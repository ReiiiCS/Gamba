import { HandResult } from "./types";

export const MIN_BET = 10;
export const MAX_BET = 500;
export const BET_DENOM = 10; // restrict to multiples of 10 for clean 3:2 (10*1.5=15)

export function isValidBet(bet: number): boolean {
  if (!Number.isInteger(bet)) return false;
  if (bet < MIN_BET || bet > MAX_BET) return false;
  if (bet % BET_DENOM !== 0) return false;
  return true;
}

export function calculatePayout(wager: number, result: HandResult, isNatural: boolean): number {
  if (result === "PUSH") {
    return wager; // return wager
  }
  if (result === "WIN") {
    if (isNatural) {
      // 3:2 net profit + return original wager -> total = wager + wager*1.5 = 2.5*wager
      // use integer arithmetic: (wager * 5) / 2
      return Math.floor((wager * 5) / 2);
    }
    // 1:1 net profit + return original wager -> total = 2*wager
    return wager * 2;
  }
  if (result === "BLACKJACK") {
    // same as natural
    return Math.floor((wager * 5) / 2);
  }
  if (result === "LOSE" || result === "BUST") {
    return 0;
  }
  return 0;
}
