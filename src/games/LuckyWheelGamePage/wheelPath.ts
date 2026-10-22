import { SEGMENT_ANGLE, segmentCenterAngle } from "./geometry";

export const WHEEL_CENTER = 120;
export const WHEEL_RADIUS_OUTER = 104;
export const WHEEL_RADIUS_INNER = 32;
export const LABEL_RADIUS = 70;

/** Point on the wheel in SVG coordinates, `angle` measured clockwise from 12 o'clock. */
export function polarPoint(angleDegrees: number, radius: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: WHEEL_CENTER + radius * Math.sin(radians),
    y: WHEEL_CENTER - radius * Math.cos(radians),
  };
}

/** The angle of a point in SVG coordinates, measured clockwise from 12 o'clock. */
export function pointAngle(x: number, y: number): number {
  const radians = Math.atan2(x - WHEEL_CENTER, WHEEL_CENTER - y);
  return (radians * 180) / Math.PI;
}

/** Donut sector for a wheel slot, drawn clockwise from 12 o'clock. */
export function segmentPath(index: number): string {
  const start = index * SEGMENT_ANGLE;
  const end = (index + 1) * SEGMENT_ANGLE;
  const outerStart = polarPoint(start, WHEEL_RADIUS_OUTER);
  const outerEnd = polarPoint(end, WHEEL_RADIUS_OUTER);
  const innerEnd = polarPoint(end, WHEEL_RADIUS_INNER);
  const innerStart = polarPoint(start, WHEEL_RADIUS_INNER);

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${WHEEL_RADIUS_OUTER} ${WHEEL_RADIUS_OUTER} 0 0 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${WHEEL_RADIUS_INNER} ${WHEEL_RADIUS_INNER} 0 0 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

/** Where the label of a slot sits on the wheel face. */
export function labelPosition(index: number) {
  return polarPoint(segmentCenterAngle(index), LABEL_RADIUS);
}
