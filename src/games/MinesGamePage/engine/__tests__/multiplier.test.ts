import { describe, expect, it } from "vitest";
import { getMineHitChance, getMultiplier } from "../multiplier";

describe("getMultiplier", () => {
  it("returns 1 before any safe pick", () => {
    expect(getMultiplier(3, 0)).toBe(1);
    expect(getMultiplier(24, 0)).toBe(1);
  });

  it("uses fair odds for a single safe pick", () => {
    expect(getMultiplier(1, 1)).toBe(1.04);
    expect(getMultiplier(3, 1)).toBe(1.14);
    expect(getMultiplier(10, 1)).toBe(1.67);
    expect(getMultiplier(24, 1)).toBe(25);
  });

  it("compounds fair odds across safe picks", () => {
    expect(getMultiplier(3, 2)).toBe(1.3);
    expect(getMultiplier(3, 3)).toBe(1.49);
    expect(getMultiplier(3, 5)).toBe(2.02);
    expect(getMultiplier(10, 3)).toBe(5.05);
    expect(getMultiplier(10, 5)).toBe(17.69);
  });

  it("pays 25x when the whole grid is cleared", () => {
    expect(getMultiplier(1, 24)).toBe(25);
    expect(getMultiplier(20, 5)).toBe(53130);
  });

  it("never goes below the minimum multiplier after a safe pick", () => {
    expect(getMultiplier(1, 1)).toBeGreaterThanOrEqual(1.01);
  });
});

describe("getMineHitChance", () => {
  it("starts at mines divided by all tiles", () => {
    expect(getMineHitChance(3, 0)).toBe(12);
    expect(getMineHitChance(10, 0)).toBe(40);
  });

  it("rises as hidden tiles are removed", () => {
    expect(getMineHitChance(3, 1)).toBe(12.5);
    expect(getMineHitChance(10, 5)).toBe(50);
  });

  it("reaches 100% when only mines remain", () => {
    expect(getMineHitChance(24, 1)).toBe(100);
  });

  it("is safe on a fully revealed grid", () => {
    expect(getMineHitChance(3, 25)).toBe(0);
  });
});
