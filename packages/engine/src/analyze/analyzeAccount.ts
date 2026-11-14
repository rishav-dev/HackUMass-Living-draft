import { makeReadingCopy } from '../cleanup/readingCopy';
import { detectEmotions } from '../emotions/detect';
import { detectPeople } from '../people/detect';
import { extractTemporalClues, findHedges } from '../temporal/clues';
import { estimateTemporal, resolveAnchors } from '../temporal/estimate';
import type { AccountAnalysis, KnownEvent, TemporalContext } from '../types';
import { detectMilestoneCues } from './milestones';
import { suggestTitle } from './title';

export function analyzeAccount(
  original: string,
  context: TemporalContext,
  knownEvents: KnownEvent[] = [],
): AccountAnalysis {
  const readingCopy = makeReadingCopy(original);
  const text = readingCopy.text;
  const clues = extractTemporalClues(text, { dateOrder: context.dateOrder });
  const estimate = resolveAnchors(estimateTemporal(clues, context), knownEvents);
  const people = detectPeople(text);
  const emotions = detectEmotions(text);
  return {
    readingCopy,
    title: suggestTitle(text, people, estimate.season),
    temporal: { clues, estimate },
    people,
    emotions,
    milestones: detectMilestoneCues(text),
    hedges: findHedges(text),
  };
}
