import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Clapperboard,
  GitCompare,
  History,
  ImagePlus,
  MapPin,
  Mic,
  PenLine,
  Quote,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import type { MemoryDetailDto } from '@living-draft/contracts';
import { uploadMedia, api } from '../../api/client';
import { useInvalidateArchive, useMemory, useProfile } from '../../api/hooks';
import { SceneArt } from '../../components/scene/SceneArt';
import { AudioPlayer } from '../../components/media/AudioPlayer';
import { Lightbox, PhotoStack, VideoNote } from '../../components/media/Gallery';
import { MediaManager } from '../../components/media/MediaManager';
import { CertaintyMark, EmotionRow, PeopleRow } from '../../components/memory/bits';
import { MemoryText, type TextMark } from '../../components/memory/MemoryText';
import { Button, ButtonLink, IconButton } from '../../components/ui/Button';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { formatDate, relativeTime } from '../../lib/format';
import { connectionMeta, MODE_LABELS } from '../../lib/meta';
import { hapticMood } from '../../lib/haptics';
import { EMOTION_TO_MOOD } from '../../lib/mood/moods';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import {
  weatherParticles,
  weatherTexture,
  writtenOnPhrase,
  type WeatherKind,
} from '@living-draft/engine';
import { memoryTexture } from '../../lib/sound/prepare';
import { useWorld } from '../../lib/world/world';
import { useDayWeather } from '../../api/weather';
import { DayWeather } from '../../components/memory/DayWeather';
import { openPlayback } from '../playback/playbackStore';
import { DeleteMemoryDialog, EditDetailsDialog, EditTextDialog } from './dialogs';

export default function MemoryPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useMemory(id);
  if (isLoading) return <PaperLoading label="Turning to that page…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;
  return <MemoryView memory={data} />;
}

function MemoryView({ memory }: { memory: MemoryDetailDto }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const location = useLocation();
  const [dialog, setDialog] = useState<'text' | 'details' | 'delete' | null>(() =>
    location.hash === '#placement' ? 'details' : null,
  );
  const [showOriginal, setShowOriginal] = useState(false);
  const [managing, setManaging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidateArchive();
  const toast = useToast();

  const world = useWorld();
  const { data: profile } = useProfile();
  const { data: dayWeather } = useDayWeather(
    memory.id,
    Boolean(profile?.weatherOn) && memory.temporal.precision === 'exact',
    `${memory.place ?? ''}|${memory.temporal.label}`,
  );
  const thatDay = dayWeather?.status === 'ok' ? (dayWeather.kind as WeatherKind) : null;
  useAtmosphere({
    emotions: memory.emotions.map((e) => ({ tag: e.tag, phase: e.phase })),
    fallback: 'nostalgic',
    seed: memory.id,
    quiet: memory.sensitive,
    presence: 'memory',
    texture: weatherTexture(thatDay) ?? memoryTexture(memory),
    sky: weatherParticles(thatDay),
    dim: 0.45,
  });
  const written = memory.versions[0]?.context;
  const firstFeeling = memory.emotions[0]?.tag;
  useEffect(() => {
    if (firstFeeling) hapticMood(EMOTION_TO_MOOD[firstFeeling] ?? firstFeeling);
  }, [memory.id, firstFeeling]);

  const photos = memory.media.filter((m) => m.kind === 'photo' || m.kind === 'scan');
  const videos = memory.media.filter((m) => m.kind === 'video');
  const audio = memory.media.filter((m) => m.kind === 'audio');
  const hero = photos[0];
  const marks: TextMark[] = useMemo(
    () =>
      memory.mentions.map((m) => ({
        start: m.start,
        end: m.end,
        characterId: m.characterId,
        label: `${m.characterName} · ${m.role}`,
      })),
    [memory.mentions],
  );
  const thenFeelings = memory.emotions.filter((e) => e.phase === 'then');
  const nowFeelings = memory.emotions.filter((e) => e.phase === 'now');
  const uncertain = memory.resolutions.filter((r) => r.resolution === 'mark_uncertain');
  const current =
    memory.versions.find((v) => v.id === memory.currentVersionId) ??
    memory.versions[memory.versions.length - 1];

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded = await Promise.all(
      Array.from(files).map((file) => uploadMedia(file, { name: file.name })),
    );
    await api.post(`/memories/${memory.id}/media`, { mediaIds: uploaded.map((m) => m.id) });
    invalidate();
    toast(`${uploaded.length === 1 ? 'Added' : `Added ${uploaded.length} files`} to this memory`);
  };

  return (
    <article className="relative">
      <div className="relative mx-3 mt-1 h-[56vh] min-h-[22rem] overflow-hidden rounded-[1.4rem] bg-abyss shadow-[0_24px_50px_-28px_rgb(0_0_0/0.95)] ring-1 ring-white/10 sm:mx-6 lg:ml-0">
        {hero ? (
          <img
            src={hero.url}
            alt={hero.caption ?? ''}
            className="anim-kenburns absolute inset-0 size-full object-cover"
          />
        ) : (
          <SceneArt
            size="hero"
            artKey={`memory:${memory.id}`}
            text={`${memory.title} ${memory.readingCopy}`}
            emotions={memory.emotions.map((e) => e.tag)}
            generate={!memory.sensitive}
            controls
            className="absolute inset-0"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ivory via-ivory/40 to-transparent" />
        <div className="absolute left-4 top-4 sm:left-8 sm:top-6">
          <Link
            to={
              memory.temporal.placedAges[0] !== undefined
                ? `/chapters/${memory.temporal.placedAges[0]}`
                : '/'
            }
            viewTransition
            className="inline-flex items-center gap-1.5 rounded-full bg-paper/88 px-3 py-1.5 text-sm font-semibold hover:bg-paper"
          >
            <ArrowLeft className="size-4" />
            {memory.temporal.placedAges[0] !== undefined
              ? `Chapter ${memory.temporal.placedAges[0]}`
              : 'Life Path'}
          </Link>
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-5 pb-6 sm:px-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CertaintyMark temporal={memory.temporal} />
            {memory.place && (
              <span className="inline-flex items-center gap-1 rounded-full bg-paper/80 px-2.5 py-0.5 text-xs font-bold">
                <MapPin className="size-3.5" /> {memory.place}
              </span>
            )}
          </div>
          <h1
            className="text-4xl font-semibold leading-tight sm:text-6xl"
            style={{ viewTransitionName: `mt-${memory.id}` }}
          >
            {memory.title}
          </h1>
          <div className="mt-3">
            <PeopleRow people={memory.people} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/8 py-4">
          <Button
            icon={<Clapperboard className="size-4" />}
            onClick={() => openPlayback({ memoryId: memory.id })}
            sound="whoosh"
          >
            Step back in
          </Button>
          <ButtonLink
            to={`/capture?memoryId=${memory.id}`}
            variant="secondary"
            icon={<Mic className="size-4" />}
          >
            Tell more
          </ButtonLink>
          <div className="ml-auto flex items-center">
            <IconButton label="Edit wording" onClick={() => setDialog('text')}>
              <PenLine className="size-5" />
            </IconButton>
            <IconButton label="Edit details" onClick={() => setDialog('details')}>
              <SlidersHorizontal className="size-5" />
            </IconButton>
            <IconButton label="Add photos, video or audio" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="size-5" />
            </IconButton>
            <Link
              to={`/compare?ids=${memory.id}`}
              viewTransition
              aria-label="Compare with another memory"
              title="Compare with another memory"
              className="inline-flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-ink/6 hover:text-ink"
            >
              <GitCompare className="size-5" />
            </Link>
            <IconButton
              label="Delete memory"
              onClick={() => setDialog('delete')}
              className="hover:!text-rose-deep"
            >
              <Trash2 className="size-5" />
            </IconButton>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => void addFiles(e.target.files)}
          />
        </div>

        {memory.pendingReview.length > 0 && (
          <Link
            to={`/memories/${memory.id}/evolution`}
            viewTransition
            className="mt-6 flex items-center gap-3 rounded-3xl bg-peach/45 p-4 text-peach-deep transition hover:bg-peach/60"
          >
            <TriangleAlert className="size-6 shrink-0" />
            <span>
              <span className="block font-bold">
                Some details read differently between tellings
              </span>
              <span className="text-sm">
                Nothing was overwritten. Take a look and decide how to keep them.
              </span>
            </span>
          </Link>
        )}

        <div className="grid gap-10 py-8 lg:grid-cols-[1.35fr_1fr]">
          <div>
            {thenFeelings.length > 0 || nowFeelings.length > 0 ? (
              <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {thenFeelings.length > 0 && (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink-soft">Back then</span>
                    <EmotionRow emotions={thenFeelings} />
                  </span>
                )}
                {nowFeelings.length > 0 && (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink-soft">Remembering it now</span>
                    <EmotionRow emotions={nowFeelings} />
                  </span>
                )}
              </div>
            ) : null}

            <div className="font-display text-[1.28rem] leading-[1.75] text-ink">
              <MemoryText
                key={memory.currentVersionId}
                text={memory.readingCopy}
                marks={marks}
                reveal
                dropCap
              />
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => setShowOriginal((s) => !s)}
                className="inline-flex items-center gap-2 text-sm font-bold text-lavender-deep hover:underline"
                aria-expanded={showOriginal}
              >
                <Quote className="size-4" />
                {showOriginal ? 'Hide your exact words' : 'Your exact words'}
              </button>
              {showOriginal && current && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-3xl bg-cream/70 p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                    {MODE_LABELS[current.mode] ?? 'Telling'} · {formatDate(current.recordedAt)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap font-display text-lg italic text-ink-soft">
                    {current.originalText}
                  </p>
                  {current.audio && (
                    <div className="mt-4">
                      <AudioPlayer media={current.audio} label="As you said it" />
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {uncertain.length > 0 && (
              <div className="mt-8 rounded-3xl border-2 border-dashed border-ink/20 p-5">
                <p className="text-sm font-bold">Details you're not sure about</p>
                <ul className="mt-2 space-y-2 text-ink-soft">
                  {uncertain.map((r) => (
                    <li key={r.id} className="italic">
                      “{r.laterText ?? r.earlierText}”
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {memory.connections.length > 0 && (
              <section className="mt-10" aria-labelledby="threads-title">
                <h2 id="threads-title" className="mb-4 text-2xl font-semibold">
                  Threads
                </h2>
                <div className="flex flex-col gap-4">
                  {memory.connections.map((c) => {
                    const meta = connectionMeta(c.type);
                    const other = c.endpoints.find((e) => e.nodeId !== memory.id);
                    return (
                      <div key={c.id} className="paper relative overflow-hidden rounded-3xl p-5">
                        <span
                          className="absolute inset-y-0 left-0 w-1.5"
                          style={{ background: meta.color }}
                          aria-hidden="true"
                        />
                        <p className="text-sm font-bold" style={{ color: meta.color }}>
                          {meta.glyph} {c.label}
                          {c.status === 'suggested' && (
                            <span className="ml-2 rounded-full bg-linen px-2 py-0.5 text-[0.7rem] text-ink-soft">
                              suggested
                            </span>
                          )}
                        </p>
                        {other && (
                          <Link
                            to={`/memories/${other.nodeId}`}
                            viewTransition
                            className="ink-link mt-1 block font-display text-xl font-semibold"
                          >
                            {other.title}
                          </Link>
                        )}
                        <p className="mt-1 text-ink-soft">{c.explanation}</p>
                        {other?.evidence && (
                          <p className="mt-2 text-sm italic text-ink-soft">
                            “{other.evidence.quote}”
                          </p>
                        )}
                        {c.note && <p className="mt-2 eyebrow">{c.note}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-6">
            {dayWeather && (
              <DayWeather
                weather={dayWeather}
                unit={world.unit}
                onAddPlace={() => setDialog('details')}
              />
            )}
            {written && (
              <p className="hand text-lg text-ink-faint">
                First written {writtenOnPhrase(written)}
                {memory.versions.length > 1 && memory.versions[memory.versions.length - 1]?.context
                  ? `, last added to ${writtenOnPhrase(memory.versions[memory.versions.length - 1]!.context!)}`
                  : ''}
                .
              </p>
            )}
            {(audio.length > 0 || photos.length > 0 || videos.length > 0) && (
              <section aria-labelledby="keepsakes">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 id="keepsakes" className="eyebrow">
                    kept with this memory
                  </h2>
                  <button
                    type="button"
                    onClick={() => setManaging((m) => !m)}
                    className="text-xs font-semibold text-ink-soft hover:text-ink"
                  >
                    {managing ? 'Done' : 'Captions & files'}
                  </button>
                </div>
                {managing ? (
                  <MediaManager media={memory.media} />
                ) : (
                  <div className="flex flex-col gap-4">
                    {audio.map((a) => (
                      <AudioPlayer key={a.id} media={a} />
                    ))}
                    {photos.length > 0 && <PhotoStack photos={photos} onOpen={setLightbox} />}
                    {videos.map((v) => (
                      <VideoNote key={v.id} media={v} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {memory.reflections.map((r, i) => (
              <motion.figure
                key={r.id}
                initial={{ rotate: 0, opacity: 0 }}
                animate={{ rotate: i % 2 ? 1.5 : -2, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="sticky-note relative rounded-2xl p-5 pt-6"
              >
                <span className="washi -top-3 left-1/2 -translate-x-1/2" aria-hidden="true" />
                <figcaption className="text-xs font-bold uppercase tracking-wider text-gold-deep">
                  Later, you wrote · {relativeTime(r.recordedAt)}
                </figcaption>
                <blockquote className="mt-2 eyebrow">{r.body}</blockquote>
              </motion.figure>
            ))}

            <Link
              to={`/memories/${memory.id}/evolution`}
              viewTransition
              className="paper group rounded-3xl p-5 transition hover:-translate-y-0.5"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-ink-soft">
                <History className="size-4" /> How this memory has changed
              </p>
              <p className="mt-1 font-display text-xl font-semibold">
                Told {memory.versions.length} {memory.versions.length === 1 ? 'time' : 'times'}
              </p>
              <p className="text-sm text-ink-soft">
                First on {formatDate(memory.versions[0]!.recordedAt)}
                {memory.versions.length > 1
                  ? `, most recently ${relativeTime(memory.versions[memory.versions.length - 1]!.recordedAt)}`
                  : ''}
              </p>
            </Link>

            {memory.milestones.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {memory.milestones.map((m) => (
                  <span
                    key={m.id}
                    className="rounded-r-full bg-peach-deep py-1 pl-3 pr-4 text-sm font-bold text-abyss"
                  >
                    ⚑ {m.title}
                  </span>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>

      <Lightbox
        photos={photos}
        index={lightbox}
        onClose={() => setLightbox(null)}
        onIndex={setLightbox}
      />
      {dialog === 'text' && <EditTextDialog memory={memory} open onClose={() => setDialog(null)} />}
      {dialog === 'details' && (
        <EditDetailsDialog memory={memory} open onClose={() => setDialog(null)} />
      )}
      {dialog === 'delete' && (
        <DeleteMemoryDialog memory={memory} open onClose={() => setDialog(null)} />
      )}
    </article>
  );
}
