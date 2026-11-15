import { EARLY } from './kinjal-early';
import { LATER } from './kinjal-later';
import { TEEN } from './kinjal-teen';
import type { SampleMemory, SampleThread } from './kinjal-types';

export const KINJAL_ACCOUNT = {
  email: 'kinjal@example.com',
  name: 'Kinjal',
};

export const KINJAL_MEMORIES: SampleMemory[] = [...EARLY, ...TEEN, ...LATER];

export const KINJAL_THREADS: SampleThread[] = [
  {
    type: 'breaking_pattern',
    from: 'not-the-team',
    to: 'raise',
    fromQuote: 'I never asked Coach Brennan why.',
    toQuote: "I said I'd like my rate to go from $22 to $28 an hour, and why.",
    explanation:
      'At fourteen you trained all summer, read the list, and never asked the coach why. At twenty-two you had put in the work again, and this time you went in with a page of results and asked for what it was worth.',
    status: 'confirmed',
  },
  {
    type: 'breaking_pattern',
    from: 'dad-major',
    to: 'switching-major',
    fromQuote: 'I just said okay.',
    toQuote: 'This time I called Dad before filling out the form, not after.',
    explanation:
      'At seventeen you let Dad choose your major without saying what you wanted. Two years later you called him first, with your reasons ready.',
    status: 'confirmed',
  },
  {
    type: 'relationship_change',
    from: 'dad-major',
    to: 'calling-dad',
    fromQuote: "Put mechanical engineering. It's safe.",
    toQuote: "He said he was proud, and he didn't mention engineering.",
    explanation:
      'Dad went from choosing the safe path for you to being proud that you had asked for something yourself, something he says he never did.',
    status: 'confirmed',
  },
  {
    type: 'relationship_change',
    from: 'not-the-team',
    to: 'chem-exam',
    fromQuote: "Dad picked me up and didn't say a word the whole drive.",
    toQuote: 'Instead he laughed, not unkindly',
    explanation:
      "After the tryouts, Dad's silence felt like disappointment to you. When you failed your first exam in college, he laughed, said it showed you where the ground was, and asked what you'd do differently.",
    status: 'suggested',
  },
  {
    type: 'echo',
    from: 'chem-exam',
    to: 'paper-rejected',
    fromQuote: 'Now you know where the ground is.',
    toQuote: 'Now you know where the ground is.',
    explanation:
      "Dad's line after your failed chemistry exam came back to you five years later when your paper was rejected, and this time you made a plan instead of hiding.",
    status: 'confirmed',
  },
  {
    type: 'full_circle',
    from: 'nani-garden',
    to: 'balcony-tomatoes',
    fromQuote: 'It was still warm from the sun.',
    toQuote: 'it was warm from the sun',
    explanation:
      'Nearly twenty years after Nani handed you a sun-warm tomato in Gwalior, you grew your own on a balcony in Amherst and ate it the same way.',
    status: 'confirmed',
  },
  {
    type: 'echo',
    from: 'lunch-table',
    to: 'priya-lunch',
    fromQuote: 'I ate lunch alone at the end of the table',
    toQuote: 'a girl named Priya waved me over to her table',
    explanation:
      'Twice, in a new place, you were about to eat alone, and twice someone made room for you: Mei in Queens, then Priya in Shrewsbury.',
    status: 'confirmed',
  },
  {
    type: 'echo',
    from: 'first-snow',
    to: 'amherst-snow',
    fromQuote: 'he wore plastic bags over his shoes',
    toQuote: 'sent him a photo of my real snow boots',
    explanation:
      "Your first snow came with Dad's plastic-bag boots. Fifteen years later you sent him a photo of real ones.",
    status: 'confirmed',
  },
  {
    type: 'personal_growth',
    from: 'not-the-team',
    to: 'jv-again',
    fromQuote: "I didn't play for a whole year",
    toQuote: 'A year later I tried out again',
    explanation:
      'After a year of telling everyone you didn’t care, you tried out again and made JV.',
    status: 'confirmed',
  },
  {
    type: 'personal_growth',
    from: 'recital',
    to: 'presentation',
    fromQuote: 'I froze in the middle of the piece.',
    toQuote: 'I thought about the recital, and how I had frozen, and I kept going',
    explanation:
      'Being watched made your mind go blank at eleven. At twenty-one your hands shook in front of a VP, you remembered the recital, and you kept going.',
    status: 'suggested',
  },
  {
    type: 'cause_consequence',
    from: 'rejections',
    to: 'moving-day',
    fromQuote: "The next week, almost on a whim, I applied to the master's program at UMass.",
    toQuote: 'Mom drove me up to Amherst for grad school.',
    explanation:
      'The spring of rejections is what sent you to the master’s program that brought you to Amherst.',
    status: 'suggested',
  },
];

export const KINJAL_PLACE_COORDS: Record<string, [number, number]> = {
  'Acadia, Maine': [44.35, -68.21],
  'Amherst, Massachusetts': [42.373, -72.52],
  'Blacksburg, Virginia': [37.229, -80.414],
  'Gurgaon, India': [28.459, 77.027],
  'Gwalior, India': [26.218, 78.183],
  'Lake Quinsigamond, Massachusetts': [42.27, -71.75],
  'Los Angeles, California': [34.052, -118.244],
  'New York': [40.713, -74.006],
  'Northampton, Massachusetts': [42.325, -72.641],
  'Queens, New York': [40.728, -73.795],
  'San Diego, California': [32.716, -117.161],
  'Shrewsbury, Massachusetts': [42.296, -71.713],
  'Worcester, Massachusetts': [42.263, -71.802],
};

export const KINJAL_MILESTONES = [
  { title: 'Started school', ageMin: 5, ageMax: 5, date: '2008-09' },
  { title: 'Moved to New York', ageMin: 7, ageMax: 7, date: '2010-08' },
  { title: 'My brother Arjun was born', ageMin: 9, ageMax: 9, date: '2012-06' },
  { title: 'Moved to Massachusetts', ageMin: 13, ageMax: 13, date: '2016-07' },
  { title: 'High school graduation', ageMin: 18, ageMax: 18, date: '2021-06' },
  { title: 'Started college', ageMin: 18, ageMax: 18, date: '2021-08' },
  { title: 'Switched to HCI', ageMin: 18, ageMax: 18, date: '2022-01' },
  { title: 'Graduated from college', ageMin: 22, ageMax: 22, date: '2025-05-15' },
  { title: "Started my master's", ageMin: 22, ageMax: 22, date: '2025-09' },
  { title: 'First raise', ageMin: 22, ageMax: 22, date: '2025-10-14' },
];

export const KINJAL_REFLECTION = {
  memoryKey: 'promise',
  text: "Looking back, I think Mom was exhausted that summer. She was working two jobs. I don't think she meant to break a promise; I think she just ran out of room.",
};

export const KINJAL_CAPSULES = [
  {
    title: 'For one year later',
    text: "It's November and I just started the master's. I hope you stopped apologizing in meetings. I hope you called Nani more. If you didn't, call her today.",
    unlockKind: 'date' as const,
    unlockDate: '2026-11-01',
    authoredAt: '2025-11-01T20:15:00.000Z',
    authoredAge: 22,
  },
  {
    title: 'To me at 25',
    text: 'Are you still drawing? Please say yes.',
    unlockKind: 'date' as const,
    unlockDate: '2028-04-18',
    authoredAt: '2026-04-18T09:00:00.000Z',
    authoredAge: 23,
  },
  {
    title: 'When I finish the master’s',
    text: 'You did the hard thing. Now rest for a whole week, no excuses.',
    unlockKind: 'milestone' as const,
    unlockMilestone: 'Finishing my master’s degree',
    authoredAt: '2026-09-02T18:40:00.000Z',
    authoredAge: 23,
  },
];
