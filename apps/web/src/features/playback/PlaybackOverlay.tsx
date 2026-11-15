import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Ear,
  EarOff,
  Mic2,
  Pause,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import { useProfile, usePlayback } from '../../api/hooks';
import { SceneArt } from '../../components/scene/SceneArt';
import { ShaderSky } from '../../components/scene/ShaderSky';
import { hapticMood } from '../../lib/haptics';
import { useActiveAtmosphere, useAtmosphere } from '../../lib/mood/atmosphere';
import { EMOTION_TO_MOOD } from '../../lib/mood/moods';
import { narrationSupported, stopSpeaking } from '../../lib/narration';
import { warmNarrator } from '../../lib/voice/neural';
import { readLocal, writeLocal } from '../../lib/storage';
import { sound } from '../../lib/sound/engine';
import { textureFor } from '../../lib/sound/textures';
import { useWorld } from '../../lib/world/world';
import { useDayWeather } from '../../api/weather';
import { weatherParticles, weatherTexture, type WeatherKind } from '@living-draft/engine';
import { Constellation } from './Constellation';
import { LiveScene } from './LiveScene';
import { openPlayback, type PlaybackRequest } from './playbackStore';

export default function PlaybackOverlay({
  request,
  onClose,
}: {
  request: PlaybackRequest;
  onClose: () => void;
}) {
  const { data: profile } = useProfile();
  const world = useWorld();
  useEffect(() => warmNarrator(), []);
  const { data, isLoading } = usePlayback(request);
  const [focus, setFocus] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [narrate, setNarrate] = useState(() => readLocal('read-aloud') === 'on');
  const [voice, setVoice] = useState<'first' | 'third'>(profile?.narrativeVoice ?? 'first');
  const closeRef = useRef<HTMLButtonElement>(null);

  const scenes = useMemo(() => data?.scenes ?? [], [data]);
  const single = scenes.length === 1;
  const index = single ? 0 : focus;
  const scene = index !== null ? scenes[index] : undefined;
  const seed = data?.title ?? 'live';

  const groupFeelings = useMemo(
    () =>
      scenes
        .filter((s) => !s.sensitive)
        .flatMap((s) => s.feelings)
        .slice(0, 30),
    [scenes],
  );
  const { data: fetchedWeather } = useDayWeather(
    scene?.memoryId ?? '',
    Boolean(profile?.weatherOn && scene?.date && !scene.weather),
  );
  const sceneWeather = scene?.weather ?? (fetchedWeather?.status === 'ok' ? fetchedWeather : null);
  const thatDay = (sceneWeather?.kind as WeatherKind | undefined) ?? null;
  useAtmosphere(
    scene
      ? {
          emotions: scene.feelings,
          fallback: 'nostalgic',
          seed: scene.memoryId,
          quiet: scene.sensitive,
          texture: weatherTexture(thatDay) ?? textureFor(scene.motifs, scene.season),
          sky: weatherParticles(thatDay),
          intensity: 0.9,
          dim: 0.4,
          presence: 'live',
        }
      : {
          emotions: groupFeelings,
          fallback: 'cosmos',
          seed,
          intensity: 0.65,
          presence: 'memory',
          texture: textureFor(
            scenes.flatMap((s) => s.motifs).slice(0, 2),
            scenes[0]?.season ?? null,
          ),
          dim: 0.5,
        },
  );
  const atmosphere = useActiveAtmosphere();
  const sky = useMemo(
    () => ({
      mood: atmosphere.mood,
      dim: scene ? 0.35 : 0.5,
      zoom: scene ? 1.7 : 1,
      seed: (atmosphere.seed % 997) / 997,
    }),
    [atmosphere, scene],
  );

  useEffect(() => {
    closeRef.current?.focus();
    sound.play('zoomIn');
    return () => {
      stopSpeaking();
      sound.duck(false);
    };
  }, []);

  const enter = useCallback(
    (next: number) => {
      const target = scenes[next];
      if (!target) return;
      stopSpeaking();
      sound.play('zoomIn');
      const mood = target.emotions[0] ? EMOTION_TO_MOOD[target.emotions[0]] : null;
      if (mood) hapticMood(mood);
      setPlaying(true);
      setFocus(next);
    },
    [scenes],
  );

  const back = useCallback(() => {
    stopSpeaking();
    setAuto(false);
    if (single) {
      onClose();
      return;
    }
    sound.play('zoomOut');
    setFocus(null);
  }, [single, onClose]);

  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      const next = index + delta;
      if (next < 0) return;
      if (next >= scenes.length) {
        setAuto(false);
        if (!single) {
          sound.play('zoomOut');
          setFocus(null);
        }
        return;
      }
      enter(next);
    },
    [index, scenes.length, single, enter],
  );

  const jump = useCallback(
    (memoryId: string) => {
      const inSet = scenes.findIndex((s) => s.memoryId === memoryId);
      if (inSet >= 0) enter(inSet);
      else {
        sound.play('zoomIn');
        openPlayback({ memoryId });
      }
    },
    [scenes, enter],
  );

  const finished = useCallback(() => step(1), [step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (index !== null && !single) back();
        else onClose();
      }
      if (index !== null && event.key === 'ArrowRight') step(1);
      if (index !== null && event.key === 'ArrowLeft') step(-1);
      if (event.key === ' ' && event.target === document.body) {
        event.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, single, back, onClose, step]);

  const groupArt = request.date
    ? {
        artKey: `day:${request.date}`,
        artUrl: null,
        motifs: scenes.flatMap((s) => s.motifs).slice(0, 2),
      }
    : scenes[0]
      ? { artKey: scenes[0].artKey, artUrl: scenes[0].artUrl, motifs: scenes[0].motifs }
      : null;
  const art = scene
    ? { artKey: scene.artKey, artUrl: scene.artUrl, motifs: scene.motifs }
    : groupArt;
  const artEmotions = scene ? scene.emotions : groupFeelings.map((f) => f.tag);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={data ? `Back to ${data.title}` : 'Back to a memory'}
      className="fixed inset-0 z-[80] overflow-hidden bg-abyss text-snow"
    >
      <ShaderSky target={sky} fixed={false} />

      <AnimatePresence mode="sync">
        {art && (
          <motion.div
            key={art.artKey}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: scene ? 0.62 : 0.32, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ mixBlendMode: 'screen' }}
          >
            <SceneArt
              size="hero"
              artKey={art.artKey}
              artUrl={art.artUrl}
              motifs={art.motifs}
              emotions={artEmotions}
              generate={!scene?.sensitive}
              className="absolute inset-0"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(4_3_9/0.85)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-abyss/90 to-transparent" />

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 p-4 sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            {scene && !single && (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20"
              >
                <ArrowLeft className="size-4" /> {data?.title}
              </button>
            )}
            {!scene && (
              <div className="min-w-0">
                <p className="eyebrow">back to</p>
                <h2 className="truncate font-display text-2xl font-semibold sm:text-3xl">
                  {data?.title ?? 'One moment…'}
                </h2>
                {data && <p className="text-sm text-snow/60">{data.subtitle}</p>}
              </div>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full bg-white/10 p-2.5 transition hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="relative flex-1">
          {!isLoading && scenes.length > 1 && (
            <Constellation
              scenes={scenes}
              seed={seed}
              focus={index}
              onEnter={enter}
              onJump={jump}
            />
          )}
          {!isLoading && scenes.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-snow/70">
              Nothing here yet.
            </p>
          )}
          <AnimatePresence mode="wait">
            {scene && (
              <motion.div
                key={scene.memoryId}
                className="absolute inset-0 overflow-y-auto px-6 pb-10 pt-2 sm:px-10"
              >
                <LiveScene
                  scene={scene}
                  voice={voice}
                  name={profile?.preferredName ?? 'They'}
                  pronouns={profile?.pronouns ?? null}
                  narrate={narrate}
                  playing={playing}
                  auto={auto}
                  onFinished={finished}
                  onJump={jump}
                  weather={sceneWeather}
                  unit={world.unit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="flex flex-col items-center gap-3 p-4 pb-7">
          {scene ? (
            <>
              {scenes.length > 1 && (
                <div className="flex gap-1.5" aria-hidden="true">
                  {scenes.map((s, i) => (
                    <span
                      key={s.memoryId}
                      className={`h-1 rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-snow shadow-[0_0_10px_var(--mood-c)]' : 'w-3 bg-white/25'}`}
                    />
                  ))}
                </div>
              )}
              <div className="glass-strong flex items-center gap-1 rounded-full p-1.5">
                {scenes.length > 1 && (
                  <button
                    type="button"
                    aria-label="Previous memory"
                    onClick={() => step(-1)}
                    className="rounded-full p-2.5 hover:bg-white/10"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={playing ? 'Pause' : 'Play'}
                  onClick={() => setPlaying((p) => !p)}
                  className="btn-aurora rounded-full p-3"
                >
                  {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
                </button>
                {scenes.length > 1 && (
                  <button
                    type="button"
                    aria-label="Next memory"
                    onClick={() => step(1)}
                    className="rounded-full p-2.5 hover:bg-white/10"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                )}
                {narrationSupported() && (
                  <button
                    type="button"
                    aria-pressed={narrate}
                    onClick={() => {
                      stopSpeaking();
                      const next = !narrate;
                      setNarrate(next);
                      writeLocal('read-aloud', next ? 'on' : null);
                      if (next) {
                        sound.unlock();
                        setPlaying(true);
                      }
                    }}
                    className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold ${narrate ? 'bg-snow text-abyss' : 'hover:bg-white/10'}`}
                  >
                    {narrate ? <Ear className="size-4" /> : <EarOff className="size-4" />}
                    <span className="hidden sm:inline">Read aloud</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVoice((v) => (v === 'first' ? 'third' : 'first'))}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-white/10"
                  title="Switch between first and third person. Your original words never change."
                >
                  <Mic2 className="size-4" />
                  {voice === 'first' ? '“I”' : `“${profile?.preferredName ?? 'They'}”`}
                </button>
              </div>
            </>
          ) : (
            scenes.length > 1 && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuto(true);
                    enter(0);
                  }}
                  className="btn-aurora inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold"
                >
                  <Sparkles className="size-5" /> Take me through it
                </button>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-snow/50">
                  or pick a memory to start there
                </p>
              </div>
            )
          )}
        </footer>
      </div>
    </div>
  );
}
