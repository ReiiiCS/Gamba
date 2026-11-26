export type PrizeKind = "chips" | "collectible" | "redeemable";

export type Prize = {
  id: string;
  name: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  color: string;
  symbol: string;
  weight: number;
  kind: PrizeKind;
  value: number;
};

export type CaseTier = {
  id: string;
  name: string;
  cost: number;
  color: string;
  symbol: string;
  prizes: Prize[];
};

export type CaseResult = {
  caseId: string;
  prize: Prize;
  cost: number;
  payout: number;
  balance: number;
  openedAt: number;
};

export const STARTING_BALANCE = 1000;

export const CASES: CaseTier[] = [
  {
    id: "starter",
    name: "Starter",
    cost: 100,
    color: "#a9b1ad",
    symbol: "◇",
    prizes: [
      {
        id: "starter-25",
        name: "25 Chip Credit",
        rarity: "Common",
        color: "#a9b1ad",
        symbol: "●",
        weight: 48,
        kind: "chips",
        value: 25,
      },
      {
        id: "starter-100",
        name: "100 Chip Credit",
        rarity: "Uncommon",
        color: "#62d4aa",
        symbol: "◆",
        weight: 29,
        kind: "chips",
        value: 100,
      },
      {
        id: "starter-250",
        name: "250 Chip Credit",
        rarity: "Rare",
        color: "#6c9cff",
        symbol: "✦",
        weight: 14,
        kind: "chips",
        value: 250,
      },
      {
        id: "starter-badge",
        name: "Daybreak Badge",
        rarity: "Epic",
        color: "#ba81ff",
        symbol: "◒",
        weight: 8,
        kind: "collectible",
        value: 1,
      },
      {
        id: "starter-key",
        name: "Vault Prize Key",
        rarity: "Legendary",
        color: "#ffb84e",
        symbol: "★",
        weight: 1,
        kind: "redeemable",
        value: 1,
      },
    ],
  },
  {
    id: "neon",
    name: "Neon",
    cost: 250,
    color: "#62d4aa",
    symbol: "✳",
    prizes: [
      {
        id: "neon-50",
        name: "50 Chip Credit",
        rarity: "Common",
        color: "#a9b1ad",
        symbol: "●",
        weight: 38,
        kind: "chips",
        value: 50,
      },
      {
        id: "neon-250",
        name: "250 Chip Credit",
        rarity: "Uncommon",
        color: "#62d4aa",
        symbol: "◆",
        weight: 32,
        kind: "chips",
        value: 250,
      },
      {
        id: "neon-500",
        name: "500 Chip Credit",
        rarity: "Rare",
        color: "#6c9cff",
        symbol: "✦",
        weight: 18,
        kind: "chips",
        value: 500,
      },
      {
        id: "neon-badge",
        name: "Voltage Badge",
        rarity: "Epic",
        color: "#ba81ff",
        symbol: "ϟ",
        weight: 10,
        kind: "collectible",
        value: 1,
      },
      {
        id: "neon-key",
        name: "Neon Prize Key",
        rarity: "Legendary",
        color: "#ffb84e",
        symbol: "★",
        weight: 2,
        kind: "redeemable",
        value: 1,
      },
    ],
  },
  {
    id: "royal",
    name: "Royal",
    cost: 500,
    color: "#ba81ff",
    symbol: "♛",
    prizes: [
      {
        id: "royal-100",
        name: "100 Chip Credit",
        rarity: "Common",
        color: "#a9b1ad",
        symbol: "●",
        weight: 30,
        kind: "chips",
        value: 100,
      },
      {
        id: "royal-500",
        name: "500 Chip Credit",
        rarity: "Uncommon",
        color: "#62d4aa",
        symbol: "◆",
        weight: 34,
        kind: "chips",
        value: 500,
      },
      {
        id: "royal-1000",
        name: "1000 Chip Credit",
        rarity: "Rare",
        color: "#6c9cff",
        symbol: "✦",
        weight: 22,
        kind: "chips",
        value: 1000,
      },
      {
        id: "royal-badge",
        name: "Moonshot Badge",
        rarity: "Epic",
        color: "#ba81ff",
        symbol: "☼",
        weight: 11,
        kind: "collectible",
        value: 1,
      },
      {
        id: "royal-key",
        name: "Royal Prize Key",
        rarity: "Legendary",
        color: "#ffb84e",
        symbol: "★",
        weight: 3,
        kind: "redeemable",
        value: 1,
      },
    ],
  },
];

export function getCase(caseId: string): CaseTier {
  const selected = CASES.find((item) => item.id === caseId);
  if (!selected) throw new Error("Unknown case.");
  return selected;
}

export function choosePrize(caseTier: CaseTier, random = Math.random): Prize {
  const total = caseTier.prizes.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = random() * total;
  for (const prize of caseTier.prizes) {
    roll -= prize.weight;
    if (roll < 0) return prize;
  }
  return caseTier.prizes[0];
}

export function canOpenCase(balance: number, cost: number): boolean {
  return balance >= cost;
}

export function openCase(
  caseId: string,
  balance: number,
  random: () => number = Math.random,
  now: () => number = Date.now,
): CaseResult {
  const selectedCase = getCase(caseId);
  if (!canOpenCase(balance, selectedCase.cost))
    throw new Error(`You need ${selectedCase.cost - balance} more chips.`);
  const prize = choosePrize(selectedCase, random);
  const payout = prize.kind === "chips" ? prize.value : 0;
  return {
    caseId,
    prize,
    cost: selectedCase.cost,
    payout,
    balance: balance - selectedCase.cost + payout,
    openedAt: now(),
  };
}

export function prizeProbability(caseTier: CaseTier, prizeId: string): number {
  const prize = caseTier.prizes.find((item) => item.id === prizeId);
  if (!prize) return 0;
  const total = caseTier.prizes.reduce((sum, item) => sum + item.weight, 0);
  return (prize.weight / total) * 100;
}
