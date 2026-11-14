import type {
  CharacterDetailDto,
  CharacterDto,
  CharacterInput,
  CharacterUpdate,
  Role,
} from '@living-draft/contracts';
import { kinKeyFor } from '@living-draft/engine';
import { all, get, placeholders, run, transaction } from '../../db/database';
import { HttpError, notFound, now } from '../../lib/http';
import { Archive, sortChronologically } from '../archive/snapshot';
import type { CharacterRow } from '../archive/rows';
import { claimMedia, findMedia, toMediaDto } from '../media/media.repository';
import { linksFor } from './character.links';
import {
  addAlias,
  aliasesOf,
  createCharacter,
  findCharacter,
  removeAlias,
} from './character.repository';

function summarize(archive: Archive, row: CharacterRow): CharacterDto {
  const roleCounts: Record<Role, number> = { central: 0, supporting: 0, mentioned: 0 };
  const ages: number[] = [];
  let memoryCount = 0;
  for (const memory of archive.memories) {
    const person = archive.people(memory.id).find((p) => p.characterId === row.id);
    if (!person) continue;
    memoryCount += 1;
    roleCounts[person.role] += 1;
    const temporal = archive.temporal(memory.id);
    if (temporal.ageMin !== null) ages.push(temporal.ageMin);
  }
  const photo = row.photo_id ? findMedia(row.photo_id) : undefined;
  return {
    id: row.id,
    name: row.name,
    relationship: row.relationship,
    aliases: archive.aliases(row.id).filter((a) => a.toLowerCase() !== row.name.toLowerCase()),
    notes: row.notes,
    provisional: !!row.provisional,
    memoryCount,
    roleCounts,
    firstAge: ages.length ? Math.min(...ages) : null,
    lastAge: ages.length ? Math.max(...ages) : null,
    photo: photo ? toMediaDto(photo) : null,
  };
}

export function listCharacters(): CharacterDto[] {
  const archive = Archive.load();
  return archive.characters
    .map((row) => summarize(archive, row))
    .sort((a, b) => b.memoryCount - a.memoryCount || a.name.localeCompare(b.name));
}

export function characterDetail(id: string): CharacterDetailDto {
  const archive = Archive.load();
  const row = archive.character(id);
  if (!row) throw notFound('Person');
  const summary = summarize(archive, row);

  const memories = sortChronologically(
    archive.cards().filter((card) => card.people.some((p) => p.characterId === id)),
  ).map((card) => {
    const mentions = archive.mentions(card.id).filter((m) => m.character_id === id);
    return {
      ...card,
      role: card.people.find((p) => p.characterId === id)!.role,
      mentionIds: mentions.map((m) => m.id),
      evidence: mentions.find((m) => m.role_evidence)?.role_evidence ?? null,
    };
  });

  const related = new Map<string, { id: string; name: string; shared: number }>();
  for (const memory of memories) {
    for (const person of memory.people) {
      if (person.characterId === id) continue;
      const entry = related.get(person.characterId) ?? {
        id: person.characterId,
        name: person.name,
        shared: 0,
      };
      entry.shared += 1;
      related.set(person.characterId, entry);
    }
  }

  const memoryIds = new Set(memories.map((m) => m.id));
  const connections = archive.connections
    .filter(
      (c) =>
        c.status !== 'dismissed' &&
        archive.connectionMemoryIds(c.id).some((mid) => memoryIds.has(mid)),
    )
    .map((c) => archive.connectionDto(c));

  return {
    ...summary,
    memories,
    related: [...related.values()].sort((a, b) => b.shared - a.shared),
    links: linksFor(id),
    connections,
  };
}

export function createCharacterFromInput(input: CharacterInput): CharacterDto {
  const row = createCharacter({ ...input, provisional: false });
  return summarize(Archive.load(), row);
}

export function updateCharacter(id: string, input: CharacterUpdate): CharacterDto {
  const row = findCharacter(id);
  if (!row) throw notFound('Person');
  transaction(() => {
    if (input.name !== undefined) {
      run(
        'UPDATE characters SET name = ?, kin_key = COALESCE(?, kin_key) WHERE id = ?',
        input.name,
        kinKeyFor(input.name),
        id,
      );
      addAlias(id, input.name);
    }
    if (input.relationship !== undefined)
      run('UPDATE characters SET relationship = ? WHERE id = ?', input.relationship, id);
    if (input.notes !== undefined)
      run('UPDATE characters SET notes = ? WHERE id = ?', input.notes, id);
    if (input.provisional !== undefined)
      run('UPDATE characters SET provisional = ? WHERE id = ?', input.provisional, id);
    if (input.photoId !== undefined) {
      run('UPDATE characters SET photo_id = ? WHERE id = ?', input.photoId, id);
      if (input.photoId) claimMedia([input.photoId], 'character', id);
    }
    run('UPDATE characters SET updated_at = ? WHERE id = ?', now(), id);
  });
  return summarize(Archive.load(), findCharacter(id)!);
}

export function addCharacterAlias(id: string, alias: string): CharacterDto {
  if (!findCharacter(id)) throw notFound('Person');
  addAlias(id, alias);
  return summarize(Archive.load(), findCharacter(id)!);
}

export function removeCharacterAlias(id: string, alias: string): CharacterDto {
  const row = findCharacter(id);
  if (!row) throw notFound('Person');
  if (alias.toLowerCase() === row.name.toLowerCase())
    throw new HttpError(400, 'Rename the person instead of removing their name');
  removeAlias(id, alias);
  return summarize(Archive.load(), findCharacter(id)!);
}

export function mergeCharacters(sourceId: string, targetId: string): CharacterDto {
  if (sourceId === targetId) throw new HttpError(400, 'Pick two different people');
  const source = findCharacter(sourceId);
  const target = findCharacter(targetId);
  if (!source || !target) throw notFound('Person');
  transaction(() => {
    for (const alias of [source.name, ...aliasesOf(sourceId)]) addAlias(targetId, alias);
    run(
      'UPDATE character_mentions SET character_id = ? WHERE character_id = ?',
      targetId,
      sourceId,
    );
    run(
      "UPDATE connection_endpoints SET node_id = ? WHERE node_type = 'character' AND node_id = ?",
      targetId,
      sourceId,
    );
    run(
      'DELETE FROM character_links WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
      sourceId,
      targetId,
      targetId,
      sourceId,
    );
    run('UPDATE OR IGNORE character_links SET from_id = ? WHERE from_id = ?', targetId, sourceId);
    run('UPDATE OR IGNORE character_links SET to_id = ? WHERE to_id = ?', targetId, sourceId);
    if (!target.notes && source.notes)
      run('UPDATE characters SET notes = ? WHERE id = ?', source.notes, targetId);
    run('UPDATE characters SET provisional = 0, updated_at = ? WHERE id = ?', now(), targetId);
    run('DELETE FROM characters WHERE id = ?', sourceId);
  });
  return summarize(Archive.load(), findCharacter(targetId)!);
}

export function splitCharacter(
  id: string,
  mentionIds: string[],
  name: string,
  relationship?: string | null,
): CharacterDto {
  if (!findCharacter(id)) throw notFound('Person');
  const owned = all<{ id: string; memory_id: string }>(
    `SELECT id, memory_id FROM character_mentions WHERE character_id = ? AND id IN (${placeholders(mentionIds.length)})`,
    id,
    ...mentionIds,
  );
  if (!owned.length) throw new HttpError(400, 'None of those mentions belong to this person');
  const created = transaction(() => {
    const fresh = createCharacter({ name, relationship: relationship ?? null, provisional: false });
    const memoryIds = [...new Set(owned.map((m) => m.memory_id))];
    run(
      `UPDATE character_mentions SET character_id = ? WHERE character_id = ? AND memory_id IN (${placeholders(memoryIds.length)})`,
      fresh.id,
      id,
      ...memoryIds,
    );
    return fresh;
  });
  return summarize(Archive.load(), created);
}

export function updateMention(
  mentionId: string,
  input: { role?: Role; characterId?: string; confirmed?: boolean },
) {
  const mention = get<{ id: string; memory_id: string; character_id: string; version_id: string }>(
    'SELECT id, memory_id, character_id, version_id FROM character_mentions WHERE id = ?',
    mentionId,
  );
  if (!mention) throw notFound('Mention');
  transaction(() => {
    if (input.role) {
      run(
        'UPDATE character_mentions SET role = ? WHERE memory_id = ? AND version_id = ? AND character_id = ?',
        input.role,
        mention.memory_id,
        mention.version_id,
        mention.character_id,
      );
    }
    if (input.characterId) {
      if (!findCharacter(input.characterId)) throw notFound('Person');
      run(
        'UPDATE character_mentions SET character_id = ? WHERE id = ?',
        input.characterId,
        mentionId,
      );
    }
    if (input.confirmed !== undefined)
      run('UPDATE character_mentions SET confirmed = ? WHERE id = ?', input.confirmed, mentionId);
  });
}

export function deleteCharacter(id: string) {
  if (!findCharacter(id)) throw notFound('Person');
  transaction(() => {
    run("DELETE FROM connection_endpoints WHERE node_type = 'character' AND node_id = ?", id);
    run('DELETE FROM characters WHERE id = ?', id);
  });
}
