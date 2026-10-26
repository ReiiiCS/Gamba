export const GRID_SIZE = 25;
export const MAX_MINES = GRID_SIZE - 1;

/**
 * Fair-odds multiplier for a mines round.
 *
 * After `revealedCount` safe picks with `mineCount` mines on the grid, the
 * probability of surviving every pick is the product of the chances of picking
 * a safe tile at each step. The multiplier is the inverse of that probability:
 *
 *   product over step = 0..revealedCount-1 of (GRID_SIZE - step) / (GRID_SIZE - mineCount - step)
 *
 * That is the same as C(GRID_SIZE, revealedCount) / C(GRID_SIZE - mineCount, revealedCount),
 * so the game returns exactly the fair payout with no hidden house edge.
 */
export function getMultiplier(mineCount: number, revealedCount: number): number {
  if (revealedCount <= 0) return 1;

  const maxSafePicks = GRID_SIZE - mineCount;
  const picks = Math.min(revealedCount, maxSafePicks);
  let multiplier = 1;

  for (let step = 0; step < picks; step += 1) {
    const remainingTiles = GRID_SIZE - step;
    const remainingSafeTiles = GRID_SIZE - mineCount - step;
    if (remainingSafeTiles <= 0) break;
    multiplier *= remainingTiles / remainingSafeTiles;
  }

  return Math.max(1.01, Math.round(multiplier * 100) / 100);
}

/** Percentage chance that the next hidden tile contains a mine. */
export function getMineHitChance(mineCount: number, revealedCount: number): number {
  const remainingTiles = GRID_SIZE - revealedCount;
  if (remainingTiles <= 0) return 0;
  return (mineCount / remainingTiles) * 100;
}
