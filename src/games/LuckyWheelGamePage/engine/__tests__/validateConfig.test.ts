import { describe, expect, it } from "vitest";
import { LUCKY_WHEEL_CONFIG } from "../prizeConfig";
import {
  collectPrizeConfigIssues,
  collectSpinRecordIssues,
  validatePrizeConfig,
  validateSpinRecord,
} from "../validateConfig";
import type { PrizeConfig, PrizeSegment, SpinRecord } from "../types";

function cloneConfig(): PrizeConfig {
  return {
    ...LUCKY_WHEEL_CONFIG,
    segments: LUCKY_WHEEL_CONFIG.segments.map((segment) => ({ ...segment })),
  };
}

function patchSegment(config: PrizeConfig, id: string, patch: Partial<PrizeSegment>): PrizeConfig {
  return {
    ...config,
    segments: config.segments.map((segment) =>
      segment.id === id ? { ...segment, ...patch } : { ...segment },
    ),
  };
}

describe("validatePrizeConfig", () => {
  it("accepts the shipped configuration", () => {
    expect(collectPrizeConfigIssues(LUCKY_WHEEL_CONFIG)).toEqual([]);
    expect(() => validatePrizeConfig(LUCKY_WHEEL_CONFIG)).not.toThrow();
  });

  it("rejects a negative weight", () => {
    const config = patchSegment(cloneConfig(), "seg-03", { weight: -5 });
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/negative weight/);
    expect(() => validatePrizeConfig(config)).toThrow();
  });

  it("rejects a non-finite weight", () => {
    const config = patchSegment(cloneConfig(), "seg-04", { weight: Number.NaN });
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/non-finite weight/);

    const infinite = patchSegment(cloneConfig(), "seg-05", { weight: Number.POSITIVE_INFINITY });
    expect(collectPrizeConfigIssues(infinite).join(" ")).toMatch(/non-finite weight/);
  });

  it("rejects a zero total weight", () => {
    const config = cloneConfig();
    config.segments = config.segments.map((segment) => ({ ...segment, weight: 0, enabled: false }));
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/greater than zero/);
  });

  it("rejects an active prize with a zero weight", () => {
    const config = patchSegment(cloneConfig(), "seg-02", { weight: 0 });
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/weight greater than zero/);
  });

  it("rejects duplicate prize identifiers", () => {
    const config = cloneConfig();
    config.segments = config.segments.map((segment) =>
      segment.id === "seg-05" ? { ...segment, id: "seg-01" } : segment,
    );
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/duplicate prize identifier/);
  });

  it("rejects duplicate wheel indexes", () => {
    const config = patchSegment(cloneConfig(), "seg-05", { index: 0 });
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/duplicates wheel index/);
  });

  it("rejects invalid reward amounts", () => {
    const negative = patchSegment(cloneConfig(), "seg-06", { prize: -25 });
    expect(collectPrizeConfigIssues(negative).join(" ")).toMatch(/negative reward amount/);

    const notFinite = patchSegment(cloneConfig(), "seg-06", { prize: Number.NaN });
    expect(collectPrizeConfigIssues(notFinite).join(" ")).toMatch(/non-finite reward amount/);

    const fractional = patchSegment(cloneConfig(), "seg-06", { prize: 12.5 });
    expect(collectPrizeConfigIssues(fractional).join(" ")).toMatch(/whole number of chips/);

    const badType = patchSegment(cloneConfig(), "seg-06", { type: "bonus" as never });
    expect(collectPrizeConfigIssues(badType).join(" ")).toMatch(/unknown prize type/);
  });

  it("rejects an empty configuration", () => {
    const config = cloneConfig();
    config.segments = [];
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/at least one segment/);
  });

  it("rejects a configuration without any enabled prize", () => {
    const config = cloneConfig();
    config.segments = config.segments.map((segment) => ({ ...segment, enabled: false }));
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/at least one enabled segment/);
  });

  it("rejects a non-finite stake", () => {
    const config = { ...cloneConfig(), stake: Number.NaN };
    expect(collectPrizeConfigIssues(config).join(" ")).toMatch(/stake must be a finite/);
  });
});

describe("collectSpinRecordIssues", () => {
  function recordFor(segmentId: string): SpinRecord {
    const segment = LUCKY_WHEEL_CONFIG.segments.find((candidate) => candidate.id === segmentId);
    return {
      id: "spin-1",
      configVersion: LUCKY_WHEEL_CONFIG.version,
      segmentId: segment?.id ?? segmentId,
      segmentIndex: segment?.index ?? 0,
      label: segment?.label ?? "?",
      prize: segment?.prize ?? 0,
      prizeType: segment?.type ?? "chips",
      weight: segment?.weight ?? 0,
      probability: 0.1,
      stake: LUCKY_WHEEL_CONFIG.stake,
      payout: segment?.prize ?? 0,
      net: (segment?.prize ?? 0) - LUCKY_WHEEL_CONFIG.stake,
      rarity: segment?.rarity ?? "common",
      settled: true,
      createdAt: 0,
    };
  }

  it("accepts a record that points at an active prize", () => {
    expect(collectSpinRecordIssues(recordFor("seg-05"), LUCKY_WHEEL_CONFIG)).toEqual([]);
    expect(() => validateSpinRecord(recordFor("seg-05"), LUCKY_WHEEL_CONFIG)).not.toThrow();
  });

  it("rejects a record that points at a missing prize", () => {
    const record = recordFor("seg-99");
    expect(collectSpinRecordIssues(record, LUCKY_WHEEL_CONFIG).join(" ")).toMatch(
      /references missing prize "seg-99"/,
    );
    expect(() => validateSpinRecord(record, LUCKY_WHEEL_CONFIG)).toThrow(
      /Invalid prize configuration/,
    );
  });

  it("rejects a record that points at a disabled prize", () => {
    const config = patchSegment(cloneConfig(), "seg-05", { enabled: false });
    const record = recordFor("seg-05");
    expect(collectSpinRecordIssues(record, config).join(" ")).toMatch(
      /references disabled prize "seg-05"/,
    );
    expect(() => validateSpinRecord(record, config)).toThrow(/Invalid prize configuration/);
  });
});
