import { useEffect, useRef, useState } from "react";
import "./PlinkoGamePage.css";

const plinkoChipValues = [10, 25, 50, 100];
const plinkoRowOptions = [8, 12, 16] as const;
const plinkoRiskOptions = ["low", "medium", "high"] as const;
const startingBalance = 1000;
const ballStartX = 50;
const ballStartY = 4;
const slotY = 84;
const minBet = Math.min(...plinkoChipValues);
// Natural-gravity fall: acceleration in board-% per ms², and how much vertical
// speed a ball keeps after bouncing off a peg.
const gravityPerMs2 = 0.0006;
const bounceRetention = 0.45;
// A ball should reverse the moment its edge touches a peg — not when its center
// reaches the peg's center (which reads as the ball sinking into and past the
// peg). The centre-to-centre contact distance is ball radius + peg radius,
// converted to board-% against the rendered board height at runtime.
const ballRadiusPx = 4; // 8px ball incl. 1px border
const pegRadiusPx = 3.5; // 7px peg incl. 1px border
const defaultCollisionGapPct = ((ballRadiusPx + pegRadiusPx) / 420) * 100;

type Risk = typeof plinkoRiskOptions[number];
type Pt = { x: number; y: number };

type DropRecord = {
  id: number;
  bet: number;
  multiplier: number;
  payout: number;
  net: number;
  rows: number;
  risk: Risk;
};

type ActiveBall = {
  id: number;
  record: DropRecord;
  k: number;
  targets: Pt[];
  targetIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
};

// Multiplier tables per risk level and row count. Each mirrors around its center.
// Values are tuned so the theoretical RTP (sum of P(k) × mult(k), with P(k) = C(n,k)/2^n)
// lands near 96% for every combination.
const plinkoMultipliers: Record<Risk, Record<number, readonly number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.4, 1, 1.1, 2.1, 5.6],
    12: [3, 1.7, 1.1, 0.9, 0.7, 0.6, 1.8, 0.6, 0.7, 0.9, 1.1, 1.7, 3],
    16: [4, 2, 1.4, 1.1, 0.9, 0.7, 0.6, 0.5, 2.4, 0.5, 0.6, 0.7, 0.9, 1.1, 1.4, 2, 4],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.3, 0.7, 1.3, 3, 13],
    12: [5, 2.2, 1.4, 1, 0.7, 0.5, 1.9, 0.5, 0.7, 1, 1.4, 2.2, 5],
    16: [8, 3, 1.8, 1.2, 0.9, 0.7, 0.5, 0.5, 2.5, 0.5, 0.5, 0.7, 0.9, 1.2, 1.8, 3, 8],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.1, 0.3, 1.5, 4, 29],
    12: [50, 10, 3, 1, 0.5, 0.4, 1.8, 0.4, 0.5, 1, 3, 10, 50],
    16: [1000, 130, 26, 7, 2, 0.9, 0.6, 0.5, 0.6, 0.5, 0.6, 0.9, 2, 7, 26, 130, 1000],
  },
};

function binomial(n: number, k: number): number {
  let value = 1;
  for (let index = 0; index < k; index += 1) value = value * (n - index) / (index + 1);
  return value;
}

function slotProbability(rows: number, k: number): number {
  return binomial(rows, k) / Math.pow(2, rows);
}

function multiplierRtp(rows: number, multipliers: readonly number[]): number {
  let sum = 0;
  for (let k = 0; k <= rows; k += 1) sum += binomial(rows, k) * multipliers[k];
  return sum / Math.pow(2, rows);
}

function formatMultiplier(multiplier: number): string {
  return `${Number.isInteger(multiplier) ? multiplier : multiplier.toFixed(1)}×`;
}

// n fair left/right decisions using rejection-free unbiased bits from the Web Crypto API.
function choosePath(rows: number): boolean[] {
  const bytes = new Uint8Array(Math.ceil(rows / 8));
  window.crypto.getRandomValues(bytes);
  return Array.from({ length: rows }, (_, index) =>
    ((bytes[Math.floor(index / 8)] >> (index % 8)) & 1) === 1,
  );
}

function pegPosition(row: number, col: number, rows: number): Pt {
  const pegDX = 80 / Math.max(1, rows - 1);
  const stepY = (slotY - ballStartY) / (rows + 1);
  return { x: 50 + (col - row / 2) * pegDX, y: ballStartY + (row + 1) * stepY };
}

function slotPosition(slot: number, rows: number): Pt {
  const pegDX = 80 / Math.max(1, rows - 1);
  return { x: 50 + (slot - rows / 2) * pegDX, y: slotY };
}

function slotTopY(rows: number): number {
  const stepY = (slotY - ballStartY) / (rows + 1);
  return ballStartY + rows * stepY + 2.5;
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

function playBounceTick(context: AudioContext, ball: ActiveBall) {
  // Rising pitch with each bounce, plus a small per-ball offset so overlapping
  // falls stay distinguishable.
  const pitch = 620 + ball.bounces * 38 + (ball.id % 5) * 14;
  playTone(context, pitch, context.currentTime + 0.02, 0.05, 0.05, "triangle");
}

function playLandingChime(context: AudioContext, multiplier: number) {
  const note = multiplier >= 100 ? 1046.5
    : multiplier >= 10 ? 784
    : multiplier >= 2 ? 659.3
    : multiplier >= 1 ? 392
    : 311;
  const startAt = context.currentTime + 0.03;
  [note, note * 1.2, note * 1.5].forEach((frequency, index) => {
    playTone(context, frequency, startAt + index * 0.07, 0.55, 0.045, "sine");
  });
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export default function PlinkoGamePage({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState(startingBalance);
  const [bet, setBet] = useState(10);
  const [rows, setRows] = useState<number>(8);
  const [risk, setRisk] = useState<Risk>("medium");
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<DropRecord[]>([]);
  const [lastDrop, setLastDrop] = useState<DropRecord | null>(null);
  const [restingBall, setRestingBall] = useState<Pt | null>(null);
  const [flyingBallIds, setFlyingBallIds] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const collisionGapPct = useRef(defaultCollisionGapPct);
  const activeBalls = useRef<Map<number, ActiveBall>>(new Map());
  const ballEls = useRef<Map<number, HTMLSpanElement>>(new Map());
  const animationFrame = useRef<number | undefined>(undefined);
  const audioContext = useRef<AudioContext | null>(null);
  const nextBallId = useRef(0);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ballsFlying = flyingBallIds.length > 0;

  const multipliers = plinkoMultipliers[risk][rows];
  const rtp = multiplierRtp(rows, multipliers);
  const netWins = history.filter((drop) => drop.net > 0).length;
  const netLosses = history.filter((drop) => drop.net < 0).length;
  const maxProbability = slotProbability(rows, Math.floor(rows / 2));

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (animationFrame.current !== undefined) window.cancelAnimationFrame(animationFrame.current);
      if (audioContext.current && audioContext.current.state !== "closed") {
        void audioContext.current.close();
      }
    };
  }, [onClose]);

  // Convert the ball/peg contact distance (px) into board-% against the board's
  // rendered height, which varies with layout and viewport.
  useEffect(() => {
    const measure = () => {
      const board = boardRef.current;
      if (!board) return;
      collisionGapPct.current = ((ballRadiusPx + pegRadiusPx) / board.offsetHeight) * 100;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Time (ms) for gravity to carry the ball from y0, with starting vertical
  // speed vy0, down to targetY. Always positive since targetY > y0.
  function impactTime(vy0: number, y0: number, targetY: number): number {
    return (-vy0 + Math.sqrt(vy0 * vy0 + 2 * gravityPerMs2 * (targetY - y0))) / gravityPerMs2;
  }

  function settleBall(id: number) {
    const ball = activeBalls.current.get(id);
    if (!ball) return;
    const { record, k } = ball;
    activeBalls.current.delete(id);
    ballEls.current.delete(id);
    setFlyingBallIds((current) => current.filter((ballId) => ballId !== id));
    setSlotIndex(k);
    setRestingBall(slotPosition(k, record.rows));
    setBalance((current) => current + record.payout);
    setHistory((current) => [record, ...current].slice(0, 8));
    setLastDrop(record);
    if (soundEnabled && audioContext.current) {
      playLandingChime(audioContext.current, record.multiplier);
    }
  }

  function tick(deltaMs: number) {
    const ids = [...activeBalls.current.keys()];
    for (const id of ids) {
      const ball = activeBalls.current.get(id);
      if (!ball) continue;
      const target = ball.targets[ball.targetIndex];
      const y0 = ball.y;
      const vy0 = ball.vy;
      const x0 = ball.x;

      ball.vy += gravityPerMs2 * deltaMs;
      ball.y += ball.vy * deltaMs;
      ball.x += ball.vx * deltaMs;

      if (ball.y >= target.y) {
        // Walk the exact impact point under gravity so the ball always meets
        // the peg/slot precisely, even if a frame jumps past it.
        const timeToTarget = impactTime(vy0, y0, target.y);
        ball.x = x0 + ball.vx * timeToTarget;
        ball.y = target.y;

        if (ball.targetIndex === ball.targets.length - 1) {
          settleBall(id);
          continue;
        }

        // Bounce off the peg: aim horizontal speed so the ball passes exactly
        // through the next peg, and reflect the vertical speed (with damping).
        ball.x = target.x;
        if (soundEnabled && audioContext.current) {
          playBounceTick(audioContext.current, ball);
        }
        ball.vy = -Math.abs(vy0) * bounceRetention;
        ball.vx = 0;
        ball.targetIndex += 1;
        const next = ball.targets[ball.targetIndex];
        const timeToNext = impactTime(ball.vy, target.y, next.y);
        ball.vx = (next.x - target.x) / timeToNext;
        ball.bounces += 1;
      }
    }

    for (const [id, element] of ballEls.current) {
      const ball = activeBalls.current.get(id);
      if (!ball) continue;
      element.style.left = `${ball.x}%`;
      element.style.top = `${ball.y}%`;
    }
  }

  function startLoop() {
    if (animationFrame.current !== undefined) return;
    let lastFrame = performance.now();
    const step = (now: number) => {
      const deltaMs = Math.min(50, now - lastFrame);
      lastFrame = now;
      tick(deltaMs);
      if (activeBalls.current.size > 0) {
        animationFrame.current = window.requestAnimationFrame(step);
      } else {
        animationFrame.current = undefined;
      }
    };
    animationFrame.current = window.requestAnimationFrame(step);
  }

  function resetBoard() {
    setSlotIndex(null);
    setRestingBall(null);
  }

  function changeRows(value: number) {
    if (ballsFlying) return;
    setRows(value);
    resetBoard();
  }

  function changeRisk(value: Risk) {
    if (ballsFlying) return;
    setRisk(value);
    resetBoard();
  }

  function changeBet(value: number) {
    if (ballsFlying) return;
    setBet(value);
  }

  function drop() {
    if (balance < bet) return;

    const count = rows;
    const decisions = choosePath(count);
    const k = decisions.filter(Boolean).length;
    const multiplier = plinkoMultipliers[risk][count][k];
    const payout = Math.round(bet * multiplier);
    const net = payout - bet;
    const id = nextBallId.current;
    nextBallId.current += 1;
    const record: DropRecord = {
      id,
      bet,
      multiplier,
      payout,
      net,
      rows: count,
      risk,
    };

    setBalance((current) => current - bet);
    setSlotIndex(null);

    // Waypoints: where the ball's edge meets each peg — the peg's center raised
    // by the contact gap so the ball touches (not sinks into) the peg — then the
    // slot at the bottom.
    const targets: Pt[] = [];
    let column = 0;
    for (let row = 0; row < count; row += 1) {
      if (decisions[row]) column += 1;
      const peg = pegPosition(row, column, count);
      targets.push({ x: peg.x, y: peg.y - collisionGapPct.current });
    }
    targets.push(slotPosition(k, count));

    if (soundEnabled) {
      audioContext.current ??= new window.AudioContext();
      void audioContext.current.resume();
    }

    const ball: ActiveBall = {
      id,
      record,
      k,
      targets,
      targetIndex: 0,
      x: ballStartX,
      y: ballStartY,
      vx: 0,
      vy: 0,
      bounces: 0,
    };
    activeBalls.current.set(id, ball);

    if (reduceMotion) {
      settleBall(id);
      return;
    }

    setFlyingBallIds((current) => [...current, id]);
    startLoop();
  }

  function resetBalance() {
    if (ballsFlying) return;
    setBalance(startingBalance);
    setHistory([]);
    setLastDrop(null);
    resetBoard();
  }

  const showReset = balance < minBet && !ballsFlying;

  function stickyStatus() {
    if (balance < bet) {
      return "Your chip balance is below this bet. Pick a smaller bet or reset to a fresh 1,000 chips.";
    }
    if (!lastDrop) {
      return "Pick a bet, rows, and risk level, then drop the ball.";
    }
    const gained = lastDrop.net >= 0;
    const amount = Math.abs(lastDrop.net).toLocaleString();
    return gained
      ? `Landed in the ${formatMultiplier(lastDrop.multiplier)} slot. ${lastDrop.bet}-chip bet returned ${lastDrop.payout.toLocaleString()} chips (+${amount} net).`
      : `Landed in the ${formatMultiplier(lastDrop.multiplier)} slot. ${lastDrop.payout.toLocaleString()} chips back (net loss of ${amount}).`;
  }

  return (
    <main className="game-page plinko-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge"><span className="live-dot" /> FREE PLAY</span>
      </header>

      <section className="plinko-content" aria-labelledby="plinko-title">
        <div className="game-page-heading">
          <div className="modal-topline"><span className="live-dot" /> PEG DROP · VIRTUAL CHIPS ONLY</div>
          <h1 id="plinko-title">GOLD DROP</h1>
          <p className="modal-intro">Drop a ball, catch a multiplier. Every bounce is pure chance.</p>
        </div>

        <div className="plinko-layout">
          <section className="plinko-board-panel" aria-label="Plinko board">
            <button
              className="sound-toggle"
              onClick={() => setSoundEnabled((enabled) => !enabled)}
              aria-pressed={soundEnabled}
              type="button"
            >
              <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span> SOUND {soundEnabled ? "ON" : "OFF"}
            </button>

            <div className={`plinko-board plinko-board-r${rows}`} ref={boardRef} aria-hidden="true">
              {Array.from({ length: rows }, (_, row) =>
                Array.from({ length: row + 1 }, (_, col) => {
                  const position = pegPosition(row, col, rows);
                  return (
                    <span
                      className={`plinko-peg ${position.y > slotY - 34 ? "is-last" : ""}`}
                      key={`${row}-${col}`}
                      style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    />
                  );
                }),
              )}
              {multipliers.map((multiplier, k) => {
                const position = slotPosition(k, rows);
                return (
                  <span
                    className={`plinko-slot ${multiplierClass(multiplier)} ${slotIndex === k ? "is-hit" : ""}`}
                    key={k}
                    style={{ left: `${position.x}%`, top: `${slotTopY(rows)}%` }}
                  >
                    <b>{formatMultiplier(multiplier)}</b>
                    <i />
                  </span>
                );
              })}
              {flyingBallIds.map((id) => (
                <span
                  className="plinko-ball"
                  key={id}
                  ref={(element) => {
                    if (!element) {
                      ballEls.current.delete(id);
                      return;
                    }
                    ballEls.current.set(id, element);
                    const active = activeBalls.current.get(id);
                    if (active) {
                      element.style.left = `${active.x}%`;
                      element.style.top = `${active.y}%`;
                    }
                  }}
                />
              ))}
              {!ballsFlying && restingBall && (
                <span
                  className="plinko-ball plinko-resting"
                  style={{ left: `${restingBall.x}%`, top: `${restingBall.y}%` }}
                />
              )}
            </div>

            <div className="plinko-balance">
              <span>YOUR VIRTUAL CHIPS</span>
              <strong>{balance.toLocaleString()}</strong>
            </div>
            <div className="plinko-bet-summary">
              <span>{bet}-CHIP DROP</span>
              <strong>{rows} ROWS · {risk.toUpperCase()} RISK</strong>
            </div>
            <button
              className="open-button plinko-drop-button"
              onClick={drop}
              disabled={balance < bet}
              type="button"
            >
              DROP THE BALL
              <ArrowIcon />
            </button>
            <p className="plinko-status" role="status">
              {ballsFlying
                ? `${flyingBallIds.length} ${flyingBallIds.length === 1 ? "ball is" : "balls are"} bouncing down the board...`
                : stickyStatus()}
            </p>
            {showReset && (
              <button className="plinko-reset-button" onClick={resetBalance} type="button">
                RESET TO 1,000 CHIPS
              </button>
            )}
          </section>

          <aside className="plinko-controls">
            <div className="plinko-panel-heading">
              <div>
                <span className="odds-heading">BUILD YOUR DROP</span>
                <p>Pick a bet, rows, and risk.</p>
              </div>
              <span className="plinko-free-note">VIRTUAL CHIPS ONLY</span>
            </div>

            <div className="plinko-chips" aria-label="Chip value">
              {plinkoChipValues.map((value) => (
                <button
                  className={`plinko-chip ${bet === value ? "is-selected" : ""}`}
                  key={value}
                  onClick={() => changeBet(value)}
                  aria-pressed={bet === value}
                  disabled={ballsFlying}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="plinko-setting">
              <span className="plinko-setting-label">ROWS</span>
              <div className="plinko-setting-group" role="group" aria-label="Number of rows">
                {plinkoRowOptions.map((value) => (
                  <button
                    className={rows === value ? "is-selected" : ""}
                    key={value}
                    onClick={() => changeRows(value)}
                    aria-pressed={rows === value}
                    disabled={ballsFlying}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="plinko-setting">
              <span className="plinko-setting-label">RISK</span>
              <div className="plinko-setting-group" role="group" aria-label="Risk level">
                {plinkoRiskOptions.map((value) => (
                  <button
                    className={`${risk === value ? "is-selected" : ""} risk-${value}`}
                    key={value}
                    onClick={() => changeRisk(value)}
                    aria-pressed={risk === value}
                    disabled={ballsFlying}
                    type="button"
                  >
                    {value.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <section className="plinko-legend" aria-label="Multiplier odds for the current settings">
              <div className="plinko-legend-heading">
                <span className="odds-heading">SLOT MULTIPLIERS · {rows} ROWS</span>
                <span className="plinko-rtp-badge">~{rtp.toFixed(1)}% RTP</span>
              </div>
              <div className="plinko-legend-slots">
                {multipliers.map((multiplier, k) => (
                  <span
                    className={`plinko-legend-slot ${multiplierClass(multiplier)} ${slotIndex === k ? "is-hit" : ""}`}
                    key={k}
                    title={`${formatMultiplier(multiplier)} · ${(slotProbability(rows, k) * 100).toFixed(2)}% chance`}
                  >
                    <i style={{ height: `${slotProbability(rows, k) / maxProbability * 100}%` }} />
                    <b>{formatMultiplier(multiplier)}</b>
                  </span>
                ))}
              </div>
              <p className="plinko-legend-note">Bar height = how often each slot is reached. Edge slots pay the most because they are rare.</p>
            </section>

            <section className="plinko-stats" aria-label="Your game stats">
              <div>
                <span>WINS</span>
                <strong>{netWins}</strong>
              </div>
              <div>
                <span>LOSSES</span>
                <strong>{netLosses}</strong>
              </div>
              <div>
                <span>DROPS</span>
                <strong>{history.length}</strong>
              </div>
            </section>

            <section className="plinko-history" aria-labelledby="plinko-history-title">
              <div className="plinko-panel-heading">
                <span className="odds-heading" id="plinko-history-title">DROP HISTORY</span>
                {history.length > 0 && <span className="plinko-history-count">{history.length} TOTAL</span>}
              </div>
              {history.length === 0 ? (
                <p className="plinko-empty-history">Your drops will show up here.</p>
              ) : (
                <ol className="plinko-history-list">
                  {history.map((drop) => (
                    <li key={drop.id}>
                      <span className={`plinko-history-mult ${multiplierClass(drop.multiplier)}`}>
                        {formatMultiplier(drop.multiplier)}
                      </span>
                      <span className={drop.net >= 0 ? "plinko-history-win" : "plinko-history-loss"}>
                        {drop.net >= 0 ? `+${drop.net.toLocaleString()}` : `−${Math.abs(drop.net).toLocaleString()}`} chips
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="plinko-math-panel" aria-label="Plinko math">
              <span className="odds-heading">THE MATH, TRANSPARENTLY</span>
              <p>
                Each ball flips <strong>{rows} fair coins</strong> on the way down, so there are{" "}
                <strong>2<sup>{rows}</sup> = {(Math.pow(2, rows)).toLocaleString()} equally likely paths</strong>.
                The slot you reach follows a binomial distribution: the middle slot is far more likely than
                the edges. At {rows} rows the exact middle lands{" "}
                <strong>{(slotProbability(rows, Math.floor(rows / 2)) * 100).toFixed(2)}%</strong> of the time,
                while an extreme edge is <strong>{(slotProbability(rows, 0) * 100).toFixed(2)}%</strong>.
              </p>
              <p className="plinko-edge">
                Theoretical return: <strong>{rtp.toFixed(1)}%</strong> · house edge{" "}
                <strong>{((1 - rtp) * 100).toFixed(1)}%</strong> · at a {bet}-chip drop, that is an average
                expected loss of <strong>{(bet * (1 - rtp)).toFixed(1)} chips</strong>. Payouts include your
                original stake: a 100-chip drop in a 2× slot returns 200 chips.
              </p>
            </section>
          </aside>
        </div>
        <p className="game-page-footnote">ALL CHIPS ARE VIRTUAL · NO MONEY · NO PRIZES · JUST FOR FUN</p>
      </section>
    </main>
  );
}

function multiplierClass(multiplier: number): string {
  if (multiplier >= 100) return "m-mega";
  if (multiplier >= 10) return "m-big";
  if (multiplier >= 2) return "m-high";
  if (multiplier > 1) return "m-mid";
  return multiplier === 1 ? "m-even" : "m-low";
}