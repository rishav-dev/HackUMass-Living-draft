import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, X } from 'lucide-react';
import type { CharacterDetailDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { useCharacters, useInvalidateArchive } from '../../api/hooks';
import { Portrait } from '../../components/memory/bits';
import { Select, TextInput } from '../../components/ui/controls';
import { useSound } from '../../lib/sound/SoundProvider';

const LABELS = [
  'parent',
  'sibling',
  'partner',
  'child',
  'grandparent',
  'cousin',
  'best friend',
  'friend',
  'teacher',
  'coworker',
  'neighbor',
];

export function PersonLinks({ person }: { person: CharacterDetailDto }) {
  const { data: people = [] } = useCharacters();
  const invalidate = useInvalidateArchive();
  const { play } = useSound();
  const [otherId, setOtherId] = useState('');
  const [label, setLabel] = useState('');
  const others = people.filter((p) => p.id !== person.id);

  const add = async () => {
    if (!otherId || !label.trim()) return;
    await api.post(`/characters/${person.id}/links`, { otherId, label: label.trim() });
    play('pluck');
    setOtherId('');
    setLabel('');
    invalidate();
  };

  const remove = async (linkId: string) => {
    await api.delete(`/characters/${person.id}/links/${linkId}`);
    invalidate();
  };

  return (
    <section className="paper rounded-3xl p-5" aria-labelledby="person-links">
      <h2 id="person-links" className="text-lg font-semibold">
        People in {person.name}'s life
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        How they're connected, in your words. These also show as threads between people on the map.
      </p>
      {person.links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {person.links.map((link) => (
            <li
              key={link.id}
              className="group flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-white/5"
            >
              <Link
                to={`/people/${link.characterId}`}
                viewTransition
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Portrait name={link.name} size={30} />
                <span className="truncate font-semibold">{link.name}</span>
                <span className="rounded-full bg-lavender/20 px-2 py-0.5 text-xs font-semibold text-lavender-deep">
                  {link.label}
                </span>
              </Link>
              <button
                type="button"
                aria-label={`Remove the link to ${link.name}`}
                onClick={() => void remove(link.id)}
                className="rounded-full p-1.5 text-ink-faint opacity-0 transition hover:text-rose-deep group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Select
            aria-label="Who"
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
            className="h-9 w-40 py-1 text-sm"
          >
            <option value="">Someone…</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <span className="text-sm text-ink-soft">is their</span>
          <TextInput
            aria-label="How they're related"
            list="person-link-labels"
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 60))}
            placeholder="sister, best friend…"
            className="h-9 w-40 py-1 text-sm"
          />
          <datalist id="person-link-labels">
            {LABELS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={!otherId || !label.trim()}
            aria-label="Add this link"
            className="rounded-full bg-white/8 p-2 text-ink-soft transition hover:bg-white/15 hover:text-snow disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </form>
      )}
    </section>
  );
}
