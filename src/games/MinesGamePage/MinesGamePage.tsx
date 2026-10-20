import { useEffect, useRef, useState } from "react";
import "./MinesGamePage.css";

const mineChipValues = [10, 25, 50, 100];
const mineCountOptions = [1, 3, 5, 7, 10] as const;
const gridSize = 25;
const startingBalance = 1000;
const gameName = "NEON MINES";

type MineCount = (typeof mineCountOptions)[number];

type TileState = "hidden" | "safe" | "mine";

type GameHistory = {
  id: number;
  bet: number;
  mines: number;
  revealed: number;
  multiplier: number;
  payout: number;
  net: number;
  result: "win" | "loss";
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function createMineLayout(mineCount: number): boolean[] {
  const layout = Array.from({ length: gridSize }, (_, index) => index < mineCount);
  return shuffle(layout);
}

function getMultiplier(mineCount: number, revealedCount: number): number {
  if (revealedCount <= 0) return 1;
  let multiplier = 1;
  for (let step = 0; step < revealedCount; step += 1) {
    const safeTiles = gridSize - mineCount - step;
    multiplier *= gridSize - step / safeTiles;
  }
  const adjusted = Math.pow(multiplier, 0.95);
  return Math.max(1.01, Math.round(adjusted * 100) / 100);
}

function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(multiplier >= 10 ? 0 : multiplier >= 2 ? 2 : 2)}×`;
}

function playTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export default function MinesGamePage({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState(startingBalance);
  const [bet, setBet] = useState(10);
  const [mineCount, setMineCount] = useState<MineCount>(3);
  const [layout, setLayout] = useState<boolean[]>(() => createMineLayout(3));
  const [tileStates, setTileStates] = useState<TileState[]>(() =>
    Array.from({ length: gridSize }, () => "hidden"),
  );
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const nextHistoryId = useRef(0);

  const multiplier = getMultiplier(mineCount, revealedCount);
  const potentialPayout = Math.floor(bet * multiplier);
  const canStart = !gameActive && balance >= bet;

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (audioContext.current && audioContext.current.state !== "closed") {
        void audioContext.current.close();
      }
    };
  }, [onClose]);

  function ensureAudio() {
    if (!soundEnabled) return null;
    audioContext.current ??= new window.AudioContext();
    void audioContext.current.resume();
    return audioContext.current;
  }

  function playReveal() {
    const context = ensureAudio();
    if (!context) return;
    const startAt = context.currentTime + 0.01;
    playTone(context, 880, startAt, 0.12, 0.028, "sine");
  }

  function playMine() {
    const context = ensureAudio();
    if (!context) return;
    const startAt = context.currentTime + 0.01;
    playTone(context, 220, startAt, 0.18, 0.032, "triangle");
    playTone(context, 164, startAt + 0.03, 0.24, 0.024, "sawtooth");
  }

  function playCollect() {
    const context = ensureAudio();
    if (!context) return;
    const startAt = context.currentTime + 0.01;
    [659, 784, 988].forEach((frequency, index) => {
      playTone(context, frequency, startAt + index * 0.06, 0.42, 0.03, "sine");
    });
  }

  function startGame() {
    if (!canStart) return;
    const newLayout = createMineLayout(mineCount);
    setLayout(newLayout);
    setTileStates(Array.from({ length: gridSize }, () => "hidden"));
    setBalance((current) => current - bet);
    setGameActive(true);
    setGameOver(false);
    setRevealedCount(0);
  }

  function revealTile(index: number) {
    if (!gameActive || gameOver || tileStates[index] !== "hidden") return;
    if (layout[index]) {
      // Hit mine
      const revealedAll = tileStates.map((state, tileIndex) =>
        state === "hidden" && layout[tileIndex] ? "mine" : state === "hidden" ? "safe" : state,
      );
      revealedAll[index] = "mine";
      setTileStates(revealedAll);
      setGameActive(false);
      setGameOver(true);
      playMine();

      const id = nextHistoryId.current;
      nextHistoryId.current += 1;
      const record: GameHistory = {
        id,
        bet,
        mines: mineCount,
        revealed: revealedCount,
        multiplier: 1,
        payout: 0,
        net: -bet,
        result: "loss",
      };
      setHistory((current) => [record, ...current]);
      return;
    }

    // Safe tile
    const nextStates = [...tileStates];
    nextStates[index] = "safe";
    const nextRevealed = revealedCount + 1;
    setTileStates(nextStates);
    setRevealedCount(nextRevealed);
    playReveal();
  }

  function collect() {
    if (!gameActive || gameOver || revealedCount === 0) return;
    const payout = potentialPayout;
    const net = payout - bet;
    setBalance((current) => current + payout);
    setGameActive(false);
    setGameOver(true);
    playCollect();

    const id = nextHistoryId.current;
    nextHistoryId.current += 1;
    const record: GameHistory = {
      id,
      bet,
      mines: mineCount,
      revealed: revealedCount,
      multiplier,
      payout,
      net,
      result: "win",
    };
    setHistory((current) => [record, ...current]);
  }

  function resetBoard() {
    if (gameActive && !gameOver) return;
    setTileStates(Array.from({ length: gridSize }, () => "hidden"));
    setGameActive(false);
    setGameOver(false);
    setRevealedCount(0);
    setLayout(createMineLayout(mineCount));
  }

  function changeBet(value: number) {
    if (gameActive) return;
    setBet(value);
  }

  function changeMineCount(value: MineCount) {
    if (gameActive) return;
    setMineCount(value);
    setLayout(createMineLayout(value));
    resetBoard();
  }

  function resetBalance() {
    if (gameActive && !gameOver) return;
    setBalance(startingBalance);
    setHistory([]);
    resetBoard();
  }

  const showResetBalance = balance < bet && !gameActive;
  const safeTilesLeft = gridSize - mineCount - revealedCount;
  const hitChance = safeTilesLeft > 0 ? (mineCount / safeTilesLeft) * 100 : 0;

  function statusText() {
    if (!gameActive && !gameOver) {
      return "Set your bet and mines, then start to pick tiles.";
    }
    if (gameActive) {
      if (revealedCount === 0) {
        return "Pick a tile to reveal gems. Avoid the mines.";
      }
      return `Revealed ${revealedCount} gem${revealedCount === 1 ? "" : "s"}. Current multiplier ${formatMultiplier(multiplier)} · Collect to secure ${potentialPayout.toLocaleString()} chips.`;
    }
    if (gameOver && revealedCount > 0) {
      return `You collected ${potentialPayout.toLocaleString()} chips (+${(potentialPayout - bet).toLocaleString()} net) at ${formatMultiplier(multiplier)}.`;
    }
    return "Mine hit. Better luck next time.";
  }

  return (
    <main className="game-page mines-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge">
          <span className="live-dot" /> FREE PLAY
        </span>
      </header>

      <section className="mines-content" aria-labelledby="mines-title">
        <div className="game-page-heading">
          <div className="modal-topline">
            <span className="live-dot" /> GRID RISK · VIRTUAL CHIPS ONLY
          </div>
          <h1 id="mines-title">{gameName}</h1>
          <p className="modal-intro">Pick gems. Dodge mines. Collect whenever you want.</p>
        </div>

        <div className="mines-layout">
          <section className="mines-board-panel" aria-label="Mines grid">
            <button
              className="mines-sound-toggle"
              onClick={() => setSoundEnabled((enabled) => !enabled)}
              aria-pressed={soundEnabled}
              type="button"
            >
              <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span> SOUND {soundEnabled ? "ON" : "OFF"}
            </button>

            <div className="mines-balance-bar">
              <span>YOUR VIRTUAL CHIPS</span>
              <strong>{balance.toLocaleString()}</strong>
            </div>
            <div className="mines-status-strip">
              <span>
                BET: <strong>{bet}-CHIP</strong>
              </span>
              <span>
                MINES: <strong>{mineCount}</strong>
              </span>
              <span>
                MULTIPLIER: <strong>{formatMultiplier(multiplier)}</strong>
              </span>
              <span>
                POTENTIAL: <strong>{potentialPayout.toLocaleString()}</strong>
              </span>
            </div>

            <div className="mines-board" role="grid" aria-label="25 tile mines grid">
              {tileStates.map((state, index) => {
                const isRevealed = state !== "hidden";
                const isMineTile = isRevealed && layout[index];
                const isSafeTile = isRevealed && !layout[index];
                return (
                  <button
                    className={`mines-tile ${isSafeTile ? "is-safe" : ""} ${isMineTile ? "is-mine" : ""}`}
                    key={index}
                    onClick={() => revealTile(index)}
                    disabled={!gameActive || isRevealed}
                    type="button"
                    aria-label={
                      isMineTile
                        ? "Mine"
                        : isSafeTile
                          ? "Gem revealed"
                          : gameActive
                            ? "Hidden tile"
                            : "Start game to play"
                    }
                  >
                    {isMineTile ? <span>✸</span> : isSafeTile ? <span>◆</span> : <span />}
                  </button>
                );
              })}
            </div>

            <div className="mines-action-row">
              {!gameActive ? (
                <button
                  className="open-button mines-action-button"
                  onClick={startGame}
                  disabled={!canStart}
                  type="button"
                >
                  START GAME
                  <ArrowIcon />
                </button>
              ) : (
                <button
                  className="open-button mines-action-button mines-collect-button"
                  onClick={collect}
                  disabled={revealedCount === 0 || gameOver}
                  type="button"
                >
                  COLLECT
                  <span aria-hidden="true">⬇</span>
                </button>
              )}
              <button
                className="open-button mines-action-button"
                onClick={resetBoard}
                disabled={gameActive && !gameOver}
                type="button"
              >
                NEW LAYOUT
                <ArrowIcon />
              </button>
            </div>

            <p className="mines-status-note" role="status">
              {statusText()}
            </p>
            {showResetBalance && (
              <button className="mines-reset-button" onClick={resetBalance} type="button">
                RESET TO 1,000 CHIPS
              </button>
            )}
          </section>

          <aside className="mines-side-panel">
            <section className="mines-panel" aria-label="Bet settings">
              <div className="mines-panel-heading">
                <span className="odds-heading">BUILD YOUR ROUND</span>
                <span className="plinko-free-note">VIRTUAL CHIPS ONLY</span>
              </div>

              <div className="mines-chip-group" aria-label="Chip value">
                {mineChipValues.map((value) => (
                  <button
                    className={`mines-chip ${bet === value ? "is-selected" : ""}`}
                    key={value}
                    onClick={() => changeBet(value)}
                    aria-pressed={bet === value}
                    disabled={gameActive}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="mines-setting">
                <span className="mines-setting-label">MINES</span>
                <div className="mines-setting-row" role="group" aria-label="Number of mines">
                  {mineCountOptions.map((value) => (
                    <button
                      className={`mines-mine-count ${mineCount === value ? "is-selected" : ""}`}
                      key={value}
                      onClick={() => changeMineCount(value)}
                      aria-pressed={mineCount === value}
                      disabled={gameActive}
                      type="button"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mines-math">
                {mineCount} mines on {gridSize} tiles. Hitting odds grow with each safe pick. Next gem
                has roughly <strong>{hitChance.toFixed(1)}%</strong> chance to be a mine (edge
                cases vary). Multipliers are calculated to stay near a fun, transparent curve.
              </p>
            </section>

            <section className="mines-panel mines-stats-grid" aria-label="Your stats">
              <div>
                <span>WINS</span>
                <strong>{history.filter((item) => item.result === "win").length}</strong>
              </div>
              <div>
                <span>LOSSES</span>
                <strong>{history.filter((item) => item.result === "loss").length}</strong>
              </div>
              <div>
                <span>ROUNDS</span>
                <strong>{history.length}</strong>
              </div>
            </section>

            <section className="mines-panel" aria-labelledby="mines-history-title">
              <div className="mines-panel-heading">
                <span className="odds-heading" id="mines-history-title">
                  ROUND HISTORY
                </span>
                {history.length > 0 && <span className="plinko-history-count">{history.length} TOTAL</span>}
              </div>
              {history.length === 0 ? (
                <p className="mines-empty-history">Your rounds will show up here.</p>
              ) : (
                <ol className="mines-history-list">
                  {history.map((round) => (
                    <li key={round.id}>
                      <span className="mines-history-mult">
                        {round.result === "win"
                          ? `${formatMultiplier(round.multiplier)} · ${round.revealed} GEM${round.revealed === 1 ? "" : "S"}`
                          : `${round.mines} MINE${round.mines === 1 ? "" : "S"}`}
                      </span>
                      <span className={round.net >= 0 ? "mines-history-win" : "mines-history-loss"}>
                        {round.net >= 0
                          ? `+${round.net.toLocaleString()}`
                          : `−${Math.abs(round.net).toLocaleString()}`}{" "}
                        chips
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mines-tip">
                Pro tip: collect early on small rounds, or push for more with fewer mines. All
                outcomes are simulated for fun.
              </p>
            </section>
          </aside>
        </div>

        <p className="game-page-footnote">
          ALL CHIPS ARE VIRTUAL · NO MONEY · NO PRIZES · JUST FOR FUN
        </p>
      </section>
    </main>
  );
}
