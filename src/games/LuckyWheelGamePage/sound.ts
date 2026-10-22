/**
 * Small Web Audio helper. All sounds are synthesised, so the game ships
 * without any audio assets.
 */

export function playTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
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

/** Short click played every time the wheel passes a slot boundary. */
export function playTick(context: AudioContext) {
  const startAt = context.currentTime + 0.001;
  playTone(context, 1750, startAt, 0.035, 0.03, "square");
}

/** Rising blip that marks the start of a spin. */
export function playSpinStart(context: AudioContext) {
  const startAt = context.currentTime + 0.01;
  playTone(context, 320, startAt, 0.16, 0.05, "triangle");
  playTone(context, 480, startAt + 0.09, 0.2, 0.04, "triangle");
}

/** Win chime, pitched by the size of the prize. */
export function playWinChime(context: AudioContext, prize: number) {
  const startAt = context.currentTime + 0.02;
  const notes =
    prize >= 250
      ? [523.25, 659.25, 783.99, 1046.5]
      : prize >= 100
        ? [523.25, 659.25, 783.99]
        : prize >= 50
          ? [493.88, 587.33, 739.99]
          : prize >= 25
            ? [440, 554.37]
            : [392];

  notes.forEach((frequency, index) => {
    playTone(context, frequency, startAt + index * 0.075, 0.6, 0.05, "sine");
  });
}

/** Extra shimmer for the rare prizes. */
export function playRareFanfare(context: AudioContext) {
  const startAt = context.currentTime + 0.3;
  [1046.5, 1318.51, 1567.98, 2093].forEach((frequency, index) => {
    playTone(context, frequency, startAt + index * 0.06, 0.7, 0.035, "triangle");
  });
}
