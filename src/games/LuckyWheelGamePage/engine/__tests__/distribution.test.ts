import { describe, expect, it } from "vitest";
import { LUCKY_WHEEL_CONFIG } from "../prizeConfig";
import { activeSegments, selectPrize, totalWeight } from "../selectPrize";
import { cryptoRandomUnit } from "../random";

/** Deterministic PRNG (mulberry32) so the seeded run is reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chiSquare(observed: number[], expected: number[]): number {
  return observed.reduce((sum, count, index) => {
    const difference = count - expected[index];
    return sum + (difference * difference) / expected[index];
  }, 0);
}

describe("prize distribution", () => {
  const segments = activeSegments(LUCKY_WHEEL_CONFIG);
  const total = totalWeight(segments);

  it("matches the theoretical distribution over a large seeded sample", () => {
    const sampleSize = 200_000;
    const random = seededRandom(0x5eed);
    const counts = new Array(segments.length).fill(0) as number[];

    for (let index = 0; index < sampleSize; index += 1) {
      const prize = selectPrize(LUCKY_WHEEL_CONFIG.segments, random);
      counts[segments.findIndex((segment) => segment.id === prize.id)] += 1;
    }

    const expected = segments.map((segment) => (segment.weight / total) * sampleSize);
    const statistic = chiSquare(counts, expected);

    // 11 degrees of freedom: 40 is far beyond the 99.99% quantile.
    expect(statistic).toBeLessThan(40);

    counts.forEach((count, index) => {
      const deviation = Math.abs(count - expected[index]);
      const sigma = Math.sqrt(expected[index]);
      expect(deviation).toBeLessThan(5 * sigma);
    });
  });

  it("matches the theoretical distribution when drawing from the CSPRNG", () => {
    const sampleSize = 20_000;
    const counts = new Array(segments.length).fill(0) as number[];

    for (let index = 0; index < sampleSize; index += 1) {
      const prize = selectPrize(LUCKY_WHEEL_CONFIG.segments, cryptoRandomUnit);
      counts[segments.findIndex((segment) => segment.id === prize.id)] += 1;
    }

    const expected = segments.map((segment) => (segment.weight / total) * sampleSize);
    expect(chiSquare(counts, expected)).toBeLessThan(50);
  });

  it("keeps every prize reachable", () => {
    const seen = new Set<string>();
    for (let index = 0; index < 5_000; index += 1) {
      seen.add(selectPrize(LUCKY_WHEEL_CONFIG.segments, cryptoRandomUnit).id);
    }
    expect(seen.size).toBe(segments.length);
  });
});
