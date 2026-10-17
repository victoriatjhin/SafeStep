import AsyncStorage from "@react-native-async-storage/async-storage";

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

const CONTACTS_KEY = "safestep.emergencyContacts";
const FALL_DETECTION_KEY = "safestep.fallDetectionEnabled";

export async function loadContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveContacts(
  contacts: EmergencyContact[]
): Promise<void> {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

/** Fall detection is on unless the person has turned it off. */
export async function loadFallDetectionEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(FALL_DETECTION_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export async function saveFallDetectionEnabled(
  enabled: boolean
): Promise<void> {
  await AsyncStorage.setItem(FALL_DETECTION_KEY, String(enabled));
}
