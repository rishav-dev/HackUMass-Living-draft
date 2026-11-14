import { compareVersions } from '../evolution/compare';
import { findCandidates } from '../retrieval/matching';
import { extractTemporalClues } from '../temporal/clues';
import { estimateTemporal, placementAges } from '../temporal/estimate';
import type { DetailChange } from '../types';
import { ARCHIVE, CHANGE_CASES, MATCH_CASES, TEMPORAL_CASES } from './fixtures';

export interface EvaluationReport {
  generatedAt: string;
  matching: {
    total: number;
    expectedSame: number;
    predictedSame: number;
    correctSame: number;
    precision: number;
    recall: number;
    separateKeptSeparate: number;
    expectedSeparate: number;
    misses: Array<{
      id: string;
      label: string;
      expected: string | null;
      got: string | null;
      score: number | null;
    }>;
  };
  changes: {
    total: number;
    correct: number;
    accuracy: number;
    rows: Array<{ id: string; label: string; expected: string; got: string; ok: boolean }>;
  };
  temporal: {
    total: number;
    correct: number;
    accuracy: number;
    rows: Array<{ id: string; text: string; expected: string; got: string; ok: boolean }>;
  };
}

const PRIORITY: DetailChange['kind'][] = [
  'corrected',
  'contradictory',
  'uncertain',
  'reflected',
  'changed',
  'new',
  'omitted',
  'consistent',
];

function headline(changes: DetailChange[]): string {
  for (const kind of PRIORITY) if (changes.some((c) => c.kind === kind)) return kind;
  return 'none';
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export function runEvaluation(): EvaluationReport {
  const archive = ARCHIVE.map((a) => ({
    id: a.id,
    title: a.title,
    text: a.text,
    ageMin: a.ageMin,
    ageMax: a.ageMax,
    season: a.season as never,
    people: a.people.map((p) => ({ characterId: p, name: p, role: 'central' as const })),
    emotions: [],
    peopleKeys: a.people,
  }));

  let predictedSame = 0;
  let correctSame = 0;
  let separateKept = 0;
  const misses: EvaluationReport['matching']['misses'] = [];
  for (const testCase of MATCH_CASES) {
    const [top] = findCandidates(
      {
        text: testCase.text,
        ageMin: testCase.ageMin,
        ageMax: testCase.ageMax,
        season: testCase.season,
        peopleKeys: testCase.people,
        emotionTags: [],
      },
      archive,
    );
    const predicted = top?.verdict === 'likely_same' ? top.memoryId : null;
    if (predicted) predictedSame += 1;
    if (predicted && predicted === testCase.expected) correctSame += 1;
    if (!testCase.expected && !predicted) separateKept += 1;
    if (predicted !== testCase.expected) {
      misses.push({
        id: testCase.id,
        label: testCase.label,
        expected: testCase.expected,
        got: predicted,
        score: top?.score ?? null,
      });
    }
  }
  const expectedSame = MATCH_CASES.filter((c) => c.expected).length;

  const changeRows = CHANGE_CASES.map((testCase) => {
    const result = compareVersions(testCase.earlier, testCase.later, testCase.mode);
    const got = headline(result.changes);
    return {
      id: testCase.id,
      label: testCase.label,
      expected: testCase.expected,
      got,
      ok: got === testCase.expected,
    };
  });

  const context = {
    today: new Date(Date.UTC(2026, 10, 13)),
    currentAge: 23,
    hemisphere: 'north' as const,
  };
  const temporalRows = TEMPORAL_CASES.map((testCase) => {
    const estimate = estimateTemporal(extractTemporalClues(testCase.text), context);
    const placed = placementAges(estimate).length > 0;
    const range = (min: number | null, max: number | null) =>
      min === null ? 'unplaced' : `${min}–${max}`;
    const ok =
      estimate.ageMin === testCase.ageMin &&
      estimate.ageMax === testCase.ageMax &&
      placed === testCase.placed;
    return {
      id: testCase.id,
      text: testCase.text,
      expected: `${range(testCase.ageMin, testCase.ageMax)}${testCase.placed ? '' : ' (not on the path)'}`,
      got: `${range(estimate.ageMin, estimate.ageMax)}${placed ? '' : ' (not on the path)'}`,
      ok,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    matching: {
      total: MATCH_CASES.length,
      expectedSame,
      predictedSame,
      correctSame,
      precision: round(predictedSame ? correctSame / predictedSame : 0),
      recall: round(expectedSame ? correctSame / expectedSame : 0),
      separateKeptSeparate: separateKept,
      expectedSeparate: MATCH_CASES.length - expectedSame,
      misses,
    },
    changes: {
      total: changeRows.length,
      correct: changeRows.filter((r) => r.ok).length,
      accuracy: round(changeRows.filter((r) => r.ok).length / changeRows.length),
      rows: changeRows,
    },
    temporal: {
      total: temporalRows.length,
      correct: temporalRows.filter((r) => r.ok).length,
      accuracy: round(temporalRows.filter((r) => r.ok).length / temporalRows.length),
      rows: temporalRows,
    },
  };
}
