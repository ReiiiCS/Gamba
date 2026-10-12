import { useEffect, useRef, useState } from "react";
import "./RouletteGamePage.css";

const rouletteSpinDuration = 2200;
const rouletteRedNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const rouletteChipValues = [10, 25, 50, 100];
const rouletteWheelOrder = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const roulettePocketAngle = 360 / rouletteWheelOrder.length;
const rouletteBetTypes = [
  { id: "straight", label: "Straight up", count: 1, payout: 35, group: "inside" },
  { id: "split", label: "Split", count: 2, payout: 17, group: "inside" },
  { id: "street", label: "Street", count: 3, payout: 11, group: "inside" },
  { id: "corner", label: "Corner", count: 4, payout: 8, group: "inside" },
  { id: "six-line", label: "Six line", count: 6, payout: 5, group: "inside" },
  { id: "dozen", label: "Dozen", count: 12, payout: 2, group: "outside" },
  { id: "column", label: "Column", count: 12, payout: 2, group: "outside" },
  { id: "red-black", label: "Red / black", count: 18, payout: 1, group: "outside" },
  { id: "odd-even", label: "Odd / even", count: 18, payout: 1, group: "outside" },
  { id: "low-high", label: "Low / high", count: 18, payout: 1, group: "outside" },
] as const;

type BetType = typeof rouletteBetTypes[number]["id"];
type RouletteBet = {
  id: number;
  label: string;
  numbers: number[];
  stake: number;
  payout: number;
};
type RouletteColor = "red" | "black";

function isValidNumberGroup(type: BetType, numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  if (type === "straight") return sorted.length === 1;
  if (type === "split") {
    if (sorted.length !== 2) return false;
    if (sorted[0] === 0) return [1, 2, 3].includes(sorted[1]);
    const [first, second] = sorted;
    const firstColumn = Math.ceil(first / 3);
    const secondColumn = Math.ceil(second / 3);
    const firstRow = (first - 1) % 3;
    const secondRow = (second - 1) % 3;
    return (firstColumn === secondColumn && Math.abs(firstRow - secondRow) === 1)
      || (firstRow === secondRow && Math.abs(firstColumn - secondColumn) === 1);
  }
  if (type === "street") {
    return sorted.length === 3
      && sorted[0] >= 1
      && (sorted[0] - 1) % 3 === 0
      && sorted.every((number, index) => number === sorted[0] + index);
  }
  if (type === "corner") {
    if (sorted.length !== 4 || sorted[0] < 1) return false;
    const first = sorted[0];
    return first % 3 !== 0
      && sorted.join(",") === [first, first + 1, first + 3, first + 4].join(",");
  }
  if (type === "six-line") {
    return sorted.length === 6
      && sorted[0] >= 1
      && (sorted[0] - 1) % 3 === 0
      && sorted.every((number, index) => number === sorted[0] + index);
  }
  return sorted.length === (type === "dozen" || type === "column" ? 12 : 18);
}

function getRouletteColor(number: number): RouletteColor | "green" {
  if (number === 0) return "green";
  return rouletteRedNumbers.has(number) ? "red" : "black";
}

function chooseWinningNumber() {
  const sample = new Uint32Array(1);
  const range = 0x1_0000_0000;
  const acceptedRange = range - (range % rouletteWheelOrder.length);

  do {
    window.crypto.getRandomValues(sample);
  } while (sample[0] >= acceptedRange);

  return sample[0] % rouletteWheelOrder.length;
}

const rouletteWheelBackground = `conic-gradient(from -${roulettePocketAngle / 2}deg, ${rouletteWheelOrder
  .map((number, index) => {
    const color = getRouletteColor(number);
    const background = color === "red" ? "#a92835" : color === "black" ? "#171615" : "#278454";
    return `${background} ${index * roulettePocketAngle}deg ${(index + 1) * roulettePocketAngle}deg`;
  })
  .join(", ")})`;

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

export default function RouletteGamePage({ onClose }: { onClose: () => void }) {
  const [balance, setBalance] = useState(1000);
  const [chipValue, setChipValue] = useState(10);
  const [selectedBetType, setSelectedBetType] = useState<BetType>("straight");
  const [pendingNumbers, setPendingNumbers] = useState<number[]>([]);
  const [pendingLabel, setPendingLabel] = useState("");
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [phase, setPhase] = useState<"ready" | "spinning">("ready");
  const [result, setResult] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [lastSpinStake, setLastSpinStake] = useState<number | null>(null);
  const [netChange, setNetChange] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const spinTimer = useRef<number | undefined>(undefined);
  const wheelRotationRef = useRef(0);
  const nextBetId = useRef(0);
  const selectedType = rouletteBetTypes.find((betType) => betType.id === selectedBetType)!;
  const totalBet = bets.reduce((total, bet) => total + bet.stake, 0);
  const canSpin = phase === "ready" && bets.length > 0;
  const pendingValid = pendingNumbers.length === selectedType.count
    && isValidNumberGroup(selectedBetType, pendingNumbers);
  const expectedLossStake = totalBet || lastSpinStake || chipValue;
  const expectedLoss = expectedLossStake / 37;

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

  function setBetType(type: BetType) {
    setSelectedBetType(type);
    setPendingNumbers([]);
    setPendingLabel("");
  }

  function toggleNumber(number: number) {
    if (selectedType.group !== "inside" || phase === "spinning") return;
    setPendingLabel("");
    setPendingNumbers((current) => current.includes(number)
      ? current.filter((value) => value !== number)
      : current.length < selectedType.count ? [...current, number] : current);
  }

  function selectOutsideBet(label: string, numbers: number[]) {
    setPendingLabel(label);
    setPendingNumbers(numbers);
  }

  function placeBet() {
    if (phase === "spinning" || !pendingValid || totalBet + chipValue > balance) return;
    const type = selectedType;
    const label = pendingLabel || `${type.label} ${pendingNumbers.slice().sort((a, b) => a - b).join(" / ")}`;
    setBets((current) => [...current, {
      id: nextBetId.current++,
      label,
      numbers: pendingNumbers,
      stake: chipValue,
      payout: type.payout,
    }]);
    setPendingNumbers([]);
    setPendingLabel("");
  }

  function selectPreset(label: string, numbers: number[]) {
    selectOutsideBet(label, numbers);
  }

  function getOutsideBetOptions(type: BetType) {
    if (type === "dozen") {
      return [1, 2, 3].map((dozen) => ({
        label: `${dozen}${dozen === 1 ? "ST" : dozen === 2 ? "ND" : "RD"} DOZEN · ${dozen * 12 - 11}–${dozen * 12}`,
        numbers: Array.from({ length: 12 }, (_, index) => (dozen - 1) * 12 + index + 1),
      }));
    }
    if (type === "column") {
      return [1, 2, 3].map((column) => ({
        label: `${column}${column === 1 ? "ST" : column === 2 ? "ND" : "RD"} COLUMN`,
        numbers: Array.from({ length: 12 }, (_, index) => column + index * 3),
      }));
    }
    if (type === "red-black") {
      return [
        { label: "RED", numbers: Array.from({ length: 36 }, (_, index) => index + 1).filter((number) => getRouletteColor(number) === "red") },
        { label: "BLACK", numbers: Array.from({ length: 36 }, (_, index) => index + 1).filter((number) => getRouletteColor(number) === "black") },
      ];
    }
    if (type === "odd-even") {
      return [
        { label: "ODD", numbers: Array.from({ length: 36 }, (_, index) => index + 1).filter((number) => number % 2 === 1) },
        { label: "EVEN", numbers: Array.from({ length: 36 }, (_, index) => index + 1).filter((number) => number % 2 === 0) },
      ];
    }
    return [
      { label: "LOW · 1–18", numbers: Array.from({ length: 18 }, (_, index) => index + 1) },
      { label: "HIGH · 19–36", numbers: Array.from({ length: 18 }, (_, index) => index + 19) },
    ];
  }

  function spinWheel() {
    if (!canSpin) return;
    const winningNumber = chooseWinningNumber();
    const returnedChips = bets.reduce(
      (total, bet) => total + (bet.numbers.includes(winningNumber) ? bet.stake * (bet.payout + 1) : 0),
      0,
    );
    const change = returnedChips - totalBet;
    const winningSlot = rouletteWheelOrder.indexOf(winningNumber);
    const targetOrientation = (360 - winningSlot * roulettePocketAngle) % 360;
    const currentOrientation = wheelRotationRef.current % 360;
    const alignmentRotation = (targetOrientation - currentOrientation + 360) % 360;
    const targetRotation = wheelRotationRef.current + 5 * 360 + alignmentRotation;

    setBalance((current) => current - totalBet + returnedChips);
    setLastSpinStake(totalBet);
    wheelRotationRef.current = targetRotation;
    setWheelRotation(targetRotation);
    setPhase("spinning");
    setNetChange(change);
    setBets([]);
    spinTimer.current = window.setTimeout(() => {
      setResult(winningNumber);
      setHistory((current) => [winningNumber, ...current].slice(0, 8));
      setPhase("ready");
    }, rouletteSpinDuration);
  }

  const resultColor = result === null ? null : getRouletteColor(result);

  return (
    <main className="game-page roulette-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge"><span className="live-dot" /> FREE PLAY</span>
      </header>
      <section className="roulette-content" aria-labelledby="roulette-title">
        <div className="game-page-heading">
          <div className="modal-topline"><span className="live-dot" /> EUROPEAN ROULETTE · NO PURCHASES</div>
          <h1 id="roulette-title">LUCKY WHEEL</h1>
          <p className="modal-intro">Pick a number, choose a color, and see where the wheel lands.</p>
        </div>

        <div className="roulette-layout">
          <section className="roulette-wheel-panel" aria-label="Roulette wheel">
            <div className="roulette-wheel">
              <div
                className="roulette-wheel-disc"
                style={{ transform: `rotate(${wheelRotation}deg)` }}
              >
                <div className="roulette-wheel-rim">
                  <div className="roulette-wheel-face" style={{ background: rouletteWheelBackground }}>
                    <div className="roulette-pocket-ring" aria-hidden="true">
                      {rouletteWheelOrder.map((number, index) => {
                        const angle = index * roulettePocketAngle;
                        const radians = angle * Math.PI / 180;
                        return (
                          <span
                            className={`roulette-pocket-number ${getRouletteColor(number)}`}
                            key={number}
                            style={{
                              left: `${50 + Math.sin(radians) * 37}%`,
                              top: `${50 - Math.cos(radians) * 37}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                          >
                            {number}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className={`roulette-result ${resultColor ?? "green"}`} aria-live="polite">
                <span>{result ?? "—"}</span>
                <small>{result === null ? "PLACE YOUR BET" : `${resultColor?.toUpperCase()} · LAST SPIN`}</small>
              </div>
              <div className={`roulette-ball-track ${phase === "spinning" ? "is-spinning" : ""}`} aria-hidden="true">
                <span className="roulette-ball" />
              </div>
            </div>
            <p className="roulette-wheel-caption">The ball stays at the marker. The winning pocket rotates beneath it.</p>
            <div className="roulette-balance">
              <span>YOUR VIRTUAL CHIPS</span>
              <strong>{balance.toLocaleString()}</strong>
            </div>
            <div className="roulette-bet-summary">
              <span>{bets.length} {bets.length === 1 ? "BET" : "BETS"}</span>
              <strong>{totalBet.toLocaleString()} chips</strong>
            </div>
            <button className="open-button roulette-spin-button" onClick={spinWheel} disabled={!canSpin} type="button">
              {phase === "spinning" ? "WHEEL SPINNING..." : "SPIN THE WHEEL"}
              <ArrowIcon />
            </button>
            <p className="roulette-status" role="status">
              {phase === "spinning"
                ? "The wheel is in motion..."
                : netChange === null
                    ? "Choose one or more bets to get started."
                    : netChange > 0
                      ? `Last spin: ${result} ${resultColor}. Net win: ${netChange.toLocaleString()} virtual chips.`
                      : netChange === 0
                        ? `Last spin: ${result} ${resultColor}. Even spin—your balance stays the same.`
                        : `Last spin: ${result} ${resultColor}. Net loss: ${Math.abs(netChange).toLocaleString()} virtual chips.`}
            </p>
          </section>

          <section className="roulette-betting" aria-label="Place your bets">
            <div className="roulette-betting-heading">
              <div>
                <span className="odds-heading">BUILD YOUR BET</span>
                <p>Pick a bet type, then choose its numbers.</p>
              </div>
              <span className="roulette-free-note">VIRTUAL CHIPS ONLY</span>
            </div>
            <div className="roulette-bet-types" aria-label="Bet type">
              {rouletteBetTypes.map((betType) => (
                <button
                  className={`roulette-bet-type ${selectedBetType === betType.id ? "is-selected" : ""}`}
                  key={betType.id}
                  onClick={() => setBetType(betType.id)}
                  aria-pressed={selectedBetType === betType.id}
                  disabled={phase === "spinning"}
                  type="button"
                >
                  {betType.label}
                </button>
              ))}
            </div>
            <div className="roulette-bet-type-info" aria-live="polite">
              <span>{selectedType.label}</span>
              <span>{selectedType.payout}:1 net payout</span>
              <span>{selectedType.count}/37 · {(selectedType.count / 37 * 100).toFixed(2)}% to win</span>
            </div>
            <div className="roulette-chips" aria-label="Chip value">
              {rouletteChipValues.map((value) => (
                <button
                  className={`roulette-chip ${chipValue === value ? "is-selected" : ""}`}
                  key={value}
                  onClick={() => setChipValue(value)}
                  aria-pressed={chipValue === value}
                  disabled={phase === "spinning"}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
            {selectedType.group === "outside" ? (
              <div className="roulette-outside-bets">
                {getOutsideBetOptions(selectedBetType).map((option) => (
                  <button
                    className={`roulette-outside-bet ${pendingLabel === option.label ? "is-selected" : ""}`}
                    key={option.label}
                    onClick={() => selectPreset(option.label, option.numbers)}
                    aria-pressed={pendingLabel === option.label}
                    disabled={phase === "spinning"}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="roulette-number-section">
              <div className="roulette-section-label">
                <span>{selectedType.group === "inside" ? `SELECT ${selectedType.count} ${selectedType.count === 1 ? "NUMBER" : "ADJACENT NUMBERS"}` : "NUMBER LAYOUT"}</span>
                <span>{selectedType.payout}:1 NET</span>
              </div>
              <div className="roulette-number-grid">
                {[...Array(37)].map((_, number) => {
                  const color = getRouletteColor(number);
                  const row = number === 0 ? 1 : 3 - ((number - 1) % 3);
                  const column = number === 0 ? 1 : Math.ceil(number / 3) + 1;
                  const isPending = pendingNumbers.includes(number);
                  return (
                    <button
                      className={`roulette-number ${color} ${isPending ? "is-selected" : ""} ${result === number ? "is-result" : ""}`}
                      key={number}
                      style={number === 0 ? { gridRow: "1 / span 3", gridColumn: 1 } : { gridRow: row, gridColumn: column }}
                      onClick={() => toggleNumber(number)}
                      aria-pressed={isPending}
                      aria-label={`${number}, ${color}${isPending ? ", selected" : ""}`}
                      disabled={phase === "spinning" || selectedType.group !== "inside"}
                      type="button"
                    >
                      {number}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="roulette-pending-note" role="status">
              {totalBet + chipValue > balance
                ? "Your bet slip is at your available chip balance."
                : pendingNumbers.length === 0
                ? selectedType.group === "inside"
                  ? `Select ${selectedType.count} ${selectedType.count === 1 ? "number" : "numbers"} for a ${selectedType.payout}:1 net payout.`
                  : "Choose an outside bet above."
                : pendingValid
                  ? `${pendingLabel || selectedType.label}: ${pendingNumbers.length}/37 numbers · ${(pendingNumbers.length / 37 * 100).toFixed(2)}% chance to win.`
                  : `${pendingNumbers.length}/${selectedType.count} numbers selected. Choose a valid ${selectedType.label.toLowerCase()} combination.`}
            </p>
            <button
              className="open-button roulette-place-bet"
              onClick={placeBet}
              disabled={phase === "spinning" || !pendingValid || totalBet + chipValue > balance}
              type="button"
            >
              PLACE {chipValue}-CHIP BET
            </button>
            {bets.length > 0 && (
              <div className="roulette-bets-list">
                <div className="roulette-section-label">
                  <span>BET SLIP · {bets.length}</span>
                  <span>{totalBet} CHIPS</span>
                </div>
                {bets.map((bet) => (
                  <div className="roulette-bet-slip" key={bet.id}>
                    <span>{bet.label}<small>{bet.numbers.length}/37 · {(bet.numbers.length / 37 * 100).toFixed(2)}% · {bet.payout}:1 · {bet.stake} chips</small></span>
                    <button
                      onClick={() => setBets((current) => current.filter((item) => item.id !== bet.id))}
                      aria-label={`Remove ${bet.label} bet`}
                      disabled={phase === "spinning"}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {bets.length > 0 || pendingNumbers.length > 0 ? (
              <button
                className="roulette-clear-button"
                onClick={() => {
                  setBets([]);
                  setPendingNumbers([]);
                  setPendingLabel("");
                }}
                disabled={phase === "spinning"}
                type="button"
              >
                CLEAR BET SLIP
              </button>
            ) : null}
            <div className="roulette-math-panel">
              <span className="odds-heading">EUROPEAN ROULETTE MATH</span>
              <p>Every number has an equal <strong>1/37 (2.70%)</strong> chance. Red and black each cover 18 numbers, so either has an <strong>18/37 (48.65%)</strong> chance to win. Zero loses even-money bets.</p>
              <p className="roulette-edge">House edge: <strong>1/37 (2.70%)</strong> · At a <strong>{expectedLossStake}-chip stake</strong>, average expected loss is <strong>{expectedLoss.toFixed(2)} chips per spin</strong>.</p>
            </div>
            <div className="roulette-payout-table">
              <span className="odds-heading">STANDARD EUROPEAN PAYOUTS</span>
              {rouletteBetTypes.map((betType) => (
                <div key={betType.id}>
                  <span>{betType.label} · {betType.count} {betType.count === 1 ? "number" : "numbers"}</span>
                  <strong>{betType.payout}:1</strong>
                </div>
              ))}
              <p>Listed odds are net winnings. A winning bet also gets its original stake back. Example: a 10-chip straight-up win returns 350 profit + 10 stake = 360 chips.</p>
            </div>
          </section>
        </div>

        {history.length > 0 && (
          <div className="roulette-history" aria-label="Recent results">
            <span className="odds-heading">RECENT SPINS</span>
            <div>
              {history.map((number, index) => (
                <span className={`roulette-history-number ${getRouletteColor(number)}`} key={`${number}-${index}`}>
                  {number}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="game-page-footnote">ALL CHIPS ARE VIRTUAL · NO MONEY · NO PRIZES · JUST FOR FUN</p>
      </section>
    </main>
  );
}
