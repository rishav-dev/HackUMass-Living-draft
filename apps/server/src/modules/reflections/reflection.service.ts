import type { ReflectionDto, ReflectionInput } from '@living-draft/contracts';
import { all, get, placeholders, run, transaction } from '../../db/database';
import { newId, notFound, now } from '../../lib/http';
import { claimMedia, deleteMediaFor, findMedia, toMediaDto } from '../media/media.repository';

interface ReflectionRow {
  id: string;
  original_text: string;
  body: string;
  audio_id: string | null;
  capsule_id: string | null;
  recorded_at: string;
}

function toDto(row: ReflectionRow): ReflectionDto {
  const memoryIds = all<{ memory_id: string }>(
    'SELECT memory_id FROM reflection_memories WHERE reflection_id = ?',
    row.id,
  ).map((r) => r.memory_id);
  const audio = row.audio_id ? findMedia(row.audio_id) : undefined;
  return {
    id: row.id,
    body: row.body,
    originalText: row.original_text,
    recordedAt: row.recorded_at,
    memoryIds,
    audio: audio ? toMediaDto(audio) : null,
  };
}

export function listReflections(): ReflectionDto[] {
  return all<ReflectionRow>('SELECT * FROM reflections ORDER BY recorded_at DESC').map(toDto);
}

export function findReflection(id: string): ReflectionDto | null {
  const row = get<ReflectionRow>('SELECT * FROM reflections WHERE id = ?', id);
  return row ? toDto(row) : null;
}

export function reflectionsFor(memoryId: string): ReflectionDto[] {
  return all<ReflectionRow>(
    `SELECT r.* FROM reflections r JOIN reflection_memories rm ON rm.reflection_id = r.id
     WHERE rm.memory_id = ? ORDER BY r.recorded_at`,
    memoryId,
  ).map(toDto);
}

export function createReflection(
  input: ReflectionInput & { capsuleId?: string | null },
): ReflectionDto {
  return transaction(() => {
    const id = newId();
    const timestamp = now();
    run(
      `INSERT INTO reflections (id, original_text, body, audio_id, capsule_id, recorded_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.originalText,
      input.readingCopy,
      input.audioId ?? null,
      input.capsuleId ?? null,
      timestamp,
      timestamp,
    );
    if (input.memoryIds.length) {
      const existing = all<{ id: string }>(
        `SELECT id FROM memories WHERE id IN (${placeholders(input.memoryIds.length)})`,
        ...input.memoryIds,
      );
      for (const { id: memoryId } of existing) {
        run(
          'INSERT OR IGNORE INTO reflection_memories (reflection_id, memory_id) VALUES (?, ?)',
          id,
          memoryId,
        );
      }
    }
    if (input.audioId) claimMedia([input.audioId], 'reflection', id);
    return findReflection(id)!;
  });
}

export function deleteReflection(id: string) {
  if (!get('SELECT id FROM reflections WHERE id = ?', id)) throw notFound('Reflection');
  transaction(() => {
    deleteMediaFor('reflection', [id]);
    run('DELETE FROM reflections WHERE id = ?', id);
  });
}
