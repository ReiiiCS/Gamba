import { describe, expect, it } from "vitest";
import {
  DEFAULT_FULL_TURNS,
  SEGMENT_ANGLE,
  SEGMENT_COUNT,
  normalizeAngle,
  rotationToAlign,
  segmentCenterAngle,
  segmentIndexAtPointer,
} from "../../geometry";

describe("wheel geometry", () => {
  it("splits the wheel into 12 slots of 30 degrees", () => {
    expect(SEGMENT_COUNT).toBe(12);
    expect(SEGMENT_ANGLE).toBe(30);
  });

  it("aligns the pointer with the selected segment for every slot", () => {
    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const rotation = rotationToAlign(index, 0);
      expect(normalizeAngle(rotation + segmentCenterAngle(index))).toBeCloseTo(0, 9);
      expect(segmentIndexAtPointer(rotation)).toBe(index);
    }
  });

  it("keeps the alignment when the wheel starts from an arbitrary rotation", () => {
    const startingRotations = [0, 45, 137.5, 359.9, 720, 1_073.25, 2_999.75];

    for (const start of startingRotations) {
      for (let index = 0; index < SEGMENT_COUNT; index += 1) {
        const rotation = rotationToAlign(index, start);
        expect(normalizeAngle(rotation + segmentCenterAngle(index))).toBeCloseTo(0, 9);
        expect(segmentIndexAtPointer(rotation)).toBe(index);
      }
    }
  });

  it("performs multiple complete rotations", () => {
    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const rotation = rotationToAlign(index, 120);
      expect(rotation - 120).toBeGreaterThanOrEqual(DEFAULT_FULL_TURNS * 360);
      expect(rotation - 120).toBeLessThan((DEFAULT_FULL_TURNS + 1) * 360);
    }
  });

  it("never returns a negative or wrapping target angle", () => {
    const rotation = rotationToAlign(0, 15);
    expect(rotation).toBeGreaterThanOrEqual(DEFAULT_FULL_TURNS * 360);
    expect(normalizeAngle(rotation)).toBe(normalizeAngle(-segmentCenterAngle(0)));
  });

  it("reports the slot under the pointer while spinning", () => {
    // Rotation 0 leaves the pointer on the boundary between slot 11 and slot 0.
    expect(segmentIndexAtPointer(0)).toBe(0);
    // Rotating back by the centre offset of a slot parks that slot under the pointer.
    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      expect(segmentIndexAtPointer(-segmentCenterAngle(index))).toBe(index);
    }
  });
});
