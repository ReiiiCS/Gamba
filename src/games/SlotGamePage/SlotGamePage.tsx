import { useEffect, useRef, useState } from "react";
import "./SlotGamePage.css";

const slotSymbols = [
  { name: "Cherry", plural: "Cherries", image: "/slots/cherries.png", payout: 20 },
  { name: "Lemon", plural: "Lemons", image: "/slots/lemon.png", payout: 30 },
  { name: "Bell", plural: "Bells", image: "/slots/bell.png", payout: 50 },
  { name: "Diamond", plural: "Diamonds", image: "/slots/diamond.png", payout: 100 },
  { name: "Seven", plural: "Sevens", image: "/slots/seven.png", payout: 500 },
] as const;

type SlotSymbol = typeof slotSymbols[number];

type SpinRecord = {
  number: number;
  symbols: readonly SlotSymbol[];
  payout: number;
  net: number;
};

const startingBalance = 1000;
const spinCost = 10;
const spinDuration = 2350;
const reelStopIndex = 16;

function SymbolIcon({ symbol, decorative = false }: { symbol: SlotSymbol; decorative?: boolean }) {
  return <img src={symbol.image} alt={decorative ? "" : symbol.name} draggable={false} />;
}

function chooseSymbol(): SlotSymbol {
  const sample = new Uint32Array(1);
  const range = 0x1_0000_0000;
  const acceptedRange = range - (range % slotSymbols.length);

  do {
    window.crypto.getRandomValues(sample);
  } while (sample[0] >= acceptedRange);

  return slotSymbols[sample[0] % slotSymbols.length];
}

function makeReelStrip(result: SlotSymbol): SlotSymbol[] {
  const strip = Array.from({ length: reelStopIndex }, chooseSymbol);
  strip.push(result);
  while (strip.length < 20) strip.push(chooseSymbol());
  return strip;
}

export default function SlotGamePage({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState(startingBalance);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [history, setHistory] = useState<SpinRecord[]>([]);
  const [reels, setReels] = useState<readonly SlotSymbol[] | null>(null);
  const [reelStrips, setReelStrips] = useState<SlotSymbol[][]>([]);
  const [phase, setPhase] = useState<"ready" | "spinning">("ready");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const closeButton = useRef<HTMLButtonElement>(null);
  const spinTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(spinTimer.current);
    };
  }, [onClose]);

  function spin() {
    if (phase === "spinning" || balance < spinCost) return;

    const result = [chooseSymbol(), chooseSymbol(), chooseSymbol()] as const;
    const match = result.every((symbol) => symbol === result[0]) ? result[0] : null;
    const payout = match?.payout ?? 0;
    const record: SpinRecord = {
      number: history.length + 1,
      symbols: result,
      payout,
      net: payout - spinCost,
    };

    setBalance((current) => current - spinCost);
    setReelStrips(result.map(makeReelStrip));
    setReels(result);
    setPhase("spinning");
    spinTimer.current = window.setTimeout(() => {
      setBalance((current) => current + payout);
      setWins((current) => current + (payout > 0 ? 1 : 0));
      setLosses((current) => current + (payout === 0 ? 1 : 0));
      setHistory((current) => [record, ...current]);
      setPhase("ready");
    }, reduceMotion ? 800 : spinDuration);
  }

  function resetGame() {
    if (phase === "spinning") return;
    setBalance(startingBalance);
    setWins(0);
    setLosses(0);
    setHistory([]);
    setReels(null);
    setReelStrips([]);
  }

  const latestSpin = history[0];

  return (
    <main className="game-page slot-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge"><span className="live-dot" /> FREE PLAY</span>
      </header>

      <section className="slot-content" aria-labelledby="slot-title">
        <div className="game-page-heading">
          <div className="modal-topline"><span className="live-dot" /> THREE REELS · VIRTUAL CHIPS ONLY</div>
          <h1 id="slot-title">LUCKY REELS</h1>
          <p className="modal-intro">One line. Five symbols. Just-for-fun spins.</p>
        </div>

        <div className="slot-layout">
          <section className="slot-machine-panel" aria-label="Three-reel slot machine">
            <div className="slot-machine-topline">
              <span>★ PLAYROOM ★</span>
              <span>NO CASH VALUE</span>
            </div>
            <div className="slot-machine-controls">
              <div
                className={`slot-reels ${phase === "spinning" ? "is-spinning" : ""}`}
                aria-live={phase === "spinning" ? "off" : "polite"}
                aria-label={phase === "spinning" ? "The three reels are spinning" : undefined}
              >
                {phase === "spinning"
                  ? reelStrips.map((strip, index) => (
                    <div className="slot-reel" key={`rolling-${index}`}>
                      <div
                        className="slot-reel-strip"
                        style={{
                          "--reel-stop": `${reelStopIndex * -5}%`,
                          "--reel-duration": `${reduceMotion ? 0.34 + index * 0.12 : 1.35 + index * 0.42}s`,
                        } as React.CSSProperties}
                        aria-hidden="true"
                      >
                        {strip.map((symbol, symbolIndex) => (
                          <span key={`${symbol.name}-${symbolIndex}`}><SymbolIcon symbol={symbol} decorative /></span>
                        ))}
                      </div>
                    </div>
                  ))
                  : reels
                    ? reels.map((symbol, index) => (
                      <div className="slot-reel" key={`${history.length}-${index}`}>
                        <SymbolIcon symbol={symbol} />
                      </div>
                    ))
                    : slotSymbols.slice(0, 3).map((symbol) => (
                      <div className="slot-reel" key={symbol.name}>
                        <SymbolIcon symbol={symbol} />
                      </div>
                    ))}
                <span className="slot-payline-pointer" aria-hidden="true" />
                <span className="slot-payline-pointer slot-payline-pointer-right" aria-hidden="true" />
              </div>
              <button
                className={`slot-lever-control ${phase === "spinning" ? "is-pulling" : ""}`}
                onClick={spin}
                disabled={phase === "spinning" || balance < spinCost}
                type="button"
                aria-label={`Spin for ${spinCost} virtual chips`}
              >
                <span className="slot-lever-track" aria-hidden="true">
                  <span className="slot-lever-knob" />
                </span>
                <span className="slot-lever-label" aria-hidden="true">SPIN</span>
              </button>
            </div>
            <div className="slot-balance">
              <span>YOUR VIRTUAL CHIPS</span>
              <strong>{balance.toLocaleString()}</strong>
            </div>
            <p className="slot-status" role="status">
              {phase === "spinning"
                ? "The reels are turning..."
                : balance < spinCost
                  ? "You're out of chips. Reset to start a fresh game."
                  : latestSpin
                    ? latestSpin.payout > 0
                      ? `${latestSpin.symbols[0].plural}! You won ${latestSpin.payout} chips (${latestSpin.net > 0 ? "+" : ""}${latestSpin.net} net).`
                      : "No match this time. Spin again when you're ready."
                    : "Three of a kind wins. Every spin costs 10 chips."}
            </p>
            {balance < spinCost && phase !== "spinning" && (
              <button className="slot-reset-button" onClick={resetGame} type="button">RESET TO 1,000 CHIPS</button>
            )}
          </section>

          <aside className="slot-side-panel">
            <section className="slot-stats" aria-label="Your game stats">
              <div>
                <span>WINS</span>
                <strong>{wins}</strong>
              </div>
              <div>
                <span>LOSSES</span>
                <strong>{losses}</strong>
              </div>
              <div>
                <span>SPINS</span>
                <strong>{history.length}</strong>
              </div>
            </section>

            <section className="slot-payout-panel" aria-labelledby="slot-payout-title">
              <div className="slot-panel-heading">
                <span className="odds-heading" id="slot-payout-title">THREE OF A KIND</span>
                <span className="slot-payout-bet">10 CHIP BET</span>
              </div>
              {slotSymbols.map((symbol) => (
                <div className="slot-payout-row" key={symbol.name}>
                  <span><SymbolIcon symbol={symbol} decorative /> {symbol.plural}</span>
                  <strong>{symbol.payout} chips</strong>
                </div>
              ))}
              <p className="slot-payout-note">Payouts include the original 10-chip bet. Any other combination pays 0.</p>
            </section>

            <section className="slot-history-panel" aria-labelledby="slot-history-title">
              <div className="slot-panel-heading">
                <span className="odds-heading" id="slot-history-title">SPIN HISTORY</span>
                {history.length > 0 && <span className="slot-history-count">{history.length} TOTAL</span>}
              </div>
              {history.length === 0 ? (
                <p className="slot-empty-history">Your spins will show up here.</p>
              ) : (
                <ol className="slot-history-list">
                  {history.map((spinRecord) => (
                    <li key={spinRecord.number}>
                      <span className="slot-history-symbols" aria-label={spinRecord.symbols.map((symbol) => symbol.name).join(", ")}>
                        {spinRecord.symbols.map((symbol, index) => <SymbolIcon symbol={symbol} decorative key={index} />)}
                      </span>
                      <span className={spinRecord.payout > 0 ? "slot-history-win" : "slot-history-loss"}>
                        {spinRecord.payout > 0 ? `+${spinRecord.net}` : "−10"} chips
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>

        <section className="slot-math-note" aria-label="Slot machine odds">
          <span className="odds-heading">THE MATH, TRANSPARENTLY</span>
          <p>Each reel has 5 equally likely symbols. Any specific triple has a 1-in-125 chance. These sample payouts return an average of 5.6 chips per 10-chip spin: <strong>56% theoretical RTP</strong> (44% theoretical house edge) over many spins—not a promise about any individual game.</p>
        </section>
      </section>
      <p className="game-page-footnote">ALL CHIPS ARE VIRTUAL · NO MONEY · NO PRIZES · JUST FOR FUN</p>
    </main>
  );
}
