import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, AudioLines, EarOff, Moon } from 'lucide-react';
import type { DayWeatherDto, PlaybackSceneDto } from '@living-draft/contracts';
import { toThirdPerson, type TempUnit } from '@living-draft/engine';
import { DayWeather } from '../../components/memory/DayWeather';
import { connectionMeta, emotionMeta } from '../../lib/meta';
import { useMotionAllowed } from '../../lib/motion';
import { narrationSupported, prefetchSpeech, speak, stopSpeaking } from '../../lib/narration';
import { sound } from '../../lib/sound/engine';

function lineDuration(line: string) {
  return 2400 + line.length * 42;
}

export function LiveScene({
  scene,
  voice,
  name,
  pronouns,
  narrate,
  playing,
  auto,
  onFinished,
  onJump,
  weather,
  unit,
}: {
  weather: DayWeatherDto | null;
  unit: TempUnit;
  scene: PlaybackSceneDto;
  voice: 'first' | 'third';
  name: string;
  pronouns: string | null;
  narrate: boolean;
  playing: boolean;
  auto: boolean;
  onFinished: () => void;
  onJump: (memoryId: string) => void;
}) {
  const allowed = useMotionAllowed();
  const [lineIndex, setLineIndex] = useState(0);
  const [reading, setReading] = useState(narrate);
  const [waiting, setWaiting] = useState(false);
  if (narrate !== reading) {
    setReading(narrate);
    if (narrate) setLineIndex(0);
  }
  const clip = useRef<HTMLAudioElement>(null);
  const lines = useMemo(
    () =>
      voice === 'first'
        ? scene.paragraphs
        : scene.paragraphs.map((line) => toThirdPerson(line, { name, pronouns })),
    [scene.paragraphs, voice, name, pronouns],
  );
  const mood = scene.emotions[0] ?? null;
  const latest = useRef({ onFinished, mood, lines });
  useEffect(() => {
    latest.current = { onFinished, mood, lines };
  });
  const done = lineIndex >= lines.length;
  const line = lines[lineIndex];

  useEffect(() => {
    if (!playing) return;
    if (line === undefined) {
      if (!auto) return;
      const timer = window.setTimeout(() => latest.current.onFinished(), 2600);
      return () => window.clearTimeout(timer);
    }
    if (narrate && narrationSupported()) {
      const { mood, lines } = latest.current;
      const slow = window.setTimeout(() => setWaiting(true), 450);
      const stop = speak(line, {
        mood,
        onStart: () => {
          window.clearTimeout(slow);
          setWaiting(false);
        },
        onEnd: () => setLineIndex((i) => i + 1),
      });
      const following = lines[lineIndex + 1];
      if (following) prefetchSpeech(following, { mood });
      return () => {
        window.clearTimeout(slow);
        setWaiting(false);
        stop();
      };
    }
    const timer = window.setTimeout(() => setLineIndex((i) => i + 1), lineDuration(line));
    return () => window.clearTimeout(timer);
  }, [playing, auto, line, lineIndex, narrate]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    const first = latest.current.lines[0];
    if (first && narrationSupported()) prefetchSpeech(first, { mood: latest.current.mood });
  }, [scene.memoryId]);

  useEffect(() => {
    const el = clip.current;
    if (!el) return;
    if (playing) {
      el.volume = narrate ? 0.35 : 0.8;
      void el.play().catch(() => undefined);
      sound.duck(true);
    } else {
      el.pause();
      sound.duck(false);
    }
    return () => sound.duck(false);
  }, [playing, narrate]);

  const then = scene.feelings.filter((f) => f.phase === 'then');
  const now = scene.feelings.filter((f) => f.phase === 'now');

  return (
    <motion.div
      initial={allowed ? { opacity: 0, scale: 0.86, filter: 'blur(12px)' } : false}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={allowed ? { opacity: 0, scale: 1.08, filter: 'blur(10px)' } : { opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${scene.certainty === 'certain' ? 'bg-white/12' : 'border border-dashed border-white/40'}`}
          >
            {scene.when}
          </span>
          {scene.sensitive && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-snow/70">
              <Moon className="size-3.5" aria-hidden="true" /> Kept quiet, so no music
            </span>
          )}
        </div>
        <h2 className="neon mt-3 text-4xl font-semibold sm:text-6xl">{scene.title}</h2>
        {scene.people.length > 0 && (
          <p className="mt-2 text-snow/70">with {scene.people.join(', ')}</p>
        )}
        {weather && (
          <div className="mt-2">
            <DayWeather weather={weather} unit={unit} compact />
          </div>
        )}

        {(then.length > 0 || now.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {then.map((f) => (
              <Feeling key={`then-${f.tag}`} tag={f.tag} />
            ))}
            {now.length > 0 && <span className="px-1 text-snow/50">now</span>}
            {now.map((f) => (
              <Feeling key={`now-${f.tag}`} tag={f.tag} />
            ))}
          </div>
        )}

        <div className="mt-8 space-y-4 font-display text-xl leading-relaxed sm:text-[1.65rem] sm:leading-[1.55]">
          {lines.map((line, i) => (
            <motion.p
              key={`${scene.memoryId}-${i}`}
              initial={false}
              animate={{
                opacity: i < lineIndex ? 0.5 : i === lineIndex ? (waiting ? 0.7 : 1) : 0,
                y: i <= lineIndex ? 0 : 12,
              }}
              transition={{ duration: allowed ? 1.1 : 0 }}
              aria-hidden={i > lineIndex}
              className={i === lineIndex ? '[text-shadow:0_0_30px_var(--mood-c)]' : ''}
            >
              {line}
            </motion.p>
          ))}
        </div>

        {waiting && narrate && (
          <p
            role="status"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-snow/70"
          >
            <AudioLines className="size-4 animate-pulse" aria-hidden="true" />
            Finding the voice for this one…
          </p>
        )}

        {done && !playing && lines.length > 0 && (
          <button
            type="button"
            onClick={() => setLineIndex(0)}
            className="mt-6 text-sm font-semibold text-snow/70 underline underline-offset-4"
          >
            Read it again
          </button>
        )}

        {scene.connections.length > 0 && (
          <div className="mt-10">
            <p className="eyebrow">This connects to</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scene.connections.map((link) => {
                const meta = connectionMeta(link.type);
                return (
                  <button
                    key={`${link.memoryId}-${link.type}`}
                    type="button"
                    onClick={() => onJump(link.memoryId)}
                    title={link.explanation}
                    className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 py-1.5 pl-2 pr-3 text-sm transition hover:border-white/30 hover:bg-white/12"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}` }}
                    />
                    <span className="font-semibold" style={{ color: meta.color }}>
                      {link.label}
                    </span>
                    <span className="text-snow/80">{link.title}</span>
                    <ArrowUpRight className="size-3.5 text-snow/50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-5">
        {scene.photos.slice(0, 3).map((photo, i) => (
          <motion.figure
            key={photo.id}
            initial={allowed ? { opacity: 0, y: 30, rotate: i % 2 ? 3 : -3 } : false}
            animate={{ opacity: 1, y: 0, rotate: i % 2 ? 2 : -2 }}
            transition={{ delay: allowed ? 0.6 + i * 0.35 : 0, duration: 1 }}
            className="photo-frame anim-float rounded-2xl p-2"
            style={{ animationDelay: `${i * 1.3}s` }}
          >
            <img
              src={photo.url}
              alt={photo.caption ?? ''}
              className="aspect-[4/3] w-full rounded-xl object-cover"
            />
            {photo.caption && (
              <figcaption className="px-1 pt-2 text-xs text-snow/70">{photo.caption}</figcaption>
            )}
          </motion.figure>
        ))}
        {scene.videos[0] && (
          <video
            src={scene.videos[0].url}
            controls
            playsInline
            className="aspect-video w-full rounded-2xl bg-black/40 ring-1 ring-white/10"
          />
        )}
        {scene.audio[0] && (
          <div className="glass-strong flex items-center gap-3 rounded-2xl p-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
              {playing ? (
                <span className="anim-breathe size-3 rounded-full bg-magenta shadow-[0_0_12px_var(--color-magenta)]" />
              ) : (
                <EarOff className="size-4" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">
                {scene.audio[0].caption ?? 'The sound of it'}
              </span>
              <span className="text-xs text-snow/60">
                {playing ? 'Playing under the score' : 'Paused'}
              </span>
            </span>
            <audio ref={clip} src={scene.audio[0].url} loop />
          </div>
        )}
      </aside>
    </motion.div>
  );
}

function Feeling({ tag }: { tag: string }) {
  const meta = emotionMeta(tag);
  return (
    <span
      className="rounded-full px-2.5 py-1"
      style={{ background: meta.tint, color: meta.ink, boxShadow: `0 0 18px -6px ${meta.ink}` }}
    >
      {meta.label}
    </span>
  );
}
