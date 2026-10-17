import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Activity,
  ChevronRight,
  Phone,
  UserPlus,
} from "lucide-react-native";

import { COLORS } from "../constants/theme";
import { useSafety } from "../safety/SafetyContext";
import { formatPhone } from "../safety/phone";
import type { RootStackParamList } from "../types/navigation";

export default function SupportCircleScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    contacts,
    fallDetectionEnabled,
    setFallDetectionEnabled,
    sensorAvailable,
    simulateFall,
  } = useSafety();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading} accessibilityRole="header">
        Your Support Circle
      </Text>
      <Text style={styles.subtitle}>
        These people are texted automatically with your location if you fall or
        ask for help.
      </Text>

      {/* Contacts */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Emergency contacts
      </Text>

      {contacts.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No emergency contacts yet</Text>
          <Text style={styles.cardText}>
            Add at least one person so SafeStep can get you help.
          </Text>
        </View>
      ) : (
        contacts.map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [
              styles.card,
              styles.row,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              navigation.navigate("EmergencyContact", { contactId: c.id })
            }
            accessibilityRole="button"
            accessibilityLabel={`${c.name}${c.relationship ? `, ${c.relationship}` : ""}, ${formatPhone(c.phone)}`}
            accessibilityHint="Edit or remove this contact"
          >
            <Phone size={22} color={COLORS.green} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{c.name}</Text>
              <Text style={styles.cardText}>
                {c.relationship ? `${c.relationship} · ` : ""}
                {formatPhone(c.phone)}
              </Text>
            </View>
            <ChevronRight size={22} color={COLORS.muted} />
          </Pressable>
        ))
      )}

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate("EmergencyContact")}
        accessibilityRole="button"
        accessibilityLabel="Add emergency contact"
      >
        <UserPlus size={22} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Add emergency contact</Text>
      </Pressable>

      {/* Fall detection */}
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Fall detection
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Activity size={26} color={COLORS.cyan} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Detect falls</Text>
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
          accessibilityHint="Shows the fall alert. Tap I'm OK to cancel before it texts anyone."
          onPress={simulateFall}
        >
          <Text style={styles.secondaryButtonText}>Test fall alert</Text>
        </Pressable>
      </View>
    </ScrollView>
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
    gap: 12,
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
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
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
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    minHeight: 58,
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
