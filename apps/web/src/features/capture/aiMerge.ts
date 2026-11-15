import type { AiNotesDto, CharacterDto } from '@living-draft/contracts';
import type { PersonRow } from './ReviewMemory';

const NARRATOR = /^(me|i|myself|narrator|the narrator|self|my|mine)$/i;
const GENERIC = /^(he|she|they|him|her|someone|somebody|a friend|my|his|her|their)$/i;

const lower = (value: string) => value.toLowerCase().trim();
const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function mergeAiPeople(
  rows: PersonRow[],
  notes: AiNotesDto,
  characters: CharacterDto[],
): PersonRow[] {
  const used = new Set<string>();
  const labels = notes.people.flatMap((p) => [p.name, p.describedAs, p.mentionedAs].map(lower));
  const result: PersonRow[] = notes.people.map((person, i) => {
    const said = [person.mentionedAs, person.name, person.describedAs].filter(Boolean).map(lower);
    const row = rows.find(
      (r) =>
        !used.has(r.key) &&
        r.surfaces.some((surface) =>
          said.some((s) => s && (s.includes(lower(surface)) || lower(surface).includes(s))),
        ),
    );
    if (row) used.add(row.key);
    const owner = person.relationTo.trim();
    const aboutSomeoneElse = owner && !NARRATOR.test(owner) && labels.includes(lower(owner));
    const relationship = person.relationship.trim()
      ? aboutSomeoneElse
        ? `${owner}'s ${person.relationship.trim()}`
        : person.relationship.trim()
      : null;
    const proper =
      person.name.trim() && !GENERIC.test(person.name.trim()) ? person.name.trim() : '';
    const name = capital(
      proper || person.describedAs.trim() || person.mentionedAs.trim() || 'Someone',
    );
    const known = characters.find((c) =>
      [c.name, ...c.aliases].some((alias) =>
        [proper, person.mentionedAs, aboutSomeoneElse ? '' : person.relationship]
          .filter(Boolean)
          .some((candidate) => lower(alias) === lower(candidate).replace(/^my /, '')),
      ),
    );
    return {
      key: row?.key ?? `ai-${i}`,
      include: true,
      characterId: row?.characterId ?? known?.id ?? null,
      name,
      role: person.role,
      surfaces: row?.surfaces ?? [person.mentionedAs.trim() || name],
      relationship: relationship ? relationship.slice(0, 60) : (row?.relationship ?? null),
      evidence: person.why,
      reason: row?.reason ?? null,
    };
  });
  for (const row of rows) if (!used.has(row.key)) result.push({ ...row, include: false });
  return result;
}

interface FeelingRow {
  tag: string;
  phase: 'then' | 'now';
  include: boolean;
  quote: string;
  basis: 'stated' | 'described';
  source: 'suggested';
}

export function mergeAiFeelings(list: FeelingRow[], notes: AiNotesDto): FeelingRow[] {
  const found: FeelingRow[] = notes.feelings.map((f) => ({
    tag: f.feeling,
    phase: f.when === 'looking back' ? 'now' : 'then',
    include: true,
    quote: f.because,
    basis: 'described',
    source: 'suggested',
  }));
  const keys = new Set(found.map((f) => `${f.tag}-${f.phase}`));
  return [
    ...found,
    ...list.filter((e) => !keys.has(`${e.tag}-${e.phase}`)).map((e) => ({ ...e, include: false })),
  ];
}
