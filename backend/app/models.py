"""Request and response shapes for the alerts API."""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(description="International format, e.g. +15195551234")

    @field_validator("phone")
    @classmethod
    def phone_is_e164(cls, v: str) -> str:
        v = v.strip()
        if not E164.match(v):
            raise ValueError("phone must be in international format, e.g. +15195551234")
        return v


class Location(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0)


class AlertRequest(BaseModel):
    reason: Literal["fall", "manual"]
    user_name: str | None = Field(default=None, max_length=80)
    contacts: list[Contact] = Field(min_length=1, max_length=10)
    location: Location | None = None


class ContactResult(BaseModel):
    name: str
    phone: str
    status: Literal["sent", "failed", "simulated"]
    error: str | None = None


class AlertResponse(BaseModel):
    sent_count: int
    simulated: bool
    results: list[ContactResult]
