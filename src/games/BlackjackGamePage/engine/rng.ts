import { RNG } from "./types";

export function createCryptoRNG(): RNG {
  return () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    // Map to [0, 1)
    return buf[0] / 0x100000000;
  };
}

export function createSeededRNG(seed: number): RNG {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
