from dataclasses import dataclass, field

SYNONYMS: dict[str, list[str]] = {
    "phone": ["cell phone"],
    "cellphone": ["cell phone"],
    "mobile": ["cell phone"],
    "iphone": ["cell phone"],
    "water bottle": ["bottle"],
    "mug": ["cup"],
    "glass": ["wine glass", "cup"],
    "computer": ["laptop"],
    "remote control": ["remote"],
    "tv remote": ["remote"],
    "television": ["tv"],
    "bag": ["backpack", "handbag", "suitcase"],
    "purse": ["handbag"],
    "luggage": ["suitcase"],
    "sofa": ["couch"],
    "table": ["dining table"],
    "desk": ["dining table"],
    "plant": ["potted plant"],
    "toilet": ["toilet"],
    "fridge": ["refrigerator"],
    "door": [],
    "people": ["person"],
    "someone": ["person"],
    "bike": ["bicycle"],
    "dog": ["dog"],
    "cat": ["cat"],
}

OBSTACLE_CLASSES = {
    "person", "bicycle", "car", "motorcycle", "bus", "truck", "fire hydrant",
    "stop sign", "parking meter", "bench", "dog", "cat", "horse", "cow",
    "chair", "couch", "potted plant", "bed", "dining table", "toilet",
    "suitcase", "backpack", "refrigerator", "oven", "sink", "tv", "train",
    "skateboard", "umbrella", "bird", "sheep", "elephant", "bear",
}

ARTICLE_EXCEPTIONS = {"keys", "glasses", "scissors", "headphones"}


@dataclass
class Detection:
    label: str
    confidence: float
    box: tuple[float, float, float, float]
    direction: str = ""
    distance: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def center_x(self) -> float:
        return (self.box[0] + self.box[2]) / 2

    @property
    def width(self) -> float:
        return self.box[2] - self.box[0]

    @property
    def height(self) -> float:
        return self.box[3] - self.box[1]

    @property
    def area(self) -> float:
        return self.width * self.height


def direction_of(d: Detection) -> str:
    x = d.center_x
    if x < 0.2:
        return "to your left"
    if x < 0.4:
        return "slightly to your left"
    if x <= 0.6:
        return "straight ahead"
    if x <= 0.8:
        return "slightly to your right"
    return "to your right"


def distance_of(d: Detection) -> str:
    size = max(d.area, d.height * d.height * 0.5)
    if size > 0.35 or d.box[3] > 0.95 and d.height > 0.5:
        return "very close"
    if size > 0.12:
        return "close"
    if size > 0.03:
        return "a few steps away"
    return "far away"


def annotate(detections: list[Detection]) -> list[Detection]:
    for d in detections:
        d.direction = direction_of(d)
        d.distance = distance_of(d)
    return detections


def target_labels(target: str) -> list[str]:
    t = target.strip().lower()
    for prefix in ("my ", "the ", "a ", "an "):
        if t.startswith(prefix):
            t = t[len(prefix):]
    if t in SYNONYMS:
        return SYNONYMS[t] or [t]
    if t.endswith("s") and t[:-1] in SYNONYMS:
        return SYNONYMS[t[:-1]] or [t[:-1]]
    if t.endswith("s") and t not in ARTICLE_EXCEPTIONS:
        return [t, t[:-1]]
    return [t]


def spoken_name(target: str) -> str:
    t = target.strip().lower()
    for prefix in ("my ", "the ", "a ", "an "):
        if t.startswith(prefix):
            t = t[len(prefix):]
    return t


def find_target(detections: list[Detection], target: str) -> Detection | None:
    wanted = set(target_labels(target))
    matches = [d for d in detections if d.label in wanted]
    if not matches:
        return None
    return max(matches, key=lambda d: (d.confidence, d.area))


def target_message(found: Detection | None, target: str) -> str:
    name = spoken_name(target)
    plural = name.endswith("s") and not name.endswith("ss")
    verb = "are" if plural else "is"
    if found is not None and found.label == "person":
        if found.direction == "straight ahead":
            return f"Someone is straight ahead, {found.distance}."
        return f"Someone is {found.direction}, {found.distance}."
    if found is None:
        if target_labels(target) == ["person"]:
            return "I don't see anyone yet. Slowly turn around."
        return f"I don't see your {name} yet. Slowly turn around."
    if found.distance == "very close" and found.direction == "straight ahead":
        return f"Your {name} {verb} right in front of you, within reach."
    if found.direction == "straight ahead":
        return f"Your {name} {verb} straight ahead, {found.distance}."
    return f"Your {name} {verb} {found.direction}, {found.distance}."


def in_path(d: Detection) -> bool:
    return d.box[2] > 0.25 and d.box[0] < 0.75


def find_obstacles(detections: list[Detection]) -> list[Detection]:
    hits = [
        d for d in detections
        if d.label in OBSTACLE_CLASSES
        and in_path(d)
        and d.distance in ("very close", "close")
    ]
    order = {"very close": 0, "close": 1}
    return sorted(hits, key=lambda d: (order[d.distance], -d.area))


def obstacle_message(obstacles: list[Detection]) -> str:
    if not obstacles:
        return ""
    first = obstacles[0]
    name = "a person" if first.label == "person" else f"a {first.label}"
    if first.distance == "very close":
        lead = "Stop."
        where = "right in front of you" if first.direction == "straight ahead" else first.direction
        msg = f"{lead} {name.capitalize()} is {where}."
    else:
        msg = f"Careful, {name} is {first.direction}."
    if len(obstacles) > 1:
        msg += f" {len(obstacles) - 1} more ahead."
    return msg


def scene_message(detections: list[Detection]) -> str:
    if not detections:
        return "I don't see any objects I recognize."
    counts: dict[str, int] = {}
    for d in detections:
        counts[d.label] = counts.get(d.label, 0) + 1
    parts = []
    for label, n in sorted(counts.items(), key=lambda kv: -kv[1])[:5]:
        if n == 1:
            parts.append(f"a {label}")
        elif label == "person":
            parts.append(f"{n} people")
        else:
            parts.append(f"{n} {label}s")
    if len(parts) == 1:
        return f"I see {parts[0]}."
    return "I see " + ", ".join(parts[:-1]) + f" and {parts[-1]}."
