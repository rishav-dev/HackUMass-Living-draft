import type { AnswerDto } from '@living-draft/contracts';
import type { Archive } from '../archive/snapshot';
import { likelySources, nameRefs, plain, quotedFrom, refsIn } from './prose';
import { ai, type JsonSchema } from './runner';
import { followupsFor, retrieve, type Retrieved } from './retrieve';

const SYSTEM = `You are helping someone think about their own life, using only the memories they have written down. You are talking to them directly ("you").

How to answer:
- Speak to them as "you" ("your dad", "when you were 14"), even when they ask in the first person. Never write as "I".
- Answer the question they actually asked, in the first paragraph, as directly as the memories allow.
- Then back it up with specific moments: what happened, what was said or done, how they reacted. Refer to memories by their number in square brackets, like [2].
- Look at how things change over time when the question is about change, using the ages given.
- Separate what the memories show from what they only suggest ("it looks like", "one reading is"). Offer another reasonable interpretation when there is one.
- If the memories don't cover something the question needs, say exactly what is missing.
- Plain, warm, specific language. No therapy jargon, no flattery, no generic advice, no inspirational lines.
- Never invent events, quotes, people or feelings that aren't in the memories.`;

const schema: JsonSchema = {
  type: 'object',
  properties: {
    paragraphs: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' } },
    sources: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          ref: { type: 'integer' },
          quote: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    missing: { type: 'string' },
  },
};

function age(found: Retrieved): string {
  const { ageMin, ageMax } = found.doc;
  if (ageMin === null && ageMax === null) return 'age unknown';
  return ageMin === ageMax || ageMax === null ? `age ${ageMin}` : `age ${ageMin}-${ageMax}`;
}

function brief(found: Retrieved, n: number, archive: Archive): string {
  const { doc } = found;
  const people = doc.people
    .map((p) => {
      const relationship = archive.character(p.characterId)?.relationship;
      return relationship ? `${p.name} (${relationship}, ${p.role})` : `${p.name} (${p.role})`;
    })
    .join(', ');
  const then = doc.emotions.filter((e) => e.phase === 'then').map((e) => e.tag);
  const now = doc.emotions.filter((e) => e.phase === 'now').map((e) => e.tag);
  const answers = followupsFor(doc.id)
    .map((a) => `Q: ${a.question} A: ${a.answer}`)
    .join('\n');
  return [
    `[${n}] "${doc.title}", ${age(found)}`,
    people ? `People: ${people}` : '',
    then.length || now.length
      ? `Felt at the time: ${then.join(', ') || 'not noted'}; looking back: ${now.join(', ') || 'not noted'}`
      : '',
    doc.text.length > 1200 ? `${doc.text.slice(0, 1200)}…` : doc.text,
    answers ? `Their answers to follow-up questions:\n${answers}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function askWithAi(
  question: string,
  scope: { includeQuiet?: boolean; memoryIds?: string[] } = {},
): Promise<AnswerDto> {
  const { found, archive } = await retrieve(question, { ...scope, limit: 6 });
  if (!found.length)
    return {
      intent: 'ai',
      lines: [
        {
          text: "I couldn't find anything in your memories that speaks to this yet. Writing down a moment or two about it would give me something to go on.",
          memoryIds: [],
        },
      ],
      citations: [],
      limitations: [],
      consideredCount: archive.docs().length,
    };

  const prompt = `${archive.profile.preferredName} is now ${archive.profile.currentAge}.

Their question: "${question}"

The memories that seem relevant, oldest first:

${found.map((f, i) => brief(f, i + 1, archive)).join('\n\n---\n\n')}

Answer as JSON, speaking to ${archive.profile.preferredName} as "you". Keep it to two to four short paragraphs, mark the memories you use like [2], and keep each quote to a few words copied exactly.`;
  const reply = await ai.askJson<{
    paragraphs: string[];
    sources: Array<{ ref: number; quote: string; why: string }>;
    missing: string;
  }>({ system: SYSTEM, prompt, maxTokens: 1000, temperature: 0.4, urgent: true }, schema);

  const idFor = (ref: number) => found[ref - 1]?.doc.id;
  const titleFor = (ref: number) => found[ref - 1]?.doc.title;
  const texts = found.map((f) => ({ id: f.doc.id, title: f.doc.title, text: f.doc.text }));
  const paragraphs = (reply.paragraphs ?? []).filter((p) => p.trim());
  if (!paragraphs.length) throw new Error('The model stopped before finishing its answer.');
  const lines = paragraphs.map((paragraph) => {
    const cited = refsIn(paragraph)
      .map(idFor)
      .filter((id): id is string => Boolean(id));
    return {
      text: plain(nameRefs(paragraph, titleFor)),
      memoryIds: [...new Set(cited.length ? cited : likelySources(paragraph, texts))],
    };
  });
  const sources = (reply.sources ?? []).filter((s) => idFor(s.ref));
  const citations = sources.length
    ? sources.map((s) => {
        const hit = found[s.ref - 1]!;
        const doc = hit.doc;
        const at = s.quote ? doc.text.indexOf(s.quote) : -1;
        return {
          memoryId: doc.id,
          title: doc.title,
          quote: at >= 0 ? s.quote : plain(s.why ?? ''),
          start: Math.max(0, at),
          end: at >= 0 ? at + s.quote.length : 0,
          ageLabel: age(hit),
        };
      })
    : [...new Set(lines.flatMap((l) => l.memoryIds))].map((id) => {
        const hit = found.find((f) => f.doc.id === id)!;
        const doc = hit.doc;
        const phrase = paragraphs
          .map((p) => quotedFrom(p, { id, title: doc.title, text: doc.text }))
          .find(Boolean);
        const at = phrase ? doc.text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
        const opening = doc.text.split(/(?<=[.!?])\s/)[0] ?? doc.text;
        return {
          memoryId: doc.id,
          title: doc.title,
          quote: at >= 0 ? doc.text.slice(at, at + phrase!.length) : opening.slice(0, 200),
          start: Math.max(0, at),
          end: at >= 0 ? at + phrase!.length : Math.min(200, opening.length),
          ageLabel: age(hit),
        };
      });
  const missing = plain(reply.missing ?? '');
  return {
    intent: 'ai',
    lines,
    citations,
    limitations: missing ? [missing] : [],
    consideredCount: found.length,
  };
}
