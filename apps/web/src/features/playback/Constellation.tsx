import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { PlaybackSceneDto } from '@living-draft/contracts';
import { emitPulse } from '../../components/scene/pulses';
import { connectionMeta, emotionMeta } from '../../lib/meta';
import { useMotionAllowed } from '../../lib/motion';
import { placeNodes, placeSatellite, seededRandom, synapsePath, type Point } from './layout';

interface Satellite {
  memoryId: string;
  title: string;
  type: string;
  from: number;
  at: Point;
}

interface Edge {
  key: string;
  from: Point;
  to: Point;
  color: string;
  dashed: boolean;
  bend: number;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function nodeColor(scene: PlaybackSceneDto): string {
  return scene.emotions[0] ? emotionMeta(scene.emotions[0]).ink : '#c4b5fd';
}

export function Constellation({
  scenes,
  seed,
  focus,
  onEnter,
  onJump,
}: {
  scenes: PlaybackSceneDto[];
  seed: string;
  focus: number | null;
  onEnter: (index: number, origin: { x: number; y: number }) => void;
  onJump: (memoryId: string) => void;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const allowed = useMotionAllowed();
  const points = useMemo(() => placeNodes(scenes.length, seed), [scenes.length, seed]);

  const { satellites, edges } = useMemo(() => {
    const inSet = new Map(scenes.map((s, i) => [s.memoryId, i]));
    const r = seededRandom(`${seed}:edges`);
    const list: Edge[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < scenes.length - 1; i += 1) {
      list.push({
        key: `thread-${i}`,
        from: points[i]!,
        to: points[i + 1]!,
        color: 'rgb(255 255 255 / 0.22)',
        dashed: false,
        bend: (r() - 0.5) * 0.5,
      });
    }
    const outer: Satellite[] = [];
    scenes.forEach((scene, i) => {
      for (const link of scene.connections) {
        const pair = [scene.memoryId, link.memoryId].sort().join('|');
        if (seen.has(pair)) continue;
        seen.add(pair);
        const target = inSet.get(link.memoryId);
        const color = connectionMeta(link.type).color;
        if (target !== undefined) {
          list.push({
            key: pair,
            from: points[i]!,
            to: points[target]!,
            color,
            dashed: false,
            bend: 0.32 * (r() < 0.5 ? -1 : 1),
          });
        } else if (outer.length < 10) {
          const at = placeSatellite(points[i]!, outer.length, seed);
          outer.push({ memoryId: link.memoryId, title: link.title, type: link.type, from: i, at });
          list.push({
            key: pair,
            from: points[i]!,
            to: at,
            color,
            dashed: true,
            bend: (r() - 0.5) * 0.4,
          });
        }
      }
    });
    return { satellites: outer, edges: list };
  }, [scenes, points, seed]);

  const px = (p: Point) => ({ x: p.x * size.width, y: p.y * size.height });

  const origin = focus !== null && points[focus] ? px(points[focus]) : null;

  return (
    <motion.div
      ref={ref}
      className="absolute inset-0"
      initial={false}
      animate={
        focus === null
          ? { scale: 1, opacity: 1, filter: 'blur(0px)' }
          : { scale: 3.4, opacity: 0, filter: 'blur(10px)' }
      }
      transition={{ duration: allowed ? 1.1 : 0, ease: [0.65, 0, 0.35, 1] }}
      style={{
        transformOrigin: origin ? `${origin.x}px ${origin.y}px` : '50% 50%',
        pointerEvents: focus === null ? 'auto' : 'none',
      }}
    >
      {size.width > 0 && (
        <svg
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-hidden="true"
        >
          <defs>
            <filter id="synapse-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {edges.map((edge, i) => {
            const d = synapsePath(px(edge.from), px(edge.to), edge.bend);
            return (
              <g key={edge.key}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={edge.dashed ? 1.2 : 1.6}
                  strokeDasharray={edge.dashed ? '3 7' : undefined}
                  strokeLinecap="round"
                  filter="url(#synapse-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.9 }}
                  transition={{ duration: allowed ? 1.4 : 0, delay: allowed ? 0.3 + i * 0.12 : 0 }}
                />
                {allowed && (
                  <circle
                    r={edge.dashed ? 1.8 : 2.6}
                    fill="#fff"
                    opacity="0.9"
                    filter="url(#synapse-glow)"
                  >
                    <animateMotion
                      dur={`${2.6 + (i % 4) * 0.7}s`}
                      begin={`${(i * 0.53) % 3}s`}
                      repeatCount="indefinite"
                      path={d}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {size.width > 0 &&
        satellites.map((sat) => {
          const at = px(sat.at);
          const meta = connectionMeta(sat.type);
          return (
            <button
              key={sat.memoryId}
              type="button"
              onClick={() => onJump(sat.memoryId)}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
              style={{ left: at.x, top: at.y }}
            >
              <span
                className="size-3 rounded-full ring-1 ring-white/40 transition group-hover:scale-150"
                style={{ background: meta.color, boxShadow: `0 0 16px ${meta.color}` }}
              />
              <span className="max-w-32 text-[0.7rem] font-semibold leading-tight text-snow/55 transition group-hover:text-snow">
                {meta.glyph} {sat.title}
              </span>
            </button>
          );
        })}

      {size.width > 0 &&
        scenes.map((scene, i) => {
          const at = px(points[i]!);
          const color = nodeColor(scene);
          const rich = scene.photos.length + scene.videos.length + scene.audio.length;
          const orb = 22 + Math.min(14, scene.paragraphs.length * 2 + rich * 3);
          return (
            <motion.button
              key={scene.memoryId}
              type="button"
              aria-label={`Open ${scene.title}, ${scene.when}`}
              initial={allowed ? { opacity: 0, scale: 0.4 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                delay: allowed ? 0.2 + i * 0.14 : 0,
                type: 'spring',
                stiffness: 160,
                damping: 16,
              }}
              onClick={(event) => {
                emitPulse(event.clientX, event.clientY, 1.8);
                onEnter(i, at);
              }}
              className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center focus-visible:outline-none"
              style={{ left: at.x, top: at.y }}
            >
              <span
                className="relative flex items-center justify-center"
                style={{ width: orb * 2.4, height: orb * 2.4 }}
              >
                <span
                  className="ripple-ring absolute rounded-full"
                  style={{
                    width: orb,
                    height: orb,
                    border: `1.5px solid ${color}`,
                    animationDelay: `${i * 0.37}s`,
                  }}
                />
                <span
                  className="absolute rounded-full opacity-60 blur-xl transition duration-500 group-hover:opacity-100"
                  style={{
                    width: orb * 2.2,
                    height: orb * 2.2,
                    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
                  }}
                />
                <span
                  className="relative rounded-full ring-1 ring-white/50 transition duration-300 group-hover:scale-125 group-focus-visible:scale-125"
                  style={{
                    width: orb,
                    height: orb,
                    background: `radial-gradient(circle at 35% 30%, #fff 0%, ${color} 38%, rgb(4 3 9 / 0.85) 100%)`,
                    boxShadow: `0 0 26px ${color}, 0 0 60px -10px ${color}`,
                  }}
                />
              </span>
              <span className="-mt-2 max-w-44 font-display text-sm font-semibold leading-tight text-snow [text-shadow:0_0_18px_rgb(0_0_0/0.9)]">
                {scene.title}
              </span>
              <span className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-snow/55">
                {scene.when}
              </span>
            </motion.button>
          );
        })}
    </motion.div>
  );
}
