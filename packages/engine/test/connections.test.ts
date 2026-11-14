import { describe, expect, it } from 'vitest';
import { answerQuestion, compareMemories, suggestConnections } from '../src';
import { doc } from './samples';

const leftOut = doc({
  id: 'lunch',
  title: 'The lunch table',
  text: 'In third grade nobody would sit with me at lunch. I ate alone by the windows for weeks and felt so lonely.',
  ageMin: 8,
  ageMax: 9,
  emotions: [{ tag: 'sad', phase: 'then' }],
});

const newKid = doc({
  id: 'new-kid',
  title: 'The new kid',
  text: 'Junior year a new girl was eating alone, so I sat with her and asked about her old school. We talked the whole lunch.',
  ageMin: 16,
  ageMax: 16,
  emotions: [{ tag: 'happy', phase: 'then' }],
});

const oceanWish = doc({
  id: 'wish',
  title: 'Drawing the ocean',
  text: 'I drew the ocean every day that year. I wished I could see the ocean for real someday.',
  ageMin: 10,
  ageMax: 10,
  emotions: [{ tag: 'excited', phase: 'then' }],
});

const oceanTrip = doc({
  id: 'ocean',
  title: 'The ocean',
  text: 'On the trip to Maine I finally saw the ocean. It was louder than I imagined.',
  ageMin: 19,
  ageMax: 19,
  emotions: [{ tag: 'happy', phase: 'then' }],
});

const quiet = doc({
  id: 'quiet',
  title: 'College argument',
  text: 'Dad said I had to study engineering. I stayed quiet and nodded even though I hated it.',
  ageMin: 17,
  ageMax: 17,
  emotions: [{ tag: 'sad', phase: 'then' }],
});

const spoke = doc({
  id: 'spoke',
  title: 'Asking for the raise',
  text: 'My boss said the raise had to wait. This time I spoke up and told her what I had done all year.',
  ageMin: 22,
  ageMax: 22,
  emotions: [{ tag: 'proud', phase: 'then' }],
});

describe('suggestConnections', () => {
  const suggestions = suggestConnections([leftOut, newKid, oceanWish, oceanTrip, quiet, spoke]);
  const types = (a: string, b: string) =>
    suggestions
      .filter((s) => s.memoryIds.includes(a) && s.memoryIds.includes(b))
      .map((s) => s.type);

  it('finds the full circle from eating alone to sitting with the new kid', () => {
    expect(types('lunch', 'new-kid')).toContain('full_circle');
  });

  it('finds the wish that came true', () => {
    expect(types('wish', 'ocean')).toContain('wish_fulfilled');
  });

  it('finds a broken pattern from staying quiet to speaking up', () => {
    expect(types('quiet', 'spoke')).toContain('breaking_pattern');
  });

  it('cites a passage from every memory in the link', () => {
    for (const suggestion of suggestions) {
      for (const id of suggestion.memoryIds) {
        expect(suggestion.evidence.some((e) => e.memoryId === id && e.quote.length > 0)).toBe(true);
      }
    }
  });
});

describe('compareMemories', () => {
  it('ties every shared term back to a passage', () => {
    const result = compareMemories([leftOut, newKid]);
    for (const shared of result.sharedTerms) {
      expect(shared.quotes.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('answerQuestion', () => {
  const mom = { characterId: 'mom', name: 'Mom', role: 'central' as const };
  const memories = [
    doc({
      id: 'a',
      title: 'Promise',
      text: 'Mom promised a trip and then cancelled it. I was angry.',
      ageMin: 12,
      ageMax: 12,
      people: [mom],
      emotions: [{ tag: 'angry', phase: 'then' }],
    }),
    doc({
      id: 'b',
      title: 'Moving day',
      text: 'Mom drove four hours to help me move in. I was so grateful.',
      ageMin: 21,
      ageMax: 21,
      people: [mom],
      emotions: [{ tag: 'grateful', phase: 'then' }],
    }),
  ];
  const context = {
    memories,
    connections: [],
    characters: [{ id: 'mom', name: 'Mom', aliases: ['mother', 'mummy'] }],
  };

  it('answers a relationship question with citations and an honest frame', () => {
    const answer = answerQuestion('How has my relationship with Mom changed over time?', context);
    expect(answer.intent).toBe('character');
    expect(answer.citations.map((c) => c.memoryId).sort()).toEqual(['a', 'b']);
    expect(answer.lines.some((l) => /how you remember Mom/.test(l.text))).toBe(true);
    expect(answer.limitations.join(' ')).toMatch(/Nothing recorded between 13 and 20/);
  });

  it('admits when there is no evidence', () => {
    const answer = answerQuestion('What do I remember about the circus?', {
      ...context,
      memories: [],
    });
    expect(answer.citations).toEqual([]);
    expect(answer.lines[0]?.text).toMatch(/no memories/i);
  });
});
