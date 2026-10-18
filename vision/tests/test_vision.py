import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.guidance import (
    Detection,
    annotate,
    find_obstacles,
    find_target,
    obstacle_message,
    scene_message,
    target_labels,
    target_message,
)
from app.main import app


def det(label, box, conf=0.9):
    return Detection(label=label, confidence=conf, box=box)


def jpeg_bytes():
    ok, buf = cv2.imencode(".jpg", np.zeros((64, 64, 3), np.uint8))
    assert ok
    return buf.tobytes()


class FakeDetector:
    model_name = "fake"

    def __init__(self, detections):
        self.detections = detections
        self.calls = []

    def detect(self, image, target):
        self.calls.append(target)
        return [Detection(d.label, d.confidence, d.box) for d in self.detections]


@pytest.fixture
def client_with(monkeypatch):
    def build(detections, api_key=""):
        monkeypatch.setenv("SAFESTEP_API_KEY", api_key)
        fake = FakeDetector(detections)
        app.state.detector = fake
        return TestClient(app), fake

    yield build
    app.state.detector = None


def post(client, mode="find", target=None, key=None, data=None):
    form = {"mode": mode}
    if target is not None:
        form["target"] = target
    headers = {"X-API-Key": key} if key else {}
    return client.post(
        "/v1/detect",
        files={"image": ("frame.jpg", data if data is not None else jpeg_bytes(), "image/jpeg")},
        data=form,
        headers=headers,
    )


def test_direction_and_distance():
    left_far, ahead_close, right_near = annotate([
        det("cup", (0.02, 0.4, 0.1, 0.48)),
        det("chair", (0.4, 0.3, 0.65, 0.9)),
        det("person", (0.7, 0.0, 1.0, 1.0)),
    ])
    assert (left_far.direction, left_far.distance) == ("to your left", "far away")
    assert (ahead_close.direction, ahead_close.distance) == ("straight ahead", "close")
    assert (right_near.direction, right_near.distance) == ("to your right", "very close")


def test_synonyms_map_to_yolo_labels():
    assert target_labels("my phone") == ["cell phone"]
    assert target_labels("water bottle") == ["bottle"]
    assert target_labels("the mug") == ["cup"]
    assert target_labels("keys") == ["keys"]
    assert target_labels("bottles") == ["bottle"] or "bottle" in target_labels("bottles")


def test_find_target_and_message():
    detections = annotate([
        det("cell phone", (0.7, 0.5, 0.8, 0.6), conf=0.8),
        det("cup", (0.45, 0.4, 0.55, 0.5)),
    ])
    found = find_target(detections, "my phone")
    assert found.label == "cell phone"
    assert target_message(found, "my phone") == "Your phone is slightly to your right, far away."
    assert target_message(None, "keys") == "I don't see your keys yet. Slowly turn around."


def test_person_target_wording():
    found = annotate([det("person", (0.85, 0.3, 0.95, 0.6))])[0]
    assert target_message(found, "someone") == "Someone is to your right, a few steps away."
    assert target_message(None, "someone") == "I don't see anyone yet. Slowly turn around."


def test_within_reach_message():
    found = annotate([det("bottle", (0.3, 0.2, 0.7, 1.0))])[0]
    assert target_message(found, "water bottle") == "Your water bottle is right in front of you, within reach."


def test_obstacles_only_in_path_and_near():
    detections = annotate([
        det("person", (0.35, 0.0, 0.7, 1.0)),
        det("chair", (0.0, 0.5, 0.15, 0.8)),
        det("dog", (0.45, 0.6, 0.55, 0.7)),
        det("cup", (0.4, 0.3, 0.7, 0.9)),
    ])
    obstacles = find_obstacles(detections)
    assert [o.label for o in obstacles] == ["person"]
    assert obstacle_message(obstacles) == "Stop. A person is right in front of you."


def test_scene_message():
    detections = [det("person", (0, 0, 1, 1)), det("person", (0, 0, 1, 1)), det("chair", (0, 0, 1, 1))]
    assert scene_message(detections) == "I see 2 people and a chair."
    assert scene_message([]) == "I don't see any objects I recognize."


def test_api_find_speaks_guidance(client_with):
    client, fake = client_with([det("cell phone", (0.1, 0.4, 0.2, 0.5))])
    r = post(client, target="phone")
    body = r.json()
    assert r.status_code == 200
    assert body["found"]["label"] == "cell phone"
    assert body["speech"] == "Your phone is to your left, far away."
    assert fake.calls == ["phone"]


def test_api_urgent_obstacle_comes_first(client_with):
    client, _ = client_with([det("person", (0.3, 0.0, 0.7, 1.0))])
    body = post(client, target="keys").json()
    assert body["urgent"] is True
    assert body["speech"].startswith("Stop. A person is right in front of you.")
    assert body["speech"].endswith("I don't see your keys yet. Slowly turn around.")


def test_api_obstacles_mode_is_quiet_when_clear(client_with):
    client, _ = client_with([det("cup", (0.45, 0.4, 0.55, 0.5))])
    body = post(client, mode="obstacles").json()
    assert body["speech"] == ""
    assert body["obstacles"] == []


def test_api_scene_mode(client_with):
    client, _ = client_with([det("chair", (0.0, 0.0, 0.1, 0.1))])
    assert post(client, mode="scene").json()["speech"] == "I see a chair."


def test_api_validation(client_with):
    client, _ = client_with([])
    assert post(client, mode="find").status_code == 422
    assert post(client, mode="find", target="keys", data=b"not an image").status_code == 400
    assert post(client, mode="nope").status_code == 422


def test_api_key(client_with):
    client, _ = client_with([], api_key="secret")
    assert post(client, mode="scene").status_code == 401
    assert post(client, mode="scene", key="secret").status_code == 200


@pytest.mark.skipif(
    pytest.importorskip("ultralytics", reason="ultralytics not installed") is None,
    reason="ultralytics not installed",
)
def test_real_yolo_on_sample_photo():
    import ultralytics

    from app.detector import YoloDetector

    image = cv2.imread(str(ultralytics.ASSETS / "bus.jpg"))
    detections = annotate(YoloDetector("yolo11n.pt").detect(image, None))
    labels = {d.label for d in detections}
    assert {"bus", "person"} <= labels
    obstacles = find_obstacles(detections)
    assert obstacles and obstacles[0].label in {"bus", "person"}
    assert obstacle_message(obstacles).startswith(("Stop.", "Careful"))
