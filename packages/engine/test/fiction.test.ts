import { describe, expect, it } from 'vitest';
import { suggestCharacterNames, suggestEchoes } from '../src';

describe('suggestCharacterNames', () => {
  it('finds names in the middle of sentences and skips ordinary capitals', () => {
    const text =
      'The lighthouse was dark when Elena reached it. She called for Tomas twice. Nobody answered. In March the storms came.';
    expect(suggestCharacterNames(text, [])).toEqual(['Elena', 'Tomas']);
  });

  it('leaves out characters the book already has', () => {
    const text = 'Elena waited. Then Marguerite walked in with Elena.';
    expect(suggestCharacterNames(text, ['Elena'])).toEqual(['Marguerite']);
  });
});

describe('suggestEchoes', () => {
  const scenes = [
    {
      id: 'a',
      title: 'The broken compass',
      text: 'Elena finds a broken brass compass in the lighthouse drawer.',
      order: 1,
    },
    {
      id: 'b',
      title: 'Market day',
      text: 'Tomas sells fish and argues about the price of salt.',
      order: 2,
    },
  ];

  it('suggests a callback to an earlier scene with the same image', () => {
    const later = {
      id: 'c',
      title: 'True north',
      text: 'Years later the brass compass from the lighthouse drawer finally points somewhere.',
      order: 5,
    };
    const [first] = suggestEchoes(later, scenes);
    expect(first?.sceneId).toBe('a');
    expect(first?.type).toBe('callback');
    expect(first?.shared).toContain('compass');
  });

  it('stays quiet when nothing really matches', () => {
    expect(
      suggestEchoes({ id: 'd', title: 'Rain', text: 'It rained all week.', order: 3 }, scenes),
    ).toEqual([]);
  });
});
