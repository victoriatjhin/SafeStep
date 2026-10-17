import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Activity, Phone, Trash2, UserPlus } from "lucide-react-native";

import { COLORS } from "../constants/theme";
import { useSafety } from "../safety/SafetyContext";

/** Loose check: at least 7 digits, optional leading +, common separators. */
function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim();
  return /^\+?[\d\s().-]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 7;
}

export default function SupportCircleScreen() {
  const {
    contacts,
    addContact,
    removeContact,
    fallDetectionEnabled,
    setFallDetectionEnabled,
    sensorAvailable,
    simulateFall,
  } = useSafety();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Enter a valid phone number, including area code.");
      return;
    }
    addContact(name, phone);
    setName("");
    setPhone("");
    setError(null);
  };

  const confirmRemove = (id: string, contactName: string) => {
    Alert.alert(
      "Remove contact?",
      `${contactName} will no longer get emergency texts.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeContact(id) },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading} accessibilityRole="header">
          Your Support Circle
        </Text>
        <Text style={styles.subtitle}>
          These people get a text with your location if you fall or ask for help.
        </Text>

        {/* Fall detection */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Activity size={26} color={COLORS.cyan} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Fall detection</Text>
              <Text style={styles.cardText}>
                {sensorAvailable === false
                  ? "Not available on this device."
                  : "Works while SafeStep is open."}
              </Text>
            </View>
            <Switch
              value={fallDetectionEnabled && sensorAvailable !== false}
              onValueChange={setFallDetectionEnabled}
              disabled={sensorAvailable === false}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              accessibilityLabel="Fall detection"
            />
          </View>

          <Pressable
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityHint="Shows the fall alert so you can try it out"
            onPress={simulateFall}
          >
            <Text style={styles.secondaryButtonText}>Test fall alert</Text>
          </Pressable>
        </View>

        {/* Contacts */}
        <Text style={styles.sectionTitle}>Emergency contacts</Text>

        {contacts.length === 0 ? (
          <Text style={styles.empty}>No contacts yet. Add one below.</Text>
        ) : (
          contacts.map((c) => (
            <View key={c.id} style={[styles.card, styles.row]}>
              <Phone size={22} color={COLORS.green} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{c.name}</Text>
                <Text style={styles.cardText}>{c.phone}</Text>
              </View>
              <Pressable
                onPress={() => confirmRemove(c.id, c.name)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${c.name}`}
                hitSlop={12}
              >
                <Trash2 size={22} color={COLORS.red} />
              </Pressable>
            </View>
          ))
        )}

        {/* Add contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a contact</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={COLORS.muted}
            accessibilityLabel="Contact name"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor={COLORS.muted}
            accessibilityLabel="Contact phone number"
            keyboardType="phone-pad"
            onSubmitEditing={handleAdd}
          />
          {error && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}
          <Pressable
            style={styles.primaryButton}
            accessibilityRole="button"
            onPress={handleAdd}
          >
            <UserPlus size={22} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Add contact</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 40,
    gap: 14,
  },
  heading: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 6,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 10,
  },
  empty: {
    color: COLORS.muted,
    fontSize: 15,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "600",
  },
  cardText: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 2,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 54,
    fontSize: 16,
  },
  error: {
    color: COLORS.red,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
