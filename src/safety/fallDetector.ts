/**
 * Fall detection from accelerometer samples (in g).
 *
 * A typical fall shows three phases:
 *   1. Free fall  – total acceleration drops well below 1 g.
 *   2. Impact     – a sharp spike well above 1 g shortly after.
 *   3. Stillness  – the person lies still, so readings settle near 1 g.
 *
 * Requiring all three keeps false alarms (sitting down hard, dropping the
 * phone on a table, walking) low. A very hard impact on its own also counts,
 * as long as stillness follows, because some falls have little free fall.
 *
 * This file has no React Native imports so it can be unit tested in Node.
 */

export type AccelSample = {
  x: number;
  y: number;
  z: number;
  /** Milliseconds. */
  t: number;
};

export type FallDetectorConfig = {
  /** Magnitude below this counts as free fall (g). */
  freeFallThreshold: number;
  /** Free fall must last at least this long (ms). */
  minFreeFallMs: number;
  /** After free fall ends, an impact must follow within this window (ms). */
  impactWindowMs: number;
  /** Magnitude above this after free fall counts as impact (g). */
  impactThreshold: number;
  /** Magnitude above this counts as impact even without free fall (g). */
  hardImpactThreshold: number;
  /** Ignore motion for this long right after impact while things settle (ms). */
  settleMs: number;
  /** How long to watch for stillness after settling (ms). */
  stillnessWindowMs: number;
  /** A sample is "still" when |magnitude - 1 g| is below this (g). */
  stillnessTolerance: number;
  /** Fraction of samples in the window that must be still. */
  stillnessRatio: number;
  /** Ignore new events for this long after a detected fall (ms). */
  cooldownMs: number;
};

export const DEFAULT_FALL_CONFIG: FallDetectorConfig = {
  freeFallThreshold: 0.5,
  minFreeFallMs: 60,
  impactWindowMs: 1000,
  impactThreshold: 2.5,
  hardImpactThreshold: 3.5,
  settleMs: 800,
  stillnessWindowMs: 2000,
  stillnessTolerance: 0.3,
  stillnessRatio: 0.8,
  cooldownMs: 15000,
};

type Phase =
  | { kind: "idle" }
  | { kind: "freeFall"; start: number }
  | { kind: "awaitImpact"; freeFallEnd: number }
  | { kind: "postImpact"; impactAt: number; still: number; total: number }
  | { kind: "cooldown"; until: number };

export function magnitude(s: { x: number; y: number; z: number }): number {
  return Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
}

export class FallDetector {
  private phase: Phase = { kind: "idle" };
  private readonly config: FallDetectorConfig;

  constructor(config: Partial<FallDetectorConfig> = {}) {
    this.config = { ...DEFAULT_FALL_CONFIG, ...config };
  }

  reset(): void {
    this.phase = { kind: "idle" };
  }

  /** Feed one sample. Returns true exactly once per detected fall. */
  feed(sample: AccelSample): boolean {
    const c = this.config;
    const mag = magnitude(sample);
    const t = sample.t;
    const p = this.phase;

    switch (p.kind) {
      case "cooldown":
        if (t >= p.until) this.phase = { kind: "idle" };
        return false;

      case "idle":
        if (mag < c.freeFallThreshold) {
          this.phase = { kind: "freeFall", start: t };
        } else if (mag > c.hardImpactThreshold) {
          this.startPostImpact(t);
        }
        return false;

      case "freeFall":
        if (mag < c.freeFallThreshold) return false;
        if (t - p.start >= c.minFreeFallMs) {
          // Free fall long enough; the impact may be this very sample.
          if (mag > c.impactThreshold) {
            this.startPostImpact(t);
          } else {
            this.phase = { kind: "awaitImpact", freeFallEnd: t };
          }
        } else {
          this.phase = { kind: "idle" };
        }
        return false;

      case "awaitImpact":
        if (mag > c.impactThreshold) {
          this.startPostImpact(t);
        } else if (t - p.freeFallEnd > c.impactWindowMs) {
          this.phase = { kind: "idle" };
        }
        return false;

      case "postImpact": {
        const elapsed = t - p.impactAt;
        if (elapsed < c.settleMs) return false;

        if (elapsed <= c.settleMs + c.stillnessWindowMs) {
          p.total += 1;
          if (Math.abs(mag - 1) < c.stillnessTolerance) p.still += 1;
          return false;
        }

        const isStill = p.total > 0 && p.still / p.total >= c.stillnessRatio;
        if (isStill) {
          this.phase = { kind: "cooldown", until: t + c.cooldownMs };
          return true;
        }
        this.phase = { kind: "idle" };
        return false;
      }
    }
  }

  private startPostImpact(t: number): void {
    this.phase = { kind: "postImpact", impactAt: t, still: 0, total: 0 };
  }
}
