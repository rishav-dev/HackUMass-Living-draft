import { describe, expect, it } from 'vitest';
import { detectEmotions } from '../src';
import { SUMMER_PROMISE } from './samples';

describe('detectEmotions', () => {
  it('allows several emotions at once', () => {
    const tags = detectEmotions(SUMMER_PROMISE).map((e) => e.tag);
    expect(tags).toContain('sad');
    expect(tags).toContain('angry');
  });

  it('separates how it felt then from how it feels now', () => {
    const signals = detectEmotions(
      'I was so nervous on stage. Looking back, I feel proud of that kid.',
    );
    expect(signals.find((s) => s.tag === 'anxious')?.phase).toBe('then');
    expect(signals.find((s) => s.tag === 'proud')?.phase).toBe('now');
  });

  it('skips negated feelings', () => {
    const tags = detectEmotions("I wasn't scared at all.").map((e) => e.tag);
    expect(tags).not.toContain('anxious');
  });

  it('marks feelings read from actions as lower confidence than stated ones', () => {
    const [cried] = detectEmotions('I cried the whole way home.');
    expect(cried?.basis).toBe('described');
    expect(cried!.confidence).toBeLessThan(0.7);
  });
});

describe('detectMotifs', () => {
  it('picks the setting a memory is about', async () => {
    const { detectMotifs } = await import('../src');
    expect(detectMotifs('I finally saw the ocean and the waves were so loud')[0]).toBe('ocean');
    expect(detectMotifs('At my piano recital my hands shook on stage')).toContain('stage');
    expect(detectMotifs('Nothing much happened')).toEqual(['sky']);
  });
});
