import { describe, expect, it } from "vitest";
import { CASES, choosePrize, openCase, prizeProbability } from "./engine";

describe("case game engine", () => {
  it("selects the first weighted prize at the low end", () => {
    expect(choosePrize(CASES[0], () => 0).id).toBe("starter-25");
  });

  it("selects the last weighted prize at the high end", () => {
    expect(choosePrize(CASES[0], () => 0.999).id).toBe("starter-key");
  });

  it("deducts cost and adds chip payouts", () => {
    const result = openCase(
      "starter",
      1000,
      () => 0.5,
      () => 123,
    );
    expect(result.balance).toBe(1000 - result.cost + result.payout);
  });

  it("rejects unaffordable cases", () => {
    expect(() => openCase("royal", 499)).toThrow("You need 1 more chips.");
  });

  it("reports weighted probabilities", () => {
    expect(prizeProbability(CASES[0], "starter-25")).toBe(48);
  });
});
