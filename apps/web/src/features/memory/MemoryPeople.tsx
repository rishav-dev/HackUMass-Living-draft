import { Link } from 'react-router';
import type { MemoryDetailDto, Role } from '@living-draft/contracts';
import { useCharacters } from '../../api/hooks';
import { Portrait } from '../../components/memory/bits';

const GROUPS: Array<{ role: Role; label: string; hint: string }> = [
  { role: 'central', label: 'At the centre', hint: 'drove what happened' },
  { role: 'supporting', label: 'Part of it', hint: 'took part' },
  { role: 'mentioned', label: 'Mentioned', hint: 'in the background' },
];

export function MemoryPeople({ memory }: { memory: MemoryDetailDto }) {
  const { data: characters } = useCharacters();
  if (!memory.people.length) return null;
  return (
    <section aria-labelledby="people-in-it" className="paper rounded-3xl p-5">
      <h2 id="people-in-it" className="eyebrow">
        who&apos;s in it
      </h2>
      <div className="mt-3 flex flex-col gap-4">
        {GROUPS.map((group) => {
          const people = memory.people.filter((p) => p.role === group.role);
          if (!people.length) return null;
          return (
            <div key={group.role}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                {group.label} <span className="font-normal normal-case">· {group.hint}</span>
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {people.map((person) => {
                  const character = characters?.find((c) => c.id === person.characterId);
                  return (
                    <li key={person.characterId}>
                      <Link
                        to={`/people/${person.characterId}`}
                        viewTransition
                        className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition hover:bg-ink/5"
                      >
                        <Portrait name={person.name} size={30} />
                        <span className="min-w-0">
                          <span className="block font-semibold">{person.name}</span>
                          {character?.relationship && (
                            <span className="block text-xs text-ink-soft">
                              {character.relationship}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
