import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, BookOpen, Ear, Images, PenLine, Printer, Square } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChapterNoteDto, MemoryCardDto, PlaybackSceneDto } from '@living-draft/contracts';
import { chapterTitle, toThirdPerson } from '@living-draft/engine';
import { api } from '../../api/client';
import { keys, useMemories, usePlayback, useProfile } from '../../api/hooks';
import { AudioPlayer } from '../../components/media/AudioPlayer';
import { CertaintyMark, EmotionRow } from '../../components/memory/bits';
import { SceneArt } from '../../components/scene/SceneArt';
import { Button } from '../../components/ui/Button';
import { Segmented, TextArea } from '../../components/ui/controls';
import { EmptyState, PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { narrationSupported, speak, stopSpeaking } from '../../lib/narration';
import { useSound } from '../../lib/sound/SoundProvider';

type ChapterKey = number | 'loose';

export default function AlbumPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'story' ? 'story' : 'album';
  const { data: cards, isLoading } = useMemories();
  const { data: playback } = usePlayback({});
  const scenes = useMemo(
    () => new Map((playback?.scenes ?? []).map((s) => [s.memoryId, s])),
    [playback],
  );
  const { play } = useSound();
  useAtmosphere({
    mood: view === 'story' ? 'nostalgic' : 'grateful',
    intensity: 0.45,
    seed: `album-${view}`,
    texture: view === 'story' ? 'vinyl' : null,
  });

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">your storybook</p>
          <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">
            {view === 'album' ? 'The album' : 'The story so far'}
          </h1>
        </div>
        <Segmented
          label="View"
          value={view}
          onChange={(v) => {
            play('shift');
            setParams(v === 'story' ? { view: 'story' } : {});
          }}
          options={[
            {
              value: 'album',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Images className="size-4" /> Album
                </span>
              ),
            },
            {
              value: 'story',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="size-4" /> Storybook
                </span>
              ),
            },
          ]}
        />
      </div>
      {isLoading ? (
        <PaperLoading />
      ) : !cards?.length ? (
        <EmptyState title="Nothing here yet">
          Capture a memory and it'll show up here, in order, with its photos and recordings.
        </EmptyState>
      ) : view === 'album' ? (
        <Album cards={cards} scenes={scenes} />
      ) : (
        <Storybook cards={cards} scenes={scenes} />
      )}
    </div>
  );
}

function Album({
  cards,
  scenes,
}: {
  cards: MemoryCardDto[];
  scenes: Map<string, PlaybackSceneDto>;
}) {
  return (
    <div className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3">
      {cards.map((card, i) => {
        const scene = scenes.get(card.id);
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, delay: (i % 3) * 0.08 }}
            className="mb-6 break-inside-avoid"
          >
            <Link
              to={`/memories/${card.id}`}
              viewTransition
              className="group relative block overflow-hidden rounded-3xl ring-1 ring-white/10 transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_var(--mood-c)] hover:ring-white/25"
            >
              {card.cover ? (
                <img
                  src={card.cover.url}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105"
                />
              ) : (
                <SceneArt
                  artKey={`memory:${card.id}`}
                  artUrl={scene?.artUrl}
                  motifs={scene?.motifs}
                  text={`${card.title} ${card.excerpt}`}
                  emotions={card.emotions.map((e) => e.tag)}
                  generate={false}
                  pan={false}
                  className="aspect-[4/3] transition duration-700 group-hover:scale-105"
                >
                  <p className="absolute inset-x-5 bottom-5 line-clamp-3 font-display text-lg italic leading-snug text-snow [text-shadow:0_2px_18px_rgb(0_0_0/0.9)]">
                    “{card.excerpt}”
                  </p>
                </SceneArt>
              )}
              <div className="bg-abyss/88 px-4 py-3">
                <p className="font-display font-semibold leading-tight">{card.title}</p>
                <p className="text-xs font-semibold text-ink-soft">{card.temporal.label}</p>
              </div>
            </Link>
            {scene?.audio[0] && (
              <div className="mt-2">
                <AudioPlayer media={scene.audio[0]} />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function ordered(list: MemoryCardDto[]): MemoryCardDto[] {
  return list
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const x = a.card.storyOrder;
      const y = b.card.storyOrder;
      if (x !== null && y !== null) return x - y;
      if (x !== null) return -1;
      if (y !== null) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.card);
}

function Storybook({
  cards,
  scenes,
}: {
  cards: MemoryCardDto[];
  scenes: Map<string, PlaybackSceneDto>;
}) {
  const { data: profile } = useProfile();
  const client = useQueryClient();
  const toast = useToast();
  const [reading, setReading] = useState<ChapterKey | null>(null);
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const { data: notes = [] } = useQuery({
    queryKey: keys.chapterNotes,
    queryFn: () => api.get<ChapterNoteDto[]>('/chapter-notes'),
  });

  const chapters = useMemo(() => {
    const byId = new Map(cards.map((c) => [c.id, c]));
    const base = order
      ? order.map((id) => byId.get(id)).filter((c): c is MemoryCardDto => Boolean(c))
      : cards;
    const groups = new Map<ChapterKey, MemoryCardDto[]>();
    for (const card of base) {
      const key = card.temporal.placedAges[0] ?? 'loose';
      groups.set(key, [...(groups.get(key) ?? []), card]);
    }
    return [...groups.entries()]
      .map(([key, list]) => [key, order ? list : ordered(list)] as const)
      .sort((a, b) =>
        a[0] === 'loose' ? 1 : b[0] === 'loose' ? -1 : (a[0] as number) - (b[0] as number),
      );
  }, [cards, order]);

  const move = async (key: ChapterKey, index: number, delta: number) => {
    const next = chapters.map(([k, list]) => {
      if (k !== key) return list;
      const copy = [...list];
      const [item] = copy.splice(index, 1);
      copy.splice(Math.max(0, Math.min(copy.length, index + delta)), 0, item!);
      return copy;
    });
    const ids = next.flat().map((c) => c.id);
    setOrder(ids);
    await api.put('/story-order', { memoryIds: ids });
    void client.invalidateQueries({ queryKey: ['memories'] });
  };

  const saveNote = async (age: number, body: string) => {
    await api.put(`/chapters/${age}/note`, { body });
    void client.invalidateQueries({ queryKey: keys.chapterNotes });
    toast(body.trim() ? 'Chapter note saved' : 'Chapter note removed');
  };

  const narrate = (key: ChapterKey, list: readonly MemoryCardDto[]) => {
    if (reading === key) {
      stopSpeaking();
      setReading(null);
      return;
    }
    const third = profile?.narrativeVoice === 'third';
    const note = typeof key === 'number' ? notes.find((n) => n.age === key)?.body : undefined;
    const text = [
      note,
      ...list.map((c) => {
        const body = (scenes.get(c.id)?.paragraphs ?? [c.excerpt]).join(' ');
        return `${c.title}. ${third && profile ? toThirdPerson(body, { name: profile.preferredName, pronouns: profile.pronouns }) : body}`;
      }),
    ]
      .filter(Boolean)
      .join('\n\n');
    setReading(key);
    speak(text, { mood: list[0]?.emotions[0]?.tag ?? null, onEnd: () => setReading(null) });
  };

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap justify-end gap-2">
        <Button
          variant={arranging ? 'primary' : 'secondary'}
          size="sm"
          icon={<PenLine className="size-4" />}
          onClick={() => setArranging((a) => !a)}
        >
          {arranging ? 'Done arranging' : 'Arrange & annotate'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={<Printer className="size-4" />}
          onClick={() => window.print()}
        >
          Print or save as PDF
        </Button>
      </div>
      {chapters.map(([key, list]) => {
        const note = typeof key === 'number' ? notes.find((n) => n.age === key) : undefined;
        return (
          <section
            key={String(key)}
            className="paper print-chapter mb-10 rounded-[2rem] px-6 py-10 sm:px-14"
            aria-labelledby={`ch-${key}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{key === 'loose' ? 'not yet placed' : `age ${key}`}</p>
                <h2 id={`ch-${key}`} className="mt-1 text-4xl font-semibold">
                  {key === 'loose' ? 'Still floating' : chapterTitle(key)}
                </h2>
              </div>
              {narrationSupported() && (
                <Button
                  size="sm"
                  className="no-print"
                  variant={reading === key ? 'primary' : 'ghost'}
                  icon={
                    reading === key ? <Square className="size-4" /> : <Ear className="size-4" />
                  }
                  onClick={() => narrate(key, list)}
                >
                  {reading === key ? 'Stop' : 'Read aloud'}
                </Button>
              )}
            </div>

            {typeof key === 'number' &&
              (arranging ? (
                <NoteEditor
                  key={`${key}-${note?.updatedAt ?? ''}`}
                  initial={note?.body ?? ''}
                  onSave={(body) => saveNote(key, body)}
                />
              ) : (
                note && (
                  <p className="mt-5 border-l-2 border-lavender-deep/50 pl-4 font-display text-lg italic text-ink-soft">
                    {note.body}
                  </p>
                )
              ))}

            {list.map((card, i) => {
              const scene = scenes.get(card.id);
              return (
                <article key={card.id} className="relative mt-10">
                  {arranging && (
                    <div className="no-print absolute -left-12 top-0 hidden flex-col gap-1 sm:flex">
                      <button
                        type="button"
                        aria-label={`Move ${card.title} earlier`}
                        disabled={i === 0}
                        onClick={() => void move(key, i, -1)}
                        className="rounded-full p-1.5 text-ink-soft hover:bg-white/8 hover:text-snow disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${card.title} later`}
                        disabled={i === list.length - 1}
                        onClick={() => void move(key, i, 1)}
                        className="rounded-full p-1.5 text-ink-soft hover:bg-white/8 hover:text-snow disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <CertaintyMark temporal={card.temporal} compact />
                    <EmotionRow
                      emotions={card.emotions.filter((e) => e.phase === 'then')}
                      size="sm"
                      limit={3}
                    />
                    {arranging && (
                      <span className="flex gap-1 sm:hidden">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => void move(key, i, -1)}
                          className="rounded-full bg-white/8 p-1 disabled:opacity-30"
                          aria-label="Move earlier"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={i === list.length - 1}
                          onClick={() => void move(key, i, 1)}
                          className="rounded-full bg-white/8 p-1 disabled:opacity-30"
                          aria-label="Move later"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-display text-2xl font-semibold">
                    <Link to={`/memories/${card.id}`} viewTransition className="ink-link">
                      {card.title}
                    </Link>
                  </h3>
                  {scene?.photos[0] && (
                    <img
                      src={scene.photos[0].url}
                      alt={scene.photos[0].caption ?? ''}
                      loading="lazy"
                      className="photo-frame float-right my-2 ml-6 w-40 rounded-xl p-1.5 sm:w-52"
                    />
                  )}
                  <div
                    className={`mt-3 space-y-3 font-display text-[1.15rem] leading-[1.85] ${i === 0 ? 'drop-cap' : ''}`}
                  >
                    {(scene?.paragraphs ?? [card.excerpt]).map((p, j) => (
                      <p key={j} className="inline">
                        {p}{' '}
                      </p>
                    ))}
                  </div>
                  <div className="clear-both" />
                  {i < list.length - 1 && (
                    <p className="mt-8 text-center text-ink-faint" aria-hidden="true">
                      ⁂
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function NoteEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="no-print mt-5">
      <TextArea
        aria-label="A note for this chapter"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="A few words to open this chapter, if you like"
        rows={2}
      />
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          variant="soft"
          disabled={saving || body === initial}
          onClick={async () => {
            setSaving(true);
            await onSave(body);
            setSaving(false);
          }}
        >
          {saving ? 'Saving…' : 'Save note'}
        </Button>
      </div>
    </div>
  );
}
