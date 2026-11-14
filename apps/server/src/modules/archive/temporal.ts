import type { Certainty, EvidenceDto, TemporalDto, TemporalInput } from '@living-draft/contracts';
import { describeWhen, placementAges } from '@living-draft/engine';
import { get, run } from '../../db/database';
import { json, newId, now } from '../../lib/http';
import type { TemporalRow } from './rows';

export function toTemporalDto(row: TemporalRow | undefined): TemporalDto {
  if (!row) {
    return {
      precision: 'unknown',
      ageMin: null,
      ageMax: null,
      year: null,
      month: null,
      day: null,
      season: null,
      approximate: true,
      confidence: 'low',
      explanation: '',
      evidence: [],
      confirmed: false,
      label: 'Not placed yet',
      certainty: 'unplaced',
      placedAges: [],
    };
  }
  const shape = {
    precision: row.precision as TemporalDto['precision'],
    ageMin: row.age_min,
    ageMax: row.age_max,
    year: row.year,
    month: row.month,
    day: row.day,
    season: row.season,
    approximate: !!row.approximate,
  };
  const placedAges = placementAges(shape);
  const certainty: Certainty = !placedAges.length
    ? 'unplaced'
    : shape.approximate
      ? 'approximate'
      : 'certain';
  return {
    ...shape,
    confidence: row.confidence,
    explanation: row.explanation,
    evidence: json<EvidenceDto[]>(row.evidence_json, []),
    confirmed: !!row.confirmed,
    label: describeWhen(shape),
    certainty,
    placedAges,
  };
}

export function currentTemporal(memoryId: string): TemporalRow | undefined {
  return get<TemporalRow>(
    'SELECT * FROM temporal_estimates WHERE memory_id = ? AND superseded_at IS NULL ORDER BY created_at DESC LIMIT 1',
    memoryId,
  );
}

export function saveTemporal(memoryId: string, input: TemporalInput) {
  const timestamp = now();
  run(
    'UPDATE temporal_estimates SET superseded_at = ? WHERE memory_id = ? AND superseded_at IS NULL',
    timestamp,
    memoryId,
  );
  run(
    `INSERT INTO temporal_estimates (id, memory_id, precision, age_min, age_max, year, month, day, season, approximate,
      confidence, explanation, evidence_json, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    memoryId,
    input.precision,
    input.ageMin,
    input.ageMax,
    input.year,
    input.month,
    input.day,
    input.season,
    input.approximate,
    input.confidence,
    input.explanation,
    JSON.stringify(input.evidence),
    input.confirmed,
    timestamp,
  );
}
