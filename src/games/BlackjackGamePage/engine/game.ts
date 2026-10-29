import { ActiveGameState, Card, GameHistoryEntry, PlayerHandState, RNG } from "./types";
import { createDeck, dealCards, shuffleDeck } from "./deck";
import { getHandValue, isNaturalBlackjack, isPair } from "./hand";
import { calculatePayout, isValidBet } from "./payout";
import { createCryptoRNG } from "./rng";
import type { GamePhase } from "./types";

export type { ActiveGameState, GameHistoryEntry, PlayerHandState } from "./types";

const STARTING_BALANCE = 1000;
const STORAGE_KEY = "gamba_blackjack_state_v1";
const STORAGE_BALANCE_KEY = "gamba_blackjack_balance_v1";
const STORAGE_HISTORY_KEY = "gamba_blackjack_history_v1";

export function loadBalance(): number {
  try {
    const raw = localStorage.getItem(STORAGE_BALANCE_KEY);
    if (raw === null) return STARTING_BALANCE;
    const v = parseInt(raw, 10);
    if (Number.isNaN(v) || v < 0) return STARTING_BALANCE;
    return v;
  } catch {
    return STARTING_BALANCE;
  }
}

export function saveBalance(balance: number): void {
  try {
    localStorage.setItem(STORAGE_BALANCE_KEY, String(Math.max(0, Math.floor(balance))));
  } catch {}
}

export function resetBalance(): number {
  const balance = STARTING_BALANCE;
  saveBalance(balance);
  try {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify([]));
  } catch {}
  try {
    localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(null));
  } catch {}
  return balance;
}

export function loadHistory(): GameHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function saveHistory(history: GameHistoryEntry[]): void {
  try {
    // keep last 50
    const trimmed = history.slice(0, 50);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function loadActiveState(): ActiveGameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveGameState;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== 1) return null;
    // basic validation
    if (!Array.isArray(parsed.deck) || !Array.isArray(parsed.playerHands) || !Array.isArray(parsed.dealerHand)) {
      return null;
    }
    if (parsed.phase === "SETTLED") return null; // don't restore settled
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveState(state: ActiveGameState | null): void {
  try {
    if (state === null) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    // don't save settled states
    if (state.phase === "SETTLED") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function createInitialState(balance: number, history: GameHistoryEntry[]): ActiveGameState {
  return {
    phase: "BETTING",
    deck: [],
    playerHands: [],
    activeHandIndex: 0,
    dealerHand: [],
    dealerHiddenCard: null,
    dealerRevealed: false,
    balance,
    history,
    version: 1,
  };
}

export function canDeal(state: ActiveGameState, bet: number): { ok: boolean; reason?: string } {
  if (state.phase !== "BETTING") return { ok: false, reason: "Round in progress" };
  if (!isValidBet(bet)) return { ok: false, reason: "Invalid bet" };
  if (state.balance < bet) return { ok: false, reason: "Insufficient balance" };
  return { ok: true };
}

export function dealRound(
  state: ActiveGameState,
  bet: number,
  rng: RNG = createCryptoRNG(),
): ActiveGameState {
  const check = canDeal(state, bet);
  if (!check.ok) return state;

  let deck = state.deck.length > 0 ? state.deck : shuffleDeck(createDeck(), rng);
  // ensure enough cards
  if (deck.length < 4) {
    deck = shuffleDeck(createDeck(), rng);
  }

  const p1 = dealCards(deck, 2);
  deck = p1.remaining;
  const d1 = dealCards(deck, 2);
  deck = d1.remaining;

  const playerCards = p1.cards;
  const dealerCardsAll = d1.cards;
  const dealerUp = dealerCardsAll[0];
  const dealerDown = dealerCardsAll[1];

  const playerHandState: PlayerHandState = {
    hand: { cards: playerCards, wager: bet, doubled: false },
    result: "PENDING",
    payout: 0,
  };

  let phase: "PLAYER_TURN" | "SETTLED" = "PLAYER_TURN";

  // check naturals
  const playerNat = isNaturalBlackjack(playerCards);
  const dealerNat = isNaturalBlackjack([dealerUp, dealerDown]);

  if (playerNat && dealerNat) {
    // push
    playerHandState.result = "PUSH";
    playerHandState.payout = bet;
    const newBalance = state.balance - bet + bet;
    const newState: ActiveGameState = {
      ...state,
      phase: "SETTLED",
      deck,
      playerHands: [playerHandState],
      activeHandIndex: 0,
      dealerHand: [dealerUp, dealerDown],
      dealerHiddenCard: null,
      dealerRevealed: true,
      balance: newBalance,
    };
    // record history
    const entry: GameHistoryEntry = {
      id: Date.now(),
      timestamp: Date.now(),
      bets: [bet],
      playerResults: [
        {
          result: "PUSH",
          cards: playerCards,
          wager: bet,
          payout: bet,
        },
      ],
      dealerCards: [dealerUp, dealerDown],
      net: 0,
    };
    newState.history = [entry, ...state.history];
    saveBalance(newBalance);
    saveHistory(newState.history);
    saveActiveState(newState);
    return newState;
  } else if (playerNat && !dealerNat) {
    // player blackjack
    const payoutTotal = calculatePayout(bet, "BLACKJACK", true);
    playerHandState.result = "BLACKJACK";
    playerHandState.payout = payoutTotal;
    const newBalance = state.balance - bet + payoutTotal;
    const newState: ActiveGameState = {
      ...state,
      phase: "SETTLED",
      deck,
      playerHands: [playerHandState],
      activeHandIndex: 0,
      dealerHand: [dealerUp, dealerDown],
      dealerHiddenCard: null,
      dealerRevealed: true,
      balance: newBalance,
    };
    const entry: GameHistoryEntry = {
      id: Date.now(),
      timestamp: Date.now(),
      bets: [bet],
      playerResults: [
        {
          result: "BLACKJACK",
          cards: playerCards,
          wager: bet,
          payout: payoutTotal,
        },
      ],
      dealerCards: [dealerUp, dealerDown],
      net: payoutTotal - bet,
    };
    newState.history = [entry, ...state.history];
    saveBalance(newBalance);
    saveHistory(newState.history);
    saveActiveState(newState);
    return newState;
  } else if (!playerNat && dealerNat) {
    // dealer blackjack, player loses
    playerHandState.result = "LOSE";
    playerHandState.payout = 0;
    const newBalance = state.balance - bet;
    const newState: ActiveGameState = {
      ...state,
      phase: "SETTLED",
      deck,
      playerHands: [playerHandState],
      activeHandIndex: 0,
      dealerHand: [dealerUp, dealerDown],
      dealerHiddenCard: null,
      dealerRevealed: true,
      balance: newBalance,
    };
    const entry: GameHistoryEntry = {
      id: Date.now(),
      timestamp: Date.now(),
      bets: [bet],
      playerResults: [
        {
          result: "LOSE",
          cards: playerCards,
          wager: bet,
          payout: 0,
        },
      ],
      dealerCards: [dealerUp, dealerDown],
      net: -bet,
    };
    newState.history = [entry, ...state.history];
    saveBalance(newBalance);
    saveHistory(newState.history);
    saveActiveState(newState);
    return newState;
  }

  // normal play
  const newBalance = state.balance - bet;
  const newState: ActiveGameState = {
    ...state,
    phase,
    deck,
    playerHands: [playerHandState],
    activeHandIndex: 0,
    dealerHand: [dealerUp],
    dealerHiddenCard: dealerDown,
    dealerRevealed: false,
    balance: newBalance,
  };
  saveBalance(newBalance);
  saveActiveState(newState);
  return newState;
}

export function hit(state: ActiveGameState, rng: RNG = createCryptoRNG()): ActiveGameState {
  if (state.phase !== "PLAYER_TURN") return state;
  if (state.playerHands.length === 0) return state;
  const idx = state.activeHandIndex;
  const handState = state.playerHands[idx];
  if (handState.result !== "PENDING") return state;
  if (handState.hand.doubled) return state; // doubled already took one card and stands

  let deck = state.deck;
  if (deck.length === 0) {
    deck = shuffleDeck(createDeck(), rng);
  }
  const d = dealCards(deck, 1);
  deck = d.remaining;

  const newCards = [...handState.hand.cards, ...d.cards];
  const handStateNew = {
    ...handState,
    hand: { ...handState.hand, cards: newCards },
  };
  const pv = getHandValue(newCards);
  if (pv.isBust) {
    handStateNew.result = "BUST";
    handStateNew.payout = 0;
  }

  const newHands = [...state.playerHands];
  newHands[idx] = handStateNew;

  // check if all hands done
  const allDone = newHands.every((h) => h.result !== "PENDING");
  let newPhase: GamePhase = state.phase;
  if (allDone) {
    newPhase = "DEALER_TURN";
  }

  const newState: ActiveGameState = {
    ...state,
    phase: newPhase,
    deck,
    playerHands: newHands,
  };
  saveActiveState(newState);
  return newState;
}

export function stand(state: ActiveGameState): ActiveGameState {
  if (state.phase !== "PLAYER_TURN") return state;
  if (state.playerHands.length === 0) return state;
  const idx = state.activeHandIndex;
  const handState = state.playerHands[idx];
  if (handState.result !== "PENDING") {
    // move to next hand
  }

  const newHands = [...state.playerHands];
  // mark current as stood if pending and not busted
  if (newHands[idx] && newHands[idx].result === "PENDING") {
    const pv = getHandValue(newHands[idx].hand.cards);
    if (pv.isBust) {
      newHands[idx] = { ...newHands[idx], result: "BUST", payout: 0 };
    } else {
      newHands[idx] = { ...newHands[idx], result: "WIN" }; // will be resolved vs dealer
      // mark as pending resolution
      newHands[idx] = { ...newHands[idx], result: "PENDING" }; // keep pending for dealer resolution
    }
  }

  // advance hand
  let nextIdx = idx + 1;
  if (nextIdx >= newHands.length) {
    // all done
    const newState: ActiveGameState = {
      ...state,
      phase: "DEALER_TURN",
      playerHands: newHands.map((h) => {
        if (h.result === "PENDING") {
          const pv = getHandValue(h.hand.cards);
          if (pv.isBust) return { ...h, result: "BUST", payout: 0 };
          return h; // pending vs dealer
        }
        return h;
      }),
    };
    saveActiveState(newState);
    return newState;
  } else {
    const newState: ActiveGameState = {
      ...state,
      activeHandIndex: nextIdx,
      playerHands: newHands,
    };
    saveActiveState(newState);
    return newState;
  }
}

export function doubleDown(state: ActiveGameState, rng: RNG = createCryptoRNG()): ActiveGameState {
  if (state.phase !== "PLAYER_TURN") return state;
  if (state.playerHands.length === 0) return state;
  const idx = state.activeHandIndex;
  const handState = state.playerHands[idx];
  if (handState.result !== "PENDING") return state;
  if (handState.hand.cards.length !== 2) return state;
  if (handState.hand.doubled) return state;
  if (state.balance < handState.hand.wager) return state; // need more for double

  // deduct additional wager
  let newBalance = state.balance - handState.hand.wager;
  let deck = state.deck;
  if (deck.length === 0) deck = shuffleDeck(createDeck(), rng);
  const d = dealCards(deck, 1);
  deck = d.remaining;
  const newCards = [...handState.hand.cards, ...d.cards];
  const pv = getHandValue(newCards);
  const newHandState: PlayerHandState = {
    hand: { cards: newCards, wager: handState.hand.wager * 2, doubled: true },
    result: pv.isBust ? "BUST" : "PENDING",
    payout: pv.isBust ? 0 : 0,
  };
  const newHands = [...state.playerHands];
  newHands[idx] = newHandState;
  const allDone = newHands.every((h) => h.result !== "PENDING");
  const newState: ActiveGameState = {
    ...state,
    phase: allDone ? "DEALER_TURN" : state.phase,
    deck,
    playerHands: newHands,
    balance: newBalance,
  };
  saveBalance(newBalance);
  saveActiveState(newState);
  return newState;
}

export function splitHand(state: ActiveGameState, rng: RNG = createCryptoRNG()): ActiveGameState {
  if (state.phase !== "PLAYER_TURN") return state;
  if (state.playerHands.length !== 1) return state;
  const handState = state.playerHands[0];
  if (handState.result !== "PENDING") return state;
  if (!isPair(handState.hand.cards)) return state;
  if (handState.hand.cards.length !== 2) return state;
  if (state.balance < handState.hand.wager) return state;

  let deck = state.deck;
  if (deck.length < 2) {
    if (deck.length === 0) deck = shuffleDeck(createDeck(), rng);
    else {
      const extra = shuffleDeck(createDeck(), rng);
      deck = [...deck, ...extra];
    }
  }

  const card1 = handState.hand.cards[0];
  const card2 = handState.hand.cards[1];
  const isAces = card1.rank === "A" && card2.rank === "A";

  const d1 = dealCards(deck, 1);
  deck = d1.remaining;
  const d2 = dealCards(deck, 1);
  deck = d2.remaining;

  const hand1Cards = [card1, d1.cards[0]];
  const hand2Cards = [card2, d2.cards[0]];

  let newHands: PlayerHandState[] = [];
  if (isAces) {
    // Split aces: deal one card to each, auto-stand, no further hits
    // 21 is not natural blackjack
    newHands = [
      { hand: { cards: hand1Cards, wager: handState.hand.wager, doubled: false }, result: "PENDING", payout: 0 },
      { hand: { cards: hand2Cards, wager: handState.hand.wager, doubled: false }, result: "PENDING", payout: 0 },
    ];
    // Auto-stand both
    newHands = newHands.map((h) => {
      const pv = getHandValue(h.hand.cards);
      if (pv.isBust) return { ...h, result: "BUST", payout: 0 };
      return { ...h, result: "PENDING" }; // will be resolved vs dealer
    });
  } else {
    newHands = [
      { hand: { cards: hand1Cards, wager: handState.hand.wager, doubled: false }, result: "PENDING", payout: 0 },
      { hand: { cards: hand2Cards, wager: handState.hand.wager, doubled: false }, result: "PENDING", payout: 0 },
    ];
  }

  const newBalance = state.balance - handState.hand.wager;
  let newPhase: any = state.phase;
  let newActiveIndex = 0;
  if (isAces) {
    newPhase = "DEALER_TURN";
    newActiveIndex = 0;
  }
  const newState: ActiveGameState = {
    ...state,
    phase: newPhase,
    deck,
    playerHands: newHands,
    activeHandIndex: newActiveIndex,
    balance: newBalance,
  };
  saveBalance(newBalance);
  saveActiveState(newState);
  return newState;
}

function getDealerCardsInOrder(state: ActiveGameState): Card[] {
  const [upCard, ...drawnCards] = state.dealerHand;
  if (state.dealerHiddenCard) {
    return upCard ? [upCard, state.dealerHiddenCard, ...drawnCards] : [state.dealerHiddenCard, ...drawnCards];
  }
  return [...state.dealerHand];
}

function settleDealer(state: ActiveGameState, dealerCards: Card[]): ActiveGameState {
  const dvFinal = getHandValue(dealerCards);
  const dealerBust = dvFinal.isBust;

  const resolvedHands: PlayerHandState[] = state.playerHands.map((ph) => {
    if (ph.result === "BUST") {
      return { ...ph, payout: 0 };
    }
    if (ph.result === "BLACKJACK") {
      // already settled
      return ph;
    }
    if (ph.result === "PUSH") {
      return ph;
    }
    const pv = getHandValue(ph.hand.cards);
    if (pv.isBust) {
      return { ...ph, result: "BUST", payout: 0 };
    }
    if (dealerBust) {
      // dealer bust -> player wins normal
      const payoutTotal = calculatePayout(ph.hand.wager, "WIN", false);
      return { ...ph, result: "WIN", payout: payoutTotal };
    }
    // compare
    if (pv.total > dvFinal.total) {
      const payoutTotal = calculatePayout(ph.hand.wager, "WIN", false);
      return { ...ph, result: "WIN", payout: payoutTotal };
    } else if (pv.total < dvFinal.total) {
      return { ...ph, result: "LOSE", payout: 0 };
    } else {
      // push
      return { ...ph, result: "PUSH", payout: ph.hand.wager };
    }
  });

  // calculate balance
  let newBalance = state.balance;
  for (let i = 0; i < resolvedHands.length; i++) {
    newBalance += resolvedHands[i].payout;
  }

  const entry: GameHistoryEntry = {
    id: Date.now(),
    timestamp: Date.now(),
    bets: resolvedHands.map((h) => h.hand.wager),
    playerResults: resolvedHands.map((h) => ({
      result: h.result,
      cards: h.hand.cards,
      wager: h.hand.wager,
      payout: h.payout,
    })),
    dealerCards: dealerCards,
    net: resolvedHands.reduce((sum, h) => sum + (h.payout - h.hand.wager), 0),
  };

  const newState: ActiveGameState = {
    ...state,
    phase: "SETTLED",
    playerHands: resolvedHands,
    dealerHand: dealerCards,
    dealerHiddenCard: null,
    dealerRevealed: true,
    balance: newBalance,
    history: [entry, ...state.history],
  };

  saveBalance(newBalance);
  saveHistory(newState.history);
  saveActiveState(newState);
  return newState;
}

export function dealerStep(state: ActiveGameState, rng: RNG = createCryptoRNG()): ActiveGameState {
  if (state.phase !== "DEALER_TURN") return state;

  // Reveal the hole card first so the player can see it before any draw.
  if (!state.dealerRevealed) {
    const revealed: ActiveGameState = { ...state, dealerRevealed: true };
    saveActiveState(revealed);
    return revealed;
  }

  const dealerCards = getDealerCardsInOrder(state);
  const dv = getHandValue(dealerCards);
  if (dv.isBust || dv.total >= 17) {
    return settleDealer(state, dealerCards);
  }

  let deck = state.deck;
  if (deck.length === 0) {
    deck = shuffleDeck(createDeck(), rng);
  }
  const d = dealCards(deck, 1);
  const newState: ActiveGameState = {
    ...state,
    deck: d.remaining,
    dealerHand: [...state.dealerHand, ...d.cards],
    dealerRevealed: true,
  };
  saveActiveState(newState);
  return newState;
}

export function playDealer(state: ActiveGameState, rng: RNG = createCryptoRNG()): ActiveGameState {
  let current = state;
  let steps = 0;
  while (current.phase === "DEALER_TURN" && steps < 30) {
    current = dealerStep(current, rng);
    steps += 1;
  }
  return current;
}

export function newRound(state: ActiveGameState): ActiveGameState {
  if (state.phase !== "SETTLED" && state.phase !== "BETTING") {
    return state;
  }
  saveActiveState(null);
  return { ...state, phase: "BETTING", playerHands: [], dealerHand: [], dealerHiddenCard: null, dealerRevealed: false };
}
