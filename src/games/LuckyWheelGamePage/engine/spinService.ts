import { cryptoRandomUnit, type RandomUnit } from "./random";
import { activeSegments, prizeProbability, selectPrize, totalWeight } from "./selectPrize";
import { SpinStore, type WheelState } from "./store";
import type { PrizeConfig, PrizeSegment, SpinRecord, SpinResult } from "./types";
import { validatePrizeConfig, collectSpinRecordIssues } from "./validateConfig";
import { LUCKY_WHEEL_CONFIG } from "./prizeConfig";

export type SpinServiceOptions = {
  config?: PrizeConfig;
  store?: SpinStore;
  /** Injection point for the random draw. Defaults to the platform CSPRNG. */
  randomUnit?: RandomUnit;
  now?: () => number;
  createId?: () => string;
};

let spinCounter = 0;

function defaultCreateId(now: number): string {
  spinCounter += 1;
  return `spin-${now.toString(36)}-${spinCounter.toString(36)}`;
}

/**
 * The authoritative Lucky Wheel service.
 *
 * Every spin runs the same pipeline:
 *   1. load the active prize configuration
 *   2. validate it (weights, totals, ids, reward amounts)
 *   3. draw a cryptographically secure random value
 *   4. select the prize from the configured weights
 *   5. persist the result
 *   6. return the recorded result to the caller
 *
 * The reward is paid out by `settle()`, which the game calls once the wheel
 * has stopped. The prize itself is fixed and stored at selection time, so the
 * animation can never change what was won.
 */
export class SpinService {
  private readonly config: PrizeConfig;
  private readonly store: SpinStore;
  private readonly randomUnit: RandomUnit;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(options: SpinServiceOptions = {}) {
    this.config = options.config ?? LUCKY_WHEEL_CONFIG;
    this.store = options.store ?? new SpinStore();
    this.randomUnit = options.randomUnit ?? cryptoRandomUnit;
    this.now = options.now ?? (() => Date.now());
    this.createId = options.createId ?? (() => defaultCreateId(this.now()));
  }

  getConfig(): PrizeConfig {
    return this.config;
  }

  getState(): WheelState {
    return this.store.load();
  }

  getBalance(): number {
    return this.store.load().balance;
  }

  getHistory(limit = 10): SpinRecord[] {
    return this.store
      .load()
      .spins.filter((spin) => collectSpinRecordIssues(spin, this.config).length === 0)
      .slice(0, limit);
  }

  /** The prize the service would award for a given unit draw. */
  probabilityOf(segment: PrizeSegment): number {
    return prizeProbability(segment, this.config);
  }

  /**
   * Selects and records a spin. The stake is debited here; the reward is paid
   * out by `settle()` once the animation finishes.
   */
  spin(): SpinResult {
    const config = this.config;

    // 1 + 2: load the active configuration and reject invalid ones.
    validatePrizeConfig(config);

    const active = activeSegments(config);
    const total = totalWeight(active);
    if (!(total > 0)) {
      throw new Error("Lucky Wheel: total prize weight must be greater than zero");
    }

    // 3 + 4: secure random draw, weighted selection.
    const segment = selectPrize(config.segments, this.randomUnit);
    const probability = segment.weight / total;
    const stake = config.stake;
    const payout = segment.type === "multiplier" ? stake * segment.prize : segment.prize;

    const createdAt = this.now();
    const record: SpinRecord = {
      id: this.createId(),
      configVersion: config.version,
      segmentId: segment.id,
      segmentIndex: segment.index,
      label: segment.label,
      prize: segment.prize,
      prizeType: segment.type,
      weight: segment.weight,
      probability,
      stake,
      payout,
      net: payout - stake,
      rarity: segment.rarity,
      settled: false,
      createdAt,
    };

    // 5: persist the result together with the stake debit.
    const state = this.store.load();
    this.store.save({
      balance: state.balance - stake,
      spins: [record, ...state.spins],
    });

    // 6: return the recorded result.
    return { record, segment };
  }

  /**
   * Applies the prize reward for a recorded spin. Safe to call twice: an
   * already settled spin is not paid out again.
   */
  settle(recordId: string): SpinRecord | null {
    const state = this.store.load();
    const existing = state.spins.find((spin) => spin.id === recordId);
    if (!existing || existing.settled) return existing ?? null;

    const settled: SpinRecord = { ...existing, settled: true };
    this.store.save({
      balance: state.balance + settled.payout,
      spins: state.spins.map((spin) => (spin.id === recordId ? settled : spin)),
    });
    return settled;
  }

  /**
   * Pays out spins that were selected but never settled (for example when the
   * page was closed mid-spin). Returns the settled records.
   */
  settlePending(): SpinRecord[] {
    const state = this.store.load();
    const pending = state.spins.filter((spin) => !spin.settled);
    return pending
      .map((spin) => this.settle(spin.id))
      .filter((spin): spin is SpinRecord => spin !== null);
  }

  resetBalance(): WheelState {
    return this.store.reset();
  }
}
