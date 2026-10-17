
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AppNavigator from "./src/navigation/AppNavigator";
import { SafetyProvider } from "./src/safety/SafetyContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafetyProvider>
        <AppNavigator />
      </SafetyProvider>
    </SafeAreaProvider>
  );
}
