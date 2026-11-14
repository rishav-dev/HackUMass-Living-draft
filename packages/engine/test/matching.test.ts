import { describe, expect, it } from 'vitest';
import { findCandidates } from '../src';
import { SUMMER_DAD_ADDITION, SUMMER_PROMISE, SUMMER_UNSURE, doc } from './samples';

const archive = [
  {
    ...doc({
      id: 'promise',
      title: "Mom's promise",
      text: SUMMER_PROMISE,
      ageMin: 12,
      ageMax: 12,
      season: 'summer',
    }),
    people: [{ characterId: 'mom', name: 'Mom', role: 'central' as const }],
    peopleKeys: ['mom'],
  },
  {
    ...doc({
      id: 'lake-8',
      title: 'The lake trip',
      text: 'When I was 8 we drove to the lake for a week in summer. Dad taught me to skip stones.',
      ageMin: 8,
      ageMax: 8,
      season: 'summer',
    }),
    people: [{ characterId: 'dad', name: 'Dad', role: 'central' as const }],
    peopleKeys: ['dad'],
  },
  {
    ...doc({
      id: 'recital',
      title: 'The recital',
      text: 'At my piano recital when I was 14 I was so nervous my hands shook. Mom sat in the front row.',
      ageMin: 14,
      ageMax: 14,
      season: 'spring',
    }),
    people: [{ characterId: 'mom', name: 'Mom', role: 'supporting' as const }],
    peopleKeys: ['mom'],
  },
];

describe('findCandidates', () => {
  it('suggests the summer promise when the Dad detail comes in', () => {
    const [top] = findCandidates(
      {
        text: SUMMER_DAD_ADDITION,
        ageMin: null,
        ageMax: null,
        season: 'summer',
        peopleKeys: ['dad', 'mom'],
        emotionTags: [],
      },
      archive,
    );
    expect(top?.memoryId).toBe('promise');
  });

  it('calls the uncertain retelling the same event', () => {
    const [top] = findCandidates(
      {
        text: SUMMER_UNSURE,
        ageMin: 12,
        ageMax: 12,
        season: 'summer',
        peopleKeys: ['mom'],
        emotionTags: [],
      },
      archive,
    );
    expect(top?.memoryId).toBe('promise');
    expect(top?.verdict).toBe('likely_same');
  });

  it('keeps a different lake trip at a different age as separate', () => {
    const results = findCandidates(
      {
        text: 'When I was 15 we drove to the lake in summer and I swam across it with my cousin.',
        ageMin: 15,
        ageMax: 15,
        season: 'summer',
        peopleKeys: ['cousin'],
        emotionTags: [],
      },
      archive,
    );
    expect(results.every((r) => r.verdict !== 'likely_same')).toBe(true);
  });

  it('never merges anything on its own; it only returns suggestions with reasons', () => {
    const [top] = findCandidates(
      {
        text: SUMMER_UNSURE,
        ageMin: 12,
        ageMax: 12,
        season: 'summer',
        peopleKeys: ['mom'],
        emotionTags: [],
      },
      archive,
    );
    expect(top?.reasons.length).toBeGreaterThan(0);
  });
});
