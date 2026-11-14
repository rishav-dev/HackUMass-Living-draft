import type { Precision, TemporalDto } from '@living-draft/contracts';
import { describeWhen, placementAges } from '@living-draft/engine';

export function derivePrecision(t: TemporalDto): Precision {
  if (t.year && t.month && t.day) return 'exact';
  if (t.year && t.month) return 'month';
  if (t.year) return 'year';
  if (t.ageMin !== null) {
    if (t.ageMax !== null && t.ageMax !== t.ageMin) return 'age_range';
    return t.season || t.month ? 'season_age' : 'age';
  }
  return t.precision === 'relative' ? 'relative' : 'unknown';
}

export function finalizeTemporal(t: TemporalDto): TemporalDto {
  const precision = derivePrecision(t);
  const next = {
    ...t,
    precision,
    ageMax: t.ageMin !== null && (t.ageMax === null || t.ageMax < t.ageMin) ? t.ageMin : t.ageMax,
  };
  const placedAges = placementAges(next);
  return {
    ...next,
    label: describeWhen(next),
    placedAges,
    certainty: !placedAges.length ? 'unplaced' : next.approximate ? 'approximate' : 'certain',
  };
}
