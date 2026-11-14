import type {
  AddVersionInput,
  AnalyzeInput,
  CaptureAnalysisDto,
  CreateMemoryInput,
  EmotionInput,
  ProposedPersonDto,
  TemporalDto,
  VersionComparisonDto,
} from '@living-draft/contracts';
import {
  analyzeAccount,
  CHANGE_LABELS,
  compareVersions,
  describeWhen,
  diffWords,
  findCandidates,
  kinKeyFor,
  placementAges,
  termSet,
  type KnownEvent,
  type PersonMention,
  type TemporalEstimate,
  type VersionComparison,
} from '@living-draft/engine';
import { all, get, run, transaction } from '../../db/database';
import { HttpError, newId, notFound, now } from '../../lib/http';
import { Archive } from '../archive/snapshot';
import type { VersionRow } from '../archive/rows';
import { saveTemporal } from '../archive/temporal';
import {
  charactersByAlias,
  charactersByKin,
  peopleForMemory,
  personKeysFor,
  resolveDecisions,
  writeMentions,
  type ResolvedPerson,
} from '../characters/character.repository';
import { claimMedia } from '../media/media.repository';
import { lifeBookId, requireProfile } from '../profile/profile.repository';

function knownEvents(archive: Archive): KnownEvent[] {
  const events: KnownEvent[] = archive.milestones.map((m) => ({
    id: m.id,
    label: m.title,
    ageMin: m.age_min,
    ageMax: m.age_max,
  }));
  for (const memory of archive.memories) {
    const temporal = archive.temporal(memory.id);
    if (temporal.confirmed && temporal.ageMin !== null) {
      events.push({
        id: memory.id,
        label: memory.title,
        ageMin: temporal.ageMin,
        ageMax: temporal.ageMax,
      });
    }
  }
  return events;
}

export function estimateToDto(estimate: TemporalEstimate, confirmed = false): TemporalDto {
  const placedAges = placementAges(estimate);
  return {
    precision: estimate.precision,
    ageMin: estimate.ageMin,
    ageMax: estimate.ageMax,
    year: estimate.year,
    month: estimate.month,
    day: estimate.day,
    season: estimate.season,
    approximate: estimate.approximate,
    confidence: estimate.confidence,
    explanation: estimate.explanation,
    evidence: estimate.evidence,
    confirmed,
    label: describeWhen(estimate),
    certainty: !placedAges.length ? 'unplaced' : estimate.approximate ? 'approximate' : 'certain',
    placedAges,
  };
}

function proposePerson(person: PersonMention, archive: Archive): ProposedPersonDto {
  const options = archive.characters.map((c) => ({
    characterId: c.id,
    name: c.name,
    relationship: c.relationship,
  }));
  const byAlias = charactersByAlias([...person.surfaces, person.label]);
  const kin = person.kind === 'kin' ? charactersByKin(person.key) : [];
  let suggestion: ProposedPersonDto['suggestion'] = null;

  if (byAlias.length === 1) {
    const match = byAlias[0]!;
    suggestion = {
      characterId: match.id,
      name: match.name,
      reason:
        person.kind === 'role'
          ? `You've called someone “${person.surfaces[0]}” before. It might be a different person this time.`
          : `You've used “${person.surfaces[0]}” for ${match.name} before.`,
    };
  } else if (kin.length === 1) {
    const match = kin[0]!;
    suggestion = {
      characterId: match.id,
      name: match.name,
      reason: `“${person.surfaces[0]}” sounds like ${match.name}. Check that it's the same person.`,
    };
  }

  return {
    key: person.key,
    label: person.label,
    kind: person.kind,
    surfaces: person.surfaces,
    role: person.role,
    roleEvidence: person.roleEvidence,
    relationship: person.relationship ?? (person.kind !== 'name' ? person.label : null),
    suggestion,
    options,
  };
}

export function analyzeCapture(input: AnalyzeInput): CaptureAnalysisDto {
  const profile = requireProfile();
  const archive = Archive.load();
  const analysis = analyzeAccount(
    input.text,
    {
      today: new Date(),
      currentAge: profile.currentAge,
      birthDate: profile.birthDate,
      hemisphere: profile.hemisphere,
      dateOrder: profile.dateOrder,
    },
    knownEvents(archive),
  );

  const people = analysis.people.map((p) => proposePerson(p, archive));

  const milestones = analysis.milestones.map((cue) => {
    const cueTerms = termSet(cue.label);
    const existing = archive.milestones.find(
      (m) => [...termSet(m.title)].filter((t) => cueTerms.has(t)).length >= 2,
    );
    return {
      label: cue.label,
      quote: cue.quote,
      existing: existing ? { id: existing.id, title: existing.title } : null,
    };
  });

  const estimate = analysis.temporal.estimate;
  const captureKeys = [
    ...people.map((p) => p.suggestion?.characterId).filter((id): id is string => !!id),
    ...analysis.people.map((p) => p.key),
    ...analysis.people.map((p) => kinKeyFor(p.label) ?? '').filter(Boolean),
  ];

  const pool = archive.memories
    .filter((m) => m.id !== input.memoryId)
    .map((m) => {
      const doc = archive.doc(m.id);
      return { ...doc, peopleKeys: personKeysFor(doc.people.map((p) => p.characterId)) };
    });

  const matches =
    input.kind === 'memory'
      ? findCandidates(
          {
            text: analysis.readingCopy.text,
            ageMin: estimate.ageMin,
            ageMax: estimate.ageMax,
            season: estimate.season,
            peopleKeys: captureKeys,
            emotionTags: analysis.emotions.map((e) => e.tag),
          },
          pool,
        ).map((match) => ({
          ...match,
          temporalLabel: archive.temporal(match.memoryId).label,
          excerpt: archive.card(match.memoryId).excerpt,
        }))
      : [];

  return {
    readingCopy: analysis.readingCopy.text,
    diff: analysis.readingCopy.diff,
    removedFillers: analysis.readingCopy.removedFillers,
    removedRepeats: analysis.readingCopy.removedRepeats,
    title: analysis.title,
    temporal: estimateToDto(estimate),
    conflicts: estimate.conflicts,
    people,
    emotions: analysis.emotions.map((e) => ({
      tag: e.tag,
      phase: e.phase,
      basis: e.basis,
      quote: e.quote,
      confidence: e.confidence,
    })),
    milestones,
    matches,
    hedges: analysis.hedges,
  };
}

function saveEmotions(memoryId: string, emotions: EmotionInput[]) {
  const timestamp = now();
  for (const emotion of emotions) {
    run(
      `INSERT INTO emotion_tags (id, memory_id, tag, phase, source, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (memory_id, tag, phase) DO UPDATE SET source = excluded.source, evidence = COALESCE(excluded.evidence, evidence)`,
      newId(),
      memoryId,
      emotion.tag.toLowerCase(),
      emotion.phase,
      emotion.source,
      emotion.evidence ?? null,
      timestamp,
    );
  }
}

export function replaceEmotions(memoryId: string, emotions: EmotionInput[]) {
  run('DELETE FROM emotion_tags WHERE memory_id = ?', memoryId);
  saveEmotions(memoryId, emotions);
}

function insertVersion(input: {
  memoryId: string;
  seq: number;
  sourceKind: string;
  mode: string;
  originalText: string;
  readingCopy: string;
  composedText: string;
  audioId?: string | null;
  note?: string | null;
  context?: unknown;
}): string {
  const id = newId();
  const timestamp = now();
  run(
    `INSERT INTO memory_versions (id, memory_id, seq, source_kind, mode, original_text, reading_copy, composed_text, audio_id,
      note, recorded_at, created_at, capture_context) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.memoryId,
    input.seq,
    input.sourceKind,
    input.mode,
    input.originalText,
    input.readingCopy,
    input.composedText,
    input.audioId ?? null,
    input.note ?? null,
    timestamp,
    timestamp,
    input.context ? JSON.stringify(input.context) : null,
  );
  return id;
}

export function linkMilestones(memoryId: string, milestoneIds: string[], replace = false) {
  if (replace) run('DELETE FROM milestone_memories WHERE memory_id = ?', memoryId);
  for (const milestoneId of milestoneIds) {
    run(
      'INSERT OR IGNORE INTO milestone_memories (milestone_id, memory_id) VALUES (?, ?)',
      milestoneId,
      memoryId,
    );
  }
}

export function createMemory(input: CreateMemoryInput): { memoryId: string; versionId: string } {
  requireProfile();
  return transaction(() => {
    const memoryId = newId();
    const timestamp = now();
    run(
      `INSERT INTO memories (id, book_id, title, place, sensitive, review_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ok', ?, ?)`,
      memoryId,
      lifeBookId(),
      input.title,
      input.place ?? null,
      input.sensitive,
      timestamp,
      timestamp,
    );
    const versionId = insertVersion({
      memoryId,
      seq: 1,
      sourceKind: input.sourceKind,
      mode: 'original',
      originalText: input.originalText,
      readingCopy: input.readingCopy,
      composedText: input.readingCopy,
      audioId: input.audioId,
      context: input.context,
    });
    run('UPDATE memories SET current_version_id = ? WHERE id = ?', versionId, memoryId);
    saveTemporal(memoryId, input.temporal);
    writeMentions(memoryId, versionId, input.readingCopy, resolveDecisions(input.people));
    saveEmotions(memoryId, input.emotions);

    const milestoneIds = [...input.milestoneIds];
    for (const milestone of input.newMilestones) {
      const id = newId();
      run(
        'INSERT INTO milestones (id, title, age_min, age_max, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        milestone.title,
        milestone.ageMin,
        milestone.ageMax,
        timestamp,
      );
      milestoneIds.push(id);
    }
    linkMilestones(memoryId, milestoneIds);
    claimMedia(input.mediaIds, 'memory', memoryId, versionId);
    if (input.audioId) claimMedia([input.audioId], 'memory', memoryId, versionId);
    return { memoryId, versionId };
  });
}

export function versionsOf(memoryId: string): VersionRow[] {
  return all<VersionRow>(
    'SELECT * FROM memory_versions WHERE memory_id = ? ORDER BY seq',
    memoryId,
  );
}

function currentVersionRow(memoryId: string): VersionRow {
  const row = get<VersionRow>(
    'SELECT v.* FROM memory_versions v JOIN memories m ON m.current_version_id = v.id WHERE m.id = ?',
    memoryId,
  );
  if (!row) throw notFound('Memory');
  return row;
}

const ROLE_RANK = { central: 3, supporting: 2, mentioned: 1 } as const;

function mergePeople(
  carried: ResolvedPerson[],
  fresh: ResolvedPerson[],
  mode: AddVersionInput['mode'],
): ResolvedPerson[] {
  const merged = new Map(carried.map((p) => [p.characterId, p]));
  for (const person of fresh) {
    const existing = merged.get(person.characterId);
    if (!existing) {
      merged.set(person.characterId, person);
      continue;
    }
    const keepExisting = mode === 'addition' && ROLE_RANK[existing.role] > ROLE_RANK[person.role];
    merged.set(person.characterId, {
      ...existing,
      surfaces: [...new Set([...existing.surfaces, ...person.surfaces])],
      role: keepExisting ? existing.role : person.role,
      roleEvidence: keepExisting
        ? existing.roleEvidence
        : (person.roleEvidence ?? existing.roleEvidence),
    });
  }
  return [...merged.values()];
}

export function comparisonDto(
  earlier: VersionRow,
  later: VersionRow,
  result: VersionComparison,
  laterText: string,
): VersionComparisonDto {
  return {
    earlierVersionId: earlier.id,
    laterVersionId: later.id,
    earlierText: earlier.composed_text,
    laterText,
    changes: result.changes.map((c) => ({ ...c, label: CHANGE_LABELS[c.kind] })),
    counts: result.counts,
    similarity: result.similarity,
    needsReview: result.needsReview,
    diff: diffWords(earlier.composed_text, later.composed_text),
  };
}

export function compareVersionRows(earlier: VersionRow, later: VersionRow): VersionComparisonDto {
  const isAddition = later.mode === 'addition' && later.seq === earlier.seq + 1;
  const laterText = isAddition ? later.reading_copy : later.composed_text;
  const result = compareVersions(
    earlier.composed_text,
    laterText,
    isAddition ? 'addition' : 'retelling',
  );
  return comparisonDto(earlier, later, result, laterText);
}

export function addVersion(memoryId: string, input: AddVersionInput) {
  if (!get('SELECT id FROM memories WHERE id = ?', memoryId)) throw notFound('Memory');
  return transaction(() => {
    const previous = currentVersionRow(memoryId);
    const composed =
      input.mode === 'addition'
        ? `${previous.composed_text.trim()}\n\n${input.readingCopy.trim()}`
        : input.readingCopy.trim();
    const versionId = insertVersion({
      memoryId,
      seq: previous.seq + 1,
      sourceKind: input.sourceKind,
      mode: input.mode,
      originalText: input.originalText,
      readingCopy: input.readingCopy,
      composedText: composed,
      audioId: input.audioId,
      note: input.note,
      context: input.context,
    });

    const people = mergePeople(
      peopleForMemory(memoryId, previous.id),
      resolveDecisions(input.people),
      input.mode,
    );
    writeMentions(memoryId, versionId, composed, people);
    saveEmotions(memoryId, input.emotions);
    claimMedia(input.mediaIds, 'memory', memoryId, versionId);
    if (input.audioId) claimMedia([input.audioId], 'memory', memoryId, versionId);

    const later = get<VersionRow>('SELECT * FROM memory_versions WHERE id = ?', versionId)!;
    const comparison = compareVersionRows(previous, later);
    const flagged = comparison.changes.filter((c) =>
      ['uncertain', 'contradictory', 'corrected'].includes(c.kind),
    );
    const explicit = input.mode === 'correction' || input.mode === 'edit';

    if (flagged.length && !explicit) {
      for (const change of flagged) {
        run(
          `INSERT INTO review_items (id, memory_id, earlier_version_id, later_version_id, change_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'open', ?)`,
          newId(),
          memoryId,
          previous.id,
          versionId,
          JSON.stringify(change),
          now(),
        );
      }
    }
    run(
      `UPDATE memories SET current_version_id = ?, updated_at = ?,
        review_status = CASE WHEN EXISTS (SELECT 1 FROM review_items WHERE memory_id = ? AND status = 'open') THEN 'needs_review' ELSE 'ok' END
       WHERE id = ?`,
      versionId,
      now(),
      memoryId,
      memoryId,
    );
    return { memoryId, versionId, comparison };
  });
}

export function restoreVersion(memoryId: string, versionId: string) {
  const target = get<VersionRow>(
    'SELECT * FROM memory_versions WHERE id = ? AND memory_id = ?',
    versionId,
    memoryId,
  );
  if (!target) throw notFound('Version');
  return transaction(() => {
    const previous = currentVersionRow(memoryId);
    if (previous.id === target.id) throw new HttpError(400, 'That version is already current');
    const restoredId = insertVersion({
      memoryId,
      seq: previous.seq + 1,
      sourceKind: 'typing',
      mode: 'restore',
      originalText: target.original_text,
      readingCopy: target.reading_copy,
      composedText: target.composed_text,
      note: `Restored the telling from ${target.recorded_at.slice(0, 10)}`,
    });
    writeMentions(
      memoryId,
      restoredId,
      target.composed_text,
      peopleForMemory(memoryId, previous.id),
    );
    run(
      'UPDATE memories SET current_version_id = ?, updated_at = ? WHERE id = ?',
      restoredId,
      now(),
      memoryId,
    );
    return { memoryId, versionId: restoredId };
  });
}
