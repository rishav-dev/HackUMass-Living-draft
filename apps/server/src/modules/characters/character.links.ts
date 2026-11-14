import type { CharacterDetailDto } from '@living-draft/contracts';
import { all, get, run } from '../../db/database';
import { HttpError, newId, notFound, now } from '../../lib/http';
import { findCharacter } from './character.repository';

interface LinkRow {
  id: string;
  from_id: string;
  to_id: string;
  label: string;
  note: string | null;
  other_name: string;
}

export function linksFor(id: string): CharacterDetailDto['links'] {
  return all<LinkRow>(
    `SELECT l.id, l.from_id, l.to_id, l.label, l.note, c.name AS other_name
       FROM character_links l
       JOIN characters c ON c.id = CASE WHEN l.from_id = ? THEN l.to_id ELSE l.from_id END
      WHERE l.from_id = ? OR l.to_id = ?
      ORDER BY c.name`,
    id,
    id,
    id,
  ).map((row) => ({
    id: row.id,
    characterId: row.from_id === id ? row.to_id : row.from_id,
    name: row.other_name,
    label: row.label,
    note: row.note,
  }));
}

export function linkCharacters(id: string, otherId: string, label: string, note?: string | null) {
  if (id === otherId) throw new HttpError(400, 'Pick someone else');
  if (!findCharacter(id) || !findCharacter(otherId)) throw notFound('Person');
  const existing = get<{ id: string }>(
    'SELECT id FROM character_links WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
    id,
    otherId,
    otherId,
    id,
  );
  if (existing) {
    run(
      'UPDATE character_links SET label = ?, note = ? WHERE id = ?',
      label,
      note ?? null,
      existing.id,
    );
  } else {
    run(
      'INSERT INTO character_links (id, from_id, to_id, label, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      newId(),
      id,
      otherId,
      label,
      note ?? null,
      now(),
    );
  }
  return linksFor(id);
}

export function unlinkCharacters(id: string, linkId: string) {
  run('DELETE FROM character_links WHERE id = ? AND (from_id = ? OR to_id = ?)', linkId, id, id);
  return linksFor(id);
}

export function allCharacterLinks(): Array<{
  id: string;
  from: string;
  to: string;
  label: string;
}> {
  return all<{ id: string; from_id: string; to_id: string; label: string }>(
    'SELECT id, from_id, to_id, label FROM character_links',
  ).map((row) => ({ id: row.id, from: row.from_id, to: row.to_id, label: row.label }));
}
