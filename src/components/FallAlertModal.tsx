import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { TriangleAlert, Check, MessageSquare } from "lucide-react-native";

import { COLORS } from "../constants/theme";
import type { SendResult } from "../safety/sendEmergencySms";

const COUNTDOWN_SECONDS = 30;
const VIBRATION_PATTERN = [0, 600, 400];

type Props = {
  visible: boolean;
  hasContacts: boolean;
  onDismiss: () => void;
  onSendHelp: () => Promise<SendResult>;
};

type Stage =
  | { kind: "countdown" }
  | { kind: "sending" }
  | { kind: "done"; result: SendResult };

function resultText(result: SendResult): string {
  if (result.ok && result.method === "automatic") {
    if (result.simulated) {
      return "Test mode: the SafeStep server isn't connected to a texting service yet, so no texts were sent.";
    }
    const n = result.sentCount;
    return `${n} emergency contact${n === 1 ? " was" : "s were"} texted with your location. Help is on the way.`;
  }
  if (result.ok) return "Your emergency message is ready. Your contacts have been asked to check on you.";
  switch (result.error) {
    case "no-contacts":
      return "No caretaker is paired yet. Pair with one in the People tab so SafeStep can text them.";
    case "sms-unavailable":
      return "This device can't send text messages.";
    case "cancelled":
      return "The message wasn't sent.";
  }
}

export default function FallAlertModal({
  visible,
  hasContacts,
  onDismiss,
  onSendHelp,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [stage, setStage] = useState<Stage>({ kind: "countdown" });
  const sendingRef = useRef(false);

  const sendNow = async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    Vibration.cancel();
    setStage({ kind: "sending" });
    const result = await onSendHelp();
    setStage({ kind: "done", result });
    AccessibilityInfo.announceForAccessibility(resultText(result));
  };

  // Reset and start alerting each time the modal opens.
  useEffect(() => {
    if (!visible) return;
    sendingRef.current = false;
    setSecondsLeft(COUNTDOWN_SECONDS);
    setStage({ kind: "countdown" });
    Vibration.vibrate(VIBRATION_PATTERN, true);
    AccessibilityInfo.announceForAccessibility(
      `Possible fall detected. Are you OK? Help will be requested in ${COUNTDOWN_SECONDS} seconds unless you tap I'm OK.`
    );
    return () => Vibration.cancel();
  }, [visible]);

  // Tick the countdown.
  useEffect(() => {
    if (!visible || stage.kind !== "countdown") return;
    if (secondsLeft <= 0) {
      sendNow();
      return;
    }
    if (secondsLeft === 10) {
      AccessibilityInfo.announceForAccessibility("10 seconds left");
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stage.kind, secondsLeft]);

  const close = () => {
    Vibration.cancel();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {stage.kind === "countdown" && (
          <>
            <View style={styles.top}>
              <TriangleAlert size={64} color={COLORS.red} />
              <Text style={styles.title} accessibilityRole="header">
                Are you OK?
              </Text>
              <Text style={styles.subtitle}>
                It looks like you may have fallen.
              </Text>
            </View>

            <View
              style={styles.countdownCircle}
              accessible
              accessibilityLabel={`${secondsLeft} seconds until help is requested`}
            >
              <Text style={styles.countdownNumber}>{secondsLeft}</Text>
              <Text style={styles.countdownLabel}>seconds</Text>
            </View>

            <Text style={styles.explainer}>
              {hasContacts
                ? "If you don't respond, SafeStep will automatically text your caretaker with your location."
                : "No caretaker is paired yet. Pair with one in the People tab."}
            </Text>

            <View style={styles.buttons}>
              <Pressable
                style={[styles.button, styles.okButton]}
                accessibilityRole="button"
                accessibilityLabel="I'm OK. Cancel the alert."
                onPress={close}
              >
                <Check size={28} color="#FFFFFF" />
                <Text style={styles.buttonText}>I'm OK</Text>
              </Pressable>

              <Pressable
                style={[styles.button, styles.helpButton]}
                accessibilityRole="button"
                accessibilityLabel="Send help now"
                onPress={sendNow}
              >
                <MessageSquare size={26} color="#FFFFFF" />
                <Text style={styles.buttonText}>Send help now</Text>
              </Pressable>
            </View>
          </>
        )}

        {stage.kind === "sending" && (
          <View style={styles.top}>
            <Text style={styles.title}>Getting help…</Text>
            <Text style={styles.subtitle}>
              Finding your location and preparing the message.
            </Text>
          </View>
        )}

        {stage.kind === "done" && (
          <>
            <View style={styles.top}>
              <Text style={styles.title} accessibilityRole="header">
                {stage.result.ok ? "Help requested" : "Message not sent"}
              </Text>
              <Text style={styles.subtitle}>{resultText(stage.result)}</Text>
            </View>

            <View style={styles.buttons}>
              {!stage.result.ok && stage.result.error === "cancelled" && (
                <Pressable
                  style={[styles.button, styles.helpButton]}
                  accessibilityRole="button"
                  onPress={() => {
                    sendingRef.current = false;
                    sendNow();
                  }}
                >
                  <MessageSquare size={26} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Try again</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.button, styles.closeButton]}
                accessibilityRole="button"
                onPress={close}
              >
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: "space-between",
    alignItems: "center",
  },
  top: {
    alignItems: "center",
    gap: 14,
  },
  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 18,
    lineHeight: 26,
    textAlign: "center",
  },
  countdownCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 6,
    borderColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownNumber: {
    color: COLORS.text,
    fontSize: 72,
    fontWeight: "800",
  },
  countdownLabel: {
    color: COLORS.muted,
    fontSize: 16,
    marginTop: -6,
  },
  explainer: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  buttons: {
    width: "100%",
    gap: 14,
  },
  button: {
    minHeight: 72,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  okButton: {
    backgroundColor: COLORS.green,
  },
  helpButton: {
    backgroundColor: COLORS.red,
  },
  closeButton: {
    backgroundColor: COLORS.surfaceLight,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
});
