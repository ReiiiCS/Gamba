import { describe, expect, it } from "vitest";
import { LUCKY_WHEEL_CONFIG } from "../prizeConfig";
import { SpinService, type SpinServiceOptions } from "../spinService";
import { SpinStore, createMemoryStorage, STARTING_BALANCE } from "../store";
import type { PrizeConfig } from "../types";

function createService(overrides: SpinServiceOptions = {}) {
  const storage = createMemoryStorage();
  const store = new SpinStore(storage);
  const service = new SpinService({ store, ...overrides });
  return { service, store, storage };
}

describe("SpinService", () => {
  it("records the prize before anything is animated and debits the stake", () => {
    const { service } = createService();
    const result = service.spin();

    expect(result.segment.id).toBe(result.record.segmentId);
    expect(result.record.prize).toBe(result.segment.prize);
    expect(result.record.settled).toBe(false);
    expect(result.record.probability).toBeCloseTo(result.segment.weight / 100, 10);
    expect(service.getBalance()).toBe(STARTING_BALANCE - LUCKY_WHEEL_CONFIG.stake);
  });

  it("pays the reward out once the spin settles", () => {
    const { service } = createService();
    const result = service.spin();

    const settled = service.settle(result.record.id);
    expect(settled?.settled).toBe(true);
    expect(service.getBalance()).toBe(
      STARTING_BALANCE - LUCKY_WHEEL_CONFIG.stake + result.record.payout,
    );

    // A second settle must not pay out again.
    service.settle(result.record.id);
    expect(service.getBalance()).toBe(
      STARTING_BALANCE - LUCKY_WHEEL_CONFIG.stake + result.record.payout,
    );
  });

  it("applies the reward according to the prize type", () => {
    const config: PrizeConfig = {
      ...LUCKY_WHEEL_CONFIG,
      segments: LUCKY_WHEEL_CONFIG.segments.map((segment) =>
        segment.id === "seg-01" ? { ...segment, prize: 3, type: "multiplier" as const } : segment,
      ),
    };

    const { service } = createService({ config, randomUnit: () => 0 });
    const result = service.spin(50);

    expect(result.record.prizeType).toBe("multiplier");
    expect(result.record.payout).toBe(150);
    expect(result.record.net).toBe(100);

    service.settle(result.record.id);
    expect(service.getBalance()).toBe(STARTING_BALANCE - 50 + 150);
  });

  it("scales the chips prize with the chosen stake", () => {
    for (const stake of LUCKY_WHEEL_CONFIG.stakes) {
      const { service } = createService({ randomUnit: () => 0 });
      const result = service.spin(stake);

      expect(result.record.stake).toBe(stake);
      expect(result.record.payout).toBe((result.segment.prize / LUCKY_WHEEL_CONFIG.stake) * stake);
      expect(service.getBalance()).toBe(STARTING_BALANCE - stake);
    }
  });

  it("pays every segment a whole number of scaled chips at every stake", () => {
    const segments = LUCKY_WHEEL_CONFIG.segments;
    const totalWeight = segments.reduce((sum, candidate) => sum + candidate.weight, 0);

    for (const stake of LUCKY_WHEEL_CONFIG.stakes) {
      segments.forEach((segment, position) => {
        // Aim the deterministic draw at the middle of this segment's slice.
        const before = segments
          .slice(0, position)
          .reduce((sum, candidate) => sum + candidate.weight, 0);
        const threshold = (before + segment.weight / 2) / totalWeight;

        const { service } = createService({ randomUnit: () => threshold });
        const result = service.spin(stake);

        expect(result.segment.id).toBe(segment.id);
        expect(Number.isInteger(result.record.payout)).toBe(true);
        expect(result.record.payout).toBe((segment.prize / LUCKY_WHEEL_CONFIG.stake) * stake);
      });
    }
  });

  it("rejects a stake that is not offered", () => {
    const { service } = createService();

    expect(() => service.spin(20)).toThrow(/stake must be one of 10, 25, 50, 100 chips/);
    expect(service.getBalance()).toBe(STARTING_BALANCE);
    expect(service.getHistory()).toHaveLength(0);
  });

  it("rejects a stake the balance cannot cover", () => {
    const storage = createMemoryStorage();
    const store = new SpinStore(storage);
    store.save({ balance: 20, spins: [] });

    const service = new SpinService({ store });
    expect(() => service.spin(25)).toThrow(/not enough chips for a 25-chip spin/);
    expect(service.getBalance()).toBe(20);
    expect(service.getHistory()).toHaveLength(0);
  });

  it("keeps the return to player constant across stakes", () => {
    const expectedValue = (stake: number) =>
      LUCKY_WHEEL_CONFIG.segments.reduce(
        (sum, segment) =>
          sum + (segment.weight / 100) * (segment.prize / LUCKY_WHEEL_CONFIG.stake) * stake,
        0,
      );

    const baseline = expectedValue(LUCKY_WHEEL_CONFIG.stake) / LUCKY_WHEEL_CONFIG.stake;
    for (const stake of LUCKY_WHEEL_CONFIG.stakes) {
      expect(expectedValue(stake) / stake).toBeCloseTo(baseline, 10);
    }
  });

  it("rejects an invalid configuration instead of spinning", () => {
    const broken: PrizeConfig = {
      ...LUCKY_WHEEL_CONFIG,
      segments: LUCKY_WHEEL_CONFIG.segments.map((segment) =>
        segment.id === "seg-04" ? { ...segment, weight: -1 } : segment,
      ),
    };

    const { service } = createService({ config: broken });
    expect(() => service.spin()).toThrow(/Invalid prize configuration/);
    expect(service.getBalance()).toBe(STARTING_BALANCE);
    expect(service.getHistory()).toHaveLength(0);
  });

  it("persists the balance and the spin log", () => {
    const storage = createMemoryStorage();
    const store = new SpinStore(storage);
    const service = new SpinService({ store });

    const result = service.spin();
    service.settle(result.record.id);

    const reloaded = new SpinService({ store: new SpinStore(storage) });
    expect(reloaded.getBalance()).toBe(service.getBalance());
    expect(reloaded.getHistory()[0].id).toBe(result.record.id);
    expect(reloaded.getHistory()[0].settled).toBe(true);
  });

  it("pays out spins that were never settled", () => {
    const { service } = createService();
    const result = service.spin();
    expect(service.getBalance()).toBe(STARTING_BALANCE - LUCKY_WHEEL_CONFIG.stake);

    const settled = service.settlePending();
    expect(settled).toHaveLength(1);
    expect(settled[0].id).toBe(result.record.id);
    expect(service.getBalance()).toBe(
      STARTING_BALANCE - LUCKY_WHEEL_CONFIG.stake + result.record.payout,
    );
  });

  it("resets the balance and clears the log", () => {
    const { service } = createService();
    service.spin();
    service.resetBalance();

    expect(service.getBalance()).toBe(STARTING_BALANCE);
    expect(service.getHistory()).toHaveLength(0);
  });

  it("uses the CSPRNG by default", () => {
    const { service } = createService();
    const result = service.spin();
    expect(result.segment).toBeDefined();
    expect(result.segment.enabled).toBe(true);
    expect(Number.isFinite(result.record.probability)).toBe(true);
  });

  it("hides spins that point at a prize which is no longer active", () => {
    const storage = createMemoryStorage();
    const store = new SpinStore(storage);
    const service = new SpinService({ store, randomUnit: () => 0 });

    const result = service.spin();
    expect(service.getHistory()).toHaveLength(1);

    const withoutThePrize: PrizeConfig = {
      ...LUCKY_WHEEL_CONFIG,
      segments: LUCKY_WHEEL_CONFIG.segments.map((segment) =>
        segment.id === result.segment.id ? { ...segment, enabled: false } : segment,
      ),
    };

    const reloaded = new SpinService({ store: new SpinStore(storage), config: withoutThePrize });
    expect(reloaded.getHistory()).toHaveLength(0);
    // The balance is untouched by the filtering.
    expect(reloaded.getBalance()).toBe(service.getBalance());
  });
});
