import hmac
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile

from .detector import Detector, YoloDetector
from .guidance import (
    Detection,
    annotate,
    find_obstacles,
    find_target,
    obstacle_message,
    scene_message,
    target_message,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("safestep.vision")

MAX_IMAGE_BYTES = 8 * 1024 * 1024


def load_dotenv() -> None:
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dotenv()
    if getattr(app.state, "detector", None) is None:
        started = time.perf_counter()
        app.state.detector = YoloDetector()
        log.info(
            "Loaded %s in %.1fs", app.state.detector.model_name, time.perf_counter() - started
        )
    yield


app = FastAPI(title="SafeStep Vision", version="0.1.0", lifespan=lifespan)


def get_detector(request: Request) -> Detector:
    return request.app.state.detector


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("SAFESTEP_API_KEY", "")
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(401, "Invalid or missing API key.")


def to_json(d: Detection) -> dict:
    return {
        "label": d.label,
        "confidence": round(d.confidence, 3),
        "box": [round(v, 4) for v in d.box],
        "direction": d.direction,
        "distance": d.distance,
    }


def decode_image(data: bytes) -> np.ndarray:
    if not data:
        raise HTTPException(400, "Image is empty.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image is too large (max 8 MB).")
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(400, "Could not read the image. Send a JPEG or PNG.")
    return image


@app.get("/health")
def health(request: Request) -> dict:
    detector = getattr(request.app.state, "detector", None)
    return {"ok": True, "model": getattr(detector, "model_name", "custom")}


@app.post("/v1/detect", dependencies=[Depends(require_api_key)])
async def detect(
    image: UploadFile = File(...),
    target: str | None = Form(default=None),
    mode: Literal["find", "obstacles", "scene"] = Form(default="find"),
    detector: Detector = Depends(get_detector),
) -> dict:
    started = time.perf_counter()
    frame = decode_image(await image.read())
    target = (target or "").strip() or None

    if mode == "find" and not target:
        raise HTTPException(422, "Say what to find, e.g. target=keys.")

    detections = annotate(detector.detect(frame, target if mode == "find" else None))
    obstacles = find_obstacles(detections)
    found = find_target(detections, target) if mode == "find" and target else None

    if found is not None:
        obstacles = [o for o in obstacles if o is not found]

    warning = obstacle_message(obstacles)
    urgent = bool(obstacles) and obstacles[0].distance == "very close"

    if mode == "find":
        guidance = target_message(found, target)
        speech = f"{warning} {guidance}" if urgent else guidance
    elif mode == "obstacles":
        speech = warning
    else:
        speech = scene_message(detections)
        if warning:
            speech = f"{warning} {speech}"

    return {
        "mode": mode,
        "target": target,
        "found": to_json(found) if found else None,
        "obstacles": [to_json(o) for o in obstacles],
        "detections": [to_json(d) for d in detections],
        "speech": speech.strip(),
        "urgent": urgent,
        "ms": round((time.perf_counter() - started) * 1000),
    }
