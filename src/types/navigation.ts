
import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  Home: undefined;
  People: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  Listening: undefined;
  Camera: undefined;
  Found: undefined;
  Awareness: undefined;
  Help: undefined;
  /** Without a contactId the form adds a new contact. */
  EmergencyContact: { contactId?: string } | undefined;
};
