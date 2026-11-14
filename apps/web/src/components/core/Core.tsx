import { useId, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useMotionAllowed } from '../../lib/motion';

export type CoreState = 'ready' | 'listening' | 'organizing' | 'saved';

const LABELS: Record<CoreState, string> = {
  ready: 'Ready',
  listening: 'Listening',
  organizing: 'Finding where it belongs',
  saved: 'Saved',
};

const ORBITS = [
  { rx: 44, ry: 16, tilt: -18, dots: 3, speed: 9 },
  { rx: 40, ry: 22, tilt: 32, dots: 2, speed: 13 },
  { rx: 48, ry: 12, tilt: 74, dots: 2, speed: 7 },
];

function Layer({
  size,
  style,
  className = '',
  children,
}: {
  size: number;
  style?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`core-layer ${className}`} style={style}>
      <svg viewBox="-60 -60 120 120" width={size} height={size} className="overflow-visible">
        {children}
      </svg>
    </div>
  );
}

export function Core({
  state = 'ready',
  size = 140,
  level = 0,
  className = '',
}: {
  state?: CoreState;
  size?: number;
  level?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const motionOk = useMotionAllowed();
  const speedUp = state === 'organizing' ? 0.25 : state === 'listening' ? 0.6 : 1;
  const coreScale = state === 'listening' ? 1 + level * 0.45 : state === 'saved' ? 1.12 : 1;
  const rippling = motionOk && state !== 'ready';

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={LABELS[state]}
    >
      <div
        className="core-layer transition-transform duration-150"
        style={{ transform: `scale(${coreScale})` }}
      >
        <Layer
          size={size}
          className={motionOk ? 'core-breathe' : ''}
          style={{ animationDuration: state === 'listening' ? '0.4s' : '3.2s' }}
        >
          <defs>
            <radialGradient id={`core-${id}`}>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="28%" stopColor="var(--mood-c, #e879f9)" />
              <stop offset="70%" stopColor="var(--mood-a, #5b21b6)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--mood-a, #5b21b6)" stopOpacity="0" />
            </radialGradient>
            <filter id={`blur-${id}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <circle r="30" fill={`url(#core-${id})`} filter={`url(#blur-${id})`} />
        </Layer>
        <Layer size={size}>
          <circle r="9" fill="#fff" />
        </Layer>
      </div>

      {[0, 1, 2].map((i) => (
        <Layer
          key={i}
          size={size}
          className={rippling ? 'core-ripple' : ''}
          style={
            rippling
              ? {
                  animationDuration: state === 'listening' ? '1.4s' : '2.4s',
                  animationDelay: `${i * 0.6}s`,
                }
              : { transform: `scale(${1.6 + i * 0.25})`, opacity: 0.12 }
          }
        >
          <circle r={24} fill="none" stroke="var(--mood-b, #38bdf8)" strokeWidth="0.6" />
        </Layer>
      ))}

      {ORBITS.map((orbit, o) => (
        <div key={o} className="core-layer" style={{ transform: `rotate(${orbit.tilt}deg)` }}>
          <Layer size={size}>
            <ellipse
              rx={orbit.rx}
              ry={orbit.ry}
              fill="none"
              stroke="rgb(255 255 255 / 0.12)"
              strokeWidth="0.5"
            />
          </Layer>
          <Layer
            size={size}
            className={motionOk ? 'core-spin' : ''}
            style={{
              animationDuration: `${orbit.speed * speedUp}s`,
              animationDirection: o % 2 ? 'reverse' : 'normal',
            }}
          >
            {Array.from({ length: orbit.dots }, (_, d) => {
              const angle = (d / orbit.dots) * Math.PI * 2;
              return (
                <circle
                  key={d}
                  cx={Math.cos(angle) * orbit.rx}
                  cy={Math.sin(angle) * orbit.ry}
                  r={state === 'organizing' ? 2.4 : 1.8}
                  fill={d % 2 ? 'var(--mood-b, #38bdf8)' : 'var(--mood-c, #e879f9)'}
                  style={{ filter: 'drop-shadow(0 0 3px white)' }}
                />
              );
            })}
          </Layer>
        </div>
      ))}

      {(state === 'organizing' || state === 'saved') && (
        <Layer size={size}>
          {state === 'organizing' &&
            [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <motion.line
                  key={i}
                  x1={0}
                  y1={0}
                  x2={Math.cos(a) * 52}
                  y2={Math.sin(a) * 52}
                  stroke="var(--mood-c, #e879f9)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: [0, 1, 1], opacity: [0, 0.9, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.17 }}
                />
              );
            })}
          {state === 'saved' && (
            <motion.circle
              r="52"
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="1.6"
              strokeLinecap="round"
              initial={{ pathLength: 0, rotate: -90 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </Layer>
      )}
    </div>
  );
}
