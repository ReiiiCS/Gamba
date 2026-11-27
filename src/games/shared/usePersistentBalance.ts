import { useEffect, useState } from "react";

type BalanceStorage = Pick<Storage, "getItem" | "setItem">;

function getBrowserStorage(): BalanceStorage | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadGameBalance(
  key: string,
  startingBalance: number,
  storage: BalanceStorage | null = getBrowserStorage(),
): number {
  try {
    const raw = storage?.getItem(key);
    if (raw === null || raw === undefined || raw.trim() === "") return startingBalance;
    const balance = Number(raw);
    return Number.isSafeInteger(balance) && balance >= 0 ? balance : startingBalance;
  } catch {
    return startingBalance;
  }
}

export function saveGameBalance(
  key: string,
  balance: number,
  storage: BalanceStorage | null = getBrowserStorage(),
): void {
  try {
    storage?.setItem(key, String(Math.max(0, Math.floor(balance))));
  } catch {
    // Keep the game playable when browser storage is unavailable.
  }
}

export function usePersistentBalance(key: string, startingBalance: number) {
  const [balance, setBalance] = useState(() => loadGameBalance(key, startingBalance));

  useEffect(() => {
    saveGameBalance(key, balance);
  }, [key, balance]);

  return [balance, setBalance] as const;
}
