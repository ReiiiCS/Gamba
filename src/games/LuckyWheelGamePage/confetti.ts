type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  life: number;
};

export type ConfettiOptions = {
  colors: string[];
  particleCount?: number;
  durationMs?: number;
};

/**
 * Canvas confetti burst. The canvas is sized to its container and the burst
 * cleans up after itself.
 */
export function runConfetti(canvas: HTMLCanvasElement, options: ConfettiOptions): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => undefined;

  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const particleCount = options.particleCount ?? 120;
  const durationMs = options.durationMs ?? 2600;
  const colors = options.colors.length > 0 ? options.colors : ["#ff9f1c", "#ffffff"];

  const particles: Particle[] = Array.from({ length: particleCount }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3.5 + Math.random() * 6.5;
    return {
      x: width / 2 + (Math.random() - 0.5) * width * 0.25,
      y: height / 2 + (Math.random() - 0.5) * height * 0.12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      size: 4 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.32,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1,
    };
  });

  const startedAt = performance.now();
  let frame = 0;

  const step = (now: number) => {
    const elapsed = now - startedAt;
    const fade = Math.max(0, 1 - elapsed / durationMs);

    context.clearRect(0, 0, width, height);

    for (const particle of particles) {
      particle.vy += 0.22;
      particle.vx *= 0.99;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.spin;
      particle.life = fade;

      context.save();
      context.globalAlpha = Math.max(0, Math.min(1, particle.life));
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
      context.restore();
    }

    if (elapsed < durationMs) {
      frame = window.requestAnimationFrame(step);
    } else {
      context.clearRect(0, 0, width, height);
      frame = 0;
    }
  };

  frame = window.requestAnimationFrame(step);

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    context.clearRect(0, 0, width, height);
  };
}
