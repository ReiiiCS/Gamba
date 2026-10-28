import { useEffect, useRef, useState } from "react";
import "./BlackjackGamePage.css";
import PlayingCard from "./PlayingCard";
import {
  ActiveGameState,
  createInitialState,
  dealRound,
  hit,
  stand,
  doubleDown,
  splitHand,
  newRound,
  loadBalance,
  loadHistory,
  loadActiveState,
  saveActiveState,
  resetBalance as resetBalanceEngine,
} from "./engine/game";
import { isValidBet } from "./engine/payout";
import { getHandValue, isPair } from "./engine/hand";

const BET_OPTIONS = [10, 25, 50, 100, 250];

export default function BlackjackGamePage({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState(loadBalance());
  const [, setHistory] = useState(loadHistory());
  const [state, setState] = useState<ActiveGameState>(() => {
    const active = loadActiveState();
    if (active) {
      return {
        ...active,
        balance: loadBalance(),
        history: loadHistory(),
      };
    }
    return createInitialState(loadBalance(), loadHistory());
  });
  const [bet, setBet] = useState(25);
  const [showRules, setShowRules] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showRules) setShowRules(false);
        else if (showResult) setShowResult(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showRules, showResult]);

  useEffect(() => {
    saveActiveState(state.phase === "SETTLED" ? null : state);
  }, [state]);

  useEffect(() => {
    if (state.phase === "SETTLED" && state.playerHands.length > 0) {
      setShowResult(true);
    }
  }, [state.phase, state.playerHands.length]);

  const canDealNow = state.phase === "BETTING" && isValidBet(bet) && balance >= bet;
  const currentHand = state.playerHands[state.activeHandIndex];
  const canHit = state.phase === "PLAYER_TURN" && currentHand && currentHand.result === "PENDING" && !currentHand.hand.doubled && currentHand.hand.cards.length >= 2;
  const canStand = state.phase === "PLAYER_TURN" && currentHand && currentHand.result === "PENDING";
  const canDouble = state.phase === "PLAYER_TURN" && currentHand && currentHand.result === "PENDING" && currentHand.hand.cards.length === 2 && !currentHand.hand.doubled && balance >= currentHand.hand.wager;
  const canSplit = state.phase === "PLAYER_TURN" && state.playerHands.length === 1 && currentHand && currentHand.result === "PENDING" && currentHand.hand.cards.length === 2 && isPair(currentHand.hand.cards) && balance >= currentHand.hand.wager; // no re-splitting in initial release

  function handleDeal() {
    if (!canDealNow) return;
    const next = dealRound({ ...state, balance }, bet);
    setState(next);
    setBalance(next.balance);
    setHistory(next.history);
  }

  function handleHit() {
    if (!canHit) return;
    const next = hit(state);
    setState(next);
    setBalance(next.balance);
    setHistory(next.history);
  }

  function handleStand() {
    if (!canStand) return;
    const next = stand(state);
    setState(next);
    setBalance(next.balance);
    setHistory(next.history);
  }

  function handleDouble() {
    if (!canDouble) return;
    const next = doubleDown(state);
    setState(next);
    setBalance(next.balance);
    setHistory(next.history);
  }

  function handleSplit() {
    if (!canSplit) return;
    const next = splitHand(state);
    setState(next);
    setBalance(next.balance);
    setHistory(next.history);
  }

  function handleNewRound() {
    const next = newRound(state);
    setState(next);
    setShowResult(false);
  }

  function handleResetBalance() {
    if (state.phase !== "BETTING") return;
    const newBalance = resetBalanceEngine();
    setBalance(newBalance);
    setHistory([]);
    setState(createInitialState(newBalance, []));
    setShowResult(false);
  }

  const showResetBalance = state.phase === "BETTING" && balance < BET_OPTIONS[0];

  const getDealerTotal = () => {
    if (state.dealerRevealed && state.dealerHiddenCard) {
      return getHandValue([...state.dealerHand, state.dealerHiddenCard]).total;
    }
    if (state.dealerHand.length > 0) {
      return getHandValue(state.dealerHand).total;
    }
    return 0;
  };

  const getPlayerTotal = (cards: any[]) => {
    return getHandValue(cards).total;
  };

  const getResultInfo = () => {
    if (state.playerHands.length === 0) return null;
    const hand = state.playerHands[0];
    const playerTotal = getHandValue(hand.hand.cards).total;
    const dealerTotal = getDealerTotal();
    const wager = hand.hand.wager;
    const payout = hand.payout;
    const net = payout - wager;
    
    let resultType: "win" | "lose" | "push" | "blackjack" = "lose";
    if (hand.result === "BLACKJACK") resultType = "blackjack";
    else if (hand.result === "WIN") resultType = "win";
    else if (hand.result === "PUSH") resultType = "push";
    else if (hand.result === "LOSE" || hand.result === "BUST") resultType = "lose";
    
    return { resultType, playerTotal, dealerTotal, wager, payout, net };
  };

  const statusText = () => {
    if (state.phase === "BETTING") return "Place your bet and press Deal to start.";
    if (state.phase === "PLAYER_TURN") {
      if (!currentHand) return "Your turn";
      const pv = getHandValue(currentHand.hand.cards);
      return `Your Turn - Player Total: ${pv.total}${pv.isSoft && pv.total !== 21 ? " (Soft)" : ""}`;
    }
    if (state.phase === "DEALER_TURN") return "Dealer's Turn - Drawing cards...";
    if (state.phase === "SETTLED") {
      const info = getResultInfo();
      if (!info) return "Round Complete";
      if (info.resultType === "blackjack") return "BLACKJACK! You win!";
      if (info.resultType === "win") return "You Win!";
      if (info.resultType === "push") return "Push - Tie";
      if (info.resultType === "lose") return "Dealer Wins";
      return "Round Complete";
    }
    return "";
  };

  return (
    <main className="game-page blackjack-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge">
          <span className="live-dot" /> FREE PLAY
        </span>
      </header>

      <section className="blackjack-content">
        <div className="blackjack-top-bar">
          <div className="blackjack-title-section">
            <h1 className="blackjack-title">BLACKJACK</h1>
            <span className="blackjack-subtitle">Premium Casino Table • Virtual Chips Only</span>
          </div>
          <div className="blackjack-balance-section">
            <span className="blackjack-balance-label">Balance</span>
            <span className="blackjack-balance-amount">${balance.toLocaleString()}</span>
          </div>
          <div className="blackjack-top-actions">
            <button className="blackjack-info-button" onClick={() => setShowRules(true)} type="button">
              Rules
            </button>
          </div>
        </div>

        <div className="blackjack-table-container">
          <div className="blackjack-dealer-area">
            <div className="blackjack-area-label">DEALER</div>
            <div className="blackjack-cards-row">
              {state.dealerHand.map((card: any, idx: number) => (
                <PlayingCard key={`d-${idx}`} card={card} dealDelay={idx * 150} animate={state.phase !== "BETTING"} />
              ))}
              {state.phase !== "SETTLED" && state.phase !== "BETTING" && state.dealerHiddenCard && !state.dealerRevealed && (
                <PlayingCard card={null} hidden={true} dealDelay={200} animate={true} />
              )}
              {state.dealerRevealed && state.dealerHiddenCard && (
                <PlayingCard card={state.dealerHiddenCard} dealDelay={300} flip={true} animate={true} />
              )}
            </div>
            {(state.dealerRevealed || state.phase === "DEALER_TURN") && state.dealerHand.length > 0 && (
              <div className="blackjack-hand-total">
                Dealer Total: {getDealerTotal()}
              </div>
            )}
          </div>

          <div className="blackjack-player-area">
            <div className="blackjack-area-label">PLAYER</div>
            {state.playerHands.length === 0 ? (
              <div className="blackjack-cards-row">
                <PlayingCard card={null} hidden={true} dealDelay={0} animate={false} />
                <PlayingCard card={null} hidden={true} dealDelay={100} animate={false} />
              </div>
            ) : (
              <div className="blackjack-split-hands">
                {state.playerHands.map((ph: any, hidx: number) => (
                  <div
                    key={`ph-${hidx}`}
                    className={`blackjack-split-hand ${hidx === state.activeHandIndex && state.phase === "PLAYER_TURN" ? "active" : ""}`}
                  >
                    <div className="blackjack-cards-row">
                      {ph.hand.cards.map((card: any, cidx: number) => (
                        <PlayingCard
                          key={`p-${hidx}-${cidx}`}
                          card={card}
                          dealDelay={cidx * 150}
                          animate={true}
                          winning={state.phase === "SETTLED" && (ph.result === "WIN" || ph.result === "BLACKJACK")}
                        />
                      ))}
                    </div>
                    <div className="blackjack-hand-total">
                      Total: {getPlayerTotal(ph.hand.cards)}
                      {state.playerHands.length > 1 && ` | Hand ${hidx + 1} | Bet: $${ph.hand.wager}`}
                      {ph.hand.doubled && " (Doubled)"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="blackjack-bottom-controls">
          <div className="blackjack-status-message">{statusText()}</div>

          {state.phase === "BETTING" && (
            <div className="blackjack-wager-section">
              <div className="blackjack-wager-label">Wager</div>
              <div className="blackjack-wager-chips">
                {BET_OPTIONS.map((value) => (
                  <button
                    key={value}
                    className={`blackjack-wager-chip ${bet === value ? "selected" : ""}`}
                    onClick={() => setBet(value)}
                    disabled={balance < value}
                    type="button"
                  >
                    ${value}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="blackjack-action-buttons">
            {state.phase === "BETTING" && (
              <button className="blackjack-btn deal" onClick={handleDeal} disabled={!canDealNow} type="button">
                Deal
              </button>
            )}
            {showResetBalance && (
              <button className="blackjack-btn" onClick={handleResetBalance} type="button">
                Reset to $1000
              </button>
            )}
            {state.phase === "PLAYER_TURN" && (
              <>
                <button className="blackjack-btn" onClick={handleHit} disabled={!canHit} type="button">
                  Hit
                </button>
                <button className="blackjack-btn" onClick={handleStand} disabled={!canStand} type="button">
                  Stand
                </button>
                <button className="blackjack-btn" onClick={handleDouble} disabled={!canDouble || state.playerHands.length > 1} type="button">
                  Double
                </button>
                <button className="blackjack-btn" onClick={handleSplit} disabled={!canSplit} type="button">
                  Split
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <section className="mines-panel" aria-labelledby="blackjack-history-title">
            <div className="mines-panel-heading">
              <span className="odds-heading" id="blackjack-history-title">
                GAME HISTORY
              </span>
              {state.history.length > 0 && (
                <span className="plinko-history-count">{state.history.length} TOTAL</span>
              )}
            </div>
            {state.history.length === 0 ? (
              <p className="mines-empty-history">Your rounds will show up here.</p>
            ) : (
              <ol className="mines-history-list">
                {state.history.slice(0, 15).map((round: any) => (
                  <li key={round.id}>
                    <span className="mines-history-mult">
                      Bet ${(round.bets || []).join("/$")} · {(round.playerResults || []).map((r: any) => r.result).join(" / ")}
                    </span>
                    <span className={round.net >= 0 ? "mines-history-win" : round.net < 0 ? "mines-history-loss" : "mines-history-win"}>
                      {round.net >= 0 ? `+${round.net}` : round.net}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </section>

      {showResult && state.phase === "SETTLED" && (
        <div className="blackjack-result-modal" onClick={() => setShowResult(false)}>
          <div className="blackjack-result-content" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const info = getResultInfo();
              if (!info) return null;
              return (
                <>
                  <div className={`blackjack-result-title ${info.resultType}`}>
                    {info.resultType === "blackjack" && "BLACKJACK!"}
                    {info.resultType === "win" && "YOU WIN!"}
                    {info.resultType === "push" && "PUSH"}
                    {info.resultType === "lose" && "DEALER WINS"}
                  </div>
                  <div className="blackjack-result-details">
                    <div className="blackjack-result-row">
                      <span>Your Total:</span>
                      <span>{info.playerTotal}</span>
                    </div>
                    <div className="blackjack-result-row">
                      <span>Dealer Total:</span>
                      <span>{info.dealerTotal}</span>
                    </div>
                    <div className="blackjack-result-row">
                      <span>Wager:</span>
                      <span>${info.wager}</span>
                    </div>
                    <div className="blackjack-result-row">
                      <span>Gross Payout:</span>
                      <span>${info.payout}</span>
                    </div>
                    <div className={`blackjack-result-row ${info.net >= 0 ? "positive" : "negative"}`}>
                      <span>Net {info.net >= 0 ? "Profit" : "Loss"}:</span>
                      <span>{info.net >= 0 ? "+" : ""}${info.net}</span>
                    </div>
                    <div className="blackjack-result-row">
                      <span>New Balance:</span>
                      <span>${balance.toLocaleString()}</span>
                    </div>
                  </div>
                  <button className="blackjack-btn" onClick={handleNewRound} type="button">
                    Play Again
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {showRules && (
        <div className="blackjack-result-modal" onClick={() => setShowRules(false)}>
          <div className="blackjack-result-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="blackjack-result-title" style={{ fontSize: "24px", color: "#d4af37" }}>
              GAME RULES
            </div>
            <div className="blackjack-result-details" style={{ textAlign: "left" }}>
              <div style={{ marginBottom: "1rem" }}>
                <strong style={{ color: "#d4af37" }}>Objective:</strong> Beat the dealer by getting closer to 21 without going over.
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <strong style={{ color: "#d4af37" }}>Card Values:</strong><br />
                2-10: Face value<br />
                J, Q, K: 10<br />
                A: 11 or 1
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <strong style={{ color: "#d4af37" }}>Blackjack:</strong> A + 10-value on first two cards pays 3:2
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <strong style={{ color: "#d4af37" }}>Dealer:</strong> Hits on 16 or less, stands on soft 17 or higher
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <strong style={{ color: "#d4af37" }}>Actions:</strong> Hit, Stand, Double Down (on first two cards), Split (on pairs)
              </div>
              <div>
                <strong style={{ color: "#d4af37" }}>Payouts:</strong> Win 1:1, Blackjack 3:2, Push returns bet
              </div>
            </div>
            <button className="blackjack-btn" onClick={() => setShowRules(false)} type="button">
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
