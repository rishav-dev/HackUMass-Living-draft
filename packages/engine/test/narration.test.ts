import { describe, expect, it } from 'vitest';
import { toThirdPerson } from '../src';

describe('toThirdPerson', () => {
  it('names the narrator once, then uses they when no pronouns are given', () => {
    expect(
      toThirdPerson('I felt so hurt and I argued with Mom. I was twelve.', { name: 'Kinjal' }),
    ).toBe('Kinjal felt so hurt and they argued with Mom. They were twelve.');
  });

  it('agrees verbs with she and he', () => {
    expect(
      toThirdPerson('I remember the lake. I still miss it, and I don’t know why.', {
        name: 'Kinjal Shah',
        pronouns: 'she/her',
      }),
    ).toBe('Kinjal remembers the lake. She still misses it, and she doesn’t know why.');
  });

  it('keeps natural contractions and possessives', () => {
    expect(
      toThirdPerson("I'm not sure Mom promised. My brother says I've got it wrong.", {
        name: 'Kinjal',
        pronouns: 'she/her',
      }),
    ).toBe("Kinjal is not sure Mom promised. Her brother says she's got it wrong.");
  });

  it('leaves quoted dialogue alone', () => {
    expect(
      toThirdPerson('Mom said, “I am proud of you,” and I cried.', {
        name: 'Kinjal',
        pronouns: 'he/him',
      }),
    ).toBe('Mom said, “I am proud of you,” and Kinjal cried.');
  });

  it('handles someone and me', () => {
    expect(
      toThirdPerson('Mom and I drove to the lake. She waited for Dad and me.', {
        name: 'Kinjal',
        pronouns: 'she/her',
      }),
    ).toBe('Mom and Kinjal drove to the lake. She waited for Dad and Kinjal.');
  });
});
