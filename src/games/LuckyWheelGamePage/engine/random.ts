/**
 * Cryptographically secure randomness.
 *
 * `Math.random()` is never used to decide a winner. The draw below is a
 * uniform 53-bit value taken from the platform CSPRNG, which is exactly
 * representable as a double and therefore free of modulo bias.
 */

export type RandomUnit = () => number;

/** Uniform value in `[0, 1)` built from 53 CSPRNG bits. */
export function cryptoRandomUnit(): number {
  const buffer = new Uint32Array(2);
  globalThis.crypto.getRandomValues(buffer);
  // 21 high bits + 32 low bits = 53 bits of entropy.
  const high = buffer[0] >>> 11;
  const low = buffer[1];
  return (high * 2 ** 32 + low) / 2 ** 53;
}
