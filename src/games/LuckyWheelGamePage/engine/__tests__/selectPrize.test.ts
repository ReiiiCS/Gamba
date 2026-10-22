import { describe, expect, it } from "vitest";
import { LUCKY_WHEEL_CONFIG } from "../prizeConfig";
import { activeSegments, prizeProbability, selectPrize, totalWeight } from "../selectPrize";
import { cryptoRandomUnit } from "../random";
import type { PrizeSegment } from "../types";

/** Deterministic draw so the boundaries can be asserted exactly. */
function fixedDraw(value: number) {
  return () => value;
}

describe("selectPrize", () => {
  it("uses the configured weights", () => {
    const segments = activeSegments(LUCKY_WHEEL_CONFIG);
    expect(totalWeight(segments)).toBe(100);
  });

  it("selects the prize the draw lands on", () => {
    const segments = LUCKY_WHEEL_CONFIG.segments;
    // Slot 0 covers [0, 0.2), slot 1 covers [0.2, 0.35), and so on.
    expect(selectPrize(segments, fixedDraw(0)).id).toBe("seg-01");
    expect(selectPrize(segments, fixedDraw(0.19999)).id).toBe("seg-01");
    expect(selectPrize(segments, fixedDraw(0.2)).id).toBe("seg-02");
    expect(selectPrize(segments, fixedDraw(0.34999)).id).toBe("seg-02");
    expect(selectPrize(segments, fixedDraw(0.35)).id).toBe("seg-03");
    expect(selectPrize(segments, fixedDraw(0.99999)).id).toBe("seg-12");
  });

  it("never returns a disabled prize", () => {
    const segments = LUCKY_WHEEL_CONFIG.segments.map((segment) =>
      segment.id === "seg-01" ? { ...segment, enabled: false } : segment,
    );
    for (let draw = 0; draw < 1; draw += 0.001) {
      expect(selectPrize(segments, fixedDraw(draw)).id).not.toBe("seg-01");
    }
  });

  it("rejects a configuration whose weights sum to zero", () => {
    const segments: PrizeSegment[] = LUCKY_WHEEL_CONFIG.segments.map((segment) => ({
      ...segment,
      weight: 0,
    }));
    expect(() => selectPrize(segments, fixedDraw(0.5))).toThrow(/greater than zero/);
  });

  it("reports the theoretical probability of each prize", () => {
    for (const segment of LUCKY_WHEEL_CONFIG.segments) {
      expect(prizeProbability(segment, LUCKY_WHEEL_CONFIG)).toBeCloseTo(segment.weight / 100, 10);
    }
  });

  it("draws a uniform unit value from the CSPRNG", () => {
    const samples = Array.from({ length: 5000 }, () => cryptoRandomUnit());
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThan(1);
    }
    const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
    expect(average).toBeGreaterThan(0.45);
    expect(average).toBeLessThan(0.55);
  });
});
