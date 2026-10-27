import { useEffect, useState } from "react";
import { Card } from "./engine/types";
import "./PlayingCard.css";

type PlayingCardProps = {
  card: Card | null;
  hidden?: boolean;
  dealDelay?: number;
  flip?: boolean;
  winning?: boolean;
  animate?: boolean;
};

const getSuitSymbol = (suit: string) => {
  if (suit === "hearts") return "♥";
  if (suit === "diamonds") return "♦";
  if (suit === "clubs") return "♣";
  if (suit === "spades") return "♠";
  return "";
};

const getSuitColor = (suit: string) => {
  if (suit === "hearts" || suit === "diamonds") return "#d62828";
  return "#1a1a1a";
};

export default function PlayingCard({
  card,
  hidden = false,
  dealDelay = 0,
  flip = false,
  winning = false,
  animate = true,
}: PlayingCardProps) {
  const [dealt, setDealt] = useState(!animate);
  const [flipped, setFlipped] = useState(!flip);
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!animate) {
      setDealt(true);
      setFlipped(true);
      return;
    }
    if (prefersReducedMotion) {
      setDealt(true);
      setFlipped(true);
      return;
    }
    const dealTimer = setTimeout(() => setDealt(true), dealDelay);
    let flipTimer: number | undefined;
    if (flip) {
      flipTimer = window.setTimeout(() => setFlipped(true), dealDelay + 400);
    } else {
      setFlipped(true);
    }
    return () => {
      clearTimeout(dealTimer);
      if (flipTimer) clearTimeout(flipTimer);
    };
  }, [animate, dealDelay, flip, prefersReducedMotion]);

  if (hidden || !card) {
    return (
      <div
        className={`playing-card playing-card-back ${dealt ? "dealt" : ""} ${winning ? "winning" : ""}`}
        style={{ animationDelay: `${dealDelay}ms` }}
        aria-label="Hidden card"
      >
        <div className="playing-card-inner">
          <div className="playing-card-pattern" />
        </div>
      </div>
    );
  }

  const suitSymbol = getSuitSymbol(card.suit);
  const suitColor = getSuitColor(card.suit);
  const isRed = suitColor === "#d62828";

  return (
    <div
      className={`playing-card playing-card-front ${dealt ? "dealt" : ""} ${flipped ? "flipped" : ""} ${
        winning ? "winning" : ""
      } ${isRed ? "red-suit" : "black-suit"}`}
      style={{ animationDelay: `${dealDelay}ms` }}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <div className="playing-card-inner">
        <div className="playing-card-corner top-left">
          <div className="playing-card-rank">{card.rank}</div>
          <div className="playing-card-suit" style={{ color: suitColor }}>
            {suitSymbol}
          </div>
        </div>
        <div className="playing-card-center" style={{ color: suitColor }}>
          {suitSymbol}
        </div>
        <div className="playing-card-corner bottom-right">
          <div className="playing-card-rank">{card.rank}</div>
          <div className="playing-card-suit" style={{ color: suitColor }}>
            {suitSymbol}
          </div>
        </div>
      </div>
    </div>
  );
}
