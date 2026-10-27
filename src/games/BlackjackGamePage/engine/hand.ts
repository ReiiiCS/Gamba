import { Card } from "./types";

export function getCardValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (card.rank === "J" || card.rank === "Q" || card.rank === "K" || card.rank === "10") {
    return 10;
  }
  return parseInt(card.rank, 10);
}

export function getHandValue(cards: Card[]): { total: number; isSoft: boolean; isBust: boolean } {
  let total = 0;
  let aces = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (c.rank === "A") {
      aces++;
      total += 11;
    } else if (c.rank === "J" || c.rank === "Q" || c.rank === "K" || c.rank === "10") {
      total += 10;
    } else {
      total += parseInt(c.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  const isSoft = aces > 0 && total <= 21;
  const isBust = total > 21;
  return { total: isBust ? total : total, isSoft, isBust };
}

export function isNaturalBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const v1 = getCardValue(cards[0]);
  const v2 = getCardValue(cards[1]);
  const hasAce = cards[0].rank === "A" || cards[1].rank === "A";
  const hasTen = v1 === 10 || v2 === 10;
  return hasAce && hasTen;
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return cards[0].rank === cards[1].rank;
}
