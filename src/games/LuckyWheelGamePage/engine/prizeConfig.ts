import type { PrizeConfig, PrizeRarity, PrizeSegment } from "./types";

/**
 * The active Lucky Wheel configuration.
 *
 * Weights are relative: the theoretical probability of a prize is
 * `weight / totalWeight`. The weights below sum to 100, so they read directly
 * as percentages.
 *
 * Chip prizes are quoted at the default 25-chip stake. The chips a spin pays
 * are `prize / stake x chosen stake`, so every stake has the same return to
 * player.
 */
export const LUCKY_WHEEL_CONFIG: PrizeConfig = {
  version: "lucky-wheel-v1",
  stake: 25,
  stakes: [10, 25, 50, 100],
  segments: [
    {
      id: "seg-01",
      index: 0,
      label: "0",
      prize: 0,
      weight: 20,
      type: "chips",
      rarity: "common",
      color: "#4a5568",
      enabled: true,
    },
    {
      id: "seg-02",
      index: 1,
      label: "5",
      prize: 5,
      weight: 15,
      type: "chips",
      rarity: "common",
      color: "#2f855a",
      enabled: true,
    },
    {
      id: "seg-03",
      index: 2,
      label: "10",
      prize: 10,
      weight: 15,
      type: "chips",
      rarity: "common",
      color: "#2b6cb0",
      enabled: true,
    },
    {
      id: "seg-04",
      index: 3,
      label: "15",
      prize: 15,
      weight: 10,
      type: "chips",
      rarity: "common",
      color: "#6b46c1",
      enabled: true,
    },
    {
      id: "seg-05",
      index: 4,
      label: "20",
      prize: 20,
      weight: 10,
      type: "chips",
      rarity: "common",
      color: "#b83280",
      enabled: true,
    },
    {
      id: "seg-06",
      index: 5,
      label: "25",
      prize: 25,
      weight: 8,
      type: "chips",
      rarity: "uncommon",
      color: "#c05621",
      enabled: true,
    },
    {
      id: "seg-07",
      index: 6,
      label: "30",
      prize: 30,
      weight: 7,
      type: "chips",
      rarity: "uncommon",
      color: "#b7791f",
      enabled: true,
    },
    {
      id: "seg-08",
      index: 7,
      label: "40",
      prize: 40,
      weight: 5,
      type: "chips",
      rarity: "uncommon",
      color: "#2c7a7b",
      enabled: true,
    },
    {
      id: "seg-09",
      index: 8,
      label: "50",
      prize: 50,
      weight: 4,
      type: "chips",
      rarity: "uncommon",
      color: "#805ad5",
      enabled: true,
    },
    {
      id: "seg-10",
      index: 9,
      label: "75",
      prize: 75,
      weight: 3,
      type: "chips",
      rarity: "rare",
      color: "#dd6b20",
      enabled: true,
    },
    {
      id: "seg-11",
      index: 10,
      label: "100",
      prize: 100,
      weight: 2,
      type: "chips",
      rarity: "legendary",
      color: "#d69e2e",
      enabled: true,
    },
    {
      id: "seg-12",
      index: 11,
      label: "250",
      prize: 250,
      weight: 1,
      type: "chips",
      rarity: "legendary",
      color: "#e53e3e",
      enabled: true,
    },
  ],
};

/** Rare prizes get the glow, the fanfare and the confetti. */
export function isRarePrize(segment: PrizeSegment): boolean {
  return segment.rarity === "rare" || segment.rarity === "legendary";
}

export const RARITY_LABELS: Record<PrizeRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};
