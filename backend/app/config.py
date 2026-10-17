"""Settings read from environment variables (or a .env file)."""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _load_dotenv() -> None:
    """Minimal .env loader so local development needs no extra package."""
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    api_key: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_from_number: str
    twilio_messaging_service_sid: str
    alerts_per_window: int
    rate_window_seconds: int

    @property
    def twilio_configured(self) -> bool:
        return bool(
            self.twilio_account_sid
            and self.twilio_auth_token
            and (self.twilio_from_number or self.twilio_messaging_service_sid)
        )


@lru_cache
def get_settings() -> Settings:
    _load_dotenv()
    return Settings(
        api_key=os.getenv("SAFESTEP_API_KEY", ""),
        twilio_account_sid=os.getenv("TWILIO_ACCOUNT_SID", ""),
        twilio_auth_token=os.getenv("TWILIO_AUTH_TOKEN", ""),
        twilio_from_number=os.getenv("TWILIO_FROM_NUMBER", ""),
        twilio_messaging_service_sid=os.getenv("TWILIO_MESSAGING_SERVICE_SID", ""),
        alerts_per_window=int(os.getenv("ALERTS_PER_WINDOW", "5")),
        rate_window_seconds=int(os.getenv("RATE_WINDOW_SECONDS", "600")),
    )
