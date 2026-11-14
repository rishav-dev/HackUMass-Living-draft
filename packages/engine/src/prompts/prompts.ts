export type PromptGroup = 'period' | 'people' | 'place' | 'emotion';

export interface MemoryPrompt {
  id: string;
  group: PromptGroup;
  text: string;
  ageMin?: number;
  ageMax?: number;
}

export const MEMORY_PROMPTS: MemoryPrompt[] = [
  {
    id: 'p-first-home',
    group: 'place',
    text: 'What do you remember about the first home you can picture?',
  },
  { id: 'p-fav-place', group: 'place', text: 'What was a favorite place when you were little?' },
  { id: 'p-kitchen', group: 'place', text: 'What did the kitchen smell like when you were a kid?' },
  { id: 'p-hiding', group: 'place', text: 'Where did you go when you wanted to be alone?' },
  { id: 'p-summer', group: 'period', text: 'What is a summer you remember?' },
  {
    id: 'p-first-day',
    group: 'period',
    text: 'Do you remember a first day somewhere new?',
    ageMin: 4,
    ageMax: 22,
  },
  { id: 'p-birthday', group: 'period', text: 'Which birthday stands out, and why that one?' },
  { id: 'p-snow', group: 'period', text: 'Is there a winter that stuck with you?' },
  {
    id: 'p-teen-song',
    group: 'period',
    text: 'What song takes you straight back to being a teenager?',
    ageMin: 13,
    ageMax: 19,
  },
  { id: 'p-brave', group: 'people', text: 'Who helped you feel brave?' },
  { id: 'p-laugh', group: 'people', text: 'Who could always make you laugh?' },
  { id: 'p-teacher', group: 'people', text: 'Was there a teacher who noticed you?' },
  { id: 'p-friend', group: 'people', text: 'Who was your first real friend?' },
  { id: 'p-advice', group: 'people', text: 'What advice from someone has stayed with you?' },
  { id: 'p-proud', group: 'emotion', text: 'When did you feel proud of yourself?' },
  { id: 'p-peace', group: 'emotion', text: 'When did you last feel completely at peace?' },
  { id: 'p-excited', group: 'emotion', text: 'What could you not wait for as a kid?' },
  { id: 'p-grateful', group: 'emotion', text: 'Is there a small kindness you never forgot?' },
];

export function pickPrompts(
  options: { group?: PromptGroup; count?: number; seed?: number } = {},
): MemoryPrompt[] {
  const pool = options.group
    ? MEMORY_PROMPTS.filter((p) => p.group === options.group)
    : MEMORY_PROMPTS;
  const count = Math.min(options.count ?? 3, pool.length);
  let state = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const next = () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
  const shuffled = [...pool].sort(() => next() - 0.5);
  return shuffled.slice(0, count);
}
