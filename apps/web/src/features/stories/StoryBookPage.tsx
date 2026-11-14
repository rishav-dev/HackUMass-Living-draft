import { useMemo, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Ear, Link2, Plus, Square, Trash2, X } from 'lucide-react';
import type { StoryBookDto, StorySceneDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import {
  useStoryActions,
  useStoryBook,
  useStoryLinkTypes,
  type StoryActions,
} from '../../api/stories';
import { Button } from '../../components/ui/Button';
import { Segmented, Select, TextArea, TextInput } from '../../components/ui/controls';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { emotionMeta, initials, tintFor } from '../../lib/meta';
import { useAtmosphere } from '../../lib/mood/atmosphere';
import { MOODS, type MoodKey } from '../../lib/mood/moods';
import { narrationSupported, speak, stopSpeaking } from '../../lib/narration';
import { useSound } from '../../lib/sound/SoundProvider';
import { SceneEditor } from './SceneEditor';

type Tab = 'board' | 'cast' | 'threads' | 'world' | 'read';

export default function StoryBookPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useStoryBook(id);
  if (isLoading) return <PaperLoading label="Opening the book…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;
  return <Workspace book={data} />;
}

function Workspace({ book }: { book: StoryBookDto }) {
  const actions = useStoryActions(book.id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('board');
  const [editing, setEditing] = useState<{
    scene: StorySceneDto | null;
    chapterId: string | null;
  } | null>(null);
  const mood = (book.mood in MOODS ? book.mood : 'cosmos') as MoodKey;
  useAtmosphere({ mood, intensity: 0.55, seed: book.id });

  return (
    <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8">
      <Link
        to="/stories"
        viewTransition
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Story books
      </Link>
      <BookHeader
        book={book}
        actions={actions}
        onDelete={async () => {
          if (
            !window.confirm(`Delete “${book.title}” and every scene in it? This can't be undone.`)
          )
            return;
          await api.delete(`/stories/${book.id}`);
          void navigate('/stories', { replace: true });
        }}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'board', label: 'Chapters' },
            { value: 'cast', label: `Cast (${book.characters.length})` },
            { value: 'threads', label: `Threads (${book.links.length})` },
            { value: 'world', label: 'World notes' },
            { value: 'read', label: 'Read' },
          ]}
        />
        <Button
          className="ml-auto"
          icon={<Plus className="size-4" />}
          onClick={() => setEditing({ scene: null, chapterId: null })}
        >
          New scene
        </Button>
      </div>

      {tab === 'board' && (
        <Board
          book={book}
          actions={actions}
          onEdit={(scene, chapterId) => setEditing({ scene, chapterId })}
        />
      )}
      {tab === 'cast' && <Cast book={book} actions={actions} />}
      {tab === 'threads' && <Threads book={book} actions={actions} />}
      {tab === 'world' && <World book={book} actions={actions} />}
      {tab === 'read' && <Reader book={book} />}

      {editing && (
        <SceneEditor
          book={book}
          scene={editing.scene}
          defaultChapterId={editing.chapterId}
          actions={actions}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BookHeader({
  book,
  actions,
  onDelete,
}: {
  book: StoryBookDto;
  actions: StoryActions;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [premise, setPremise] = useState(book.premise ?? '');
  return (
    <header className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
      <div>
        <p className="eyebrow">Story book · fiction</p>
        <input
          aria-label="Book title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() =>
            title.trim() && title !== book.title && void actions.updateBook({ title: title.trim() })
          }
          className="mt-1 w-full bg-transparent font-display text-4xl font-semibold outline-none sm:text-5xl"
        />
        <textarea
          aria-label="What it's about"
          value={premise}
          rows={2}
          placeholder="What's it about?"
          onChange={(e) => setPremise(e.target.value)}
          onBlur={() =>
            premise !== (book.premise ?? '') &&
            void actions.updateBook({ premise: premise.trim() || null })
          }
          className="mt-2 w-full max-w-3xl resize-none bg-transparent text-ink-soft outline-none placeholder:text-ink-faint"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-bold">
          <span className="sr-only">Book atmosphere</span>
          <Select
            value={book.mood}
            onChange={(e) => void actions.updateBook({ mood: e.target.value })}
            className="h-9 py-1 text-sm"
          >
            {(Object.keys(MOODS) as MoodKey[])
              .filter((key) => key !== 'studio')
              .map((key) => (
                <option key={key} value={key}>
                  {MOODS[key].label} atmosphere
                </option>
              ))}
          </Select>
        </label>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete this book"
          className="rounded-full p-2 text-ink-faint hover:bg-white/8 hover:text-rose-deep"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </header>
  );
}

function SceneCard({
  scene,
  book,
  onOpen,
  onDragStart,
  onDropBefore,
}: {
  scene: StorySceneDto;
  book: StoryBookDto;
  onOpen: () => void;
  onDragStart: (event: DragEvent) => void;
  onDropBefore: (event: DragEvent) => void;
}) {
  const glow = scene.mood ? emotionMeta(scene.mood).ink : '#c4b5fd';
  const pov = book.characters.find((c) => c.id === scene.povId);
  const threads = book.links.filter(
    (l) => l.fromSceneId === scene.id || l.toSceneId === scene.id,
  ).length;
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropBefore}
      onClick={onOpen}
      className="group relative w-full cursor-grab overflow-hidden rounded-2xl border border-white/10 bg-abyss/88 p-4 text-left transition hover:-translate-y-0.5 hover:border-white/25 active:cursor-grabbing"
    >
      <span
        className="absolute inset-y-3 left-0 w-0.5 rounded-full"
        style={{ background: glow, boxShadow: `0 0 12px ${glow}` }}
        aria-hidden="true"
      />
      <p className="font-display font-semibold leading-snug">{scene.title}</p>
      <p className="mt-1 line-clamp-3 text-sm text-ink-soft">{scene.text}</p>
      <div className="mt-3 flex items-center gap-1.5">
        {pov && (
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.68rem] font-bold text-ink-soft">
            POV {pov.name}
          </span>
        )}
        <span className="flex -space-x-1.5">
          {scene.characterIds.slice(0, 4).map((cid) => {
            const person = book.characters.find((c) => c.id === cid);
            if (!person) return null;
            return (
              <span
                key={cid}
                title={person.name}
                className="flex size-5 items-center justify-center rounded-full text-[0.55rem] font-bold text-abyss ring-2 ring-abyss"
                style={{ background: tintFor(person.name) }}
              >
                {initials(person.name)}
              </span>
            );
          })}
        </span>
        {threads > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-magenta">
            <Link2 className="size-3" /> {threads}
          </span>
        )}
      </div>
    </button>
  );
}

function Board({
  book,
  actions,
  onEdit,
}: {
  book: StoryBookDto;
  actions: StoryActions;
  onEdit: (scene: StorySceneDto | null, chapterId: string | null) => void;
}) {
  const { play } = useSound();
  const [newChapter, setNewChapter] = useState('');
  const scenes = useMemo(() => new Map(book.scenes.map((s) => [s.id, s])), [book.scenes]);
  const columns = [
    {
      id: null as string | null,
      title: 'Floating',
      number: null as number | null,
      sceneIds: book.floating,
    },
    ...book.chapters,
  ];

  const move = (sceneId: string, toChapter: string | null, beforeId: string | null) => {
    const strip = (ids: string[]) => ids.filter((x) => x !== sceneId);
    const insert = (ids: string[]) => {
      const list = strip(ids);
      const at = beforeId ? list.indexOf(beforeId) : -1;
      if (at < 0) list.push(sceneId);
      else list.splice(at, 0, sceneId);
      return list;
    };
    play('pluck');
    void actions.reorder({
      floating: toChapter === null ? insert(book.floating) : strip(book.floating),
      chapters: book.chapters.map((c) => ({
        id: c.id,
        sceneIds: c.id === toChapter ? insert(c.sceneIds) : strip(c.sceneIds),
      })),
    });
  };

  const dragged = (event: DragEvent) => event.dataTransfer.getData('text/scene');

  return (
    <div className="mt-6 flex gap-4 overflow-x-auto pb-6">
      {columns.map((column) => (
        <section
          key={column.id ?? 'floating'}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = dragged(e);
            if (id) move(id, column.id, null);
          }}
          className={`flex w-72 shrink-0 flex-col gap-3 rounded-3xl p-3 ${column.id ? 'paper' : 'border-2 border-dashed border-white/15 bg-white/3'}`}
          aria-label={column.id ? `Chapter ${column.number}: ${column.title}` : 'Floating scenes'}
        >
          <ChapterHeader column={column} actions={actions} />
          {column.sceneIds.map((sid) => {
            const scene = scenes.get(sid);
            if (!scene) return null;
            return (
              <SceneCard
                key={sid}
                scene={scene}
                book={book}
                onOpen={() => onEdit(scene, column.id)}
                onDragStart={(e) => e.dataTransfer.setData('text/scene', sid)}
                onDropBefore={(e) => {
                  e.stopPropagation();
                  const id = dragged(e);
                  if (id && id !== sid) move(id, column.id, sid);
                }}
              />
            );
          })}
          <button
            type="button"
            onClick={() => onEdit(null, column.id)}
            className="rounded-2xl border border-dashed border-white/15 py-3 text-sm font-semibold text-ink-faint transition hover:border-white/30 hover:text-ink"
          >
            + Scene
          </button>
        </section>
      ))}
      <form
        className="flex w-64 shrink-0 flex-col gap-2 self-start rounded-3xl border border-dashed border-white/15 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!newChapter.trim()) return;
          void actions.addChapter(newChapter.trim());
          setNewChapter('');
        }}
      >
        <TextInput
          value={newChapter}
          onChange={(e) => setNewChapter(e.target.value)}
          placeholder="New chapter title"
          aria-label="New chapter title"
        />
        <Button type="submit" size="sm" variant="soft" disabled={!newChapter.trim()}>
          Add chapter
        </Button>
      </form>
    </div>
  );
}

function ChapterHeader({
  column,
  actions,
}: {
  column: { id: string | null; title: string; number: number | null; sceneIds: string[] };
  actions: StoryActions;
}) {
  const [title, setTitle] = useState(column.title);
  if (!column.id) {
    return (
      <div className="px-1">
        <p className="font-display font-semibold">Floating</p>
        <p className="text-xs text-ink-faint">Scenes without a place yet. Drag them anywhere.</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
        {column.number}
      </span>
      <input
        aria-label="Chapter title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() =>
          title.trim() &&
          title !== column.title &&
          void actions.renameChapter(column.id!, title.trim())
        }
        className="min-w-0 flex-1 bg-transparent font-display font-semibold outline-none"
      />
      <button
        type="button"
        aria-label="Delete chapter (its scenes start floating)"
        title="Delete chapter (its scenes start floating)"
        onClick={() => void actions.deleteChapter(column.id!)}
        className="rounded-full p-1 text-ink-faint hover:text-rose-deep"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function Cast({ book, actions }: { book: StoryBookDto; actions: StoryActions }) {
  const [draft, setDraft] = useState({ name: '', role: '', notes: '' });
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {book.characters.map((c) => (
        <CharacterCard key={c.id} character={c} actions={actions} />
      ))}
      <form
        className="paper flex flex-col gap-2 rounded-3xl p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.name.trim()) return;
          void actions.addCharacter({
            name: draft.name.trim(),
            role: draft.role.trim() || null,
            notes: draft.notes.trim() || null,
          });
          setDraft({ name: '', role: '', notes: '' });
        }}
      >
        <p className="font-display font-semibold">Add someone</p>
        <TextInput
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Name"
          aria-label="Name"
        />
        <TextInput
          value={draft.role}
          onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          placeholder="Role: protagonist, rival…"
          aria-label="Role"
        />
        <TextArea
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="Notes"
          aria-label="Notes"
        />
        <Button type="submit" size="sm" disabled={!draft.name.trim()} className="self-start">
          Add to cast
        </Button>
      </form>
    </div>
  );
}

function CharacterCard({
  character,
  actions,
}: {
  character: StoryBookDto['characters'][number];
  actions: StoryActions;
}) {
  const [role, setRole] = useState(character.role ?? '');
  const [notes, setNotes] = useState(character.notes ?? '');
  const tint = tintFor(character.name);
  return (
    <div className="paper group relative rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex size-11 items-center justify-center rounded-full font-display font-semibold text-abyss"
          style={{ background: tint, boxShadow: `0 0 20px -4px ${tint}` }}
        >
          {initials(character.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold">{character.name}</p>
          <p className="text-xs text-ink-faint">
            in {character.sceneCount} {character.sceneCount === 1 ? 'scene' : 'scenes'}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Remove ${character.name}`}
          onClick={() =>
            window.confirm(`Remove ${character.name} from the cast?`) &&
            void actions.deleteCharacter(character.id)
          }
          className="rounded-full p-1.5 text-ink-faint opacity-0 transition hover:text-rose-deep group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <TextInput
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onBlur={() =>
          role !== (character.role ?? '') &&
          void actions.updateCharacter(character.id, { role: role.trim() || null })
        }
        placeholder="Role"
        aria-label={`${character.name}'s role`}
        className="mt-3 h-9 py-1 text-sm"
      />
      <TextArea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() =>
          notes !== (character.notes ?? '') &&
          void actions.updateCharacter(character.id, { notes: notes.trim() || null })
        }
        placeholder="What drives them, what they hide…"
        aria-label={`Notes on ${character.name}`}
        className="mt-2 text-sm"
      />
    </div>
  );
}

function Threads({ book, actions }: { book: StoryBookDto; actions: StoryActions }) {
  const { data: types = [] } = useStoryLinkTypes();
  const [draft, setDraft] = useState({
    fromSceneId: '',
    toSceneId: '',
    type: 'foreshadowing',
    note: '',
  });
  const title = (id: string) => book.scenes.find((s) => s.id === id)?.title ?? 'a scene';
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
      <ul className="flex flex-col gap-3">
        {book.links.map((link) => (
          <li
            key={link.id}
            className="paper group flex flex-wrap items-center gap-3 rounded-2xl p-4"
          >
            <span className="rounded-full bg-magenta/15 px-2.5 py-0.5 text-xs font-bold text-magenta">
              {link.label}
            </span>
            <span className="font-semibold">{title(link.fromSceneId)}</span>
            <span className="text-ink-faint" aria-hidden="true">
              →
            </span>
            <span className="font-semibold">{title(link.toSceneId)}</span>
            {link.note && <span className="basis-full text-sm text-ink-soft">{link.note}</span>}
            <button
              type="button"
              aria-label="Remove this thread"
              onClick={() => void actions.deleteLink(link.id)}
              className="ml-auto rounded-full p-1.5 text-ink-faint opacity-0 transition hover:text-rose-deep group-hover:opacity-100 focus-visible:opacity-100"
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
        {!book.links.length && (
          <li className="paper rounded-2xl p-6 text-center text-ink-soft">
            No threads yet. When a new scene echoes an earlier one, I'll point it out.
          </li>
        )}
      </ul>
      <form
        className="paper flex flex-col gap-3 self-start rounded-3xl p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.fromSceneId || !draft.toSceneId || draft.fromSceneId === draft.toSceneId)
            return;
          void actions.addLink({ ...draft, note: draft.note.trim() || null });
          setDraft({ ...draft, toSceneId: '', note: '' });
        }}
      >
        <p className="font-display font-semibold">Tie two scenes together</p>
        <Select
          value={draft.fromSceneId}
          onChange={(e) => setDraft({ ...draft, fromSceneId: e.target.value })}
          aria-label="From scene"
        >
          <option value="">From…</option>
          {book.scenes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </Select>
        <Select
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          aria-label="Kind of thread"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id} title={t.hint}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select
          value={draft.toSceneId}
          onChange={(e) => setDraft({ ...draft, toSceneId: e.target.value })}
          aria-label="To scene"
        >
          <option value="">To…</option>
          {book.scenes
            .filter((s) => s.id !== draft.fromSceneId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
        </Select>
        <TextInput
          value={draft.note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          placeholder="Why (optional)"
          aria-label="Why"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!draft.fromSceneId || !draft.toSceneId}
          className="self-start"
        >
          Add thread
        </Button>
      </form>
    </div>
  );
}

function World({ book, actions }: { book: StoryBookDto; actions: StoryActions }) {
  const [title, setTitle] = useState('');
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {book.notes.map((note) => (
        <NoteCard key={note.id} note={note} actions={actions} />
      ))}
      <form
        className="paper flex flex-col gap-2 self-start rounded-3xl p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          void actions.addNote({ title: title.trim(), body: '' });
          setTitle('');
        }}
      >
        <p className="font-display font-semibold">A place, a rule, a history</p>
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="The harbor town, how magic works…"
          aria-label="Note title"
        />
        <Button
          type="submit"
          size="sm"
          variant="soft"
          disabled={!title.trim()}
          className="self-start"
        >
          Add note
        </Button>
      </form>
    </div>
  );
}

function NoteCard({
  note,
  actions,
}: {
  note: StoryBookDto['notes'][number];
  actions: StoryActions;
}) {
  const [body, setBody] = useState(note.body);
  return (
    <div className="sticky-note group relative rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <p className="flex-1 font-display text-lg font-semibold">{note.title}</p>
        <button
          type="button"
          aria-label={`Delete ${note.title}`}
          onClick={() =>
            window.confirm(`Delete the note “${note.title}”?`) && void actions.deleteNote(note.id)
          }
          className="rounded-full p-1.5 text-ink-faint opacity-0 transition hover:text-rose-deep group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <TextArea
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => body !== note.body && void actions.updateNote(note.id, { body })}
        placeholder="Write it down so the story stays consistent."
        aria-label={`${note.title} notes`}
        className="mt-2 bg-transparent text-sm"
      />
    </div>
  );
}

function Reader({ book }: { book: StoryBookDto }) {
  const [reading, setReading] = useState<string | null>(null);
  const scenes = new Map(book.scenes.map((s) => [s.id, s]));
  const parts = [
    ...book.chapters.map((c) => ({
      key: c.id,
      heading: `${c.number}. ${c.title}`,
      ids: c.sceneIds,
    })),
    ...(book.floating.length
      ? [{ key: 'floating', heading: 'Not placed yet', ids: book.floating }]
      : []),
  ].filter((p) => p.ids.length);

  if (!parts.length) {
    return (
      <p className="paper mt-6 rounded-3xl p-10 text-center text-ink-soft">
        Write a scene and it shows up here, in reading order.
      </p>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      {parts.map((part) => {
        const text = part.ids.map((id) => scenes.get(id)?.text ?? '').join('\n\n');
        return (
          <motion.section
            key={part.key}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="paper mb-8 rounded-[2rem] px-6 py-10 sm:px-12"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-3xl font-semibold">{part.heading}</h2>
              {narrationSupported() && (
                <Button
                  size="sm"
                  variant={reading === part.key ? 'primary' : 'ghost'}
                  icon={
                    reading === part.key ? (
                      <Square className="size-4" />
                    ) : (
                      <Ear className="size-4" />
                    )
                  }
                  onClick={() => {
                    if (reading === part.key) {
                      stopSpeaking();
                      setReading(null);
                      return;
                    }
                    setReading(part.key);
                    speak(text, { title: part.heading, onEnd: () => setReading(null) });
                  }}
                >
                  {reading === part.key ? 'Stop' : 'Read aloud'}
                </Button>
              )}
            </div>
            {part.ids.map((id, i) => {
              const scene = scenes.get(id);
              if (!scene) return null;
              return (
                <article key={id} className="mt-8">
                  <h3 className="eyebrow">{scene.title}</h3>
                  <div
                    className={`mt-3 space-y-4 font-display text-[1.15rem] leading-[1.85] ${i === 0 ? 'drop-cap' : ''}`}
                  >
                    {scene.text.split(/\n{2,}/).map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                  </div>
                  {i < part.ids.length - 1 && (
                    <p className="mt-8 text-center text-ink-faint" aria-hidden="true">
                      ⁂
                    </p>
                  )}
                </article>
              );
            })}
          </motion.section>
        );
      })}
    </div>
  );
}
