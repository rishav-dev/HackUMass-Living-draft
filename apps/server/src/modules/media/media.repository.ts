import fs from 'node:fs';
import path from 'node:path';
import type { MediaDto, MediaKind } from '@living-draft/contracts';
import { all, get, placeholders, run } from '../../db/database';
import { config } from '../../config';
import { HttpError, newId, now } from '../../lib/http';

export type OwnerType = 'pending' | 'memory' | 'capsule' | 'reflection' | 'character';

export interface MediaRow {
  id: string;
  owner_type: OwnerType;
  owner_id: string | null;
  version_id: string | null;
  kind: MediaKind;
  file_name: string;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  duration_ms: number | null;
  created_at: string;
}

export function toMediaDto(row: MediaRow): MediaDto {
  return {
    id: row.id,
    kind: row.kind,
    url: `/media/${row.file_name}`,
    mimeType: row.mime_type,
    caption: row.caption,
    durationMs: row.duration_ms,
    versionId: row.version_id,
    createdAt: row.created_at,
  };
}

export function kindForMime(mime: string, requested?: string): MediaKind {
  if (requested === 'scan') return 'scan';
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  throw new HttpError(415, `Unsupported file type: ${mime}`);
}

export function insertMedia(input: {
  fileName: string;
  originalName: string | null;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
  caption?: string | null;
  durationMs?: number | null;
  ownerType?: OwnerType;
  ownerId?: string | null;
  versionId?: string | null;
}): MediaRow {
  const id = newId();
  run(
    `INSERT INTO media_assets (id, owner_type, owner_id, version_id, kind, file_name, original_name, mime_type, size_bytes,
      caption, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.ownerType ?? 'pending',
    input.ownerId ?? null,
    input.versionId ?? null,
    input.kind,
    input.fileName,
    input.originalName,
    input.mimeType,
    input.sizeBytes,
    input.caption ?? null,
    input.durationMs ?? null,
    now(),
  );
  return get<MediaRow>('SELECT * FROM media_assets WHERE id = ?', id)!;
}

export function findMedia(id: string): MediaRow | undefined {
  return get<MediaRow>('SELECT * FROM media_assets WHERE id = ?', id);
}

export function mediaFor(ownerType: OwnerType, ownerIds: string[]): MediaRow[] {
  if (!ownerIds.length) return [];
  return all<MediaRow>(
    `SELECT * FROM media_assets WHERE owner_type = ? AND owner_id IN (${placeholders(ownerIds.length)}) ORDER BY created_at`,
    ownerType,
    ...ownerIds,
  );
}

export function claimMedia(
  ids: string[],
  ownerType: OwnerType,
  ownerId: string,
  versionId: string | null = null,
) {
  for (const id of ids) {
    run(
      `UPDATE media_assets SET owner_type = ?, owner_id = ?, version_id = COALESCE(version_id, ?)
       WHERE id = ? AND (owner_type = 'pending' OR (owner_type = ? AND owner_id = ?))`,
      ownerType,
      ownerId,
      versionId,
      id,
      ownerType,
      ownerId,
    );
  }
}

export function updateCaption(id: string, caption: string | null) {
  run('UPDATE media_assets SET caption = ? WHERE id = ?', caption, id);
}

function removeFile(fileName: string) {
  const file = path.join(config.mediaDir, path.basename(fileName));
  fs.rmSync(file, { force: true });
}

export function deleteMedia(id: string) {
  const row = findMedia(id);
  if (!row) return;
  run('DELETE FROM media_assets WHERE id = ?', id);
  removeFile(row.file_name);
}

export function deleteMediaFor(ownerType: OwnerType, ownerIds: string[]) {
  for (const row of mediaFor(ownerType, ownerIds)) deleteMedia(row.id);
}

export function deleteStalePending(olderThanHours = 24) {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000).toISOString();
  for (const row of all<MediaRow>(
    "SELECT * FROM media_assets WHERE owner_type = 'pending' AND created_at < ?",
    cutoff,
  )) {
    deleteMedia(row.id);
  }
}
