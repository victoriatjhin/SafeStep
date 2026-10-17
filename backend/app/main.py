"""SafeStep backend: sends emergency text alerts to a user's contacts."""

import asyncio
import hmac
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request

from .config import Settings, get_settings
from .models import AlertRequest, AlertResponse, ContactResult
from .sms import build_message, send_sms

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("safestep")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient()
    settings = get_settings()
    if not settings.twilio_configured:
        log.warning("Twilio is not configured: alerts will be logged, not sent.")
    yield
    await app.state.http.aclose()


app = FastAPI(title="SafeStep API", version="0.1.0", lifespan=lifespan)


class RateLimiter:
    """Allows a few alerts per caller per time window, to stop SMS abuse."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, limit: int, window: int) -> bool:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > window:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True


rate_limiter = RateLimiter()


def get_http(request: Request) -> httpx.AsyncClient:
    return request.app.state.http


def require_api_key(
    x_api_key: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.api_key:
        # Never run an open SMS relay in production.
        if settings.twilio_configured:
            raise HTTPException(500, "Server is missing SAFESTEP_API_KEY.")
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, settings.api_key):
        raise HTTPException(401, "Invalid or missing API key.")


@app.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict:
    return {"ok": True, "sms": "twilio" if settings.twilio_configured else "simulated"}


@app.post(
    "/v1/alerts",
    response_model=AlertResponse,
    dependencies=[Depends(require_api_key)],
)
async def send_alert(
    alert: AlertRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    http: httpx.AsyncClient = Depends(get_http),
) -> AlertResponse:
    caller = request.client.host if request.client else "unknown"
    if not rate_limiter.allow(caller, settings.alerts_per_window, settings.rate_window_seconds):
        raise HTTPException(429, "Too many alerts. Please wait before trying again.")

    body = build_message(alert)

    # The same number listed twice should only get one text.
    contacts = list({c.phone: c for c in alert.contacts}.values())

    if not settings.twilio_configured:
        for c in contacts:
            log.info("[simulated SMS] to %s (%s): %s", c.name, c.phone, body)
        return AlertResponse(
            sent_count=0,
            simulated=True,
            results=[
                ContactResult(name=c.name, phone=c.phone, status="simulated")
                for c in contacts
            ],
        )

    errors = await asyncio.gather(
        *(send_sms(http, settings, c.phone, body) for c in contacts)
    )
    results = [
        ContactResult(
            name=c.name,
            phone=c.phone,
            status="failed" if err else "sent",
            error=err,
        )
        for c, err in zip(contacts, errors)
    ]
    sent = sum(r.status == "sent" for r in results)
    log.info("Alert (%s) sent to %d of %d contacts", alert.reason, sent, len(results))

    if sent == 0:
        raise HTTPException(502, "No messages could be sent.")

    return AlertResponse(sent_count=sent, simulated=False, results=results)
