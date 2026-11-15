import type { MemoryDoc } from '@living-draft/engine';

const pairKey = (ids: string[]) => [...ids].sort().join('|');
import { all } from '../../db/database';
import { Archive } from '../archive/snapshot';
import { createConnection } from '../connections/connection.service';
import { retrieve } from './retrieve';
import { ai, type JsonSchema } from './runner';
import { plain } from './prose';

const TYPES = [
  'breaking_pattern',
  'repeating_pattern',
  'full_circle',
  'relationship_change',
  'personal_growth',
  'turning_point',
  'wish_fulfilled',
  'role_reversal',
  'returning_to_place',
  'recurring_fear',
  'cause_consequence',
  'question_answer',
  'echo',
] as const;

const SYSTEM = `You decide whether two memories from one person's life are meaningfully connected, and if so how. Be strict: most pairs of memories are not connected in a way worth pointing out.

A real connection is about what happened, what they did, what they believed, or how a relationship went. Examples:
- breaking_pattern: in the earlier memory they did one thing (held back, gave in, avoided), and in the later one, in a similar situation, they did something different.
- repeating_pattern: a similar situation and a similar response, more than once.
- full_circle: they come back to something from the earlier memory, or end up on the other side of it.
- relationship_change: how they stand with the same person is clearly different.
- personal_growth, turning_point, wish_fulfilled, role_reversal, returning_to_place, recurring_fear, cause_consequence, question_answer, echo: use only when the stories plainly support it.

Sharing a feeling word, a season, or a generic topic is NOT a connection by itself.
If they are connected, quote a short exact phrase (copied word for word) from each memory that shows it, and explain in one or two plain sentences, speaking to them as "you".`;

const schema: JsonSchema = {
  type: 'object',
  properties: {
    connected: { type: 'boolean' },
    type: { enum: [...TYPES] },
    explanation: { type: 'string' },
    earlierQuote: { type: 'string' },
    laterQuote: { type: 'string' },
  },
};

function locate(text: string, quote: string): { quote: string; start: number; end: number } | null {
  const clean = quote.trim().replace(/^["'“”]+|["'“”.]+$/g, '');
  if (clean.length < 8) return null;
  const at = text.toLowerCase().indexOf(clean.toLowerCase());
  if (at >= 0)
    return { quote: text.slice(at, at + clean.length), start: at, end: at + clean.length };
  const head = clean.split(/\s+/).slice(0, 6).join(' ').toLowerCase();
  const near = head.length >= 12 ? text.toLowerCase().indexOf(head) : -1;
  if (near < 0) return null;
  const end = Math.min(text.length, near + clean.length);
  return { quote: text.slice(near, end), start: near, end };
}

const ageOf = (doc: MemoryDoc) => doc.ageMin ?? doc.ageMax ?? 999;

function block(doc: MemoryDoc, label: string): string {
  const age = doc.ageMin === null ? 'age unknown' : `age ${doc.ageMin}`;
  const people = doc.people.map((p) => `${p.name} (${p.role})`).join(', ');
  return `${label}: "${doc.title}", ${age}${people ? `. People: ${people}` : ''}\n${doc.text.slice(0, 1800)}`;
}

export async function discoverThreads(memoryIds?: string[], perMemory = 3): Promise<number> {
  const archive = Archive.load();
  const docs = archive.docs().filter((d) => !d.sensitive);
  const existing = new Set(
    archive.connections.map((c) => pairKey(archive.connectionMemoryIds(c.id))),
  );
  const themes = new Map<string, string[]>();
  for (const row of all<{ memory_id: string; theme: string }>(
    'SELECT memory_id, theme FROM memory_themes',
  ))
    themes.set(row.memory_id, [...(themes.get(row.memory_id) ?? []), row.theme]);

  const targets = memoryIds?.length ? docs.filter((d) => memoryIds.includes(d.id)) : docs;
  let made = 0;
  for (const target of targets) {
    const { found } = await retrieve(`${target.title}. ${target.text.slice(0, 600)}`, {
      limit: 12,
    });
    const scored = found
      .filter((f) => f.doc.id !== target.id)
      .map((f) => {
        const sharedPeople = f.doc.people.filter(
          (p) =>
            p.role !== 'mentioned' &&
            target.people.some((q) => q.characterId === p.characterId && q.role !== 'mentioned'),
        ).length;
        const sharedThemes = (themes.get(f.doc.id) ?? []).filter((t) =>
          (themes.get(target.id) ?? []).includes(t),
        ).length;
        return { doc: f.doc, score: f.score + sharedPeople * 0.3 + sharedThemes * 0.4 };
      })
      .filter((c) => !existing.has(pairKey([target.id, c.doc.id])))
      .sort((a, b) => b.score - a.score)
      .slice(0, perMemory);

    for (const candidate of scored) {
      const [earlier, later] =
        ageOf(target) <= ageOf(candidate.doc) ? [target, candidate.doc] : [candidate.doc, target];
      existing.add(pairKey([earlier.id, later.id]));
      const reply = await ai.askJson<{
        connected: boolean;
        type: (typeof TYPES)[number];
        explanation: string;
        earlierQuote: string;
        laterQuote: string;
      }>(
        {
          system: SYSTEM,
          prompt: `${block(earlier, 'Earlier memory')}\n\n---\n\n${block(later, 'Later memory')}\n\nAnswer as JSON.`,
          maxTokens: 320,
          temperature: 0.2,
          urgent: false,
        },
        schema,
      );
      if (!reply.connected || !reply.explanation || !reply.earlierQuote || !reply.laterQuote)
        continue;
      const first = locate(earlier.text, reply.earlierQuote);
      const second = locate(later.text, reply.laterQuote);
      if (!first || !second || reply.explanation.trim().length < 20) continue;
      createConnection({
        type: reply.type,
        explanation: plain(reply.explanation),
        status: 'suggested',
        note: null,
        memoryIds: [earlier.id, later.id],
        evidence: [
          { memoryId: earlier.id, ...first },
          { memoryId: later.id, ...second },
        ],
      });
      made += 1;
    }
  }
  return made;
}
