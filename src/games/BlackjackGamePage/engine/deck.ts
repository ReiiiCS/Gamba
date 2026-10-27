import { Card, Rank, Suit, RNG } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let s = 0; s < SUITS.length; s++) {
    for (let r = 0; r < RANKS.length; r++) {
      deck.push({ suit: SUITS[s], rank: RANKS[r] });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[], rng: RNG): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dealCards(deck: Card[], count: number): { cards: Card[]; remaining: Card[] } {
  if (count > deck.length) {
    // If exhausted, just deal what we have (game logic should handle reshuffle strategy)
    const cards = deck.slice(0, deck.length);
    return { cards, remaining: [] };
  }
  const cards = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { cards, remaining };
}
