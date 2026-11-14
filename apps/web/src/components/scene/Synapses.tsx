import { useEffect, useRef } from 'react';
import { haptic } from '../../lib/haptics';
import { useMotionAllowed } from '../../lib/motion';
import { sound } from '../../lib/sound/engine';
import { emitPulse } from './pulses';

interface Branch {
  points: Array<[number, number]>;
  color: string;
  width: number;
}

interface Burst {
  x: number;
  y: number;
  start: number;
  glow: number;
  branches: Branch[];
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

const LIFE = 1100;
const TRAIL_LIFE = 620;
const NO_TRAIL =
  'input, textarea, select, [contenteditable="true"], [draggable="true"], .react-flow, [data-no-trail]';

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function grow(
  x: number,
  y: number,
  angle: number,
  length: number,
  depth: number,
  color: string,
  out: Branch[],
) {
  const points: Array<[number, number]> = [[x, y]];
  let cx = x;
  let cy = y;
  let a = angle;
  const steps = 6 + Math.floor(Math.random() * 4);
  for (let i = 0; i < steps; i += 1) {
    a += (Math.random() - 0.5) * 0.7;
    cx += Math.cos(a) * (length / steps);
    cy += Math.sin(a) * (length / steps);
    points.push([cx, cy]);
    if (depth > 0 && i > 2 && Math.random() < 0.28) {
      grow(
        cx,
        cy,
        a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6),
        length * 0.5,
        depth - 1,
        color,
        out,
      );
    }
  }
  out.push({ points, color, width: depth === 2 ? 1.8 : depth === 1 ? 1.2 : 0.8 });
}

export function Synapses() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const allowed = useMotionAllowed();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const bursts: Burst[] = [];
    let trail: TrailPoint[] = [];
    let dragging = false;
    let travelled = 0;
    let sprouted = 0;
    let lastX = 0;
    let lastY = 0;
    let colors: string[] = [];
    let frame = 0;
    let running = false;

    const wake = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(draw);
    };

    const sprout = (x: number, y: number, heading: number) => {
      const branches: Branch[] = [];
      const side = Math.random() < 0.5 ? -1 : 1;
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i += 1) {
        const angle = heading + side * (i % 2 ? -1 : 1) * (1.1 + Math.random() * 0.7);
        grow(x, y, angle, 22 + Math.random() * 28, 1, colors[i % colors.length]!, branches);
      }
      bursts.push({ x, y, start: performance.now(), glow: 14, branches });
      if (bursts.length > 16) bursts.shift();
    };

    const resize = () => {
      if (!canvas || !ctx) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = bursts.length - 1; i >= 0; i -= 1) {
        const burst = bursts[i]!;
        const t = Math.max(0, (now - burst.start) / LIFE);
        if (t >= 1) {
          bursts.splice(i, 1);
          continue;
        }
        const grown = Math.min(1, t * 2.4);
        const fade = 1 - t;
        for (const branch of burst.branches) {
          const count = Math.max(2, Math.floor(branch.points.length * grown));
          ctx.strokeStyle = branch.color;
          ctx.lineWidth = branch.width;
          ctx.globalAlpha = fade * 0.75;
          ctx.beginPath();
          branch.points
            .slice(0, count)
            .forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.stroke();
          const signal =
            branch.points[
              Math.min(
                branch.points.length - 1,
                Math.floor(branch.points.length * Math.min(1, t * 1.6)),
              )
            ]!;
          ctx.globalAlpha = fade;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(signal[0], signal[1], branch.width + 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        const reach = burst.glow * (1 + t);
        const glow = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, reach);
        glow.addColorStop(0, `rgba(255,255,255,${0.55 * fade})`);
        glow.addColorStop(1, 'transparent');
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, reach, 0, Math.PI * 2);
        ctx.fill();
      }

      trail = trail.filter((p) => now - p.t < TRAIL_LIFE);
      if (trail.length > 1) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const [width, strength, color] of [
          [7, 0.18, colors[0] ?? '#e879f9'],
          [2.2, 0.9, '#ffffff'],
        ] as const) {
          for (let i = 1; i < trail.length; i += 1) {
            const a = trail[i - 1]!;
            const b = trail[i]!;
            const fade = Math.max(0, 1 - (now - b.t) / TRAIL_LIFE);
            ctx.globalAlpha = fade * strength;
            ctx.strokeStyle = color;
            ctx.lineWidth = width * (0.35 + fade * 0.65);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (dragging) {
          const head = trail[trail.length - 1]!;
          const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 18);
          glow.addColorStop(0, 'rgba(255,255,255,0.7)');
          glow.addColorStop(1, 'transparent');
          ctx.globalAlpha = 1;
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(head.x, head.y, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (bursts.length || trail.length > 1 || dragging) frame = requestAnimationFrame(draw);
      else running = false;
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      sound.unlock();
      if (!typing) sound.fire(event.clientX, event.clientY, 0.9);
      emitPulse(event.clientX, event.clientY, typing ? 0.4 : 1);
      haptic('fire');
      dragging = false;
      if (!allowed || !ctx || typing) return;
      colors = [
        cssColor('--mood-c', '#e879f9'),
        cssColor('--mood-b', '#38bdf8'),
        cssColor('--mood-a', '#8b5cf6'),
        '#fde68a',
      ];
      const branches: Branch[] = [];
      const count = 6 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        grow(
          event.clientX,
          event.clientY,
          angle,
          50 + Math.random() * 70,
          2,
          colors[i % colors.length]!,
          branches,
        );
      }
      bursts.push({
        x: event.clientX,
        y: event.clientY,
        start: performance.now(),
        glow: 36,
        branches,
      });
      if (bursts.length > 16) bursts.shift();
      dragging = !target?.closest(NO_TRAIL);
      travelled = 0;
      sprouted = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      trail = [{ x: lastX, y: lastY, t: performance.now() }];
      wake();
    };

    const onMove = (event: PointerEvent) => {
      if (!dragging || !(event.buttons & 1)) return;
      const step = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      if (step < 4) return;
      const heading = Math.atan2(event.clientY - lastY, event.clientX - lastX);
      travelled += step;
      lastX = event.clientX;
      lastY = event.clientY;
      trail.push({ x: lastX, y: lastY, t: performance.now() });
      if (trail.length > 80) trail.shift();
      if (travelled - sprouted > 64) {
        sprouted = travelled;
        sprout(lastX, lastY, heading);
        emitPulse(lastX, lastY, 0.35);
        if (Math.random() < 0.5) sound.fire(lastX, lastY, 0.25);
      }
      wake();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (travelled > 50) {
        sprout(lastX, lastY, Math.random() * Math.PI * 2);
        sprout(lastX, lastY, Math.random() * Math.PI * 2);
        emitPulse(lastX, lastY, 0.6);
      }
      wake();
    };

    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', resize);
    };
  }, [allowed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] h-full w-full"
    />
  );
}
