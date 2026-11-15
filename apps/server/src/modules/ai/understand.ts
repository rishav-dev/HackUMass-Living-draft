import { ai, type JsonSchema } from './runner';
import { plain } from './prose';

export const FEELINGS = [
  'happy',
  'excited',
  'proud',
  'confident',
  'determined',
  'hopeful',
  'relieved',
  'grateful',
  'loved',
  'peaceful',
  'nostalgic',
  'nervous',
  'anxious',
  'scared',
  'frustrated',
  'angry',
  'resentful',
  'hurt',
  'betrayed',
  'sad',
  'disappointed',
  'lonely',
  'embarrassed',
  'guilty',
  'regretful',
  'jealous',
  'overwhelmed',
  'confused',
] as const;

export const THEMES = [
  'Self-advocacy',
  'Standing up for myself',
  'Recognizing my worth',
  'Breaking a pattern',
  'Repeating a pattern',
  'Coming full circle',
  'Changing a belief',
  'A relationship changing',
  'Trying again',
  'Facing a fear',
  'Feeling unheard',
  'Being blamed unfairly',
  'Wanting control over my own body',
  'Family expectations',
  'Belonging',
  'Leaving home',
  'Starting over',
  'Losing someone',
  'Being cared for',
  'Independence',
  'Hard work paying off',
  'Hard work not paying off',
  'Friendship',
  'First love',
  'Growing up',
] as const;

export interface KnownPerson {
  name: string;
  relationship: string | null;
  aliases: string[];
}

export interface UnderstandContext {
  narratorName: string;
  pronouns: string | null;
  people: KnownPerson[];
  ageNow: number;
  earlier?: Array<{ text: string; when: string }>;
  answers?: Array<{ question: string; answer: string }>;
}

export interface MemoryNotes {
  title: string;
  summary: string;
  time: {
    kind:
      'one moment' | 'one day' | 'a few days' | 'weeks or months' | 'kept happening' | 'unclear';
    hint: string;
  };
  feelings: Array<{ feeling: string; when: 'at the time' | 'looking back'; because: string }>;
  milestone: { isMilestone: boolean; title: string };
  people: Array<{
    mentionedAs: string;
    name: string;
    describedAs: string;
    role: 'central' | 'supporting' | 'mentioned';
    relationTo: string;
    relationship: string;
    why: string;
  }>;
  places: Array<{
    name: string;
    kind: 'city or town' | 'country' | 'state or region' | 'venue' | 'school' | 'home' | 'other';
  }>;
  themes: Array<{ theme: string; because: string }>;
  questions: string[];
}

const NOTES_SYSTEM = `You help one person keep a private journal of their own life. They speak or type a memory, often messily: run-on sentences, filler words, swearing, things out of order. Your job is to understand what actually happened and what it meant to them, then return careful notes as JSON.

Ground rules:
- Only use what the text says or clearly implies. Never invent names, places, dates, motives or events.
- "I", "me", "my" is the narrator.
- Relationships belong to whoever the text says. "His wife" means the wife of the man just mentioned, not the narrator's wife. "My mom" is the narrator's mother.
- A person who drives the main conflict or event is central, even if mentioned only a few times. Someone who takes part is supporting. Someone only named in passing is mentioned.
- Prefer the most specific description the text supports: "piano coach" rather than "coach", "Mr. Halvorsen" if a name is given.
- Places are not people. Only named cities, states, countries, schools and venues go in places; leave places empty if none is named.
- People fields: "mentionedAs" is the exact words used ("my coach", "his wife"). "name" is their actual name only if one is said, otherwise "". "describedAs" is a short label of 1 to 3 words ("piano coach", "coach's wife", "mom"). "relationTo" is "me" when the relationship is to the narrator, otherwise the describedAs of the other person ("piano coach"). "relationship" is one or two words ("teacher", "wife", "mother").
- List everyone who is mentioned, including people described only through someone else, like "his wife".
- Never write placeholder text such as "Not specified", "Not named" or "Unknown". Use "" instead.

People example
Text: my coach gave me the hardest part ... I think his wife cheated on him
people: [{"mentionedAs":"my coach","name":"","describedAs":"music coach","role":"central","relationTo":"me","relationship":"coach","why":"Gave me the part that went wrong"},{"mentionedAs":"his wife","name":"","describedAs":"coach's wife","role":"mentioned","relationTo":"music coach","relationship":"wife","why":"Only mentioned at the end"}]
- The title is 3 to 7 words and names what the memory is really about: the defining event, conflict or feeling. Not a person's name or a detail that happens to be mentioned. Plain, in the narrator's register, like a heading they would write themselves (e.g. "When my coach gave me the impossible part").
- The summary is one sentence, under 30 words, written about the narrator in the third person using their pronouns.
- Keep every "because" and "why" under 15 words.
- Feelings: infer them from what happened, not only from emotion words. Use several when the story moves between them. Mark feelings the narrator has now, looking back, separately from feelings at the time.
- Milestones are only big life markers (moving, starting school or a job, graduating, a team or audition result, a promotion, a major relationship change, a loss, a personal first). Most memories are not milestones.
- Themes must be supported by the story. Leave the list empty rather than guess.
- Questions: 2 to 4 short, warm, specific follow-up questions a curious friend would ask to understand this memory better: what led up to it, why it mattered, what the other person said or did, what happened right after, how it resolved, whether they see it differently now. Only ask about things in this story; never ask about family members, friends or events it doesn't mention. Do not ask about anything the text already answers, and don't ask about the date unless it truly matters.`;

function notesSchema(minPeople: number): JsonSchema {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      people: {
        type: 'array',
        minItems: minPeople,
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            mentionedAs: { type: 'string' },
            name: { type: 'string' },
            describedAs: { type: 'string' },
            role: { enum: ['central', 'supporting', 'mentioned'] },
            relationTo: { type: 'string' },
            relationship: { type: 'string' },
            why: { type: 'string' },
          },
        },
      },
      feelings: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            feeling: { enum: [...FEELINGS] },
            when: { enum: ['at the time', 'looking back'] },
            because: { type: 'string' },
          },
        },
      },
      places: {
        type: 'array',
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            kind: {
              enum: [
                'city or town',
                'country',
                'state or region',
                'venue',
                'school',
                'home',
                'other',
              ],
            },
          },
        },
      },
      milestone: {
        type: 'object',
        properties: {
          isMilestone: { type: 'boolean' },
          title: { type: 'string' },
        },
      },
      themes: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          properties: {
            theme: { enum: [...THEMES] },
            because: { type: 'string' },
          },
        },
      },
      time: {
        type: 'object',
        properties: {
          kind: {
            enum: [
              'one moment',
              'one day',
              'a few days',
              'weeks or months',
              'kept happening',
              'unclear',
            ],
          },
          hint: { type: 'string' },
        },
      },
      questions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
      summary: { type: 'string' },
    },
  };
}

function knownPeople(context: UnderstandContext): string {
  if (!context.people.length) return 'None yet.';
  return context.people
    .slice(0, 40)
    .map(
      (p) =>
        `- ${p.name}${p.relationship ? ` (${p.relationship})` : ''}${p.aliases.length ? `, also called ${p.aliases.slice(0, 4).join(', ')}` : ''}`,
    )
    .join('\n');
}

function extraSources(context: UnderstandContext): string {
  const parts: string[] = [];
  if (context.earlier?.length)
    parts.push(
      `Earlier tellings of this same memory:\n${context.earlier
        .map((e, i) => `[Telling ${i + 1}, ${e.when}]\n${e.text}`)
        .join('\n\n')}`,
    );
  if (context.answers?.length)
    parts.push(
      `Answers they gave to follow-up questions:\n${context.answers
        .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
        .join('\n')}`,
    );
  return parts.length ? `\n\n${parts.join('\n\n')}` : '';
}

export async function understandNotes(
  text: string,
  context: UnderstandContext,
  urgent = true,
  peopleSpotted = 1,
) {
  const prompt = `The narrator is ${context.narratorName}${context.pronouns ? ` (${context.pronouns})` : ''}, now ${context.ageNow}.
People already in their journal (use these names when the text clearly refers to them):
${knownPeople(context)}${extraSources(context)}

The new memory, exactly as they said it:
"""
${text}
"""

Return the notes as JSON.`;
  const notes = await ai.askJson<MemoryNotes>(
    { system: NOTES_SYSTEM, prompt, maxTokens: 1100, temperature: 0.3, urgent },
    notesSchema(peopleSpotted > 0 ? 1 : 0),
  );
  return tidyNotes(notes);
}

const clip = (value: string, limit: number) =>
  value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;

const PLACEHOLDER =
  /^(not (specified|named|mentioned|given|stated|clear)|unknown|n\/a|none|unnamed|no name)\.?$/i;
const real = (value: string) => (PLACEHOLDER.test(value.trim()) ? '' : value.trim());

function tidyNotes(partial: Partial<MemoryNotes>): MemoryNotes {
  const raw: MemoryNotes = {
    title: '',
    summary: '',
    people: [],
    feelings: [],
    places: [],
    milestone: { isMilestone: false, title: '' },
    themes: [],
    time: { kind: 'unclear', hint: '' },
    questions: [],
    ...partial,
  };
  const notes: MemoryNotes = {
    ...raw,
    people: raw.people.map((p) => ({
      ...p,
      mentionedAs: real(p.mentionedAs),
      name: real(p.name),
      describedAs: real(p.describedAs),
      relationTo: real(p.relationTo),
      relationship: real(p.relationship),
    })),
    places: raw.places.filter((place) => real(place.name)),
    time: { ...raw.time, hint: real(raw.time.hint) },
    milestone: raw.milestone.isMilestone ? raw.milestone : { isMilestone: false, title: '' },
  };
  const seenFeelings = new Set<string>();
  const seenPeople = new Set<string>();
  const seenThemes = new Set<string>();
  return {
    ...notes,
    title: clip(
      notes.title
        .replace(/^["']|["']$/g, '')
        .replace(/[.]$/, '')
        .trim(),
      70,
    ),
    summary: clip(plain(notes.summary), 260),
    feelings: notes.feelings
      .filter((f) => {
        const key = `${f.feeling}-${f.when}`;
        if (seenFeelings.has(key)) return false;
        seenFeelings.add(key);
        return true;
      })
      .map((f) => ({ ...f, because: clip(f.because.trim(), 140) })),
    people: notes.people
      .filter((p) => {
        const key = (p.name || p.describedAs || p.mentionedAs).toLowerCase().trim();
        if (!key || seenPeople.has(key)) return false;
        seenPeople.add(key);
        return true;
      })
      .map((p) => ({
        ...p,
        mentionedAs: clip(p.mentionedAs.trim(), 40),
        name: clip(p.name.trim(), 40),
        describedAs: clip(p.describedAs.trim(), 40),
        relationTo: clip(p.relationTo.trim(), 40),
        relationship: clip(p.relationship.trim(), 40),
        why: clip(p.why.trim(), 140),
      })),
    places: notes.places
      .filter((p) => p.name.trim())
      .map((p) => ({ ...p, name: clip(p.name.trim(), 60) })),
    themes: notes.themes.filter((t) => {
      if (seenThemes.has(t.theme)) return false;
      seenThemes.add(t.theme);
      return true;
    }),
    questions: [...new Set(notes.questions.map((q) => clip(q.trim(), 160)))].filter(Boolean),
  };
}

const NARRATIVE_SYSTEM = `You are a careful editor. You turn a transcript of someone talking about one of their memories into clean, readable first-person prose for their journal. Your job is editing, not writing.

Rules:
- Every sentence you write must come from something they actually said. Do not add events, people, places, objects, dialogue, reasons, feelings, outcomes or conclusions that are not in the transcript. If something is unclear, leave it as vague as they left it.
- It must read as written prose, not a transcript. Remove filler and spoken openers ("um", "like", "you know", "I mean", "basically", "actually now that I think of it", "you know what it is"). Turn rhetorical asides into plain statements. Join fragments into complete sentences and fix grammar, punctuation and repetition.
- Start with the situation (what was happening), then what happened, then how they feel about it. Anything longer than about 90 words gets at least two paragraphs.
- Keep their hedges about facts ("I think", "maybe", "I'm not sure"). If they said "I think his wife cheated on him", don't turn it into a certainty.
- Keep their voice, opinions and strong feelings, and keep their own phrases where they carry meaning. Swap crude slang for a plain word with the same meaning ("fucked up" can become "messed up", "shit" can become "stuff").
- Keep it about as long as what they said, usually a little shorter. Never pad it.
- Do not add a moral, a summary or an ending they did not say.
- When earlier tellings or answers to follow-up questions are given, fold in the new information once, without repeating anything. If tellings disagree, say so plainly in their voice.

Example
Transcript: so um the first day at the new school I didn't know anyone and like I sat alone at lunch and then this girl Priya she just came and sat down and asked if I liked the show on my notebook and I was so relieved honestly I still think about that
Journal: On my first day at the new school I didn't know anyone, so I sat alone at lunch. Then a girl named Priya came over, sat down and asked if I liked the show on my notebook. I was so relieved. I still think about that.

Example
Transcript: honestly the worst part was the drive back like nobody said anything for two hours and you know what it is my dad just kept the radio off which he never does so I knew he was disappointed and I didn't even make the team so whatever
Journal: I didn't make the team. The worst part was the drive back: nobody said anything for two hours, and my dad kept the radio off, which he never does. That's how I knew he was disappointed.`;

export function cleanNarrative(text: string): string {
  return text
    .replace(/^\s*(here(?:'s| is)[^\n]*:|journal version:?|the journal version:?)\s*/i, '')
    .replace(/^["“]|["”]$/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

export async function rewriteNarrative(
  text: string,
  context: UnderstandContext,
  urgent = true,
  onDraft?: (soFar: string) => void,
): Promise<string> {
  const words = text.split(/\s+/).length;
  const prompt = `Narrator: ${context.narratorName}.${extraSources(context)}

${context.earlier?.length ? 'The newest telling' : 'Their memory'}, exactly as they said it:
"""
${text}
"""

Write the journal version now. Plain text only: paragraphs separated by a blank line, no title, no notes before or after.`;
  const reply = await ai.askText(
    {
      system: NARRATIVE_SYSTEM,
      prompt,
      maxTokens: Math.min(2400, Math.round(words * 1.6) + 60),
      temperature: 0.25,
      urgent,
    },
    onDraft ? (soFar) => onDraft(cleanNarrative(soFar)) : undefined,
  );
  return cleanNarrative(reply);
}
