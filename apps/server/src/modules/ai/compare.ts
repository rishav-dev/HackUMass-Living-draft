import type { CompareInsightDto } from '@living-draft/contracts';
import { Archive } from '../archive/snapshot';
import { nameRefs, plain, refsIn } from './prose';
import { followupsFor } from './retrieve';
import { ai, type JsonSchema } from './runner';

const SYSTEM = `You compare memories from one person's life, the way a thoughtful friend who has read every word would. You speak to them directly as "you", never by name and never as "I". Other people are named as they appear in the memories; keep straight who did what.

What to look at: what happened in each, why it mattered, what they wanted or expected, the effort and choices they made, how it turned out, how they felt then and how they feel now, and what changed in how they acted between the two.

Rules:
- Find the connection that actually means something. Two memories sharing an emotion word is not an insight; explain what the shared feeling was about and what was different.
- Be specific: name the events, decisions and outcomes. Refer to memories by number like [1].
- Mark each observation as "shown" (the memories say it) or "suggested" (a reasonable reading that goes beyond what they say). Don't present a suggestion as fact, and don't diagnose.
- Include differences as well as similarities. If they seem unrelated, say so honestly.
- Plain, warm language. No morals, no motivational lines, no therapy jargon.`;

const schema: JsonSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    observations: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          kind: { enum: ['alike', 'different', 'changed', 'reading'] },
          basis: { enum: ['shown', 'suggested'] },
          text: { type: 'string' },
        },
      },
    },
    caveat: { type: 'string' },
  },
};

export async function compareWithAi(
  memoryIds: string[],
  question?: string,
): Promise<CompareInsightDto> {
  const archive = Archive.load();
  const docs = memoryIds
    .map((id) => archive.docs().find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  const blocks = docs.map((doc, i) => {
    const age =
      doc.ageMin === null
        ? 'age unknown'
        : doc.ageMin === doc.ageMax || doc.ageMax === null
          ? `age ${doc.ageMin}`
          : `age ${doc.ageMin}-${doc.ageMax}`;
    const people = doc.people
      .map((p) => {
        const relationship = archive.character(p.characterId)?.relationship;
        return relationship ? `${p.name} (${relationship}, ${p.role})` : `${p.name} (${p.role})`;
      })
      .join(', ');
    const then = doc.emotions
      .filter((e) => e.phase === 'then')
      .map((e) => e.tag)
      .join(', ');
    const now = doc.emotions
      .filter((e) => e.phase === 'now')
      .map((e) => e.tag)
      .join(', ');
    const answers = followupsFor(doc.id)
      .map((a) => `Q: ${a.question} A: ${a.answer}`)
      .join('\n');
    return [
      `[${i + 1}] "${doc.title}", ${age}`,
      people && `People: ${people}`,
      (then || now) && `Felt then: ${then || 'not noted'}. Looking back: ${now || 'not noted'}.`,
      doc.text.length > 1600 ? `${doc.text.slice(0, 1600)}…` : doc.text,
      answers && `Follow-up answers:\n${answers}`,
    ]
      .filter(Boolean)
      .join('\n');
  });
  const prompt = `${archive.profile.preferredName} is ${archive.profile.currentAge} now.
${question ? `They asked: "${question}"\n` : ''}
${blocks.join('\n\n---\n\n')}

Compare them as JSON, speaking to ${archive.profile.preferredName} as "you". The headline is one or two sentences with the most meaningful connection (or lack of one). Give three to five observations, each one or two sentences.`;
  const reply = await ai.askJson<{
    headline: string;
    observations: Array<{ kind: string; basis: 'shown' | 'suggested'; text: string }>;
    caveat: string;
  }>({ system: SYSTEM, prompt, maxTokens: 1000, temperature: 0.45, urgent: true }, schema);
  const idFor = (n: number) => docs[n - 1]?.id;
  const titleFor = (n: number) => docs[n - 1]?.title;
  const tidy = (text: string) => plain(nameRefs(text ?? '', titleFor));
  if (!reply.headline?.trim()) throw new Error('The model stopped before finishing its answer.');
  return {
    headline: tidy(reply.headline),
    observations: (reply.observations ?? [])
      .filter((o) => o.text?.trim())
      .map((o) => ({
        kind: o.kind as CompareInsightDto['observations'][number]['kind'],
        basis: o.basis ?? 'suggested',
        text: tidy(o.text),
        memoryIds: [
          ...new Set(
            refsIn(o.text)
              .map(idFor)
              .filter((id): id is string => Boolean(id)),
          ),
        ],
      })),
    caveat: tidy(reply.caveat ?? ''),
    memoryIds: docs.map((d) => d.id),
  };
}
