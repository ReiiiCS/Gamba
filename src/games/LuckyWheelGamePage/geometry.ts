/**
 * Wheel geometry.
 *
 * The wheel has 12 slots of 30 degrees each. A slot's local angle is measured
 * clockwise from 12 o'clock, so slot `i` occupies `[i * 30, (i + 1) * 30)`.
 * The pointer is fixed at 12 o'clock and the wheel rotates underneath it.
 */

export const SEGMENT_COUNT = 12;

export const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

/** How many complete revolutions every spin performs before settling. */
export const DEFAULT_FULL_TURNS = 5;

export function segmentCenterAngle(index: number): number {
  return index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
}

/** Normalise any angle into `[0, 360)`. */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Rotation (in degrees, clockwise) that puts the centre of `index` under the
 * pointer, starting from `currentRotation`.
 *
 * The returned rotation always adds at least `fullTurns` complete revolutions
 * and lands exactly on the target angle modulo 360, so the segment shown under
 * the pointer is always the one that was selected.
 */
export function rotationToAlign(
  index: number,
  currentRotation: number,
  fullTurns: number = DEFAULT_FULL_TURNS,
): number {
  const desired = normalizeAngle(-segmentCenterAngle(index));
  const current = normalizeAngle(currentRotation);
  const alignment = normalizeAngle(desired - current);
  return currentRotation + fullTurns * 360 + alignment;
}

/**
 * The slot sitting under the pointer for a given rotation. Used for tick
 * sounds while the wheel is moving.
 */
export function segmentIndexAtPointer(rotation: number): number {
  const localAngle = normalizeAngle(-normalizeAngle(rotation));
  return Math.floor(localAngle / SEGMENT_ANGLE) % SEGMENT_COUNT;
}
