import AsyncStorage from "@react-native-async-storage/async-storage";

export type EmergencyContact = {
  id: string;
  name: string;
  /** International format, e.g. +15195551234. */
  phone: string;
  relationship?: string;
};

const CONTACTS_KEY = "safestep.emergencyContacts";
const USER_NAME_KEY = "safestep.userName";

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

/** The person's own name, so alerts say who needs help. */
export async function loadUserName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(USER_NAME_KEY)) ?? "";
  } catch {
    return "";
  }
}

export async function saveUserName(name: string): Promise<void> {
  await AsyncStorage.setItem(USER_NAME_KEY, name);
}
