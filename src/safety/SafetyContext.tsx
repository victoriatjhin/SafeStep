import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  EmergencyContact,
  loadContacts,
  loadUserName,
  saveContacts,
  saveUserName,
} from "./storage";
import {
  AlertReason,
  SendResult,
  sendEmergencyAlert,
} from "./sendEmergencySms";
import { normalizePhone } from "./phone";

export type ContactInput = Omit<EmergencyContact, "id">;

type SafetyContextValue = {
  /** Who gets texted. Set this from the paired caretaker(s). */
  contacts: EmergencyContact[];
  /**
   * Replaces the contact list, e.g. after pairing:
   * setEmergencyContacts([{ name: "Jeffrey", phone: "905 736 3398" }]).
   * Numbers are converted to international format; invalid ones are dropped.
   */
  setEmergencyContacts: (contacts: ContactInput[]) => void;

  /** The patient's own name, included in alert texts. */
  userName: string;
  setUserName: (name: string) => void;

  /**
   * Texts every contact with the patient's location.
   * Use "fall" when fall detection's countdown runs out, "manual" for Get help.
   */
  sendAlert: (reason: AlertReason) => Promise<SendResult>;
};

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function useSafety(): SafetyContextValue {
  const value = useContext(SafetyContext);
  if (!value) throw new Error("useSafety must be used inside SafetyProvider");
  return value;
}

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [userName, setUserNameState] = useState("");

  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  // Load saved contacts and name once.
  useEffect(() => {
    loadContacts().then(setContacts);
    loadUserName().then(setUserNameState);
  }, []);

  const setEmergencyContacts = useCallback((input: ContactInput[]) => {
    const next: EmergencyContact[] = [];
    for (const c of input) {
      const phone = normalizePhone(c.phone);
      if (!phone || next.some((n) => n.phone === phone)) continue;
      next.push({ ...c, phone, id: phone });
    }
    setContacts(next);
    saveContacts(next);
  }, []);

  const setUserName = useCallback((name: string) => {
    setUserNameState(name);
    saveUserName(name);
  }, []);

  // Reads refs so a long-running caller (like a countdown) always uses the
  // latest contacts.
  const sendAlert = useCallback(
    (reason: AlertReason) =>
      sendEmergencyAlert(contactsRef.current, reason, userNameRef.current),
    []
  );

  const value = useMemo<SafetyContextValue>(
    () => ({ contacts, setEmergencyContacts, userName, setUserName, sendAlert }),
    [contacts, setEmergencyContacts, userName, setUserName, sendAlert]
  );

  return (
    <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>
  );
}
