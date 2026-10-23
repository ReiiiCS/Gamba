import type { PrizeConfig, PrizeSegment } from "./types";

/**
 * How much a prize pays for every chip of stake.
 *
 * Chip prizes are quoted at the configuration's default stake, so 250 chips at
 * a 25-chip stake is a 10x prize and pays 1,000 chips at a 100-chip stake.
 * Multiplier prizes are already expressed as a multiple of the stake.
 *
 * The configuration validation guarantees that `prizeMultiplier x stake` is a
 * whole number for every allowed stake, so the arithmetic below stays exact.
 */
export function prizeMultiplier(segment: PrizeSegment, config: PrizeConfig): number {
  if (segment.type === "multiplier") return segment.prize;
  if (!(config.stake > 0)) return 0;
  return segment.prize / config.stake;
}

/** The chips a prize pays for a given stake. */
export function payoutFor(segment: PrizeSegment, config: PrizeConfig, stake: number): number {
  return Math.round(prizeMultiplier(segment, config) * stake);
}

/** Formats a payout multiplier for display: `2×`, `0.2×`, `1.2×`. */
export function formatMultiplier(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}×`;
}
