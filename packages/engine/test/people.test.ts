import { describe, expect, it } from 'vitest';
import { detectPeople, kinKeyFor } from '../src';
import { SUMMER_DAD_ADDITION, SUMMER_PROMISE } from './samples';

describe('detectPeople', () => {
  it('finds Mom as central in the summer promise', () => {
    const people = detectPeople(SUMMER_PROMISE);
    const mom = people.find((p) => p.key === 'mom');
    expect(mom?.role).toBe('central');
    expect(mom?.spans.length).toBe(3);
    expect(mom?.roleEvidence).toMatch(/promised|argued/);
  });

  it('marks Dad as supporting when he sides with someone', () => {
    const people = detectPeople(SUMMER_DAD_ADDITION);
    expect(people.find((p) => p.key === 'dad')?.role).toBe('supporting');
  });

  it('groups different words for the same kin role under one key', () => {
    expect(kinKeyFor('Mummy')).toBe('mom');
    expect(kinKeyFor('my mother')).toBe('mom');
    expect(kinKeyFor('mom')).toBe('mom');
  });

  it('marks a background presence as mentioned', () => {
    const people = detectPeople(
      'I dropped a glass while my mom was in the kitchen. It shattered everywhere.',
    );
    expect(people.find((p) => p.key === 'mom')?.role).toBe('mentioned');
  });

  it('picks up names, including titled ones', () => {
    const people = detectPeople(
      'Ms. Alvarez let me stay in at recess, and later Priya sat with me.',
    );
    const keys = people.map((p) => p.label);
    expect(keys).toContain('Ms. Alvarez');
    expect(keys).toContain('Priya');
  });

  it('folds "my brother Leo" into one person with a relationship', () => {
    const people = detectPeople('My brother Leo cried the whole drive home.');
    expect(people).toHaveLength(1);
    expect(people[0]?.label).toBe('Leo');
    expect(people[0]?.relationship).toBe('Brother');
  });

  it('treats a capitalized word after "to" or "in" as a place, not a person', () => {
    const people = detectPeople('We drove to Maine with Priya and stayed in Portland.');
    expect(people.map((p) => p.label)).toEqual(['Priya']);
  });

  it('does not treat months, days or the narrator as people', () => {
    const people = detectPeople('On Monday in July I went outside. It was hot.');
    expect(people).toEqual([]);
  });
});
