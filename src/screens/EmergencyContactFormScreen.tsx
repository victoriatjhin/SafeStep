import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check, Trash2 } from "lucide-react-native";

import { COLORS } from "../constants/theme";
import { useSafety } from "../safety/SafetyContext";
import { formatPhone, normalizePhone } from "../safety/phone";
import type { RootStackParamList } from "../types/navigation";

const RELATIONSHIPS = ["Family", "Friend", "Caregiver", "Neighbour", "Other"];

type InputHandle = React.ComponentRef<typeof TextInput>;

type Errors = { userName?: string; name?: string; phone?: string };

export default function EmergencyContactFormScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "EmergencyContact">>();
  const contactId = route.params?.contactId;

  const {
    contacts,
    addContact,
    updateContact,
    removeContact,
    userName: savedUserName,
    setUserName,
  } = useSafety();

  const existing = contacts.find((c) => c.id === contactId);
  const isEditing = Boolean(existing);

  const [userName, setUserNameInput] = useState(savedUserName);
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(
    existing ? formatPhone(existing.phone) : ""
  );
  const [relationship, setRelationship] = useState(
    existing?.relationship ?? ""
  );
  const [errors, setErrors] = useState<Errors>({});

  const nameRef = useRef<InputHandle>(null);
  const phoneRef = useRef<InputHandle>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? "Edit contact" : "Add emergency contact",
    });
  }, [navigation, isEditing]);

  const save = () => {
    const next: Errors = {};
    const normalized = normalizePhone(phone);

    if (!userName.trim()) next.userName = "Enter your name so contacts know who needs help.";
    if (!name.trim()) next.name = "Enter the contact's name.";
    if (!normalized) {
      next.phone = "Enter a full phone number with area code, like 519 555 1234.";
    } else if (contacts.some((c) => c.phone === normalized && c.id !== contactId)) {
      next.phone = "This number is already one of your contacts.";
    }

    setErrors(next);
    const firstError = next.userName ?? next.name ?? next.phone;
    if (firstError) {
      AccessibilityInfo.announceForAccessibility(firstError);
      return;
    }

    setUserName(userName.trim());
    const contact = {
      name: name.trim(),
      phone: normalized!,
      ...(relationship ? { relationship } : {}),
    };
    if (existing) updateContact(existing.id, contact);
    else addContact(contact);

    AccessibilityInfo.announceForAccessibility(
      `${contact.name} saved as an emergency contact.`
    );
    navigation.goBack();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(
      "Remove contact?",
      `${existing.name} will no longer get emergency alerts.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeContact(existing.id);
            navigation.goBack();
          },
        },
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
        <Text style={styles.intro}>
          If you fall or ask for help, SafeStep automatically texts this person
          with your location.
        </Text>

        {/* About you */}
        <Text style={styles.section} accessibilityRole="header">
          About you
        </Text>
        <Field
          label="Your name"
          value={userName}
          onChangeText={setUserNameInput}
          placeholder="e.g. Victoria"
          error={errors.userName}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          onSubmitEditing={() => nameRef.current?.focus()}
        />

        {/* Contact */}
        <Text style={styles.section} accessibilityRole="header">
          Emergency contact
        </Text>
        <Field
          inputRef={nameRef}
          label="Contact's name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Mom"
          error={errors.name}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <Field
          inputRef={phoneRef}
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 519 555 1234"
          hint="Must be able to receive texts. Add + and country code for numbers outside Canada and the US."
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />

        <Text style={styles.label}>Relationship (optional)</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {RELATIONSHIPS.map((r) => {
            const selected = relationship === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRelationship(selected ? "" : r)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={r}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={styles.saveButton}
          onPress={save}
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Save changes" : "Save emergency contact"}
        >
          <Check size={24} color="#FFFFFF" />
          <Text style={styles.saveText}>
            {isEditing ? "Save changes" : "Save contact"}
          </Text>
        </Pressable>

        {isEditing && (
          <Pressable
            style={styles.removeButton}
            onPress={remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${existing!.name}`}
          >
            <Trash2 size={20} color={COLORS.red} />
            <Text style={styles.removeText}>Remove contact</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  hint?: string;
  error?: string;
  inputRef?: React.Ref<InputHandle>;
};

function Field({ label, hint, error, inputRef, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor={COLORS.muted}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...input}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
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
    paddingTop: 12,
    paddingBottom: 48,
  },
  intro: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 8,
  },
  section: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "700",
    marginTop: 22,
    marginBottom: 6,
  },
  field: {
    marginTop: 12,
  },
  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    color: COLORS.text,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 16,
    minHeight: 58,
    fontSize: 18,
  },
  inputError: {
    borderColor: COLORS.red,
  },
  hint: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  error: {
    color: COLORS.red,
    fontSize: 14,
    marginTop: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    minHeight: 46,
    justifyContent: "center",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 15,
  },
  chipTextSelected: {
    fontWeight: "700",
  },
  saveButton: {
    marginTop: 34,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  removeButton: {
    marginTop: 14,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  removeText: {
    color: COLORS.red,
    fontSize: 16,
    fontWeight: "600",
  },
});
