import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./LuckyWheelGamePage.css";
import { LUCKY_WHEEL_CONFIG, RARITY_LABELS, RARE_PRIZE_THRESHOLD } from "./engine/prizeConfig";
import { SpinService } from "./engine/spinService";
import { STARTING_BALANCE } from "./engine/store";
import { activeSegments, prizeProbability, totalWeight } from "./engine/selectPrize";
import type { SpinRecord, SpinResult } from "./engine/types";
import {
  DEFAULT_FULL_TURNS,
  SEGMENT_COUNT,
  rotationToAlign,
  segmentCenterAngle,
  segmentIndexAtPointer,
} from "./geometry";
import {
  LABEL_RADIUS,
  WHEEL_CENTER,
  WHEEL_RADIUS_INNER,
  WHEEL_RADIUS_OUTER,
  segmentPath,
} from "./wheelPath";
import { SPIN_EASING } from "./easing";
import { playRareFanfare, playSpinStart, playTick, playWinChime } from "./sound";
import { runConfetti } from "./confetti";

const SPIN_DURATION_MS = 4400;
/** At rest the pointer sits on the centre of the first slot. */
const RESTING_ROTATION = -15;

type Phase = "ready" | "spinning" | "revealed";

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export default function LuckyWheelGamePage({ onClose }: { onClose: () => void }) {
  const service = useMemo(() => new SpinService(), []);
  const segments = LUCKY_WHEEL_CONFIG.segments;
  const active = useMemo(() => activeSegments(LUCKY_WHEEL_CONFIG), []);
  const stake = LUCKY_WHEEL_CONFIG.stake;

  const [balance, setBalance] = useState(() => service.getBalance());
  const [history, setHistory] = useState<SpinRecord[]>(() => service.getHistory(8));
  const [phase, setPhase] = useState<Phase>("ready");
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const closeButton = useRef<HTMLButtonElement>(null);
  const wheelGroupRef = useRef<SVGGElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef(RESTING_ROTATION);
  const animationFrame = useRef<number | undefined>(undefined);
  const audioContext = useRef<AudioContext | null>(null);
  const stopConfetti = useRef<(() => void) | null>(null);

  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const total = useMemo(() => totalWeight(active), [active]);
  const expectedPrize = useMemo(
    () =>
      active.reduce(
        (sum, segment) =>
          sum +
          prizeProbability(segment, LUCKY_WHEEL_CONFIG) *
            (segment.type === "multiplier" ? stake * segment.prize : segment.prize),
        0,
      ),
    [active, stake],
  );
  const returnToPlayer = stake > 0 ? expectedPrize / stake : 0;

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (animationFrame.current !== undefined) window.cancelAnimationFrame(animationFrame.current);
      stopConfetti.current?.();
      if (audioContext.current && audioContext.current.state !== "closed") {
        void audioContext.current.close();
      }
    };
  }, [onClose]);

  // A spin that was selected but never paid out (the page was closed mid-spin)
  // is settled when the game is opened again.
  useEffect(() => {
    const settled = service.settlePending();
    if (settled.length > 0) {
      setBalance(service.getBalance());
      setHistory(service.getHistory(8));
    }
  }, [service]);

  const applyRotation = useCallback((value: number) => {
    rotationRef.current = value;
    wheelGroupRef.current?.setAttribute(
      "transform",
      `rotate(${value} ${WHEEL_CENTER} ${WHEEL_CENTER})`,
    );
  }, []);

  const ensureAudio = useCallback(() => {
    if (!soundEnabled) return null;
    if (typeof window.AudioContext === "undefined") return null;
    audioContext.current ??= new window.AudioContext();
    void audioContext.current.resume();
    return audioContext.current;
  }, [soundEnabled]);

  const launchConfetti = useCallback((color: string) => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    stopConfetti.current?.();
    stopConfetti.current = runConfetti(canvas, {
      colors: [color, "#ff9f1c", "#ffe9c7", "#ffffff"],
    });
  }, []);

  const finishSpin = useCallback(
    (outcome: SpinResult) => {
      const settled = service.settle(outcome.record.id) ?? outcome.record;
      setBalance(service.getBalance());
      setHistory(service.getHistory(8));
      setResult({ ...outcome, record: settled });
      setPhase("revealed");

      const context = audioContext.current;
      if (context && soundEnabled) {
        playWinChime(context, outcome.segment.prize);
        if (outcome.segment.prize >= RARE_PRIZE_THRESHOLD) playRareFanfare(context);
      }
      if (!reducedMotion && outcome.segment.prize >= RARE_PRIZE_THRESHOLD) {
        launchConfetti(outcome.segment.color);
      }
    },
    [launchConfetti, reducedMotion, service, soundEnabled],
  );

  const animate = useCallback(
    (from: number, to: number, outcome: SpinResult) => {
      const startedAt = performance.now();
      let lastIndex = segmentIndexAtPointer(from);
      let lastTickAt = 0;

      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / SPIN_DURATION_MS);
        const current = from + (to - from) * SPIN_EASING(progress);
        applyRotation(current);

        const index = segmentIndexAtPointer(current);
        if (index !== lastIndex) {
          lastIndex = index;
          // The wheel crosses a lot of slots per second at full speed, so the
          // ticks are rate limited to keep the sound like a wheel and not a buzz.
          const context = audioContext.current;
          if (context && soundEnabled && now - lastTickAt > 45) {
            lastTickAt = now;
            playTick(context);
          }
        }

        if (progress < 1) {
          animationFrame.current = window.requestAnimationFrame(step);
        } else {
          // Land on the exact target so the pointer sits on the winning slot.
          applyRotation(to);
          finishSpin(outcome);
        }
      };

      animationFrame.current = window.requestAnimationFrame(step);
    },
    [applyRotation, finishSpin, soundEnabled],
  );

  function spinWheel() {
    if (phase === "spinning") return;

    setError(null);
    const context = ensureAudio();

    // The service decides the prize and records it before the wheel moves.
    let outcome: SpinResult;
    try {
      outcome = service.spin();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The wheel could not be spun because the prize table is not valid.",
      );
      return;
    }

    setBalance(service.getBalance());
    setPhase("spinning");
    setResult(null);

    const from = rotationRef.current;
    const to = rotationToAlign(outcome.segment.index, from, DEFAULT_FULL_TURNS);

    if (context) playSpinStart(context);

    if (reducedMotion) {
      applyRotation(to);
      finishSpin(outcome);
      return;
    }

    animate(from, to, outcome);
  }

  function resetBalance() {
    if (phase === "spinning") return;
    service.resetBalance();
    setBalance(service.getBalance());
    setHistory([]);
    setResult(null);
    setPhase("ready");
  }

  const winningSegmentId = result?.segment.id ?? null;
  const net = result?.record.net ?? 0;
  const statusText = (() => {
    if (error) return error;
    if (phase === "spinning") return "The wheel is in motion...";
    if (!result) return `Each spin costs ${stake} chips. Twelve slots, one winner.`;
    if (result.segment.prize === 0) {
      return `Slot ${result.segment.index + 1} paid 0 chips. Net −${stake} chips on this spin.`;
    }
    if (net > 0) {
      return `Slot ${result.segment.index + 1} paid ${result.segment.prize} chips. Net +${net} chips.`;
    }
    if (net === 0) {
      return `Slot ${result.segment.index + 1} paid ${result.segment.prize} chips. Even spin — the stake came straight back.`;
    }
    return `Slot ${result.segment.index + 1} paid ${result.segment.prize} chips. Net −${Math.abs(net)} chips.`;
  })();

  return (
    <main className="game-page lucky-wheel-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge">
          <span className="live-dot" /> FREE PLAY
        </span>
      </header>

      <section className="lucky-wheel-content" aria-labelledby="lucky-wheel-title">
        <div className="game-page-heading">
          <div className="modal-topline">
            <span className="live-dot" /> PRIZE WHEEL · VIRTUAL CHIPS ONLY
          </div>
          <h1 id="lucky-wheel-title">LUCKY WHEEL</h1>
          <p className="modal-intro">
            Twelve slots, one spin. The wheel decides nothing — the prize is locked in before it
            moves.
          </p>
        </div>

        <div className="lucky-wheel-layout">
          <section className="lucky-wheel-panel" aria-label="Lucky wheel">
            <button
              className="lucky-wheel-sound-toggle"
              onClick={() => setSoundEnabled((enabled) => !enabled)}
              aria-pressed={soundEnabled}
              type="button"
            >
              <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span> SOUND{" "}
              {soundEnabled ? "ON" : "OFF"}
            </button>

            <div className="lucky-wheel-stage">
              <svg
                className="lucky-wheel-svg"
                viewBox="0 0 240 240"
                role="img"
                aria-label={
                  result
                    ? `Lucky wheel. The pointer is on slot ${result.segment.index + 1}, which pays ${result.segment.prize} chips.`
                    : "Lucky wheel with twelve prize slots and a fixed pointer at the top."
                }
              >
                <defs>
                  <filter id="lucky-wheel-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="4.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <circle
                  className="lucky-wheel-rim"
                  cx={WHEEL_CENTER}
                  cy={WHEEL_CENTER}
                  r={WHEEL_RADIUS_OUTER + 6}
                />
                <circle
                  className="lucky-wheel-rim-inner"
                  cx={WHEEL_CENTER}
                  cy={WHEEL_CENTER}
                  r={WHEEL_RADIUS_OUTER + 1}
                />

                <g
                  ref={wheelGroupRef}
                  transform={`rotate(${RESTING_ROTATION} ${WHEEL_CENTER} ${WHEEL_CENTER})`}
                  className="lucky-wheel-disc"
                >
                  {segments.map((segment) => (
                    <path
                      key={segment.id}
                      d={segmentPath(segment.index)}
                      fill={segment.color}
                      className={`lucky-wheel-segment ${winningSegmentId === segment.id ? "is-winner" : ""}`}
                      stroke="#0e0e0e"
                      strokeWidth="1"
                    />
                  ))}

                  {segments.map((segment) => (
                    <g
                      key={`${segment.id}-label`}
                      transform={`rotate(${segmentCenterAngle(segment.index)} ${WHEEL_CENTER} ${WHEEL_CENTER})`}
                    >
                      <text
                        className="lucky-wheel-segment-prize"
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER - LABEL_RADIUS}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {segment.label}
                      </text>
                      <text
                        className="lucky-wheel-segment-chance"
                        x={WHEEL_CENTER}
                        y={WHEEL_CENTER - LABEL_RADIUS + 14}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {(prizeProbability(segment, LUCKY_WHEEL_CONFIG) * 100).toFixed(0)}%
                      </text>
                    </g>
                  ))}
                </g>

                <g className="lucky-wheel-hub">
                  <circle cx={WHEEL_CENTER} cy={WHEEL_CENTER} r={WHEEL_RADIUS_INNER - 3} />
                  <text
                    x={WHEEL_CENTER}
                    y={WHEEL_CENTER - 4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="lucky-wheel-hub-value"
                  >
                    {result ? result.segment.prize : "—"}
                  </text>
                  <text
                    x={WHEEL_CENTER}
                    y={WHEEL_CENTER + 11}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="lucky-wheel-hub-label"
                  >
                    {result ? "CHIPS" : "SPIN"}
                  </text>
                </g>

                <g className="lucky-wheel-pointer" transform={`translate(${WHEEL_CENTER} 0)`}>
                  <path d="M -13 2 L 13 2 L 0 34 Z" />
                </g>
              </svg>

              <canvas className="lucky-wheel-confetti" ref={confettiCanvasRef} aria-hidden="true" />
            </div>

            <div className="lucky-wheel-balance">
              <span>YOUR VIRTUAL CHIPS</span>
              <strong>{balance.toLocaleString()}</strong>
            </div>
            <div className="lucky-wheel-stake">
              <span>{stake}-CHIP SPIN</span>
              <strong>{phase === "spinning" ? "IN MOTION" : `${SEGMENT_COUNT} SLOTS`}</strong>
            </div>

            <button
              className="open-button lucky-wheel-spin-button"
              onClick={spinWheel}
              disabled={phase === "spinning" || balance < stake}
              type="button"
            >
              {phase === "spinning" ? "WHEEL SPINNING..." : "SPIN THE WHEEL"}
              <ArrowIcon />
            </button>
            <p
              className={`lucky-wheel-status ${error ? "is-error" : ""}`}
              role={error ? "alert" : "status"}
            >
              {statusText}
            </p>
            {balance < stake && phase !== "spinning" && (
              <button className="lucky-wheel-reset-button" onClick={resetBalance} type="button">
                RESET TO {STARTING_BALANCE.toLocaleString()} CHIPS
              </button>
            )}
          </section>

          <aside className="lucky-wheel-side">
            <section className="lucky-wheel-prizes" aria-labelledby="lucky-wheel-prizes-title">
              <div className="lucky-wheel-side-heading">
                <span className="odds-heading" id="lucky-wheel-prizes-title">
                  PRIZE TABLE
                </span>
                <span className="lucky-wheel-free-note">TOTAL WEIGHT {total}</span>
              </div>
              <ul>
                {segments.map((segment) => {
                  const probability = prizeProbability(segment, LUCKY_WHEEL_CONFIG) * 100;
                  return (
                    <li
                      key={segment.id}
                      className={winningSegmentId === segment.id ? "is-winner" : undefined}
                    >
                      <i style={{ background: segment.color }} aria-hidden="true" />
                      <span className="lucky-wheel-prize-name">{segment.label}</span>
                      <span className="lucky-wheel-prize-bar" aria-hidden="true">
                        <b style={{ width: `${probability}%` }} />
                      </span>
                      <span className="lucky-wheel-prize-chance">{probability.toFixed(0)}%</span>
                      <span className="lucky-wheel-prize-chips">
                        {segment.prize} {segment.prize === 1 ? "chip" : "chips"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="lucky-wheel-math" aria-label="Prize wheel math">
              <span className="odds-heading">THE MATH, TRANSPARENTLY</span>
              <p>
                The weights add up to <strong>{total}</strong>, so every weight is also its
                percentage chance. The best slot pays <strong>250 chips</strong> but only lands one
                spin in a hundred.
              </p>
              <p className="lucky-wheel-edge">
                Expected prize <strong>{expectedPrize.toFixed(1)} chips</strong> per spin · stake{" "}
                <strong>{stake} chips</strong> · return to player{" "}
                <strong>{(returnToPlayer * 100).toFixed(1)}%</strong> · house edge{" "}
                <strong>{((1 - returnToPlayer) * 100).toFixed(1)}%</strong>
              </p>
            </section>

            <section className="lucky-wheel-history" aria-labelledby="lucky-wheel-history-title">
              <div className="lucky-wheel-side-heading">
                <span className="odds-heading" id="lucky-wheel-history-title">
                  SPIN HISTORY
                </span>
                {history.length > 0 && (
                  <span className="lucky-wheel-history-count">{history.length} SPINS</span>
                )}
              </div>
              {history.length === 0 ? (
                <p className="lucky-wheel-empty-history">Your spins will show up here.</p>
              ) : (
                <ol>
                  {history.map((spin) => (
                    <li key={spin.id}>
                      <span className="lucky-wheel-history-prize">
                        {spin.prize} {spin.prize === 1 ? "chip" : "chips"}
                      </span>
                      <span className="lucky-wheel-history-chance">
                        slot {spin.segmentIndex + 1} · {(spin.probability * 100).toFixed(0)}% ·{" "}
                        {RARITY_LABELS[spin.rarity]}
                      </span>
                      <span
                        className={
                          spin.net > 0
                            ? "lucky-wheel-history-win"
                            : spin.net === 0
                              ? "lucky-wheel-history-even"
                              : "lucky-wheel-history-loss"
                        }
                      >
                        {spin.net > 0
                          ? `+${spin.net}`
                          : spin.net === 0
                            ? "0"
                            : `−${Math.abs(spin.net)}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
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
