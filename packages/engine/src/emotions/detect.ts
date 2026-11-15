import { splitSentences } from '../text/sentences';
import type { BaseEmotion, EmotionPhase, EmotionSignal } from '../types';

interface LexiconEntry {
  tag: BaseEmotion;
  basis: 'stated' | 'described';
  phrases: string[];
}

const LEXICON: LexiconEntry[] = [
  {
    tag: 'happy',
    basis: 'stated',
    phrases: [
      'happy',
      'happiest',
      'glad',
      'joy',
      'joyful',
      'delighted',
      'cheerful',
      'overjoyed',
      'over the moon',
      'on top of the world',
    ],
  },
  {
    tag: 'happy',
    basis: 'described',
    phrases: [
      'laughed',
      'laughing',
      'smiled',
      'smiling',
      'giggled',
      'grinned',
      'danced',
      "couldn't stop smiling",
    ],
  },
  {
    tag: 'sad',
    basis: 'stated',
    phrases: [
      'sad',
      'sadness',
      'unhappy',
      'heartbroken',
      'miserable',
      'lonely',
      'hurt',
      'upset',
      'gutted',
      'devastated',
    ],
  },
  {
    tag: 'sad',
    basis: 'described',
    phrases: ['cried', 'crying', 'tears', 'sobbed', 'wept', 'in tears'],
  },
  {
    tag: 'angry',
    basis: 'stated',
    phrases: [
      'angry',
      'mad',
      'furious',
      'annoyed',
      'frustrated',
      'irritated',
      'livid',
      'resentful',
      'fuming',
    ],
  },
  {
    tag: 'angry',
    basis: 'described',
    phrases: [
      'argued',
      'yelled',
      'shouted',
      'screamed',
      'slammed',
      'stormed off',
      'got into a fight',
    ],
  },
  {
    tag: 'nostalgic',
    basis: 'stated',
    phrases: [
      'nostalgic',
      'nostalgia',
      'i miss',
      'i still miss',
      'miss those',
      'those were the days',
      'takes me back',
    ],
  },
  {
    tag: 'excited',
    basis: 'stated',
    phrases: [
      'excited',
      'exciting',
      "couldn't wait",
      'could not wait',
      'thrilled',
      'eager',
      'pumped',
      'buzzing',
    ],
  },
  {
    tag: 'peaceful',
    basis: 'stated',
    phrases: ['peaceful', 'calm', 'serene', 'relaxed', 'at peace', 'cozy', 'content', 'felt safe'],
  },
  {
    tag: 'anxious',
    basis: 'stated',
    phrases: [
      'anxious',
      'nervous',
      'scared',
      'afraid',
      'worried',
      'terrified',
      'panicked',
      'frightened',
      'uneasy',
      'dreaded',
      'dreading',
    ],
  },
  {
    tag: 'anxious',
    basis: 'described',
    phrases: ['shaking', 'trembling', 'heart was pounding', "couldn't breathe", 'butterflies'],
  },
  { tag: 'proud', basis: 'stated', phrases: ['proud', 'pride', 'accomplished'] },
  {
    tag: 'grateful',
    basis: 'stated',
    phrases: [
      'grateful',
      'thankful',
      'so lucky',
      'appreciate',
      'appreciated',
      'means a lot',
      'meant a lot',
      'meant so much',
    ],
  },
  {
    tag: 'confused',
    basis: 'stated',
    phrases: [
      'confused',
      'confusing',
      "didn't understand",
      'did not understand',
      'puzzled',
      'made no sense',
      "didn't get why",
    ],
  },
  {
    tag: 'disappointed',
    basis: 'stated',
    phrases: ['disappointed', 'disappointing', 'let down', 'crushed', 'gutted'],
  },
];

const NEGATORS =
  /\b(?:not|never|no|wasn't|weren't|didn't|don't|isn't|aren't|hardly|barely|nobody|wasnt|didnt|dont)\b/i;
const NOW_MARKERS =
  /\b(?:now|today|these days|nowadays|looking back|in hindsight|i realize|i realise|i see now|i understand now|still makes me|it makes me|i feel|i'm|i am|i still|even now|to this day)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMPILED = LEXICON.flatMap((entry) =>
  entry.phrases.map((phrase) => ({
    entry,
    pattern: new RegExp(`\\b${escapeRegex(phrase).replace(/'/g, "['’]")}\\b`, 'gi'),
  })),
);

export function detectEmotions(text: string): EmotionSignal[] {
  const sentences = splitSentences(text);
  const signals: EmotionSignal[] = [];
  const taken: Array<[number, number]> = [];

  for (const { entry, pattern } of COMPILED) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (taken.some(([s, e]) => start < e && s < end)) continue;
      const lead = text.slice(Math.max(0, start - 24), start);
      if (NEGATORS.test(lead.split(/[,.;!?]/).pop() ?? '')) continue;
      const sentence = sentences.find((s) => start >= s.start && start < s.end);
      const phase: EmotionPhase = sentence && NOW_MARKERS.test(sentence.text) ? 'now' : 'then';
      taken.push([start, end]);
      signals.push({
        tag: entry.tag,
        phase,
        basis: entry.basis,
        quote: sentence?.text ?? match[0],
        start,
        end,
        confidence: entry.basis === 'stated' ? 0.85 : 0.55,
      });
    }
  }

  const best = new Map<string, EmotionSignal>();
  for (const signal of signals) {
    const key = `${signal.tag}:${signal.phase}`;
    const existing = best.get(key);
    if (!existing || signal.confidence > existing.confidence) best.set(key, signal);
  }
  return [...best.values()].sort((a, b) => a.start - b.start);
}

export const POSITIVE_EMOTIONS = new Set([
  'happy',
  'excited',
  'peaceful',
  'proud',
  'grateful',
  'nostalgic',
  'confident',
  'determined',
  'hopeful',
  'relieved',
  'loved',
]);
export const DIFFICULT_EMOTIONS = new Set([
  'sad',
  'angry',
  'anxious',
  'disappointed',
  'confused',
  'nervous',
  'scared',
  'frustrated',
  'resentful',
  'hurt',
  'betrayed',
  'lonely',
  'embarrassed',
  'guilty',
  'regretful',
  'jealous',
  'overwhelmed',
]);

export function valence(tags: string[]): number {
  if (!tags.length) return 0;
  let total = 0;
  for (const tag of tags) {
    if (POSITIVE_EMOTIONS.has(tag)) total += 1;
    else if (DIFFICULT_EMOTIONS.has(tag)) total -= 1;
  }
  return total / tags.length;
}
