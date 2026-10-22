import { describe, expect, it } from "vitest";
import {
  SEGMENT_ANGLE,
  SEGMENT_COUNT,
  normalizeAngle,
  rotationToAlign,
  segmentCenterAngle,
} from "../../geometry";
import {
  LABEL_RADIUS,
  WHEEL_CENTER,
  WHEEL_RADIUS_INNER,
  WHEEL_RADIUS_OUTER,
  labelPosition,
  pointAngle,
  polarPoint,
  segmentPath,
} from "../../wheelPath";

/** Reads the two arc endpoints of a rendered wedge. */
function wedgeAngles(path: string) {
  const move = /M\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(path);
  const arc = /A\s+[\d.]+\s+[\d.]+\s+\d\s+\d\s+1\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(path);
  return {
    start: pointAngle(Number(move?.[1]), Number(move?.[2])),
    end: pointAngle(Number(arc?.[1]), Number(arc?.[2])),
  };
}

/** Rotates a point around the wheel centre by `rotation` degrees clockwise. */
function rotatePoint(x: number, y: number, rotation: number) {
  const radians = (rotation * Math.PI) / 180;
  const dx = x - WHEEL_CENTER;
  const dy = y - WHEEL_CENTER;
  return {
    x: WHEEL_CENTER + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: WHEEL_CENTER + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

/** Signed difference between two angles in degrees. */
function angleDifference(a: number, b: number) {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

describe("rendered wheel geometry", () => {
  it("draws every wedge across its own 30 degree slot", () => {
    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const { start, end } = wedgeAngles(segmentPath(index));
      // The path coordinates are rounded to three decimals, which is worth a
      // fraction of a thousandth of a degree.
      expect(Math.abs(angleDifference(start, index * SEGMENT_ANGLE))).toBeLessThan(0.001);
      expect(Math.abs(angleDifference(end, (index + 1) * SEGMENT_ANGLE))).toBeLessThan(0.001);
    }
  });

  it("puts the pointer on the winning wedge for every slot", () => {
    const pointer = polarPoint(0, WHEEL_RADIUS_OUTER - 6);

    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const rotation = rotationToAlign(index, 0);
      // The wheel turns clockwise, so the pointer moves the other way inside
      // the wheel's own frame of reference.
      const rotated = rotatePoint(pointer.x, pointer.y, -rotation);
      const localAngle = pointAngle(rotated.x, rotated.y);

      expect(normalizeAngle(localAngle)).toBeGreaterThanOrEqual(index * SEGMENT_ANGLE);
      expect(normalizeAngle(localAngle)).toBeLessThan((index + 1) * SEGMENT_ANGLE);
    }
  });

  it("keeps the labels inside the wedge band", () => {
    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const position = labelPosition(index);
      const radius = Math.hypot(position.x - WHEEL_CENTER, position.y - WHEEL_CENTER);
      expect(radius).toBeCloseTo(LABEL_RADIUS, 6);
      expect(radius).toBeGreaterThan(WHEEL_RADIUS_INNER);
      expect(radius).toBeLessThan(WHEEL_RADIUS_OUTER);
    }
  });

  it("rotates the labels with the wheel", () => {
    // The numbers are printed along the arc and turn with the wheel, so every
    // one leans by its own slot angle and the lower half of the wheel reads
    // upside down, the way a real prize wheel does.
    for (const rotation of [0, -15, 90, 2115]) {
      for (let index = 0; index < SEGMENT_COUNT; index += 1) {
        const position = labelPosition(index);
        const rotated = rotatePoint(position.x, position.y, rotation);
        const angle = normalizeAngle(pointAngle(rotated.x, rotated.y));
        const expected = normalizeAngle(segmentCenterAngle(index) + rotation);
        expect(Math.abs(angleDifference(angle, expected))).toBeLessThan(0.001);
      }
    }
  });
});
