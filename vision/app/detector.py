import os
import threading
from typing import Protocol

import numpy as np

from .guidance import Detection, spoken_name, target_labels


class Detector(Protocol):
    def detect(self, image: np.ndarray, target: str | None) -> list[Detection]: ...


class YoloDetector:
    def __init__(self, model_name: str | None = None, min_confidence: float = 0.35):
        from ultralytics import YOLO

        self.model_name = model_name or os.getenv("VISION_MODEL", "yolo11n.pt")
        self.min_confidence = float(os.getenv("VISION_MIN_CONFIDENCE", min_confidence))
        self.open_vocabulary = "world" in self.model_name.lower()
        self.base_classes = [
            "person", "chair", "couch", "dining table", "bed", "door", "stairs",
            "bicycle", "car", "dog", "cat", "bench", "potted plant", "trash can",
            "pole", "backpack", "handbag", "suitcase", "bottle", "cup",
            "cell phone", "laptop", "remote", "book", "keys", "wallet", "glasses",
        ]
        self._lock = threading.Lock()
        self._current_classes: list[str] | None = None

        if self.open_vocabulary:
            from ultralytics import YOLOWorld

            self.model = YOLOWorld(self.model_name)
        else:
            self.model = YOLO(self.model_name)

    def _classes_for(self, target: str | None) -> list[str]:
        classes = list(self.base_classes)
        if target:
            for name in [spoken_name(target), *target_labels(target)]:
                if name and name not in classes:
                    classes.append(name)
        return classes

    def detect(self, image: np.ndarray, target: str | None) -> list[Detection]:
        with self._lock:
            if self.open_vocabulary:
                classes = self._classes_for(target)
                if classes != self._current_classes:
                    self.model.set_classes(classes)
                    self._current_classes = classes
            result = self.model(image, conf=self.min_confidence, verbose=False)[0]

        names = result.names
        detections = []
        for box in result.boxes:
            x1, y1, x2, y2 = (float(v) for v in box.xyxyn[0].tolist())
            label = names[int(box.cls)]
            if self.open_vocabulary and target:
                if label == spoken_name(target):
                    label = target_labels(target)[0]
            detections.append(
                Detection(label=label, confidence=float(box.conf), box=(x1, y1, x2, y2))
            )
        return detections
