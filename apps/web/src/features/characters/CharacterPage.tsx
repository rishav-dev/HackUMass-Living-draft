import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, Clapperboard, Plus, Scissors, Sparkles, X } from 'lucide-react';
import type { CharacterDetailDto, Role } from '@living-draft/contracts';
import { api, uploadMedia } from '../../api/client';
import { useCharacter, useInvalidateArchive } from '../../api/hooks';
import { CertaintyMark, EmotionRow, Portrait, RoleBadge } from '../../components/memory/bits';
import { CompareTray, SelectToCompare } from '../../components/memory/CompareSelection';
import { useCompareSelection } from '../../components/memory/useCompareSelection';
import { RecapPanel } from '../../components/memory/RecapPanel';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Segmented, TextArea, TextInput } from '../../components/ui/controls';
import { ErrorState, PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { connectionMeta, tintFor } from '../../lib/meta';
import { useScene, useSound } from '../../lib/sound/SoundProvider';
import { openPlayback } from '../playback/playbackStore';
import { PersonLinks } from './PersonLinks';

export default function CharacterPage() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useCharacter(id);
  if (isLoading) return <PaperLoading label="Looking them up…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;
  return <CharacterView person={data} />;
}

function CharacterView({ person }: { person: CharacterDetailDto }) {
  const [role, setRole] = useState<'all' | Role>('all');
  const [alias, setAlias] = useState('');
  const [editing, setEditing] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const invalidate = useInvalidateArchive();
  const navigate = useNavigate();
  const { play } = useSound();
  useScene('path');

  const memories = person.memories.filter((m) => role === 'all' || m.role === role);
  const selection = useCompareSelection();
  const ask = (question: string) =>
    void navigate(`/ask?q=${encodeURIComponent(question)}&person=${person.id}`, {
      viewTransition: true,
    });

  const addAlias = async () => {
    if (!alias.trim()) return;
    await api.post(`/characters/${person.id}/aliases`, { alias: alias.trim() });
    setAlias('');
    play('tap');
    invalidate();
  };

  return (
    <div className="relative">
      <div
        className="absolute inset-x-0 top-0 h-80 opacity-60"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, ${tintFor(person.name)} 0%, transparent 65%)`,
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-8 sm:px-8">
        <Link
          to="/people"
          viewTransition
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" /> People
        </Link>

        <header className="mt-8 flex flex-wrap items-center gap-6">
          <PortraitPicker person={person} onChange={invalidate} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              {person.relationship &&
              person.relationship.toLowerCase() !== person.name.toLowerCase()
                ? person.relationship.toLowerCase()
                : 'in your story'}
            </p>
            <h1
              className="text-5xl font-semibold"
              style={{ viewTransitionName: `person-${person.id}` }}
            >
              {person.name}
            </h1>
            <p className="mt-1 text-ink-soft">
              {person.memoryCount} {person.memoryCount === 1 ? 'memory' : 'memories'}
              {person.firstAge !== null
                ? `, from age ${person.firstAge}${person.lastAge !== person.firstAge ? ` to ${person.lastAge}` : ''}`
                : ''}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {person.aliases.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-xs font-bold shadow-sm"
                >
                  “{a}”
                  <button
                    type="button"
                    aria-label={`Remove the name ${a}`}
                    onClick={async () => {
                      await api.delete(`/characters/${person.id}/aliases/${encodeURIComponent(a)}`);
                      invalidate();
                    }}
                    className="rounded-full text-ink-faint hover:text-ink"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addAlias();
                }}
                className="inline-flex items-center"
              >
                <TextInput
                  aria-label="Add another name for them"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Another name…"
                  className="h-8 w-36 rounded-full px-3 py-0 text-xs"
                />
                <button
                  type="submit"
                  aria-label="Add name"
                  className="ml-1 rounded-full p-1.5 text-ink-soft hover:bg-ink/6"
                >
                  <Plus className="size-4" />
                </button>
              </form>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<Clapperboard className="size-4" />}
              onClick={() => openPlayback({ characterId: person.id })}
              disabled={!person.memoryCount}
              sound="whoosh"
            >
              Step back in
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </header>

        {person.notes && <p className="mt-6 max-w-2xl eyebrow">{person.notes}</p>}

        <section className="paper mt-10 rounded-[2rem] p-6" aria-labelledby="journey">
          <h2 id="journey" className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5 text-gold-deep" /> Character journey
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Answers come only from what you've recorded, and describe how you remember {person.name}
            , not who they are.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              `How has my relationship with ${person.name} changed over time?`,
              `How has my perception of ${person.name} changed?`,
              `In which situations did ${person.name} play an important role?`,
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="rounded-full bg-cream px-4 py-2 text-left text-sm font-semibold transition hover:bg-linen"
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Through the years</h2>
          <div className="flex items-center gap-2">
            <Segmented
              size="sm"
              label="Role"
              value={role}
              onChange={setRole}
              options={[
                { value: 'all', label: 'All' },
                { value: 'central', label: 'Central' },
                { value: 'supporting', label: 'Supporting' },
                { value: 'mentioned', label: 'Mentioned' },
              ]}
            />
            {memories.length > 1 && <SelectToCompare selection={selection} />}
            {person.memories.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Scissors className="size-4" />}
                onClick={() => setSplitting(true)}
              >
                Split
              </Button>
            )}
          </div>
        </div>

        {memories.length > 0 && (
          <RecapPanel
            className="mt-5"
            label={
              role === 'all'
                ? `Your memories with ${person.name}`
                : role === 'mentioned'
                  ? `Memories that mention ${person.name}`
                  : `Memories where ${person.name} was ${role}`
            }
            memoryIds={memories.map((m) => m.id)}
            quietCount={memories.filter((m) => m.sensitive).length}
            focusPeople={[person.name, ...person.aliases]}
          />
        )}
        <CompareTray selection={selection} />
        <ol className="relative mt-6 flex flex-col gap-5 before:absolute before:bottom-0 before:left-[3.4rem] before:top-0 before:w-0.5 before:bg-white/10">
          {memories.map((m, i) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative grid grid-cols-[4.5rem_1fr] items-start gap-4"
            >
              <span className="mt-4 text-right font-display text-xl font-semibold text-ink-soft">
                {m.temporal.ageMin ?? '?'}
              </span>
              <Link
                to={`/memories/${m.id}`}
                viewTransition
                aria-pressed={selection.active ? selection.ids.includes(m.id) : undefined}
                onClick={(event) => {
                  if (!selection.active) return;
                  event.preventDefault();
                  selection.toggle(m.id);
                }}
                className={`paper rounded-3xl p-5 transition hover:-translate-y-0.5 hover:shadow-lift ${selection.ids.includes(m.id) ? 'ring-2 ring-magenta' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <RoleBadge role={m.role} />
                  <CertaintyMark temporal={m.temporal} compact />
                </div>
                <h3 className="mt-2 font-display text-xl font-semibold">{m.title}</h3>
                {m.evidence && <p className="mt-1 text-sm italic text-ink-soft">“{m.evidence}”</p>}
                <div className="mt-3">
                  <EmotionRow emotions={m.emotions.filter((e) => e.phase === 'then')} size="sm" />
                </div>
              </Link>
            </motion.li>
          ))}
          {!memories.length && <li className="pl-24 text-ink-soft">No memories with that role.</li>}
        </ol>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <PersonLinks person={person} />
          {person.related.length > 0 && (
            <section className="paper rounded-3xl p-5" aria-labelledby="related">
              <h2 id="related" className="mb-3 text-lg font-semibold">
                Often with
              </h2>
              <ul className="flex flex-col gap-2">
                {person.related.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/people/${r.id}`}
                      viewTransition
                      className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-white/5"
                    >
                      <Portrait name={r.name} size={32} />
                      <span className="font-semibold">{r.name}</span>
                      <span className="ml-auto text-xs text-ink-soft">
                        {r.shared} shared {r.shared === 1 ? 'memory' : 'memories'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {person.connections.length > 0 && (
            <section className="paper rounded-3xl p-5" aria-labelledby="person-threads">
              <h2 id="person-threads" className="mb-3 text-lg font-semibold">
                Threads through {person.name}
              </h2>
              <ul className="flex flex-col gap-3 text-sm">
                {person.connections.map((c) => (
                  <li
                    key={c.id}
                    className="border-l-4 pl-3"
                    style={{ borderColor: connectionMeta(c.type).color }}
                  >
                    <span className="font-bold">{c.label}</span>: {c.explanation}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      {editing && <EditPersonDialog person={person} onClose={() => setEditing(false)} />}
      {splitting && <SplitDialog person={person} onClose={() => setSplitting(false)} />}
    </div>
  );
}

function EditPersonDialog({
  person,
  onClose,
}: {
  person: CharacterDetailDto;
  onClose: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [relationship, setRelationship] = useState(person.relationship ?? '');
  const [notes, setNotes] = useState(person.notes ?? '');
  const invalidate = useInvalidateArchive();
  return (
    <Dialog
      open
      onClose={onClose}
      title={`About ${person.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              await api.patch(`/characters/${person.id}`, {
                name: name.trim(),
                relationship: relationship.trim() || null,
                notes: notes.trim() || null,
                provisional: false,
              });
              invalidate();
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Name</span>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Who they are to you</span>
          <TextInput
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">Private notes</span>
          <TextArea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Only you see this."
          />
        </label>
      </div>
    </Dialog>
  );
}

function SplitDialog({ person, onClose }: { person: CharacterDetailDto; onClose: () => void }) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [name, setName] = useState('');
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Some of these aren't ${person.name}?`}
      description={`“My teacher” at 8 and “my teacher” at 15 are usually two people. Pick the memories that belong to someone else.`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!chosen.length || !name.trim()}
            onClick={async () => {
              const mentionIds = person.memories
                .filter((m) => chosen.includes(m.id))
                .flatMap((m) => m.mentionIds);
              await api.post(`/characters/${person.id}/split`, { mentionIds, name: name.trim() });
              invalidate();
              toast(
                `Moved ${chosen.length} ${chosen.length === 1 ? 'memory' : 'memories'} to ${name.trim()}`,
              );
              onClose();
            }}
          >
            Split them off
          </Button>
        </>
      }
    >
      <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {person.memories.map((m) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 hover:bg-ink/4">
              <input
                type="checkbox"
                className="size-4"
                checked={chosen.includes(m.id)}
                onChange={() =>
                  setChosen((l) => (l.includes(m.id) ? l.filter((x) => x !== m.id) : [...l, m.id]))
                }
              />
              <span className="font-semibold">{m.title}</span>
              <span className="text-sm text-ink-soft">{m.temporal.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-bold">Who is it really?</span>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ms. Patel, my piano teacher…"
        />
      </label>
    </Dialog>
  );
}

function PortraitPicker({
  person,
  onChange,
}: {
  person: CharacterDetailDto;
  onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const media = await uploadMedia(file, { name: file.name, kind: 'photo' });
      await api.patch(`/characters/${person.id}`, { photoId: media.id });
      onChange();
      toast(`New photo for ${person.name}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group relative">
      <Portrait name={person.name} size={112} photoUrl={person.photo?.url} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={
          person.photo ? `Change ${person.name}'s photo` : `Add a photo of ${person.name}`
        }
        className="absolute inset-0 flex items-center justify-center rounded-full bg-abyss/60 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Camera className="size-6 text-snow" />
      </button>
      {person.photo && (
        <button
          type="button"
          onClick={async () => {
            await api.patch(`/characters/${person.id}`, { photoId: null });
            onChange();
          }}
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-abyss/80 px-2 py-0.5 text-[0.65rem] font-semibold text-ink-soft opacity-0 transition hover:text-snow group-hover:opacity-100"
        >
          Remove photo
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
