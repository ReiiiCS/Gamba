export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type Card = {
  suit: Suit;
  rank: Rank;
};

export type Hand = {
  cards: Card[];
  wager: number;
  doubled: boolean;
};

export type GamePhase =
  | "BETTING"
  | "DEALING"
  | "PLAYER_TURN"
  | "DEALER_TURN"
  | "SETTLED";

export type HandResult =
  | "PENDING"
  | "BLACKJACK"
  | "WIN"
  | "LOSE"
  | "PUSH"
  | "BUST";

export type PlayerHandState = {
  hand: Hand;
  result: HandResult;
  payout: number;
};

export type ActiveGameState = {
  phase: GamePhase;
  deck: Card[];
  playerHands: PlayerHandState[];
  activeHandIndex: number;
  dealerHand: Card[];
  dealerHiddenCard: Card | null;
  dealerRevealed: boolean;
  balance: number;
  history: GameHistoryEntry[];
  version: number;
};

export type GameHistoryEntry = {
  id: number;
  timestamp: number;
  bets: number[];
  playerResults: Array<{
    result: HandResult;
    cards: Card[];
    wager: number;
    payout: number;
  }>;
  dealerCards: Card[];
  net: number;
};

export type RNG = () => number;
