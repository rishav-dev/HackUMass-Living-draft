import { describe, expect, it } from 'vitest';
import { compareVersions } from '../src';
import { SUMMER_DAD_ADDITION, SUMMER_PROMISE, SUMMER_UNSURE } from './samples';

describe('compareVersions', () => {
  it('treats the Dad detail as an addition, not a contradiction', () => {
    const result = compareVersions(SUMMER_PROMISE, SUMMER_DAD_ADDITION, 'addition');
    expect(result.counts.contradictory).toBe(0);
    expect(result.counts.new + result.counts.consistent + result.counts.changed).toBeGreaterThan(0);
    expect(result.counts.omitted).toBe(0);
  });

  it('flags the promise as less certain, not as a lie', () => {
    const result = compareVersions(SUMMER_PROMISE, SUMMER_UNSURE, 'retelling');
    const promise = result.changes.find((c) => c.later?.text.includes('promised'));
    expect(promise?.kind).toBe('uncertain');
    expect(promise?.earlier?.text).toMatch(/promised/);
    expect(result.needsReview).toBe(true);
  });

  it('treats a changed interpretation as a different perspective', () => {
    const result = compareVersions(
      'I was sad that Mom worked late every night.',
      'Looking back, I see it differently. Mom worked late every night so we could stay in that house.',
      'retelling',
    );
    expect(result.counts.reflected).toBeGreaterThan(0);
    expect(result.counts.contradictory).toBe(0);
  });

  it('catches a flipped fact as a possible inconsistency', () => {
    const result = compareVersions(
      'Grandpa came to my recital.',
      "Grandpa didn't come to my recital.",
      'retelling',
    );
    expect(result.changes[0]?.kind).toBe('contradictory');
  });

  it('catches different numbers for the same thing', () => {
    const result = compareVersions(
      'I finished my homework in four days.',
      'I finished my homework in two days.',
      'retelling',
    );
    expect(result.changes[0]?.kind).toBe('contradictory');
  });

  it('respects an explicit correction', () => {
    const result = compareVersions(
      'We drove to Ohio.',
      'I was wrong before, we drove to Michigan.',
      'retelling',
    );
    expect(result.counts.corrected).toBe(1);
  });

  it('notes details left out of a retelling without calling them changed', () => {
    const result = compareVersions(
      'We went to the lake. Dad caught a fish.',
      'We went to the lake.',
      'retelling',
    );
    expect(result.counts.omitted).toBe(1);
    expect(result.changes.find((c) => c.kind === 'omitted')?.note).toMatch(/doesn’t mean/);
  });
});
