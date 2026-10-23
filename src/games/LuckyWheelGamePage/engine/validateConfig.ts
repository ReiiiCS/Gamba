import { SEGMENT_COUNT } from "../geometry";
import { prizeMultiplier } from "./payouts";
import type { PrizeConfig, PrizeSegment, SpinRecord } from "./types";

export class InvalidPrizeConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid prize configuration: ${issues.join("; ")}`);
    this.name = "InvalidPrizeConfigError";
    this.issues = issues;
  }
}

/**
 * Collect every reason the configuration is unusable. An empty array means the
 * configuration is valid.
 */
export function collectPrizeConfigIssues(config: PrizeConfig): string[] {
  const issues: string[] = [];

  if (!config || !Array.isArray(config.segments)) {
    return ["prize config must contain a segments array"];
  }

  if (config.segments.length === 0) {
    issues.push("prize config must contain at least one segment");
  }

  if (!Number.isFinite(config.stake) || config.stake < 0) {
    issues.push(`stake must be a finite, non-negative number (received ${config.stake})`);
  }

  const validStakes: number[] = [];

  if (!Array.isArray(config.stakes) || config.stakes.length === 0) {
    issues.push("prize config must list at least one stake");
  } else {
    for (const stake of config.stakes) {
      if (!Number.isFinite(stake) || !Number.isInteger(stake) || stake <= 0) {
        issues.push(`stake ${stake} must be a positive whole number`);
      } else if (validStakes.includes(stake)) {
        issues.push(`duplicate stake ${stake}`);
      } else {
        validStakes.push(stake);
      }
    }

    if (Number.isFinite(config.stake) && !validStakes.includes(config.stake)) {
      issues.push(
        `default stake ${config.stake} must be one of the available stakes (${validStakes.join(", ")})`,
      );
    }
  }

  const seenIds = new Set<string>();
  const seenIndexes = new Set<number>();

  for (const segment of config.segments) {
    const name = segment?.id ?? "(missing id)";

    if (!segment || typeof segment !== "object") {
      issues.push("every segment must be an object");
      continue;
    }

    if (typeof segment.id !== "string" || segment.id.length === 0) {
      issues.push(`segment ${name} is missing a string id`);
    } else if (seenIds.has(segment.id)) {
      issues.push(`duplicate prize identifier "${segment.id}"`);
    } else {
      seenIds.add(segment.id);
    }

    if (!Number.isInteger(segment.index) || segment.index < 0 || segment.index >= SEGMENT_COUNT) {
      issues.push(`segment "${name}" has an invalid wheel index ${segment.index}`);
    } else if (seenIndexes.has(segment.index)) {
      issues.push(`segment "${name}" duplicates wheel index ${segment.index}`);
    } else {
      seenIndexes.add(segment.index);
    }

    if (!Number.isFinite(segment.weight)) {
      issues.push(`segment "${name}" has a non-finite weight`);
    } else if (segment.weight < 0) {
      issues.push(`segment "${name}" has a negative weight (${segment.weight})`);
    } else if (segment.enabled && segment.weight === 0) {
      issues.push(`active segment "${name}" must have a weight greater than zero`);
    }

    if (!Number.isFinite(segment.prize)) {
      issues.push(`segment "${name}" has a non-finite reward amount`);
    } else if (segment.prize < 0) {
      issues.push(`segment "${name}" has a negative reward amount (${segment.prize})`);
    } else if (segment.type !== "chips" && segment.type !== "multiplier") {
      issues.push(`segment "${name}" has an unknown prize type "${segment.type}"`);
    } else if (segment.type === "chips" && !Number.isInteger(segment.prize)) {
      issues.push(`segment "${name}" must award a whole number of chips`);
    } else if (segment.type === "multiplier" && segment.prize < 1) {
      issues.push(`multiplier segment "${name}" must pay at least 1x`);
    }

    if (
      validStakes.length > 0 &&
      Number.isFinite(segment.prize) &&
      segment.prize >= 0 &&
      (segment.type === "chips" || segment.type === "multiplier")
    ) {
      const multiplier = prizeMultiplier(segment, config);
      for (const stake of validStakes) {
        const payout = multiplier * stake;
        if (!Number.isInteger(payout) || payout < 0) {
          issues.push(
            `segment "${name}" would pay ${payout} chips at a ${stake}-chip stake; prizes must be whole chips at every stake`,
          );
          break;
        }
      }
    }
  }

  const active = config.segments.filter((segment) => segment?.enabled);
  if (active.length === 0) {
    issues.push("prize config must have at least one enabled segment");
  }

  const total = active.reduce(
    (sum, segment) => sum + (Number.isFinite(segment.weight) ? segment.weight : 0),
    0,
  );
  if (!(total > 0)) {
    issues.push(`total weight of the enabled prizes must be greater than zero (received ${total})`);
  }

  return issues;
}

/** Throws `InvalidPrizeConfigError` when the configuration is unusable. */
export function validatePrizeConfig(config: PrizeConfig): void {
  const issues = collectPrizeConfigIssues(config);
  if (issues.length > 0) throw new InvalidPrizeConfigError(issues);
}

/**
 * A stored spin is only replayable while its prize still exists and is still
 * enabled in the active configuration.
 */
export function collectSpinRecordIssues(record: SpinRecord, config: PrizeConfig): string[] {
  const issues: string[] = [];
  const segment = config.segments?.find((candidate) => candidate.id === record.segmentId);

  if (!segment) {
    issues.push(`spin ${record.id} references missing prize "${record.segmentId}"`);
  } else if (!segment.enabled) {
    issues.push(`spin ${record.id} references disabled prize "${record.segmentId}"`);
  }

  return issues;
}

/** Throws when a stored spin no longer maps to an active prize. */
export function validateSpinRecord(record: SpinRecord, config: PrizeConfig): void {
  const issues = collectSpinRecordIssues(record, config);
  if (issues.length > 0) throw new InvalidPrizeConfigError(issues);
}

export function findSegmentById(config: PrizeConfig, id: string): PrizeSegment | undefined {
  return config.segments.find((segment) => segment.id === id);
}
