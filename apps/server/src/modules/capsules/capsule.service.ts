import type { CapsuleDto, CapsuleInput } from '@living-draft/contracts';
import { all, get, run, transaction } from '../../db/database';
import { HttpError, newId, notFound, now } from '../../lib/http';
import { claimMedia, deleteMediaFor, findMedia, toMediaDto } from '../media/media.repository';
import { requireProfile } from '../profile/profile.repository';
import { createReflection, findReflection } from '../reflections/reflection.service';

interface CapsuleRow {
  id: string;
  title: string;
  original_text: string;
  body: string;
  authored_at: string;
  authored_age: number;
  unlock_kind: 'date' | 'milestone';
  unlock_date: string | null;
  unlock_milestone: string | null;
  milestone_reached: number;
  opened_at: string | null;
  reflection_id: string | null;
  audio_id: string | null;
}

function isUnlocked(row: CapsuleRow): boolean {
  if (row.unlock_kind === 'milestone') return !!row.milestone_reached;
  return !!row.unlock_date && row.unlock_date <= now().slice(0, 10);
}

function toDto(row: CapsuleRow): CapsuleDto {
  const unlocked = isUnlocked(row);
  const audio = unlocked && row.audio_id ? findMedia(row.audio_id) : undefined;
  return {
    id: row.id,
    title: row.title,
    body: unlocked ? row.body : null,
    originalText: unlocked ? row.original_text : null,
    authoredAt: row.authored_at,
    authoredAge: row.authored_age,
    unlockKind: row.unlock_kind,
    unlockDate: row.unlock_date,
    unlockMilestone: row.unlock_milestone,
    openedAt: row.opened_at,
    unlocked,
    reflection: row.reflection_id ? findReflection(row.reflection_id) : null,
    audio: audio ? toMediaDto(audio) : null,
  };
}

export function listCapsules(): CapsuleDto[] {
  return all<CapsuleRow>('SELECT * FROM capsules ORDER BY COALESCE(unlock_date, authored_at)').map(
    toDto,
  );
}

export function createCapsule(input: CapsuleInput): CapsuleDto {
  const profile = requireProfile();
  if (
    input.unlockKind === 'date' &&
    (!input.unlockDate || input.unlockDate <= now().slice(0, 10))
  ) {
    throw new HttpError(400, 'Pick a date in the future');
  }
  if (input.unlockKind === 'milestone' && !input.unlockMilestone)
    throw new HttpError(400, 'Name the milestone that opens it');
  const id = newId();
  const timestamp = now();
  transaction(() => {
    run(
      `INSERT INTO capsules (id, title, original_text, body, authored_at, authored_age, unlock_kind, unlock_date, unlock_milestone,
        audio_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.title,
      input.originalText,
      input.readingCopy,
      timestamp,
      profile.currentAge,
      input.unlockKind,
      input.unlockDate ?? null,
      input.unlockMilestone ?? null,
      input.audioId ?? null,
      timestamp,
    );
    if (input.audioId) claimMedia([input.audioId], 'capsule', id);
  });
  return toDto(get<CapsuleRow>('SELECT * FROM capsules WHERE id = ?', id)!);
}

export function markMilestoneReached(id: string): CapsuleDto {
  const row = get<CapsuleRow>('SELECT * FROM capsules WHERE id = ?', id);
  if (!row) throw notFound('Capsule');
  if (row.unlock_kind !== 'milestone') throw new HttpError(400, 'This capsule opens on a date');
  run('UPDATE capsules SET milestone_reached = 1 WHERE id = ?', id);
  return toDto(get<CapsuleRow>('SELECT * FROM capsules WHERE id = ?', id)!);
}

export function openCapsule(id: string, reflection?: string): CapsuleDto {
  const row = get<CapsuleRow>('SELECT * FROM capsules WHERE id = ?', id);
  if (!row) throw notFound('Capsule');
  if (!isUnlocked(row)) throw new HttpError(403, 'Still sealed');
  transaction(() => {
    if (!row.opened_at) run('UPDATE capsules SET opened_at = ? WHERE id = ?', now(), id);
    if (reflection?.trim()) {
      const created = createReflection({
        originalText: reflection,
        readingCopy: reflection,
        memoryIds: [],
        capsuleId: id,
      });
      run('UPDATE capsules SET reflection_id = ? WHERE id = ?', created.id, id);
    }
  });
  return toDto(get<CapsuleRow>('SELECT * FROM capsules WHERE id = ?', id)!);
}

export function deleteCapsule(id: string) {
  if (!get('SELECT id FROM capsules WHERE id = ?', id)) throw notFound('Capsule');
  transaction(() => {
    deleteMediaFor('capsule', [id]);
    run('DELETE FROM capsules WHERE id = ?', id);
  });
}
