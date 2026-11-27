import { describe, expect, it } from "vitest";
import { loadGameBalance, saveGameBalance } from "./usePersistentBalance";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };
}

describe("persistent game balances", () => {
  it("keeps each game's balance under its own key", () => {
    const storage = createStorage();

    saveGameBalance("playroom.balance.slots.v1", 725, storage);

    expect(loadGameBalance("playroom.balance.slots.v1", 1000, storage)).toBe(725);
    expect(loadGameBalance("playroom.balance.mines.v1", 1000, storage)).toBe(1000);
  });

  it("falls back to the starting balance for invalid stored values", () => {
    const storage = createStorage();
    storage.setItem("playroom.balance.slots.v1", "-4");

    expect(loadGameBalance("playroom.balance.slots.v1", 1000, storage)).toBe(1000);
  });
});
