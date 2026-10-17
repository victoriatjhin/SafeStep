import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { Accelerometer } from "expo-sensors";

import { FallDetector } from "./fallDetector";
import {
  EmergencyContact,
  loadContacts,
  loadFallDetectionEnabled,
  loadUserName,
  saveContacts,
  saveFallDetectionEnabled,
  saveUserName,
} from "./storage";
import {
  AlertReason,
  SendResult,
  sendEmergencyAlert,
} from "./sendEmergencySms";
import FallAlertModal from "../components/FallAlertModal";

/** 50 Hz: fast enough to catch the short free-fall dip before an impact. */
const SAMPLE_INTERVAL_MS = 20;

export type ContactInput = Omit<EmergencyContact, "id">;

type SafetyContextValue = {
  contacts: EmergencyContact[];
  addContact: (contact: ContactInput) => void;
  updateContact: (id: string, contact: ContactInput) => void;
  removeContact: (id: string) => void;

  /** The person's own name, included in alert texts. */
  userName: string;
  setUserName: (name: string) => void;

  fallDetectionEnabled: boolean;
  setFallDetectionEnabled: (enabled: boolean) => void;
  /** null while checking; false if this device has no usable accelerometer. */
  sensorAvailable: boolean | null;

  /** Alerts all contacts right away (automatic, or Messages app as backup). */
  requestHelp: () => Promise<SendResult>;
  /** Shows the "Are you OK?" countdown, as if a fall was detected. */
  simulateFall: () => void;
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
  const [fallDetectionEnabled, setEnabledState] = useState(true);
  const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active"
  );

  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const userNameRef = useRef(userName);
  userNameRef.current = userName;
  const detectorRef = useRef(new FallDetector());

  // Load saved settings once.
  useEffect(() => {
    loadContacts().then(setContacts);
    loadFallDetectionEnabled().then(setEnabledState);
    loadUserName().then(setUserNameState);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setAppActive(state === "active")
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      setSensorAvailable(false);
      return;
    }
    Accelerometer.isAvailableAsync()
      .then(setSensorAvailable)
      .catch(() => setSensorAvailable(false));
  }, []);

  // Listen to the accelerometer while the app is open and detection is on.
  // Pause while the alert is showing so one fall triggers one alert.
  useEffect(() => {
    if (!fallDetectionEnabled || !sensorAvailable || !appActive || alertVisible) {
      return;
    }

    const detector = detectorRef.current;
    detector.reset();
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);

    const subscription = Accelerometer.addListener(({ x, y, z, timestamp }) => {
      // timestamp is in seconds; fall back to the clock if it's missing.
      const t = timestamp ? timestamp * 1000 : Date.now();
      if (detector.feed({ x, y, z, t })) setAlertVisible(true);
    });

    return () => subscription.remove();
  }, [fallDetectionEnabled, sensorAvailable, appActive, alertVisible]);

  const addContact = useCallback((contact: ContactInput) => {
    setContacts((prev) => {
      const next = [
        ...prev,
        { ...contact, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      ];
      saveContacts(next);
      return next;
    });
  }, []);

  const updateContact = useCallback((id: string, contact: ContactInput) => {
    setContacts((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...contact, id } : c));
      saveContacts(next);
      return next;
    });
  }, []);

  const setUserName = useCallback((name: string) => {
    setUserNameState(name);
    saveUserName(name);
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveContacts(next);
      return next;
    });
  }, []);

  const setFallDetectionEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled);
    saveFallDetectionEnabled(enabled);
  }, []);

  const send = useCallback(
    (reason: AlertReason) =>
      sendEmergencyAlert(contactsRef.current, reason, userNameRef.current),
    []
  );

  const value = useMemo<SafetyContextValue>(
    () => ({
      contacts,
      addContact,
      updateContact,
      removeContact,
      userName,
      setUserName,
      fallDetectionEnabled,
      setFallDetectionEnabled,
      sensorAvailable,
      requestHelp: () => send("manual"),
      simulateFall: () => setAlertVisible(true),
    }),
    [
      contacts,
      addContact,
      updateContact,
      removeContact,
      userName,
      setUserName,
      fallDetectionEnabled,
      setFallDetectionEnabled,
      sensorAvailable,
      send,
    ]
  );

  return (
    <SafetyContext.Provider value={value}>
      {children}
      <FallAlertModal
        visible={alertVisible}
        hasContacts={contacts.length > 0}
        onDismiss={() => setAlertVisible(false)}
        onSendHelp={() => send("fall")}
      />
    </SafetyContext.Provider>
  );
}
