export type VisionMode = "find" | "obstacles" | "scene";

export type VisionObject = {
  label: string;
  confidence: number;
  box: [number, number, number, number];
  direction: string;
  distance: string;
};

export type VisionResult = {
  mode: VisionMode;
  target: string | null;
  found: VisionObject | null;
  obstacles: VisionObject[];
  detections: VisionObject[];
  speech: string;
  urgent: boolean;
  ms: number;
};

const API_URL = process.env.EXPO_PUBLIC_VISION_API_URL?.replace(/\/$/, "");
const API_KEY = process.env.EXPO_PUBLIC_SAFESTEP_API_KEY ?? "";

export const visionConfigured = Boolean(API_URL);

export async function detectFrame(
  imageUri: string,
  mode: VisionMode,
  target?: string
): Promise<VisionResult> {
  if (!API_URL) {
    throw new Error("Set EXPO_PUBLIC_VISION_API_URL in .env.local to connect the vision server.");
  }

  const form = new FormData();
  form.append("image", { uri: imageUri, name: "frame.jpg", type: "image/jpeg" } as unknown as Blob);
  form.append("mode", mode);
  if (target?.trim()) form.append("target", target.trim());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(`${API_URL}/v1/detect`, {
      method: "POST",
      headers: API_KEY ? { "X-API-Key": API_KEY } : undefined,
      body: form,
      signal: controller.signal,
    });
    if (!resp.ok) {
      const detail = await resp.text();
      throw new Error(`Vision server error ${resp.status}: ${detail.slice(0, 120)}`);
    }
    return (await resp.json()) as VisionResult;
  } finally {
    clearTimeout(timer);
  }
}
