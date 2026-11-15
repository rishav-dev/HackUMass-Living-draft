import type {
  CaptureContextDto,
  MemoryCardDto,
  MemoryDetailDto,
  MentionDto,
  ResolutionDto,
  ResolutionInput,
  ReviewItemDto,
  SearchQuery,
  UpdateMemoryInput,
} from '@living-draft/contracts';
import { CHANGE_LABELS, TermIndex, type DetailChange } from '@living-draft/engine';
import { all, get, run, transaction } from '../../db/database';
import { HttpError, json, newId, notFound, now } from '../../lib/http';
import { forgetDayWeather } from '../weather/weather.service';
import { Archive, sortChronologically } from '../archive/snapshot';
import type { MentionRow, VersionRow } from '../archive/rows';
import { currentTemporal, saveTemporal } from '../archive/temporal';
import {
  linkMilestones,
  replaceEmotions,
  restoreVersion,
  versionsOf,
} from '../capture/capture.service';
import { peopleForMemory, writeMentions } from '../characters/character.repository';
import { claimMedia, deleteMediaFor, findMedia, toMediaDto } from '../media/media.repository';
import { deleteArt } from '../art/art.service';
import { reflectionsFor } from '../reflections/reflection.service';

export function memoryDetail(memoryId: string): MemoryDetailDto {
  const archive = Archive.load();
  const memory = archive.memory(memoryId);
  if (!memory) throw notFound('Memory');
  const card = archive.card(memoryId);
  const versions = versionsOf(memoryId);

  const mentions: MentionDto[] = archive
    .mentions(memoryId)
    .filter((m) => m.span_start >= 0)
    .map((m: MentionRow) => ({
      id: m.id,
      versionId: m.version_id,
      characterId: m.character_id,
      characterName: m.character_name,
      surface: m.surface,
      start: m.span_start,
      end: m.span_end,
      role: m.role,
      roleEvidence: m.role_evidence,
      confirmed: !!m.confirmed,
    }));

  const resolutions = all<{
    id: string;
    earlier_version_id: string;
    later_version_id: string;
    change_kind: string;
    earlier_text: string | null;
    later_text: string | null;
    resolution: string;
    created_at: string;
  }>(
    'SELECT * FROM version_resolutions WHERE memory_id = ? ORDER BY created_at',
    memoryId,
  ).map<ResolutionDto>((r) => ({
    id: r.id,
    earlierVersionId: r.earlier_version_id,
    laterVersionId: r.later_version_id,
    changeKind: r.change_kind,
    earlierText: r.earlier_text,
    laterText: r.later_text,
    resolution: r.resolution,
    createdAt: r.created_at,
  }));

  const pendingReview = all<{
    id: string;
    change_json: string;
    earlier_version_id: string;
    later_version_id: string;
  }>(
    "SELECT * FROM review_items WHERE memory_id = ? AND status = 'open' ORDER BY created_at",
    memoryId,
  ).map<ReviewItemDto>((row) => {
    const change = json<DetailChange>(row.change_json, {
      kind: 'changed',
      earlier: null,
      later: null,
      note: '',
      sharedTerms: [],
    });
    return {
      ...change,
      id: row.id,
      label: CHANGE_LABELS[change.kind],
      earlierVersionId: row.earlier_version_id,
      laterVersionId: row.later_version_id,
    };
  });

  return {
    ...card,
    readingCopy: archive.text(memoryId),
    place: memory.place,
    time: memory.time_kind ? { kind: memory.time_kind, hint: memory.time_hint ?? '' } : null,
    questions: all<{
      id: string;
      version_id: string | null;
      question: string;
      answer: string | null;
      asked_at: string;
      answered_at: string | null;
    }>('SELECT * FROM memory_questions WHERE memory_id = ? ORDER BY asked_at', memoryId).map(
      (q) => ({
        id: q.id,
        versionId: q.version_id,
        question: q.question,
        answer: q.answer,
        askedAt: q.asked_at,
        answeredAt: q.answered_at,
      }),
    ),
    themeEvidence: all<{ theme: string; evidence: string | null }>(
      'SELECT theme, evidence FROM memory_themes WHERE memory_id = ? ORDER BY theme',
      memoryId,
    ),
    placeList: all<{ id: string; name: string; kind: string | null }>(
      `SELECT p.id, p.name, p.kind FROM memory_places mp JOIN places p ON p.id = mp.place_id
       WHERE mp.memory_id = ? ORDER BY p.name`,
      memoryId,
    ),
    currentVersionId: memory.current_version_id ?? '',
    versions: versions.map((v: VersionRow) => {
      const audio = v.audio_id ? findMedia(v.audio_id) : undefined;
      return {
        id: v.id,
        seq: v.seq,
        sourceKind: v.source_kind,
        mode: v.mode,
        originalText: v.original_text,
        readingCopy: v.reading_copy,
        recordedAt: v.recorded_at,
        note: v.note,
        audio: audio ? toMediaDto(audio) : null,
        context: v.capture_context ? (JSON.parse(v.capture_context) as CaptureContextDto) : null,
      };
    }),
    mentions,
    media: archive.media(memoryId),
    connections: archive
      .connectionsFor(memoryId)
      .filter((c) => c.status !== 'dismissed')
      .map((c) => archive.connectionDto(c)),
    milestones: archive.milestoneIds(memoryId).map((id) => {
      const milestone = archive.milestones.find((m) => m.id === id)!;
      return { id, title: milestone.title };
    }),
    resolutions,
    reflections: reflectionsFor(memoryId),
    pendingReview,
  };
}

export function updateMemory(memoryId: string, input: UpdateMemoryInput) {
  if (!get('SELECT id FROM memories WHERE id = ?', memoryId)) throw notFound('Memory');
  transaction(() => {
    if (input.title !== undefined)
      run('UPDATE memories SET title = ? WHERE id = ?', input.title, memoryId);
    if (input.place !== undefined)
      run('UPDATE memories SET place = ? WHERE id = ?', input.place, memoryId);
    if (input.place !== undefined || input.temporal) forgetDayWeather(memoryId);
    if (input.sensitive !== undefined)
      run('UPDATE memories SET sensitive = ? WHERE id = ?', input.sensitive, memoryId);
    if (input.temporal) saveTemporal(memoryId, input.temporal);
    if (input.emotions) replaceEmotions(memoryId, input.emotions);
    if (input.milestoneIds) linkMilestones(memoryId, input.milestoneIds, true);
    run('UPDATE memories SET updated_at = ? WHERE id = ?', now(), memoryId);
  });
  return memoryDetail(memoryId);
}

export function attachMedia(memoryId: string, mediaIds: string[]) {
  const memory = get<{ current_version_id: string | null }>(
    'SELECT current_version_id FROM memories WHERE id = ?',
    memoryId,
  );
  if (!memory) throw notFound('Memory');
  transaction(() => {
    claimMedia(mediaIds, 'memory', memoryId, memory.current_version_id);
    run('UPDATE memories SET updated_at = ? WHERE id = ?', now(), memoryId);
  });
}

export function confirmPlacement(memoryId: string) {
  const row = currentTemporal(memoryId);
  if (!row) throw notFound('Placement');
  run('UPDATE temporal_estimates SET confirmed = 1 WHERE id = ?', row.id);
}

export function deleteMemory(memoryId: string) {
  if (!get('SELECT id FROM memories WHERE id = ?', memoryId)) throw notFound('Memory');
  transaction(() => {
    deleteMediaFor('memory', [memoryId]);
    deleteArt([`memory:${memoryId}`]);
    run("DELETE FROM connection_endpoints WHERE node_type = 'memory' AND node_id = ?", memoryId);
    run(`DELETE FROM connections WHERE id IN (
      SELECT c.id FROM connections c LEFT JOIN connection_endpoints e ON e.connection_id = c.id
      GROUP BY c.id HAVING COUNT(e.node_id) < 2)`);
    run('DELETE FROM map_positions WHERE node_id = ?', `memory:${memoryId}`);
    run('DELETE FROM memories WHERE id = ?', memoryId);
    run(
      `DELETE FROM characters WHERE provisional = 1 AND id NOT IN (SELECT DISTINCT character_id FROM character_mentions)`,
    );
  });
}

export function resolveChange(
  memoryId: string,
  reviewItemId: string | null,
  input: ResolutionInput,
) {
  if (!get('SELECT id FROM memories WHERE id = ?', memoryId)) throw notFound('Memory');
  return transaction(() => {
    run(
      `INSERT INTO version_resolutions (id, memory_id, earlier_version_id, later_version_id, change_kind, earlier_text, later_text,
        resolution, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      memoryId,
      input.earlierVersionId,
      input.laterVersionId,
      input.changeKind,
      input.earlierText,
      input.laterText,
      input.resolution,
      now(),
    );
    if (reviewItemId)
      run(
        "UPDATE review_items SET status = 'resolved' WHERE id = ? AND memory_id = ?",
        reviewItemId,
        memoryId,
      );

    let result: { memoryId: string; splitMemoryId?: string } = { memoryId };
    if (input.resolution === 'prefer_earlier') {
      restoreVersion(memoryId, input.earlierVersionId);
    } else if (input.resolution === 'separate') {
      result = { memoryId, splitMemoryId: splitVersion(memoryId, input.laterVersionId) };
    }

    run(
      `UPDATE memories SET review_status = CASE WHEN EXISTS (SELECT 1 FROM review_items WHERE memory_id = ? AND status = 'open')
        THEN 'needs_review' ELSE 'ok' END, updated_at = ? WHERE id = ?`,
      memoryId,
      now(),
      memoryId,
    );
    return result;
  });
}

function splitVersion(memoryId: string, versionId: string): string {
  const version = get<VersionRow>(
    'SELECT * FROM memory_versions WHERE id = ? AND memory_id = ?',
    versionId,
    memoryId,
  );
  if (!version) throw notFound('Version');
  const versions = versionsOf(memoryId);
  if (versions.length < 2) throw new HttpError(400, 'A memory with one telling cannot be split');
  const earlier = [...versions].reverse().find((v) => v.seq < version.seq && v.id !== versionId);
  if (!earlier) throw new HttpError(400, 'Nothing to split from');

  const source = get<{ title: string; book_id: string }>(
    'SELECT title, book_id FROM memories WHERE id = ?',
    memoryId,
  )!;
  const people = peopleForMemory(memoryId, version.id);
  const newMemoryId = newId();
  const timestamp = now();
  run(
    `INSERT INTO memories (id, book_id, title, current_version_id, review_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ok', ?, ?)`,
    newMemoryId,
    source.book_id,
    `${source.title} (another time)`,
    null,
    timestamp,
    timestamp,
  );
  run(
    'UPDATE memory_versions SET memory_id = ?, seq = 1, mode = ?, composed_text = reading_copy WHERE id = ?',
    newMemoryId,
    'original',
    versionId,
  );
  run('DELETE FROM character_mentions WHERE version_id = ?', versionId);
  writeMentions(newMemoryId, versionId, version.reading_copy, people);
  run('UPDATE memories SET current_version_id = ? WHERE id = ?', versionId, newMemoryId);
  run(
    "UPDATE media_assets SET owner_id = ? WHERE owner_type = 'memory' AND owner_id = ? AND version_id = ?",
    newMemoryId,
    memoryId,
    versionId,
  );
  run("UPDATE review_items SET status = 'resolved' WHERE later_version_id = ?", versionId);

  const latest = versionsOf(memoryId).at(-1)!;
  run('UPDATE memories SET current_version_id = ? WHERE id = ?', latest.id, memoryId);

  saveTemporal(newMemoryId, {
    precision: 'unknown',
    ageMin: null,
    ageMax: null,
    year: null,
    month: null,
    day: null,
    season: null,
    approximate: true,
    confidence: 'low',
    explanation: 'Split from another memory. Place it when you know when it happened.',
    evidence: [],
    confirmed: false,
  });
  return newMemoryId;
}

export function searchMemories(query: SearchQuery): MemoryCardDto[] {
  const archive = Archive.load();
  let cards = archive.cards();

  if (query.collection === 'unplaced')
    cards = cards.filter((c) => c.temporal.certainty === 'unplaced');
  if (query.collection === 'needs_review') {
    const provisional = new Set(archive.characters.filter((c) => c.provisional).map((c) => c.id));
    cards = cards.filter(
      (c) =>
        c.reviewStatus === 'needs_review' ||
        (!c.temporal.confirmed && c.temporal.certainty !== 'unplaced') ||
        c.people.some((p) => provisional.has(p.characterId)),
    );
  }
  if (query.collection === 'sensitive') cards = cards.filter((c) => c.sensitive);

  if (query.emotions) {
    const wanted = query.emotions
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    cards = cards.filter((c) => {
      const tags = new Set(c.emotions.map((e) => e.tag));
      return query.emotionMode === 'all'
        ? wanted.every((w) => tags.has(w))
        : wanted.some((w) => tags.has(w));
    });
  }
  if (query.characterId) {
    cards = cards.filter((c) =>
      c.people.some(
        (p) => p.characterId === query.characterId && (!query.role || p.role === query.role),
      ),
    );
  }
  if (query.ageMin !== undefined)
    cards = cards.filter((c) => (c.temporal.ageMax ?? c.temporal.ageMin ?? -1) >= query.ageMin!);
  if (query.ageMax !== undefined)
    cards = cards.filter((c) => c.temporal.ageMin !== null && c.temporal.ageMin <= query.ageMax!);
  if (query.season) cards = cards.filter((c) => c.temporal.season === query.season);
  if (query.media) cards = cards.filter((c) => c.mediaKinds.includes(query.media!));
  if (query.certainty) cards = cards.filter((c) => c.temporal.certainty === query.certainty);
  if (query.connection) cards = cards.filter((c) => c.connectionTypes.includes(query.connection!));
  if (query.milestoneId)
    cards = cards.filter((c) => archive.milestoneIds(c.id).includes(query.milestoneId!));

  if (query.q?.trim()) {
    const needle = query.q.trim().toLowerCase();
    const index = new TermIndex(
      cards.map((c) => {
        const original = versionsOf(c.id)
          .map((v) => v.original_text)
          .join(' ');
        const aliases = c.people
          .flatMap((p) => [p.name, ...archive.aliases(p.characterId)])
          .join(' ');
        const captions = archive
          .media(c.id)
          .map((m) => m.caption ?? '')
          .join(' ');
        return {
          id: c.id,
          text: `${c.title} ${archive.text(c.id)} ${original} ${aliases} ${c.temporal.label} ${captions}`,
        };
      }),
    );
    const scores = new Map(index.search(needle, 200).map((r) => [r.id, r.score]));
    const literal = (c: MemoryCardDto) =>
      `${c.title} ${archive.text(c.id)} ${c.people.map((p) => p.name).join(' ')} ${archive
        .media(c.id)
        .map((m) => m.caption ?? '')
        .join(' ')}`
        .toLowerCase()
        .includes(needle);
    cards = cards
      .filter((c) => scores.has(c.id) || literal(c))
      .sort((a, b) => (scores.get(b.id) ?? 0.01) - (scores.get(a.id) ?? 0.01));
    return cards;
  }
  return sortChronologically(cards);
}
