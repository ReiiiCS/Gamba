import { useEffect, useRef, useState } from "react";

type Game = {
  title: string;
  category: string;
  description: string;
  style: string;
  symbol: string;
  tag?: string;
  playable?: boolean;
};

type Item = {
  name: string;
  rarity: string;
  color: string;
  symbol: string;
  chance: number;
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

const items: Item[] = [
  { name: "Daybreak", rarity: "Common", color: "#a9b1ad", symbol: "◒", chance: 48 },
  { name: "Voltage", rarity: "Uncommon", color: "#62d4aa", symbol: "ϟ", chance: 27 },
  { name: "Afterglow", rarity: "Rare", color: "#6c9cff", symbol: "✦", chance: 16 },
  { name: "Starfall", rarity: "Epic", color: "#ba81ff", symbol: "✧", chance: 7 },
  { name: "Moonshot", rarity: "Legendary", color: "#ffb84e", symbol: "☼", chance: 2 },
];

const caseRollDuration = 1900;

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

function playCaseSounds(context: AudioContext, rarity: string) {
  const startAt = context.currentTime + 0.03;
  for (let index = 1; index <= 10; index += 1) {
    const progress = index / 10;
    const time = startAt + caseRollDuration / 1000 * (1 - Math.sqrt(1 - progress));
    playTone(context, 1350 - index * 48, time, 0.04, 0.075, "triangle");
  }

  const revealNote: Record<string, number> = {
    Common: 523,
    Uncommon: 587,
    Rare: 659,
    Epic: 784,
    Legendary: 988,
  };
  const note = revealNote[rarity] ?? revealNote.Common;
  const revealAt = startAt + caseRollDuration / 1000 + 0.06;
  [note, note * 1.25, note * 1.5].forEach((frequency, index) => {
    playTone(context, frequency, revealAt + index * 0.07, 0.62, 0.045, "sine");
  });
}

function chooseItem(): Item {
  const roll = Math.random() * 100;
  let cursor = 0;
  for (const item of items) {
    cursor += item.chance;
    if (roll < cursor) return item;
  }
  return items[0];
}

function BrandMark() {
  return (
    <a className="brand" href="#top" aria-label="Playroom home">
      <span className="brand-icon" aria-hidden="true">P</span>
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
      <span className="art-orbit orbit-one" />
      <span className="art-orbit orbit-two" />
      <span className="card-art-symbol" aria-hidden="true">{game.symbol}</span>
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
      <span className="card-arrow" aria-hidden="true"><ArrowIcon /></span>
    </button>
  );
}

function CaseGamePage({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"ready" | "rolling" | "revealed">("ready");
  const [prize, setPrize] = useState<Item | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);
  const rollTimer = useRef<number | undefined>(undefined);
  const audioContext = useRef<AudioContext | null>(null);

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

  function openCase() {
    if (phase === "rolling") return;
    const selectedPrize = chooseItem();
    setPrize(selectedPrize);
    setPhase("rolling");
    if (soundEnabled && typeof window.AudioContext !== "undefined") {
      audioContext.current ??= new window.AudioContext();
      void audioContext.current.resume();
      playCaseSounds(audioContext.current, selectedPrize.rarity);
    }
    rollTimer.current = window.setTimeout(() => {
      setPhase("revealed");
    }, caseRollDuration);
  }

  function close() {
    onClose();
  }

  return (
    <main className="game-page">
      <header className="game-page-header">
        <button className="back-button" onClick={close} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge"><span className="live-dot" /> FREE PLAY</span>
      </header>
      <section className="case-game-content" aria-labelledby="case-title">
        <div className="game-page-heading">
          <div className="modal-topline"><span className="live-dot" /> CASE OPENING · NO PURCHASES</div>
          <h1 id="case-title">NEON VAULT</h1>
          <p className="modal-intro">A little mystery. A lot of possibility.</p>
        </div>

        <div className={`reveal-stage ${phase === "rolling" ? "is-rolling" : ""}`}>
          <button
            className="sound-toggle"
            onClick={() => setSoundEnabled((enabled) => !enabled)}
            aria-pressed={soundEnabled}
            type="button"
          >
            <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span> SOUND {soundEnabled ? "ON" : "OFF"}
          </button>
          {phase === "ready" && (
            <>
              <span className="vault-halo" />
              <span className="vault-symbol" aria-hidden="true">✳</span>
              <span className="stage-caption">YOUR NEXT FAVORITE THING?</span>
            </>
          )}
          {phase === "rolling" && (
            <>
              <div className="rolling-items" aria-label="Opening case">
                {Array.from(
                  { length: 15 },
                  (_, index) => index === 10 && prize ? prize : items[(index * 3 + 1) % items.length],
                ).map((item, index) => (
                  <span
                    className="rolling-item"
                    style={{ "--item-color": item.color } as React.CSSProperties}
                    key={`${item.name}-${index}`}
                  >
                    {item.symbol}
                  </span>
                ))}
              </div>
              <span className="rolling-marker" aria-hidden="true" />
            </>
          )}
          {phase === "revealed" && prize && (
            <div className="prize-reveal" style={{ "--prize-color": prize.color } as React.CSSProperties}>
              <span className="prize-symbol" aria-hidden="true">{prize.symbol}</span>
              <span className="prize-rarity">{prize.rarity} drop</span>
              <span className="prize-name">{prize.name}</span>
            </div>
          )}
          <button
            className="open-button stage-open-button"
            onClick={openCase}
            disabled={phase === "rolling"}
            type="button"
          >
            OPEN CASE
            <ArrowIcon />
          </button>
        </div>

        {phase === "revealed" && prize ? (
          <p className="reveal-message" role="status">
            You found <strong style={{ color: prize.color }}>{prize.name}</strong>. Just for fun—nothing to buy or cash out.
          </p>
        ) : (
          <p className="reveal-message">
            {phase === "rolling" ? "The universe is deciding..." : "Every drop is virtual. No money, no prizes."}
          </p>
        )}

        <div className="odds-panel">
          <span className="odds-heading">DROP ODDS</span>
          <div className="odds-list">
            {items.map((item) => (
              <span className="odds-item" key={item.name}>
                <i style={{ background: item.color }} />
                {item.rarity} <b>{item.chance}%</b>
              </span>
            ))}
          </div>
        </div>
      </section>
      <p className="game-page-footnote">ALL ITEMS ARE VIRTUAL · NO MONEY · NO PRIZES · JUST FOR FUN</p>
    </main>
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
    <main className="game-page">
      <header className="game-page-header">
        <button className="back-button" onClick={onClose} ref={closeButton} type="button">
          <span aria-hidden="true">←</span> ALL GAMES
        </button>
        <span className="game-page-brand">PLAYROOM</span>
        <span className="game-page-badge">COMING SOON</span>
      </header>
      <section className={`coming-page-content art-${game.style}`} aria-labelledby="coming-title">
        <span className="coming-symbol" aria-hidden="true">{game.symbol}</span>
        <span className="card-category">{game.category}</span>
        <h2 id="coming-title">{game.title}</h2>
        <p className="modal-intro">This game is still dreaming. Check back later for another free-to-play experience.</p>
        <button className="open-button" onClick={onClose} type="button">BACK TO PLAYROOM <ArrowIcon /></button>
      </section>
    </main>
  );
}

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  if (selectedGame) {
    const onClose = () => setSelectedGame(null);
    return selectedGame.playable
      ? <CaseGamePage onClose={onClose} />
      : <ComingSoonPage game={selectedGame} onClose={onClose} />;
  }

  return (
    <main id="top" className="page-shell">
      <header className="site-header">
        <BrandMark />
        <nav className="site-nav" aria-label="Main navigation">
          <a className="nav-active" href="#discover">Discover</a>
          <a href="#games">Games</a>
          <a href="#about">About</a>
        </nav>
        <a className="free-pill" href="#about"><span className="live-dot" /> ALWAYS FREE</a>
      </header>

      <section className="hero" id="discover">
        <div className="hero-art">
          <div className="hero-glow" />
          <div className="hero-ring ring-back" />
          <div className="hero-ring ring-front" />
          <span className="hero-spark spark-a">✦</span>
          <span className="hero-spark spark-b">✧</span>
          <div className="hero-object">
            <div className="object-face"><span>✳</span></div>
            <div className="object-side" />
            <div className="object-top" />
          </div>
          <div className="hero-art-label">A LITTLE MYSTERY<br />GOES A LONG WAY</div>
          <div className="hero-art-index">01 — 04</div>
        </div>
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> YOUR NEW HAPPY PLACE</div>
          <p className="hero-kicker">GOOD GAMES. GOOD VIBES.</p>
          <h1>Chase the<br /><em>feeling,</em> not the prize.</h1>
          <p className="hero-description">
            All the thrill of the reveal, with nothing on the line. Pick a game, take a chance, enjoy the moment.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#games">EXPLORE GAMES <ArrowIcon /></a>
            <span className="hero-note">100% free · 0% pressure</span>
          </div>
        </div>
        <div className="hero-count"><span>01</span> / 04</div>
      </section>

      <section className="games-section" id="games">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">PICK YOUR NEXT OBSESSION</p>
            <h2>Find your <em>game.</em></h2>
          </div>
          <span className="game-count">01 LIVE GAME <i /> 03 IN THE WORKS</span>
        </div>
        <div className="game-grid">
          {games.map((game) => (
            <GameCard key={game.title} game={game} onSelect={setSelectedGame} />
          ))}
        </div>
      </section>

      <section className="manifesto" id="about">
        <div className="manifesto-mark" aria-hidden="true">✳</div>
        <div>
          <p className="section-eyebrow">THE PLAYROOM PROMISE</p>
          <h2>All the rush.<br /><em>None of the risk.</em></h2>
        </div>
        <div className="manifesto-copy">
          <p>We made this for the fun part: the anticipation, the reveal, the “what if?” Every game is free to play, uses pretend items, and has no cash value. No accounts. No purchases. Just play.</p>
          <span><i className="live-dot" /> NOTHING TO SPEND. NOTHING TO LOSE.</span>
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
