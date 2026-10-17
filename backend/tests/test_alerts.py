import httpx
import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import Settings, get_settings
from app.main import app, get_http

CONTACTS = [
    {"name": "Mom", "phone": "+15195551234"},
    {"name": "Sam", "phone": "+15195559876"},
]


def make_settings(**overrides) -> Settings:
    base = dict(
        api_key="test-key",
        twilio_account_sid="AC123",
        twilio_auth_token="secret",
        twilio_from_number="+15190000000",
        twilio_messaging_service_sid="",
        alerts_per_window=5,
        rate_window_seconds=600,
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
def setup(monkeypatch):
    """Returns a function that builds a client with given settings and a fake Twilio."""
    sent: list[dict] = []
    monkeypatch.setattr(main, "rate_limiter", main.RateLimiter())

    def build(settings: Settings, twilio_status: int = 201):
        def handler(request: httpx.Request) -> httpx.Response:
            form = dict(httpx.QueryParams(request.content.decode()))
            sent.append(form)
            if twilio_status >= 400:
                return httpx.Response(twilio_status, json={"message": "invalid number"})
            return httpx.Response(201, json={"sid": "SM1"})

        fake = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        app.dependency_overrides[get_settings] = lambda: settings
        app.dependency_overrides[get_http] = lambda: fake
        return TestClient(app)

    yield build, sent
    app.dependency_overrides.clear()


def post(client, payload, key="test-key"):
    headers = {"X-API-Key": key} if key else {}
    return client.post("/v1/alerts", json=payload, headers=headers)


def test_fall_alert_texts_every_contact_with_location(setup):
    build, sent = setup
    client = build(make_settings())
    r = post(client, {
        "reason": "fall",
        "user_name": "Victoria",
        "contacts": CONTACTS,
        "location": {"latitude": 43.4723, "longitude": -80.5449},
    })
    assert r.status_code == 200
    assert r.json()["sent_count"] == 2
    assert {m["To"] for m in sent} == {"+15195551234", "+15195559876"}
    body = sent[0]["Body"]
    assert "Victoria may have fallen" in body
    assert "maps.google.com/?q=43.472300,-80.544900" in body
    assert sent[0]["From"] == "+15190000000"


def test_manual_alert_without_location(setup):
    build, sent = setup
    client = build(make_settings())
    r = post(client, {"reason": "manual", "contacts": CONTACTS[:1]})
    assert r.status_code == 200
    assert "A SafeStep user needs help" in sent[0]["Body"]
    assert "Location unavailable" in sent[0]["Body"]


def test_rejects_wrong_api_key(setup):
    build, sent = setup
    client = build(make_settings())
    assert post(client, {"reason": "fall", "contacts": CONTACTS}, key="nope").status_code == 401
    assert post(client, {"reason": "fall", "contacts": CONTACTS}, key=None).status_code == 401
    assert sent == []


def test_refuses_to_run_open_when_twilio_is_live(setup):
    build, _ = setup
    client = build(make_settings(api_key=""))
    assert post(client, {"reason": "fall", "contacts": CONTACTS}, key=None).status_code == 500


def test_rejects_bad_phone_and_empty_contacts(setup):
    build, sent = setup
    client = build(make_settings())
    bad = post(client, {"reason": "fall", "contacts": [{"name": "X", "phone": "5195551234"}]})
    assert bad.status_code == 422
    assert post(client, {"reason": "fall", "contacts": []}).status_code == 422
    assert sent == []


def test_simulates_when_twilio_not_configured(setup):
    build, sent = setup
    client = build(make_settings(twilio_account_sid="", twilio_auth_token=""))
    r = post(client, {"reason": "fall", "contacts": CONTACTS})
    assert r.status_code == 200
    assert r.json()["simulated"] is True
    assert {x["status"] for x in r.json()["results"]} == {"simulated"}
    assert sent == []


def test_all_failures_return_502(setup):
    build, _ = setup
    client = build(make_settings(), twilio_status=400)
    r = post(client, {"reason": "fall", "contacts": CONTACTS})
    assert r.status_code == 502


def test_duplicate_numbers_are_texted_once(setup):
    build, sent = setup
    client = build(make_settings())
    r = post(client, {"reason": "fall", "contacts": [CONTACTS[0], CONTACTS[0]]})
    assert r.status_code == 200
    assert len(sent) == 1


def test_rate_limit(setup):
    build, _ = setup
    client = build(make_settings(alerts_per_window=2))
    payload = {"reason": "manual", "contacts": CONTACTS[:1]}
    assert post(client, payload).status_code == 200
    assert post(client, payload).status_code == 200
    assert post(client, payload).status_code == 429


def test_uses_messaging_service_when_set(setup):
    build, sent = setup
    client = build(make_settings(twilio_from_number="", twilio_messaging_service_sid="MG1"))
    post(client, {"reason": "fall", "contacts": CONTACTS[:1]})
    assert sent[0]["MessagingServiceSid"] == "MG1"
    assert "From" not in sent[0]
