import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Check, Merge, Plus } from 'lucide-react';
import type { CharacterDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useCharacters, useInvalidateArchive } from '../../api/hooks';
import { Portrait } from '../../components/memory/bits';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Select, TextInput } from '../../components/ui/controls';
import { EmptyState, ErrorState, PaperLoading } from '../../components/ui/states';
import { useToast } from '../../components/ui/Toast';
import { hashNumber } from '../../lib/meta';
import { useScene, useSound } from '../../lib/sound/SoundProvider';

export default function CharactersPage() {
  const { data, isLoading, error, refetch } = useCharacters();
  const [creating, setCreating] = useState(false);
  const [merging, setMerging] = useState<CharacterDto | null>(null);
  const invalidate = useInvalidateArchive();
  const { play } = useSound();
  useScene('path');

  if (isLoading) return <PaperLoading label="Finding everyone…" />;
  if (error || !data) return <ErrorState error={error} retry={() => void refetch()} />;

  const fresh = data.filter((c) => c.provisional);
  const known = data.filter((c) => !c.provisional);

  const confirm = async (id: string) => {
    await api.patch(`/characters/${id}`, { provisional: false });
    play('chime');
    invalidate();
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">the people in your story</p>
          <h1 className="text-4xl font-semibold sm:text-5xl">People</h1>
          <p className="mt-2 max-w-xl text-ink-soft">
            Everyone who shows up across your memories, and how much of each story is theirs.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<Plus className="size-4" />}
          onClick={() => setCreating(true)}
        >
          Add someone
        </Button>
      </div>

      {fresh.length > 0 && (
        <section
          className="mt-10 rounded-[2rem] border-2 border-dashed border-ink/15 p-5 sm:p-6"
          aria-labelledby="fresh"
        >
          <h2 id="fresh" className="text-xl font-semibold">
            New faces to check
          </h2>
          <p className="text-sm text-ink-soft">
            I picked these up from what you said. Confirm them, merge them into someone you already
            have, or rename them.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fresh.map((c) => (
              <li key={c.id} className="paper flex items-center gap-3 rounded-2xl p-3">
                <Portrait name={c.name} size={44} />
                <Link to={`/people/${c.id}`} viewTransition className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="text-xs text-ink-soft">
                    {c.memoryCount} {c.memoryCount === 1 ? 'memory' : 'memories'}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void confirm(c.id)}
                  aria-label={`Confirm ${c.name}`}
                  className="rounded-full p-2 text-sage-deep hover:bg-sage/30"
                >
                  <Check className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMerging(c)}
                  aria-label={`Merge ${c.name} into someone else`}
                  className="rounded-full p-2 text-ink-soft hover:bg-ink/6"
                >
                  <Merge className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {known.length === 0 && fresh.length === 0 ? (
        <EmptyState title="Nobody here yet">
          When you mention someone in a memory, they'll appear here, linked to every page they're
          on.
        </EmptyState>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {known.map((c, i) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <PersonCard person={c} onMerge={() => setMerging(c)} />
            </motion.li>
          ))}
        </ul>
      )}

      {creating && <CreatePersonDialog onClose={() => setCreating(false)} />}
      {merging && <MergeDialog source={merging} people={data} onClose={() => setMerging(null)} />}
    </div>
  );
}

function PersonCard({ person, onMerge }: { person: CharacterDto; onMerge: () => void }) {
  const total = person.memoryCount || 1;
  const tilt = (hashNumber(person.id) - 0.5) * 3;
  return (
    <div
      className="paper group relative rounded-[1.75rem] p-5 transition hover:-translate-y-1 hover:shadow-lift"
      style={{ rotate: `${tilt}deg` }}
    >
      <Link to={`/people/${person.id}`} viewTransition className="flex items-center gap-4">
        <Portrait name={person.name} size={72} photoUrl={person.photo?.url} />
        <span className="min-w-0">
          <span
            className="block truncate font-display text-2xl font-semibold"
            style={{ viewTransitionName: `person-${person.id}` }}
          >
            {person.name}
          </span>
          <span className="block text-sm text-ink-soft">
            {person.relationship && person.relationship.toLowerCase() !== person.name.toLowerCase()
              ? person.relationship
              : 'In your story'}
            {person.firstAge !== null ? ` · since age ${person.firstAge}` : ''}
          </span>
        </span>
      </Link>
      <div className="mt-5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-linen" aria-hidden="true">
          <span
            className="bg-gold"
            style={{ width: `${(person.roleCounts.central / total) * 100}%` }}
          />
          <span
            className="bg-sage"
            style={{ width: `${(person.roleCounts.supporting / total) * 100}%` }}
          />
          <span
            className="bg-ink/15"
            style={{ width: `${(person.roleCounts.mentioned / total) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-semibold text-ink-soft">
          {person.memoryCount} {person.memoryCount === 1 ? 'memory' : 'memories'} · central in{' '}
          {person.roleCounts.central}, part of {person.roleCounts.supporting}, mentioned in{' '}
          {person.roleCounts.mentioned}
        </p>
      </div>
      {person.aliases.length > 0 && (
        <p className="mt-2 truncate text-xs text-ink-faint">
          Also called {person.aliases.join(', ')}
        </p>
      )}
      <button
        type="button"
        onClick={onMerge}
        className="absolute right-3 top-3 rounded-full p-2 text-ink-faint opacity-0 transition hover:bg-ink/6 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Merge ${person.name} with someone`}
      >
        <Merge className="size-4" />
      </button>
    </div>
  );
}

function CreatePersonDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const invalidate = useInvalidateArchive();
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add someone"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              await api.post('/characters', {
                name: name.trim(),
                relationship: relationship.trim() || null,
                aliases: [],
              });
              invalidate();
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="person-name">
          <TextInput
            id="person-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Who are they to you? (optional)" htmlFor="person-rel">
          <TextInput
            id="person-rel"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Grandmother, best friend, coach…"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function MergeDialog({
  source,
  people,
  onClose,
}: {
  source: CharacterDto;
  people: CharacterDto[];
  onClose: () => void;
}) {
  const [target, setTarget] = useState('');
  const invalidate = useInvalidateArchive();
  const toast = useToast();
  const options = people.filter((p) => p.id !== source.id);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Merge ${source.name} into someone else?`}
      description={`Every mention of “${source.name}” will point to the person you pick, and “${source.name}” becomes one of their names. Only merge if they're really the same person.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button
            disabled={!target}
            onClick={async () => {
              await api.post('/characters/merge', { sourceId: source.id, targetId: target });
              invalidate();
              toast('Merged.');
              onClose();
            }}
          >
            Merge
          </Button>
        </>
      }
    >
      <Select aria-label="Merge into" value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Choose who they are…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.relationship ? ` (${p.relationship})` : ''}
          </option>
        ))}
      </Select>
    </Dialog>
  );
}
