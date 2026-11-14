import { describe, expect, it } from 'vitest';
import {
  estimateTemporal,
  extractTemporalClues,
  placementAges,
  resolveAnchors,
  describeWhen,
} from '../src';
import { SUMMER_PROMISE, context } from './samples';

const estimate = (text: string, ctx = context) => estimateTemporal(extractTemporalClues(text), ctx);

describe('temporal estimate', () => {
  it('places the summer promise at about 12 in summer without inventing a date', () => {
    const result = estimate(SUMMER_PROMISE);
    expect(result.ageMin).toBe(12);
    expect(result.ageMax).toBe(12);
    expect(result.season).toBe('summer');
    expect(result.day).toBeNull();
    expect(result.year).toBeNull();
    expect(result.precision).toBe('season_age');
    expect(result.approximate).toBe(true);
  });

  it('keeps "eight or nine" as one estimate spanning two chapters', () => {
    const result = estimate('I was eight or nine, in summer, and we drove to the lake.');
    expect(result.ageMin).toBe(8);
    expect(result.ageMax).toBe(9);
    expect(result.precision).toBe('age_range');
    expect(placementAges(result)).toEqual([8, 9]);
  });

  it('treats a grade as a culture-dependent hint, not a fact', () => {
    const result = estimate('In sixth grade we had a class hamster.');
    expect(result.ageMin).toBe(11);
    expect(result.ageMax).toBe(12);
    expect(result.confidence).toBe('low');
    expect(result.evidence[0]?.reason).toMatch(/School years differ/);
  });

  it('prefers a stated age over a grade that disagrees', () => {
    const result = estimate('In sixth grade, when I was 13, I broke my arm.');
    expect(result.ageMin).toBe(13);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('leaves unknown memories unplaced', () => {
    const result = estimate("I don't know when this was, but the porch smelled like rain.");
    expect(result.precision).toBe('unknown');
    expect(placementAges(result)).toEqual([]);
  });

  it('handles exact dates with a birthday', () => {
    const result = estimate('It was June 14, 2015 and I got my first bike.', {
      ...context,
      birthDate: '2003-03-02',
    });
    expect(result.precision).toBe('exact');
    expect(result.ageMin).toBe(12);
    expect(describeWhen(result)).toBe('June 14, 2015');
  });

  it('gives two possible ages for a year when only the current age is known', () => {
    const result = estimate('Back in 2014 we got a puppy.');
    expect(result.precision).toBe('year');
    expect(result.ageMax! - result.ageMin!).toBeLessThanOrEqual(2);
  });

  it('does not read "may" as a month or "fall" as a season by itself', () => {
    const clues = extractTemporalClues('I may fall asleep if this goes on.');
    expect(clues).toEqual([]);
  });

  it('narrows a relative clue only as a proposal, using a confirmed milestone', () => {
    const base = estimate('This was before my brother was born, in the old apartment.');
    expect(base.precision).toBe('relative');
    const resolved = resolveAnchors(base, [
      { id: 'm1', label: 'My brother Leo was born', ageMin: 9, ageMax: 9 },
    ]);
    expect(resolved.ageMax).toBe(9);
    expect(resolved.explanation).toMatch(/suggestion until you confirm/);
  });

  it('counts back from today for "two winters ago"', () => {
    const result = estimate('Two winters ago the pipes froze.');
    expect(result.ageMin).toBe(20);
    expect(result.ageMax).toBe(21);
    expect(result.season).toBe('winter');
  });
});
