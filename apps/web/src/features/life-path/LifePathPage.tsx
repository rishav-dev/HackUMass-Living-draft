import { useMemo } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { CalendarHeart, Sparkles, TriangleAlert } from 'lucide-react';
import type { AgeNodeDto, LifePathDto } from '@living-draft/contracts';
import { greetingLine, momentPrompts } from '@living-draft/engine';
import { useLifePath } from '../../api/hooks';
import { Core } from '../../components/core/Core';
import { Button } from '../../components/ui/Button';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { plural } from '../../lib/format';
import { emotionMeta, hashNumber } from '../../lib/meta';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { useMotionAllowed } from '../../lib/motion';
import { useSound } from '../../lib/sound/SoundProvider';
import { useWorld } from '../../lib/world/world';
import { openPlayback } from '../playback/playbackStore';
import { DayStrip } from '../days/DayStrip';
import { Impulses } from './Impulses';
import { OpenQuestions } from './OpenQuestions';

const SPACING = 150;
const TOP = 200;
const BOTTOM = 160;

function xFor(index: number) {
  return 50 + Math.sin(index * 0.78 + 0.6) * 24;
}

function pathData(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const mid = (a.y + b.y) / 2;
    d += ` C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
  }
  return d;
}

function colorFor(node: AgeNodeDto): string {
  return node.topEmotions[0] ? emotionMeta(node.topEmotions[0]).ink : '#c4b5fd';
}

export default function LifePathPage() {
  const { data, isLoading, error, refetch } = useLifePath();
  if (isLoading) return <PaperLoading label="Turning to the first page…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;
  return <PathView data={data} />;
}

function PathView({ data }: { data: LifePathDto }) {
  const { profile } = data;
  const world = useWorld();
  const nudge = momentPrompts(world.part, world.kind)[0];
  const motionAllowed = useMotionAllowed();
  const chapters = useMemo(() => [...data.ages].reverse(), [data.ages]);
  const future = useMemo(() => [...data.future].reverse(), [data.future]);
  const rows = future.length + chapters.length;
  const height = TOP + Math.max(0, rows - 1) * SPACING + BOTTOM;
  const points = Array.from({ length: rows }, (_, i) => ({ x: xFor(i), y: TOP + i * SPACING }));
  const futurePath = pathData(points.slice(0, future.length + 1));
  const pastPath = pathData(points.slice(future.length));
  const filled = data.ages.filter((a) => a.memoryCount > 0).length;

  const lifeFeelings = data.ages.flatMap((a) => a.topEmotions.slice(0, 2).map((tag) => ({ tag })));
  useAtmosphere({
    emotions: lifeFeelings.slice(0, 24),
    musicMood: 'cosmos',
    fallback: 'cosmos',
    intensity: 0.55,
    seed: 'life-path',
    dim: 0.5,
  });

  const scrollTo = (age: number) => {
    document
      .getElementById(`age-${age}`)
      ?.scrollIntoView({ behavior: motionAllowed ? 'smooth' : 'auto', block: 'center' });
  };
  const jumps = [
    { label: 'Now', age: profile.currentAge },
    { label: 'Teens', age: Math.min(profile.currentAge, 15) },
    { label: 'Childhood', age: Math.min(profile.currentAge, 7) },
    { label: 'Start', age: 0 },
  ].filter((j, i, list) => list.findIndex((k) => k.age === j.age) === i);

  return (
    <div className="relative">
      <section className="relative mx-auto max-w-6xl px-5 pb-4 pt-10 sm:px-8">
        <p className="eyebrow">
          {greetingLine(
            world.part,
            profile.preferredName,
            world.weather
              ? {
                  kind: world.kind ?? 'cloudy',
                  temperature: world.weather.temperature,
                  isDay: world.weather.isDay,
                }
              : null,
          )}
        </p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Your life, <span className="aurora-text">one memory at a time</span>
        </h1>
        <p className="mt-4 max-w-xl text-ink-soft">
          {data.totalMemories
            ? `${plural(data.totalMemories, 'memory', 'memories')} so far, across ${plural(filled, 'year')} of your life. Open any year you like, even the empty ones. They aren't missing, just waiting.`
            : 'Every year of your life is here, waiting. Start with whatever comes to mind. Order doesn’t matter.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {data.totalMemories > 0 && (
            <Button
              onClick={() => openPlayback({})}
              icon={<Sparkles className="size-4" />}
              sound="zoomIn"
            >
              Walk through it all
            </Button>
          )}
          {data.needsReviewCount > 0 && (
            <Link
              to="/search?collection=needs_review"
              viewTransition
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-peach/20 px-4 text-sm font-semibold text-peach-deep ring-1 ring-peach/40"
            >
              <TriangleAlert className="size-4" aria-hidden="true" />{' '}
              {plural(data.needsReviewCount, 'thing')} to check
            </Link>
          )}
        </div>

        {nudge && (
          <Link
            to={`/capture?prompt=${encodeURIComponent(nudge.text)}`}
            viewTransition
            className="hand group mt-6 inline-flex max-w-2xl items-baseline gap-2 text-xl text-ink-soft transition hover:text-ink"
          >
            <span>{nudge.text}</span>
            <span className="whitespace-nowrap text-base text-lavender-deep opacity-70 transition group-hover:opacity-100">
              write it →
            </span>
          </Link>
        )}
        {data.onThisDay.length > 0 && (
          <div className="paper mt-6 flex max-w-2xl items-center gap-4 rounded-3xl p-4">
            <CalendarHeart className="size-8 shrink-0 text-rose-deep" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-rose-deep">On this day</p>
              {data.onThisDay.map((m) => (
                <Link
                  key={m.id}
                  to={`/memories/${m.id}`}
                  viewTransition
                  className="ink-link block font-display text-lg font-semibold"
                >
                  {m.title}{' '}
                  <span className="font-sans text-sm font-normal text-ink-soft">
                    ({m.temporal.label})
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <DayStrip />

      <OpenQuestions unplaced={data.unplacedCount} />

      <nav
        aria-label="Jump along the path"
        className="sticky top-20 z-20 float-right mr-3 hidden flex-col gap-1 sm:flex"
      >
        {jumps.map((jump) => (
          <button
            key={jump.label}
            type="button"
            onClick={() => scrollTo(jump.age)}
            className="rounded-full border border-white/10 bg-abyss/88 px-3 py-1.5 text-xs font-bold text-ink-soft transition hover:border-white/25 hover:text-snow"
          >
            {jump.label}
          </button>
        ))}
      </nav>

      <div className="relative mx-auto max-w-4xl" style={{ height }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="axon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e879f9" />
              <stop offset="0.5" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <path
            d={futurePath}
            fill="none"
            stroke="#c4b5fd"
            strokeWidth="2"
            strokeDasharray="2 12"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity="0.35"
          />
          <path
            d={pastPath}
            fill="none"
            stroke="url(#axon)"
            strokeWidth="26"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity="0.12"
          />
          <path
            d={pastPath}
            fill="none"
            stroke="url(#axon)"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={motionAllowed ? 1 : 0}
            className="anim-draw"
            style={{ filter: 'drop-shadow(0 0 6px #e879f9)' }}
          />
        </svg>
        {motionAllowed && <Impulses d={pastPath} height={height} />}

        <p className="absolute inset-x-0 top-6 text-center">
          <span className="eyebrow">chapters still being written</span>
        </p>

        {future.map((age, i) => (
          <div
            key={`future-${age}`}
            aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${points[i]!.x}%`, top: points[i]!.y, opacity: 0.25 + i * 0.12 }}
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-dashed border-white/25 font-display text-lg text-ink-faint">
              {age}
            </div>
          </div>
        ))}

        {chapters.map((node, i) => {
          const point = points[future.length + i]!;
          return (
            <Neuron
              key={node.age}
              node={node}
              x={point.x}
              y={point.y}
              current={node.age === profile.currentAge}
            />
          );
        })}
      </div>

      <section className="mx-auto max-w-3xl px-5 pb-10 text-center">
        <span className="eyebrow">where it all starts</span>
      </section>
    </div>
  );
}

function Neuron({
  node,
  x,
  y,
  current,
}: {
  node: AgeNodeDto;
  x: number;
  y: number;
  current: boolean;
}) {
  const { play } = useSound();
  const filled = node.memoryCount > 0;
  const labelLeft = x > 55;
  const color = colorFor(node);
  const uncertain = node.uncertainCount > 0;
  const size = filled ? 56 + Math.min(30, node.memoryCount * 6) : 30;
  const sparks = Math.min(node.memoryCount, 7);

  return (
    <div
      id={`age-${node.age}`}
      className="group scroll-reveal absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: y }}
    >
      {current && (
        <motion.div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <span className="eyebrow whitespace-nowrap">you are here</span>
        </motion.div>
      )}
      {filled && (
        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible"
          width={size * 3}
          height={size * 3}
          aria-hidden="true"
        >
          {Array.from({ length: sparks }, (_, i) => {
            const angle = (i / sparks) * Math.PI * 2 + hashNumber(`${node.age}-${i}`) * 0.9;
            const reach = size * (0.85 + hashNumber(`r${node.age}-${i}`) * 0.5);
            const cx = size * 1.5;
            const ex = cx + Math.cos(angle) * reach;
            const ey = cx + Math.sin(angle) * reach;
            const bx = cx + Math.cos(angle + 0.4) * reach * 0.55;
            const by = cx + Math.sin(angle + 0.4) * reach * 0.55;
            return (
              <g
                key={i}
                className="transition-opacity duration-500 group-hover:opacity-100"
                opacity={0.55}
              >
                <path
                  d={`M ${cx} ${cx} Q ${bx} ${by} ${ex} ${ey}`}
                  stroke={color}
                  strokeWidth="1"
                  fill="none"
                  opacity="0.7"
                />
                <circle
                  cx={ex}
                  cy={ey}
                  r="2.2"
                  fill={color}
                  style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                />
              </g>
            );
          })}
        </svg>
      )}
      {current && (
        <Core
          state="ready"
          size={size * 1.9}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80"
        />
      )}
      <Link
        to={`/chapters/${node.age}`}
        viewTransition
        onClick={() => play('zoomIn')}
        aria-label={`Age ${node.age}, ${node.title}. ${filled ? `${node.memoryCount} ${node.memoryCount === 1 ? 'memory' : 'memories'}` : 'No memories yet'}${node.milestones.length ? `. Milestone: ${node.milestones.map((m) => m.title).join(', ')}` : ''}${node.connectionCount ? `. ${node.connectionCount} confirmed threads` : ''}${node.uncertainCount ? `. ${node.uncertainCount} estimated` : ''}`}
        className="relative flex items-center justify-center rounded-full transition duration-300 hover:scale-110 focus-visible:scale-110"
        style={{ width: size, height: size }}
      >
        {filled ? (
          <>
            <span
              className="absolute -inset-4 rounded-full opacity-50 blur-xl transition group-hover:opacity-90"
              style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
            />
            <span
              className="absolute inset-0 rounded-full ring-1 ring-white/40"
              style={{
                background: `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.9) 0%, ${color} 34%, rgb(10 6 24 / 0.95) 100%)`,
                boxShadow: `0 0 30px -4px ${color}`,
              }}
            />
            {node.cover && (
              <img
                src={node.cover.url}
                alt=""
                className="absolute inset-1 size-[calc(100%-0.5rem)] rounded-full object-cover opacity-55 mix-blend-luminosity"
                loading="lazy"
              />
            )}
          </>
        ) : (
          <span className="absolute inset-0 rounded-full border border-dashed border-white/25 bg-abyss/60" />
        )}
        {uncertain && (
          <span
            className="cert-approximate absolute -inset-2.5 rounded-full border border-gold/50"
            aria-hidden="true"
          />
        )}
        <span
          className={`relative font-display font-semibold ${filled ? 'text-2xl text-snow [text-shadow:0_0_12px_rgb(0_0_0/0.8)]' : 'text-sm text-ink-faint'}`}
        >
          {node.age}
        </span>
        {node.connectionCount > 0 && (
          <span
            className="absolute -bottom-1 -left-1 flex size-6 items-center justify-center rounded-full bg-magenta/90 text-[0.7rem] text-abyss shadow-[0_0_14px_var(--color-magenta)]"
            title={`${node.connectionCount} confirmed ${node.connectionCount === 1 ? 'thread' : 'threads'}`}
            aria-hidden="true"
          >
            ∿
          </span>
        )}
        {node.milestones.length > 0 && (
          <span
            className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-gold text-[0.65rem] text-abyss shadow-[0_0_14px_var(--color-gold)]"
            aria-hidden="true"
          >
            ⚑
          </span>
        )}
      </Link>
      <div
        className={`pointer-events-none absolute top-1/2 w-48 -translate-y-1/2 ${labelLeft ? 'right-full mr-6 text-right' : 'left-full ml-6'}`}
        aria-hidden="true"
      >
        <p
          className={`font-display font-semibold leading-tight ${filled ? 'text-lg text-snow' : 'text-sm text-ink-faint'}`}
        >
          {node.title}
        </p>
        {filled ? (
          <p className="text-xs font-semibold text-ink-soft">
            {plural(node.memoryCount, 'memory', 'memories')}
            {node.people.length ? ` · ${node.people.slice(0, 2).join(', ')}` : ''}
            {node.milestones[0] ? ` · ${node.milestones[0].title}` : ''}
          </p>
        ) : (
          <p className="text-xs font-semibold text-ink-faint opacity-0 transition group-hover:opacity-100">
            Add a memory
          </p>
        )}
        {uncertain && (
          <p className="text-[0.7rem] font-bold text-gold/80">{node.uncertainCount} estimated</p>
        )}
      </div>
    </div>
  );
}
