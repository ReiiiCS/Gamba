export type PrizeType = "chips" | "multiplier";

export type PrizeRarity = "common" | "uncommon" | "rare" | "legendary";

export type PrizeSegment = {
  /** Stable identifier. The frontend resolves the wheel slot from this id. */
  id: string;
  /** Wheel slot, 0 = the segment under the pointer when the wheel is unrotated. */
  index: number;
  /** Short text drawn on the wheel face. */
  label: string;
  /** Reward amount in chips (or the multiplier value for `multiplier` prizes). */
  prize: number;
  /** Probability weight, relative to the sum of all enabled weights. */
  weight: number;
  type: PrizeType;
  rarity: PrizeRarity;
  color: string;
  enabled: boolean;
};

export type PrizeConfig = {
  version: string;
  /** Virtual chips a single spin costs. */
  stake: number;
  segments: PrizeSegment[];
};

export type SpinRecord = {
  id: string;
  configVersion: string;
  segmentId: string;
  segmentIndex: number;
  label: string;
  prize: number;
  prizeType: PrizeType;
  weight: number;
  /** weight / totalWeight, frozen at selection time. */
  probability: number;
  stake: number;
  /** Chips awarded once the spin settles. */
  payout: number;
  /** payout - stake. */
  net: number;
  rarity: PrizeRarity;
  settled: boolean;
  createdAt: number;
};

export type SpinResult = {
  record: SpinRecord;
  segment: PrizeSegment;
};
