import { useEffect, useRef, useState } from "react";
import CaseGamePage from "./games/CaseGamePage/CaseGamePage";
import RouletteGamePage from "./games/RouletteGamePage/RouletteGamePage";
import SlotGamePage from "./games/SlotGamePage/SlotGamePage";
import PlinkoGamePage from "./games/PlinkoGamePage/PlinkoGamePage";

type Game = {
  title: string;
  category: string;
  description: string;
  style: string;
  symbol: string;
  tag?: string;
  playable?: boolean;
  roulette?: boolean;
  slots?: boolean;
  plinko?: boolean;
};

const games: Game[] = [
  {
    title: "Neon vault",
    category: "CASE OPENING",
    description: "One case. A hundred possibilities.",
    style: "vault",
    symbol: "✳",
    tag: "PLAY NOW",
    playable: true,
  },
  {
    title: "Lucky wheel",
    category: "ROULETTE TABLE",
    description: "Call your number. Pick your color.",
    style: "roulette",
    symbol: "◉",
    tag: "PLAY NOW",
    playable: true,
    roulette: true,
  },
  {
    title: "Lucky reels",
    category: "SLOT MACHINE",
    description: "Three reels. One line. All virtual.",
    style: "slots",
    symbol: "777",
    tag: "PLAY NOW",
    playable: true,
    slots: true,
  },
  {
    title: "Gold drop",
    category: "PEG DROP",
    description: "Watch the ball find its multiplier.",
    style: "plinko",
    symbol: "●",
    tag: "PLAY NOW",
    playable: true,
    plinko: true,
  },
  {
    title: "Wishbound",
    category: "HERO PULLS",
    description: "A whole new world is waiting.",
    style: "wish",
    symbol: "✧",
    tag: "COMING SOON",
  },
  {
    title: "Relic run",
    category: "TREASURE DROP",
    description: "Ancient loot. Modern luck.",
    style: "relic",
    symbol: "◈",
    tag: "COMING SOON",
  },
  {
    title: "Pixel parade",
    category: "MYSTERY PACKS",
    description: "Tiny treasures, big energy.",
    style: "pixel",
    symbol: "✹",
    tag: "COMING SOON",
  },
];

function BrandMark() {
  return (
    <a className="brand" href="#top" aria-label="Playroom home">
      <span className="brand-icon" aria-hidden="true">
        P
      </span>
      <span>PLAYROOM</span>
    </a>
  );
}

function ArrowIcon() {
  return <span aria-hidden="true">↗</span>;
}

function GameCard({ game, onSelect }: { game: Game; onSelect: (game: Game) => void }) {
  return (
    <button
      className={`game-card art-${game.style}`}
      onClick={() => onSelect(game)}
      aria-label={`${game.title}: ${game.tag}`}
      type="button"
    >
      <span className="card-art-symbol" aria-hidden="true">
        {game.symbol}
      </span>
      <span className="card-shade" />
      <span className="card-content">
        <span className="card-category">{game.category}</span>
        <span className="card-title">{game.title}</span>
        <span className="card-description">{game.description}</span>
        <span className={`card-tag ${game.playable ? "tag-live" : ""}`}>
          {game.playable && <span className="live-dot" />}
          {game.tag}
        </span>
      </span>
      <span className="card-arrow" aria-hidden="true">
        <ArrowIcon />
      </span>
    </button>
  );
}

function ComingSoonPage({ game, onClose }: { game: Game; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  return (
    <main className={`game-page coming-page coming-${game.style}`}>
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge">COMING SOON</span>
      </header>
      <section className={`coming-page-content art-${game.style}`} aria-labelledby="coming-title">
        <span className="coming-symbol" aria-hidden="true">
          {game.symbol}
        </span>
        <span className="card-category">{game.category}</span>
        <h2 id="coming-title">{game.title}</h2>
        <p className="modal-intro">
          This game is still dreaming. Check back later for another free-to-play experience.
        </p>
        <button className="open-button" onClick={onClose} type="button">
          BACK TO PLAYROOM <ArrowIcon />
        </button>
      </section>
    </main>
  );
}

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  if (selectedGame) {
    const onClose = () => setSelectedGame(null);
    if (selectedGame.roulette) return <RouletteGamePage onClose={onClose} />;
    if (selectedGame.slots) return <SlotGamePage onClose={onClose} />;
    if (selectedGame.plinko) return <PlinkoGamePage onClose={onClose} />;
    return selectedGame.playable ? (
      <CaseGamePage onClose={onClose} />
    ) : (
      <ComingSoonPage game={selectedGame} onClose={onClose} />
    );
  }

  return (
    <main id="top" className="page-shell">
      <header className="site-header">
        <BrandMark />
        <nav className="site-nav" aria-label="Main navigation">
          <a className="nav-active" href="#discover">
            Discover
          </a>
          <a href="#games">Games</a>
          <a href="#about">About</a>
        </nav>
        <a className="free-pill" href="#about">
          <span className="live-dot" /> ALWAYS FREE
        </a>
      </header>

      <section className="hero" id="discover">
        <div className="hero-art">
          <div className="hero-glow" />
          <div className="hero-ring ring-back" />
          <div className="hero-ring ring-front" />
          <span className="hero-spark spark-a">✦</span>
          <span className="hero-spark spark-b">✧</span>
          <div className="hero-object">
            <div className="object-face">
              <span>✳</span>
            </div>
            <div className="object-side" />
            <div className="object-top" />
          </div>
          <div className="hero-art-label">
            A LITTLE MYSTERY
            <br />
            GOES A LONG WAY
          </div>
          <div className="hero-art-index">01 — 06</div>
        </div>
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> YOUR NEW HAPPY PLACE
          </div>
          <p className="hero-kicker">GOOD GAMES. GOOD VIBES.</p>
          <h1>
            Chase the
            <br />
            <em>feeling,</em> not the prize.
          </h1>
          <p className="hero-description">
            All the thrill of the reveal, with nothing on the line. Pick a game, take a chance,
            enjoy the moment.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#games">
              EXPLORE GAMES <ArrowIcon />
            </a>
            <span className="hero-note">100% free · 0% pressure</span>
          </div>
        </div>
        <div className="hero-count">
          <span>01</span> / 06
        </div>
      </section>

      <section className="games-section" id="games">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">PICK YOUR NEXT OBSESSION</p>
            <h2>
              Find your <em>game.</em>
            </h2>
          </div>
          <span className="game-count">
            03 LIVE GAMES <i /> 03 IN THE WORKS
          </span>
        </div>
        <div className="game-grid">
          {games.map((game) => (
            <GameCard key={game.title} game={game} onSelect={setSelectedGame} />
          ))}
        </div>
      </section>

      <section className="manifesto" id="about">
        <div className="manifesto-mark" aria-hidden="true">
          ✳
        </div>
        <div>
          <p className="section-eyebrow">THE PLAYROOM PROMISE</p>
          <h2>
            All the rush.
            <br />
            <em>None of the risk.</em>
          </h2>
        </div>
        <div className="manifesto-copy">
          <p>
            We made this for the fun part: the anticipation, the reveal, the “what if?” Every game
            is free to play, uses pretend items, and has no cash value. No accounts. No purchases.
            Just play.
          </p>
          <span>
            <i className="live-dot" /> NOTHING TO SPEND. NOTHING TO LOSE.
          </span>
        </div>
      </section>

      <footer className="site-footer">
        <BrandMark />
        <span>MADE FOR THE MOMENT. NOT THE MONEY.</span>
        <a href="#top">BACK TO TOP ↑</a>
      </footer>
    </main>
  );
}

export default App;
