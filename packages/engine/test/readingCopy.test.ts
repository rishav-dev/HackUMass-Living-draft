import { describe, expect, it } from 'vitest';
import { makeReadingCopy } from '../src';
import { SUMMER_PROMISE } from './samples';

describe('makeReadingCopy', () => {
  it('drops fillers and stutters but keeps the narrator’s words', () => {
    const copy = makeReadingCopy(
      'um so i i went to the uh lake with my dad and, you know, it was cold',
    );
    expect(copy.text).toBe('So I went to the lake with my dad and, it was cold.');
    expect(copy.removedFillers).toBeGreaterThan(0);
    expect(copy.removedRepeats).toBe(1);
  });

  it('keeps hesitation that carries meaning', () => {
    const copy = makeReadingCopy("I think it was summer. Maybe. I'm not totally sure");
    expect(copy.text).toContain('I think');
    expect(copy.text).toContain('Maybe');
    expect(copy.text).toContain("I'm not totally sure");
  });

  it('records what changed so the original can be restored', () => {
    const copy = makeReadingCopy(SUMMER_PROMISE);
    expect(
      copy.diff.some((segment) => segment.type === 'removed' && /um/i.test(segment.text)),
    ).toBe(true);
    expect(copy.text).toContain('Mom promised');
  });

  it('leaves legitimate doubled words alone', () => {
    expect(makeReadingCopy('She had had enough.').text).toBe('She had had enough.');
  });
});
