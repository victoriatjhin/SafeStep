import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CameraView } from "expo-camera";
import * as Speech from "expo-speech";

import { detectFrame, VisionMode, VisionResult } from "./visionClient";

const FRAME_GAP_MS = 600;
const REPEAT_AFTER_MS = 5000;
const PREFERRED_SIZES = ["640x480", "1280x720", "960x540", "1024x768", "1920x1080"];

export function pickPictureSize(sizes: string[]): string | undefined {
  for (const size of PREFERRED_SIZES) {
    if (sizes.includes(size)) return size;
  }
  const parsed = sizes
    .map((s) => ({ s, px: s.split("x").map(Number).reduce((a, b) => a * b, 1) }))
    .filter((p) => Number.isFinite(p.px) && p.px >= 300_000)
    .sort((a, b) => a.px - b.px);
  return parsed[0]?.s;
}

type Options = {
  cameraRef: RefObject<CameraView | null>;
  cameraReady: boolean;
  active: boolean;
  mode: Exclude<VisionMode, "scene">;
  target?: string;
};

export function useVisionGuide({ cameraRef, cameraReady, active, mode, target }: Options) {
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSpoken = useRef({ text: "", at: 0 });

  useEffect(() => {
    if (!active || !cameraReady) return;

    let cancelled = false;
    lastSpoken.current = { text: "", at: 0 };
    setError(null);

    const speak = async (r: VisionResult) => {
      const text = r.speech;
      if (!text) return;
      const now = Date.now();
      const repeat = text === lastSpoken.current.text && now - lastSpoken.current.at < REPEAT_AFTER_MS;
      if (repeat) return;
      if (r.urgent) {
        await Speech.stop();
      } else if (await Speech.isSpeakingAsync()) {
        return;
      }
      lastSpoken.current = { text, at: now };
      Speech.speak(text, { rate: 1.0 });
    };

    const loop = async () => {
      while (!cancelled) {
        const started = Date.now();
        try {
          const camera = cameraRef.current;
          if (!camera) break;
          const photo = await camera.takePictureAsync({ quality: 0.4, shutterSound: false });
          if (cancelled || !photo?.uri) break;
          const r = await detectFrame(photo.uri, mode, target);
          if (cancelled) break;
          setResult(r);
          setError(null);
          await speak(r);
        } catch (e) {
          if (cancelled) break;
          const message = e instanceof Error ? e.message : "Something went wrong.";
          setError(message);
          await new Promise((res) => setTimeout(res, 2000));
        }
        const wait = FRAME_GAP_MS - (Date.now() - started);
        if (wait > 0) await new Promise((res) => setTimeout(res, wait));
      }
    };

    loop();

    return () => {
      cancelled = true;
      Speech.stop();
    };
  }, [active, cameraReady, mode, target, cameraRef]);

  return { result, error };
}
