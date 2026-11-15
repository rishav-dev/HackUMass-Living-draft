import { describe, expect, it } from 'vitest';
import { readJson } from '../src/modules/ai/json';
import { likelySources, nameRefs, plain, refsIn } from '../src/modules/ai/prose';

describe('reading model replies', () => {
  it('parses a complete reply with text around it', () => {
    expect(readJson<{ a: number }>('Sure! {"a": 1} hope that helps')).toEqual({ a: 1 });
  });

  it('keeps the finished parts of a reply that ran out of room', () => {
    const cut = '{"paragraphs": ["First one.", "Second one.", "Third one that never got fin';
    expect(readJson<{ paragraphs: string[] }>(cut)).toEqual({
      paragraphs: ['First one.', 'Second one.'],
    });
  });

  it('keeps finished objects inside an array', () => {
    const cut = '{"observations": [{"kind": "alike", "text": "Both."}, {"kind": "diff';
    expect(readJson<{ observations: unknown[] }>(cut)).toEqual({
      observations: [{ kind: 'alike', text: 'Both.' }],
    });
  });

  it('gives up when nothing finished', () => {
    expect(() => readJson('{"headline": "half a sente')).toThrow(/stopped/);
  });
});

describe('tidying model prose', () => {
  const titles = ['Not making the team', 'Asking for the raise'];
  const titleFor = (n: number) => titles[n - 1];

  it('names memories used as part of the sentence and drops trailing citations', () => {
    expect(nameRefs('In [1], you never asked why.', titleFor)).toBe(
      'In “Not making the team”, you never asked why.',
    );
    expect(nameRefs('[2] went differently.', titleFor)).toBe(
      '“Asking for the raise” went differently.',
    );
    expect(nameRefs('You stayed quiet [1].', titleFor)).toBe('You stayed quiet.');
    expect(nameRefs('Between [1, 2] something shifted.', titleFor)).toBe(
      'Between “Not making the team” and “Asking for the raise” something shifted.',
    );
  });

  it('collects every reference number', () => {
    expect(refsIn('One [1] and [2, 3].')).toEqual([1, 2, 3]);
  });

  it('swaps dashes for plainer punctuation', () => {
    expect(plain('He said nothing — not one word — the whole drive.')).toBe(
      'He said nothing, not one word, the whole drive.',
    );
    expect(plain("You didn't fail — you showed up. Then it rained.")).toBe(
      "You didn't fail: you showed up. Then it rained.",
    );
  });

  it('finds the memories a paragraph is drawing on', () => {
    const sources = [
      {
        id: 'chem',
        title: 'Failing my first chemistry exam',
        text: 'I got a 52 on the first chemistry exam. Dad laughed and said, "Good. Now you know where the ground is."',
      },
      {
        id: 'drive',
        title: 'Failing my driving test',
        text: 'I failed my driving test on the parallel parking. Dad said, "Well, now you know the route."',
      },
      { id: 'other', title: 'Snow day', text: 'We built a snowman on the quad.' },
    ];
    const paragraph =
      "When you failed chemistry, he laughed and said 'Good. Now you know where the ground is.'";
    expect(likelySources(paragraph, sources)).toEqual(['chem']);
  });
});
