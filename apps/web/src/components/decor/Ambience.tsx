import { useEffect, useRef } from 'react';
import { useMotionAllowed } from '../../lib/motion';

export type ParticleKind =
  | 'petals'
  | 'fireflies'
  | 'leaves'
  | 'snow'
  | 'dust'
  | 'stars'
  | 'bubbles'
  | 'sparks'
  | 'rain'
  | 'embers';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spin: number;
  angle: number;
  phase: number;
  hue: number;
  life: number;
}

const PALETTES: Record<ParticleKind, string[]> = {
  petals: ['#f9a8d4', '#fbcfe8', '#fda4af', '#fde68a'],
  fireflies: ['#fef08a', '#bef264', '#fde68a'],
  leaves: ['#f97316', '#ea580c', '#fbbf24', '#dc2626'],
  snow: ['#ffffff', '#e0f2fe', '#c7d2fe'],
  dust: ['#e9d5ff', '#fde68a', '#bae6fd'],
  stars: ['#ffffff', '#e0e7ff', '#fef3c7', '#a5f3fc'],
  bubbles: ['#fde047', '#f9a8d4', '#67e8f9', '#fdba74'],
  sparks: ['#fde047', '#f472b6', '#ffffff', '#c084fc'],
  rain: ['#93c5fd', '#bfdbfe', '#a5b4fc'],
  embers: ['#f97316', '#ef4444', '#fbbf24', '#fb923c'],
};

const FALLING = new Set<ParticleKind>(['snow', 'petals', 'leaves', 'rain']);
const RISING = new Set<ParticleKind>(['bubbles', 'embers', 'sparks']);

function spawn(kind: ParticleKind, width: number, height: number, initial: boolean): Particle {
  const fromTop = FALLING.has(kind);
  const fromBottom = RISING.has(kind);
  const speed: Partial<Record<ParticleKind, () => number>> = {
    snow: () => 0.25 + Math.random() * 0.45,
    petals: () => 0.35 + Math.random() * 0.4,
    leaves: () => 0.5 + Math.random() * 0.6,
    rain: () => 7 + Math.random() * 5,
    bubbles: () => -(0.3 + Math.random() * 0.6),
    embers: () => -(0.6 + Math.random() * 1.2),
    sparks: () => -(0.8 + Math.random() * 1.6),
  };
  return {
    x: Math.random() * width,
    y: initial
      ? Math.random() * height
      : fromTop
        ? -20
        : fromBottom
          ? height + 20
          : Math.random() * height,
    vx: kind === 'rain' ? -1.2 : (Math.random() - 0.5) * (kind === 'sparks' ? 1.4 : 0.35),
    vy: speed[kind]?.() ?? (Math.random() - 0.5) * 0.15,
    size:
      kind === 'leaves'
        ? 6 + Math.random() * 6
        : kind === 'petals'
          ? 4 + Math.random() * 4
          : kind === 'bubbles'
            ? 3 + Math.random() * 9
            : kind === 'rain'
              ? 10 + Math.random() * 14
              : kind === 'stars'
                ? 0.6 + Math.random() * 1.4
                : 1 + Math.random() * 2.6,
    spin: (Math.random() - 0.5) * 0.04,
    angle: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    hue: Math.floor(Math.random() * PALETTES[kind].length),
    life: Math.random(),
  };
}

const sprites = new Map<string, HTMLCanvasElement>();

function glowSprite(color: string): HTMLCanvasElement {
  let sprite = sprites.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = 64;
  sprite.height = 64;
  const g = sprite.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'transparent');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, sprite);
  return sprite;
}

function draw(ctx: CanvasRenderingContext2D, kind: ParticleKind, p: Particle, t: number) {
  const color = PALETTES[kind][p.hue]!;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (kind === 'rain') {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-p.size * 0.15, p.size);
    ctx.stroke();
  } else if (kind === 'bubbles') {
    const wobble = Math.sin(t * 0.002 + p.phase) * 2;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(wobble, 0, p.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(wobble - p.size * 0.35, -p.size * 0.35, p.size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (
    kind === 'sparks' ||
    kind === 'embers' ||
    kind === 'fireflies' ||
    kind === 'stars' ||
    kind === 'dust'
  ) {
    const pulse =
      kind === 'fireflies'
        ? 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.0016 + p.phase))
        : kind === 'sparks'
          ? 0.6 + 0.4 * Math.sin(t * 0.02 + p.phase)
          : kind === 'embers'
            ? 0.5 + 0.5 * Math.sin(t * 0.006 + p.phase)
            : 0.45 + 0.55 * Math.sin(t * 0.001 + p.phase);
    const radius =
      p.size *
      (kind === 'fireflies' ? 3.4 : kind === 'embers' ? 2.8 : kind === 'sparks' ? 2.2 : 2.3);
    ctx.globalAlpha = pulse * (kind === 'dust' ? 0.5 : 0.95);
    ctx.drawImage(glowSprite(color), -radius, -radius, radius * 2, radius * 2);
    if (kind === 'sparks') {
      ctx.globalAlpha = pulse * 0.6;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-p.vx * 6, -p.vy * 6);
      ctx.stroke();
    }
  } else if (kind === 'snow') {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(p.angle);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (kind === 'petals') {
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(0, -p.size);
      ctx.quadraticCurveTo(p.size * 0.9, 0, 0, p.size);
      ctx.quadraticCurveTo(-p.size * 0.9, 0, 0, -p.size);
    }
    ctx.fill();
  }
  ctx.restore();
}

export function Ambience({
  kind,
  density = 1,
  className = '',
  fixed = false,
}: {
  kind: ParticleKind;
  density?: number;
  className?: string;
  fixed?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const allowed = useMotionAllowed();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !allowed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let particles: Particle[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = 1;
      width = rect.width;
      height = rect.height;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const base = kind === 'rain' ? 60000 : 26000;
      const count = Math.round(
        Math.min(
          kind === 'rain' ? 140 : 90,
          ((width * height) / base) * density * (kind === 'rain' ? 4 : 1),
        ),
      );
      particles = Array.from({ length: count }, () => spawn(kind, width, height, true));
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let lastDraw = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (t - lastDraw < 32) return;
      lastDraw = t;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation =
        kind === 'rain' || kind === 'leaves' || kind === 'petals' ? 'source-over' : 'lighter';
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i]!;
        const sway = Math.sin(t * 0.0008 + p.phase);
        p.x += p.vx + (FALLING.has(kind) && kind !== 'rain' ? sway * 0.35 : 0);
        p.y += p.vy + (kind === 'fireflies' ? Math.cos(t * 0.0006 + p.phase) * 0.12 : 0);
        if (kind === 'embers' || kind === 'sparks') p.x += sway * 0.6;
        p.angle += p.spin + sway * 0.004;
        if (p.y > height + 30 || p.x < -40 || p.x > width + 40 || p.y < -40) {
          particles[i] = spawn(
            kind,
            width,
            height,
            kind === 'fireflies' || kind === 'dust' || kind === 'stars',
          );
          continue;
        }
        draw(ctx, kind, p, t);
      }
    };

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', onVisibility);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [kind, density, allowed]);

  if (!allowed) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`decor pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 h-full w-full ${className}`}
    />
  );
}
