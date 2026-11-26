import { useEffect, useRef, useState } from "react";
import "./CaseGamePage.css";
import {
  CASES,
  STARTING_BALANCE,
  getCase,
  openCase,
  prizeProbability,
  type CaseResult,
  type Prize,
} from "./engine";

type Phase = "ready" | "rolling" | "revealed";

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export default function CaseGamePage({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [selectedCaseId, setSelectedCaseId] = useState(CASES[0].id);
  const [phase, setPhase] = useState<Phase>("ready");
  const [pendingResult, setPendingResult] = useState<CaseResult | null>(null);
  const [history, setHistory] = useState<CaseResult[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);
  const rollTimer = useRef<number | undefined>(undefined);
  const audioContext = useRef<AudioContext | null>(null);

  const selectedCase = getCase(selectedCaseId);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(rollTimer.current);
      if (audioContext.current && audioContext.current.state !== "closed") {
        void audioContext.current.close();
      }
    };
  }, [onClose]);

  function ensureAudio(): AudioContext | null {
    if (!soundEnabled || typeof window.AudioContext === "undefined") return null;
    audioContext.current ??= new window.AudioContext();
    void audioContext.current.resume();
    return audioContext.current;
  }

  function playReveal(prize: Prize) {
    const context = ensureAudio();
    if (!context) return;
    const startAt = context.currentTime + 0.02;
    [523, 659, 784].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt + index * 0.07);
      gain.gain.setValueAtTime(0.0001, startAt + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(
        prize.rarity === "Legendary" ? 0.06 : 0.035,
        startAt + 0.07 + index * 0.07,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.55 + index * 0.07);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt + index * 0.07);
      oscillator.stop(startAt + 0.62 + index * 0.07);
    });
  }

  function openSelectedCase() {
    if (phase === "rolling") return;
    try {
      const result = openCase(selectedCaseId, balance);
      setPendingResult(result);
      setPhase("rolling");
      rollTimer.current = window.setTimeout(() => {
        setBalance(result.balance);
        setHistory((current) => [result, ...current].slice(0, 8));
        setInventory((current) => ({
          ...current,
          [result.prize.id]:
            (current[result.prize.id] ?? 0) + (result.prize.kind === "chips" ? 0 : 1),
        }));
        setPhase("revealed");
        playReveal(result.prize);
      }, 1900);
    } catch (error) {
      setPhase("ready");
      setPendingResult(null);
      window.alert(error instanceof Error ? error.message : "This case is unavailable.");
    }
  }

  function resetSession() {
    if (phase === "rolling") return;
    setBalance(STARTING_BALANCE);
    setHistory([]);
    setInventory({});
    setPendingResult(null);
    setPhase("ready");
  }

  const reveal = phase === "revealed" ? pendingResult : null;

  return (
    <main className="game-page case-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge">
          <span className="live-dot" /> FREE PLAY
        </span>
      </header>

      <section className="case-game-content" aria-labelledby="case-title">
        <div className="game-page-heading case-heading">
          <div>
            <div className="modal-topline">
              <span className="live-dot" /> CASE OPENING · NO PURCHASES
            </div>
            <h1 id="case-title">NEON VAULT</h1>
          </div>
          <div className="case-balance" aria-label={`Balance ${balance} chips`}>
            <span>BALANCE</span>
            <strong>{balance.toLocaleString()}</strong>
            <small>CHIPS</small>
          </div>
        </div>

        <div className="case-layout">
          <div className="case-main">
            <div className="case-selector" aria-label="Choose a case">
              {CASES.map((caseOption) => (
                <button
                  key={caseOption.id}
                  className={`case-selector-button ${caseOption.id === selectedCaseId ? "is-active" : ""}`}
                  style={{ "--case-color": caseOption.color } as React.CSSProperties}
                  onClick={() => {
                    if (phase === "rolling") return;
                    setSelectedCaseId(caseOption.id);
                    setPhase("ready");
                    setPendingResult(null);
                  }}
                  disabled={phase === "rolling"}
                  type="button"
                >
                  <span className="case-mini-symbol" aria-hidden="true">
                    {caseOption.symbol}
                  </span>
                  <span>
                    <strong>{caseOption.name}</strong>
                    <small>{caseOption.cost} chips</small>
                  </span>
                </button>
              ))}
            </div>

            <div className={`reveal-stage ${phase === "rolling" ? "is-rolling" : ""}`}>
              <button
                className="sound-toggle"
                onClick={() => setSoundEnabled((enabled) => !enabled)}
                aria-pressed={soundEnabled}
                type="button"
              >
                <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span> SOUND{" "}
                {soundEnabled ? "ON" : "OFF"}
              </button>

              {phase === "ready" && (
                <>
                  <span
                    className="vault-halo"
                    style={{ "--case-color": selectedCase.color } as React.CSSProperties}
                  />
                  <span
                    className="vault-symbol"
                    style={{ "--case-color": selectedCase.color } as React.CSSProperties}
                    aria-hidden="true"
                  >
                    {selectedCase.symbol}
                  </span>
                  <span className="stage-caption">
                    {selectedCase.name.toUpperCase()} VAULT · {selectedCase.cost} CHIPS
                  </span>
                </>
              )}

              {phase === "rolling" && pendingResult && (
                <>
                  <div className="rolling-items" aria-label="Opening case">
                    {Array.from({ length: 15 }, (_, index) => {
                      if (index === 10) return pendingResult.prize;
                      return selectedCase.prizes[(index * 2 + 1) % selectedCase.prizes.length];
                    }).map((prize, index) => (
                      <span
                        className="rolling-item"
                        style={{ "--item-color": prize.color } as React.CSSProperties}
                        key={`${prize.id}-${index}`}
                        aria-label={prize.name}
                      >
                        {prize.symbol}
                      </span>
                    ))}
                  </div>
                  <span className="rolling-marker" aria-hidden="true" />
                </>
              )}

              {reveal && (
                <div
                  className="prize-reveal"
                  style={{ "--prize-color": reveal.prize.color } as React.CSSProperties}
                >
                  <span className="prize-symbol" aria-hidden="true">
                    {reveal.prize.symbol}
                  </span>
                  <span className="prize-rarity">
                    {reveal.prize.rarity} ·{" "}
                    {reveal.prize.kind === "chips"
                      ? "CHIPS"
                      : reveal.prize.kind === "redeemable"
                        ? "PRIZE KEY"
                        : "COLLECTIBLE"}
                  </span>
                  <span className="prize-name">{reveal.prize.name}</span>
                  {reveal.payout > 0 && (
                    <span className="prize-payout">+{reveal.payout} CHIPS</span>
                  )}
                </div>
              )}

              <button
                className="open-button stage-open-button"
                onClick={openSelectedCase}
                disabled={phase === "rolling" || balance < selectedCase.cost}
                type="button"
              >
                {balance < selectedCase.cost
                  ? "NOT ENOUGH CHIPS"
                  : `OPEN ${selectedCase.name.toUpperCase()} · ${selectedCase.cost}`}
                <ArrowIcon />
              </button>
            </div>

            <p className="reveal-message" role="status">
              {reveal
                ? reveal.prize.kind === "redeemable"
                  ? `${reveal.prize.name} found. Prize redemption requires a live catalog and is not available in this demo.`
                  : reveal.prize.kind === "collectible"
                    ? `${reveal.prize.name} added to your collection.`
                    : `You won ${reveal.payout} virtual chips.`
                : phase === "rolling"
                  ? "The vault is choosing..."
                  : "Opening a case costs chips, but never real money."}
            </p>
          </div>

          <aside className="case-side-panel">
            <section className="case-prize-panel">
              <div className="case-panel-heading">
                <span className="odds-heading">PRIZE POOL</span>
                <span>{selectedCase.cost} CHIP COST</span>
              </div>
              <div className="case-prize-list">
                {selectedCase.prizes.map((prize) => (
                  <div className="case-prize-row" key={prize.id}>
                    <span
                      className="case-prize-symbol"
                      style={{ "--prize-color": prize.color } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      {prize.symbol}
                    </span>
                    <span className="case-prize-info">
                      <strong>{prize.name}</strong>
                      <small>
                        {prize.rarity} ·{" "}
                        {prizeProbability(selectedCase, prize.id).toFixed(
                          prizeProbability(selectedCase, prize.id) % 1 ? 1 : 0,
                        )}
                        %
                      </small>
                    </span>
                    <span className="case-prize-type">
                      {prize.kind === "chips"
                        ? `+${prize.value}`
                        : prize.kind === "redeemable"
                          ? "KEY"
                          : "ITEM"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="case-history-panel">
              <div className="case-panel-heading">
                <span className="odds-heading">RECENT DROPS</span>
                <button type="button" onClick={resetSession}>
                  RESET
                </button>
              </div>
              {history.length === 0 ? (
                <p className="case-empty">Your first drop will appear here.</p>
              ) : (
                <ul className="case-history-list">
                  {history.map((result) => (
                    <li key={`${result.openedAt}-${result.prize.id}`}>
                      <span style={{ color: result.prize.color }} aria-hidden="true">
                        {result.prize.symbol}
                      </span>
                      <span>
                        <strong>{result.prize.name}</strong>
                        <small>
                          {result.payout > 0 ? `+${result.payout} chips` : result.prize.rarity}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        {Object.keys(inventory).length > 0 && (
          <section className="case-inventory" aria-label="Prize inventory">
            <span className="odds-heading">INVENTORY</span>
            <div>
              {Object.entries(inventory).map(([prizeId, count]) => {
                const prize = [...CASES]
                  .flatMap((item) => item.prizes)
                  .find((item) => item.id === prizeId);
                if (!prize) return null;
                return (
                  <span
                    className="inventory-item"
                    key={prizeId}
                    style={{ "--prize-color": prize.color } as React.CSSProperties}
                  >
                    <b aria-hidden="true">{prize.symbol}</b>
                    <span>
                      <strong>{prize.name}</strong>
                      <small>×{count}</small>
                    </span>
                  </span>
                );
              })}
            </div>
          </section>
        )}
      </section>
      <p className="game-page-footnote">
        VIRTUAL CHIPS AND COLLECTIBLES · DEMO PRIZE KEYS ARE NOT REDEEMABLE · NO REAL-MONEY PURCHASE
      </p>
    </main>
  );
}
