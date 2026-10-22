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
      stake: 20,
      segments: LUCKY_WHEEL_CONFIG.segments.map((segment) =>
        segment.id === "seg-01" ? { ...segment, prize: 3, type: "multiplier" as const } : segment,
      ),
    };

    const { service } = createService({ config, randomUnit: () => 0 });
    const result = service.spin();

    expect(result.record.prizeType).toBe("multiplier");
    expect(result.record.payout).toBe(60);
    expect(result.record.net).toBe(40);

    service.settle(result.record.id);
    expect(service.getBalance()).toBe(STARTING_BALANCE - 20 + 60);
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
