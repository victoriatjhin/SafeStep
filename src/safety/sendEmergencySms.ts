import * as SMS from "expo-sms";
import * as Location from "expo-location";

import type { EmergencyContact } from "./storage";

export type AlertReason = "fall" | "manual";

export type SendResult =
  | { ok: true; status: "sent" | "unknown" }
  | { ok: false; error: "no-contacts" | "sms-unavailable" | "cancelled" };

/** Best-effort location: quick cached fix first, then a fresh one with a timeout. */
async function getLocationLink(): Promise<string | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;

    let position = await Location.getLastKnownPositionAsync({
      maxAge: 2 * 60 * 1000,
      requiredAccuracy: 200,
    });

    if (!position) {
      position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
    }

    if (!position) return null;
    const { latitude, longitude } = position.coords;
    return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  } catch {
    return null;
  }
}

export function buildMessage(
  reason: AlertReason,
  locationLink: string | null
): string {
  const opening =
    reason === "fall"
      ? "SafeStep alert: a possible fall was detected and I didn't respond. Please check on me."
      : "SafeStep alert: I need help. Please contact me as soon as you can.";

  const where = locationLink
    ? `My location: ${locationLink}`
    : "My location couldn't be determined.";

  return `${opening}\n${where}`;
}

/**
 * Opens the phone's SMS composer with every emergency contact and the
 * message filled in. Phones don't let apps send texts silently, so the
 * person (or someone nearby) still has to tap Send.
 */
export async function sendEmergencySms(
  contacts: EmergencyContact[],
  reason: AlertReason
): Promise<SendResult> {
  if (contacts.length === 0) return { ok: false, error: "no-contacts" };

  const available = await SMS.isAvailableAsync();
  if (!available) return { ok: false, error: "sms-unavailable" };

  const link = await getLocationLink();
  const { result } = await SMS.sendSMSAsync(
    contacts.map((c) => c.phone),
    buildMessage(reason, link)
  );

  if (result === "cancelled") return { ok: false, error: "cancelled" };
  return { ok: true, status: result };
}
