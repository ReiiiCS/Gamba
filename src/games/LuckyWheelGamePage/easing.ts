/**
 * CSS-style cubic bezier easing, evaluated in JavaScript.
 *
 * The wheel needs a curve that accelerates out of rest and then eases out for
 * a long time, so the deceleration is what the player actually feels.
 */
export function cubicBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (progress: number) => number {
  const ax = 3 * x1 - 3 * x2 + 1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const by = 3 * y2 - 6 * y1;
  const cx = 3 * x1;
  const cy = 3 * y1;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (progress: number): number => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;

    // Newton-Raphson first, it converges in a couple of steps.
    let t = progress;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const error = sampleX(t) - progress;
      if (Math.abs(error) < 1e-7) return sampleY(t);
      const derivative = sampleDerivativeX(t);
      if (Math.abs(derivative) < 1e-7) break;
      t -= error / derivative;
    }

    // Bisection fallback for the cases Newton-Raphson cannot handle.
    let low = 0;
    let high = 1;
    t = progress;
    for (let iteration = 0; iteration < 24; iteration += 1) {
      const error = sampleX(t) - progress;
      if (Math.abs(error) < 1e-7) break;
      if (error > 0) high = t;
      else low = t;
      t = (low + high) / 2;
    }

    return sampleY(t);
  };
}

/** Accelerates out of rest, then settles into a long, soft slowdown. */
export const SPIN_EASING = cubicBezierEasing(0.35, 0.1, 0.25, 1);
