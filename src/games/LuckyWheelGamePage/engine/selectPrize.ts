import { cryptoRandomUnit, type RandomUnit } from "./random";
import { InvalidPrizeConfigError } from "./validateConfig";
import type { PrizeConfig, PrizeSegment } from "./types";

/** Every prize that can currently be won. */
export function activeSegments(config: PrizeConfig): PrizeSegment[] {
  return config.segments.filter((segment) => segment.enabled);
}

/** Sum of the weights of the given prizes. */
export function totalWeight(segments: PrizeSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.weight, 0);
}

/**
 * Theoretical probability of a prize: `weight / totalWeight`.
 */
export function prizeProbability(segment: PrizeSegment, config: PrizeConfig): number {
  const total = totalWeight(activeSegments(config));
  if (!(total > 0)) return 0;
  return segment.weight / total;
}

/**
 * Weighted selection.
 *
 * The caller supplies the random draw so the outcome is fully controlled by
 * the caller (tests use a deterministic draw, production uses the CSPRNG).
 * `randomUnit` must return a value in `[0, 1)`.
 */
export function selectPrize(
  segments: PrizeSegment[],
  randomUnit: RandomUnit = cryptoRandomUnit,
): PrizeSegment {
  const active = segments.filter((segment) => segment.enabled);
  const total = totalWeight(active);

  if (!(total > 0)) {
    throw new InvalidPrizeConfigError([
      "total weight of the enabled prizes must be greater than zero",
    ]);
  }

  const target = randomUnit() * total;
  let cursor = 0;

  for (const segment of active) {
    cursor += segment.weight;
    if (target < cursor) return segment;
  }

  // Only reachable if the draw was >= 1, which is not a valid unit sample.
  return active[active.length - 1];
}
