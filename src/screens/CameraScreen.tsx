
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import {
  Camera,
  Search,
  X,
  ScanSearch,
  Square,
  ShieldAlert,
  Eye,
} from "lucide-react-native";
import * as Speech from "expo-speech";
import { useNavigation } from "@react-navigation/native";

import { COLORS } from "../constants/theme";
import { pickPictureSize, useVisionGuide } from "../vision/useVisionGuide";
import { detectFrame } from "../vision/visionClient";

export default function CameraScreen() {
  const navigation = useNavigation();

  const [permission, requestPermission] =
    useCameraPermissions();

  const [targetObject, setTargetObject] = useState("");
  const [activeMode, setActiveMode] = useState<"find" | "obstacles" | null>(null);
  const [searchTarget, setSearchTarget] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const [sceneText, setSceneText] = useState<string | null>(null);
  const [describing, setDescribing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const { result, error } = useVisionGuide({
    cameraRef,
    cameraReady,
    active: activeMode !== null && !describing,
    mode: activeMode ?? "obstacles",
    target: activeMode === "find" ? searchTarget : undefined,
  });

  const handleCameraReady = async () => {
    try {
      const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
      setPictureSize(pickPictureSize(sizes ?? []));
    } catch {
      setPictureSize(undefined);
    }
    setCameraReady(true);
  };

  // Camera permissions are still loading
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  // Camera permission has not been granted
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Camera size={64} color={COLORS.cyan} />

        <Text style={styles.permissionTitle}>
          Camera access needed
        </Text>

        <Text style={styles.permissionDescription}>
          SafeStep uses your camera to help locate
          everyday objects.
        </Text>

        <Pressable
          style={styles.permissionButton}
          accessibilityRole="button"
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>
            Allow Camera Access
          </Text>
        </Pressable>
      </View>
    );
  }

  const announce = (text: string) => {
    setTimeout(() => Speech.speak(text), 150);
  };

  const isSearching = activeMode === "find";
  const isWatching = activeMode === "obstacles";

  const handleSearch = () => {
    if (isSearching) {
      setActiveMode(null);
      announce("Stopped searching.");
      return;
    }
    if (!targetObject.trim()) return;

    Keyboard.dismiss();
    setSceneText(null);
    setSearchTarget(targetObject.trim());
    setActiveMode("find");
    announce(`Looking for your ${targetObject.trim()}. Move the phone slowly.`);
  };

  const toggleObstacles = () => {
    if (isWatching) {
      setActiveMode(null);
      announce("Obstacle warnings off.");
      return;
    }
    Keyboard.dismiss();
    setSceneText(null);
    setActiveMode("obstacles");
    announce("Watching for obstacles. Point the phone ahead of you.");
  };

  const describeScene = async () => {
    if (!cameraReady || describing || !cameraRef.current) return;
    setDescribing(true);
    try {
      await Speech.stop();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.4, shutterSound: false });
      const r = await detectFrame(photo.uri, "scene");
      setSceneText(r.speech);
      Speech.speak(r.speech);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't describe the scene.";
      setSceneText(message);
      Speech.speak("Sorry, I couldn't see that. Please try again.");
    } finally {
      setDescribing(false);
    }
  };

  const statusMessage =
    error ??
    (describing
      ? "Looking around…"
      : sceneText ??
        (activeMode && result?.speech
          ? result.speech
          : isSearching
            ? `Looking for your ${searchTarget}…`
            : isWatching
              ? "Path looks clear."
              : "Enter an object name, or watch for obstacles."));

  return (
    <View style={styles.container}>
      {/* Live camera preview */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        pictureSize={pictureSize}
        animateShutter={false}
        onCameraReady={handleCameraReady}
      />

      {/* Dark overlay at the top */}
      <View style={styles.topOverlay}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.closeButton}
        >
          <X size={26} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.headerTitle}>
          Find an Object
        </Text>
      </View>

      {/* Camera guide */}
      <View
        style={styles.scanArea}
        pointerEvents="none"
      >
        <View style={styles.scanFrame}>
          <ScanSearch
            size={58}
            color="rgba(255,255,255,0.7)"
          />
        </View>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomPanel}>
        <Text style={styles.panelTitle}>
          What are you looking for?
        </Text>

        <View style={styles.inputContainer}>
          <Search size={22} color={COLORS.muted} />

          <TextInput
            style={styles.input}
            value={targetObject}
            onChangeText={setTargetObject}
            placeholder="e.g. keys, water bottle"
            placeholderTextColor={COLORS.muted}
            accessibilityLabel="Object to find"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>

        <Pressable
          style={[
            styles.searchButton,
            isSearching && styles.stopButton,
            !isSearching && !targetObject.trim() && styles.disabledButton,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isSearching ? "Stop searching" : "Start object search"}
          accessibilityState={{
            disabled: !isSearching && !targetObject.trim(),
          }}
          disabled={!isSearching && !targetObject.trim()}
          onPress={handleSearch}
        >
          {isSearching ? (
            <Square size={20} color="#FFFFFF" />
          ) : (
            <Search size={22} color="#FFFFFF" />
          )}

          <Text style={styles.buttonText}>
            {isSearching ? "Stop searching" : "Start searching"}
          </Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            style={[styles.secondaryButton, isWatching && styles.secondaryActive]}
            accessibilityRole="switch"
            accessibilityLabel="Warn me about obstacles"
            accessibilityState={{ checked: isWatching }}
            onPress={toggleObstacles}
          >
            <ShieldAlert size={20} color="#FFFFFF" />
            <Text style={styles.secondaryText}>
              {isWatching ? "Stop warnings" : "Obstacles"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryButton, describing && styles.disabledButton]}
            accessibilityRole="button"
            accessibilityLabel="Describe what's around me"
            disabled={describing}
            onPress={describeScene}
          >
            <Eye size={20} color="#FFFFFF" />
            <Text style={styles.secondaryText}>What's around?</Text>
          </Pressable>
        </View>

        <Text
          style={[styles.statusText, result?.urgent && activeMode ? styles.urgentText : null]}
          accessibilityLiveRegion="polite"
        >
          {statusMessage}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 20,
  },
  permissionTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  permissionDescription: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  topOverlay: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "rgba(9,14,23,0.75)",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  scanArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 35,
  },
  scanFrame: {
    width: "100%",
    maxWidth: 350,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "rgba(83,181,255,0.8)",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomPanel: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 18,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 56,
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 12,
    outlineStyle: "none",
  } as any,
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  stopButton: {
    backgroundColor: COLORS.red,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActive: {
    backgroundColor: COLORS.primary,
  },
  secondaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  urgentText: {
    color: COLORS.red,
    fontWeight: "700",
  },
  statusText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 16,
  },
});
