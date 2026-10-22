import type { SpinRecord } from "./types";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const LUCKY_WHEEL_STORAGE_KEY = "playroom.luckywheel.v1";

export const MAX_STORED_SPINS = 50;

export const STARTING_BALANCE = 1000;

export type WheelState = {
  balance: number;
  spins: SpinRecord[];
};

/** In-memory storage, used by the tests and as a fallback. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** `localStorage` when the browser exposes it, otherwise an in-memory stand-in. */
export function getDefaultStorage(): StorageLike {
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      const probe = `${LUCKY_WHEEL_STORAGE_KEY}.probe`;
      globalThis.localStorage.setItem(probe, "1");
      globalThis.localStorage.removeItem(probe);
      return globalThis.localStorage;
    }
  } catch {
    // Private mode / blocked storage: fall back to memory.
  }
  return createMemoryStorage();
}

/**
 * Persists the chip balance and the spin log. The store owns the record of what
 * was awarded, so the prize shown to the player always matches the prize that
 * was selected.
 */
export class SpinStore {
  private readonly storage: StorageLike;
  private readonly key: string;

  constructor(storage: StorageLike = getDefaultStorage(), key: string = LUCKY_WHEEL_STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  load(): WheelState {
    const fallback: WheelState = { balance: STARTING_BALANCE, spins: [] };

    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return fallback;

      const parsed = JSON.parse(raw) as Partial<WheelState>;
      const balance =
        typeof parsed.balance === "number" && Number.isFinite(parsed.balance)
          ? parsed.balance
          : STARTING_BALANCE;
      const spins = Array.isArray(parsed.spins) ? (parsed.spins as SpinRecord[]) : [];

      return { balance, spins: spins.slice(0, MAX_STORED_SPINS) };
    } catch {
      return fallback;
    }
  }

  save(state: WheelState): void {
    try {
      this.storage.setItem(
        this.key,
        JSON.stringify({
          balance: state.balance,
          spins: state.spins.slice(0, MAX_STORED_SPINS),
        }),
      );
    } catch {
      // Storage is full or blocked: the game keeps working in memory.
    }
  }

  reset(): WheelState {
    const fresh: WheelState = { balance: STARTING_BALANCE, spins: [] };
    this.save(fresh);
    return fresh;
  }
}
