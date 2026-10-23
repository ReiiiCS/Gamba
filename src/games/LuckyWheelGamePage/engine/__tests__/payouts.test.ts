import { describe, expect, it } from "vitest";
import { formatMultiplier, payoutFor, prizeMultiplier } from "../payouts";
import { LUCKY_WHEEL_CONFIG } from "../prizeConfig";
import type { PrizeConfig, PrizeSegment } from "../types";

const config = LUCKY_WHEEL_CONFIG;

function segment(prize: number, type: PrizeSegment["type"] = "chips"): PrizeSegment {
  return {
    id: "seg-test",
    index: 0,
    label: String(prize),
    prize,
    weight: 1,
    type,
    rarity: "common",
    color: "#000000",
    enabled: true,
  };
}

describe("prizeMultiplier", () => {
  it("quotes chip prizes against the default stake", () => {
    expect(prizeMultiplier(segment(0), config)).toBe(0);
    expect(prizeMultiplier(segment(5), config)).toBeCloseTo(0.2, 10);
    expect(prizeMultiplier(segment(25), config)).toBe(1);
    expect(prizeMultiplier(segment(250), config)).toBe(10);
  });

  it("uses multiplier prizes as they are written", () => {
    expect(prizeMultiplier(segment(3, "multiplier"), config)).toBe(3);
  });

  it("is safe for a degenerate configuration", () => {
    const broken: PrizeConfig = { ...config, stake: 0 };
    expect(prizeMultiplier(segment(50), broken)).toBe(0);
  });
});

describe("payoutFor", () => {
  it("scales every shipped prize to whole chips at every stake", () => {
    for (const stake of config.stakes) {
      for (const prize of config.segments) {
        const payout = payoutFor(prize, config, stake);
        expect(Number.isInteger(payout)).toBe(true);
        expect(payout).toBe((prize.prize / config.stake) * stake);
      }
    }
  });

  it("pays multiplier prizes the stake times the multiplier", () => {
    for (const stake of config.stakes) {
      expect(payoutFor(segment(3, "multiplier"), config, stake)).toBe(stake * 3);
    }
  });
});

describe("formatMultiplier", () => {
  it("drops the decimal for whole multipliers", () => {
    expect(formatMultiplier(0)).toBe("0×");
    expect(formatMultiplier(1)).toBe("1×");
    expect(formatMultiplier(10)).toBe("10×");
  });

  it("keeps one decimal for fractional multipliers", () => {
    expect(formatMultiplier(0.2)).toBe("0.2×");
    expect(formatMultiplier(1.6)).toBe("1.6×");
  });
});
