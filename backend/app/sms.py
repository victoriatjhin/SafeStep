"""Building alert messages and sending them through Twilio."""

import logging

import httpx

from .config import Settings
from .models import AlertRequest

log = logging.getLogger("safestep.sms")

TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


def build_message(alert: AlertRequest) -> str:
    who = (alert.user_name or "").strip() or "A SafeStep user"

    if alert.reason == "fall":
        opening = (
            f"SafeStep alert: {who} may have fallen and did not respond. "
            "Please check on them now."
        )
    else:
        opening = f"SafeStep alert: {who} needs help. Please contact them as soon as you can."

    if alert.location:
        lat, lng = alert.location.latitude, alert.location.longitude
        where = f"Location: https://maps.google.com/?q={lat:.6f},{lng:.6f}"
    else:
        where = "Location unavailable."

    return f"{opening}\n{where}"


async def send_sms(
    client: httpx.AsyncClient, settings: Settings, to: str, body: str
) -> str | None:
    """Sends one text. Returns None on success or an error message."""
    data = {"To": to, "Body": body}
    if settings.twilio_messaging_service_sid:
        data["MessagingServiceSid"] = settings.twilio_messaging_service_sid
    else:
        data["From"] = settings.twilio_from_number

    try:
        resp = await client.post(
            TWILIO_URL.format(sid=settings.twilio_account_sid),
            data=data,
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            timeout=15,
        )
    except httpx.HTTPError as exc:
        log.warning("Twilio request to %s failed: %s", to, exc)
        return "Could not reach the SMS provider."

    if resp.status_code >= 400:
        try:
            detail = resp.json().get("message", resp.text)
        except ValueError:
            detail = resp.text
        log.warning("Twilio rejected message to %s: %s", to, detail)
        return str(detail)[:200]

    return None
