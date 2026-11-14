import type { PersonDecision, Role } from '@living-draft/contracts';
import { findSurfaceSpans, kinKeyFor, normalizePersonKey } from '@living-draft/engine';
import { all, get, placeholders, run } from '../../db/database';
import { newId, now } from '../../lib/http';
import type { CharacterRow } from '../archive/rows';

export function normalizeAlias(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/^(my|our|the)\s+/, '')
    .replace(/[^a-z0-9. -]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findCharacter(id: string): CharacterRow | undefined {
  return get<CharacterRow>('SELECT * FROM characters WHERE id = ?', id);
}

export function aliasesOf(characterId: string): string[] {
  return all<{ alias: string }>(
    'SELECT alias FROM character_aliases WHERE character_id = ? ORDER BY alias',
    characterId,
  ).map((r) => r.alias);
}

export function charactersByAlias(values: string[]): CharacterRow[] {
  const normalized = [...new Set(values.map(normalizeAlias).filter(Boolean))];
  if (!normalized.length) return [];
  return all<CharacterRow>(
    `SELECT DISTINCT c.* FROM characters c JOIN character_aliases a ON a.character_id = c.id
     WHERE a.normalized IN (${placeholders(normalized.length)})`,
    ...normalized,
  );
}

export function charactersByKin(kinKey: string): CharacterRow[] {
  return all<CharacterRow>('SELECT * FROM characters WHERE kin_key = ?', kinKey);
}

export function addAlias(characterId: string, alias: string) {
  const normalized = normalizeAlias(alias);
  if (!normalized) return;
  run(
    'INSERT OR IGNORE INTO character_aliases (id, character_id, alias, normalized) VALUES (?, ?, ?, ?)',
    newId(),
    characterId,
    alias.trim(),
    normalized,
  );
}

export function removeAlias(characterId: string, alias: string) {
  run(
    'DELETE FROM character_aliases WHERE character_id = ? AND normalized = ?',
    characterId,
    normalizeAlias(alias),
  );
}

export function createCharacter(input: {
  name: string;
  relationship?: string | null;
  notes?: string | null;
  provisional?: boolean;
  aliases?: string[];
}): CharacterRow {
  const id = newId();
  const timestamp = now();
  const kinKey =
    kinKeyFor(input.name) ?? (input.relationship ? kinKeyFor(input.relationship) : null);
  run(
    `INSERT INTO characters (id, name, relationship, kin_key, notes, provisional, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name.trim(),
    input.relationship ?? null,
    kinKey,
    input.notes ?? null,
    input.provisional ?? true,
    timestamp,
    timestamp,
  );
  addAlias(id, input.name);
  for (const alias of input.aliases ?? []) addAlias(id, alias);
  return findCharacter(id)!;
}

export interface ResolvedPerson {
  characterId: string;
  surfaces: string[];
  role: Role;
  roleEvidence: string | null;
}

export function resolveDecisions(decisions: PersonDecision[]): ResolvedPerson[] {
  return decisions.map((decision) => {
    let characterId = decision.characterId;
    if (!characterId) {
      characterId = createCharacter({
        name: decision.label,
        relationship: decision.relationship ?? null,
        aliases: decision.surfaces,
        provisional: true,
      }).id;
    } else if (decision.addAlias) {
      for (const surface of decision.surfaces) addAlias(characterId, surface);
    }
    return {
      characterId,
      surfaces: decision.surfaces,
      role: decision.role,
      roleEvidence: decision.roleEvidence ?? null,
    };
  });
}

export function peopleForMemory(memoryId: string, versionId: string): ResolvedPerson[] {
  const rows = all<{ character_id: string; role: Role; role_evidence: string | null }>(
    'SELECT character_id, role, role_evidence FROM character_mentions WHERE memory_id = ? AND version_id = ?',
    memoryId,
    versionId,
  );
  const merged = new Map<string, ResolvedPerson>();
  for (const row of rows) {
    if (merged.has(row.character_id)) continue;
    const character = findCharacter(row.character_id);
    if (!character) continue;
    merged.set(row.character_id, {
      characterId: row.character_id,
      surfaces: [character.name, ...aliasesOf(row.character_id)],
      role: row.role,
      roleEvidence: row.role_evidence,
    });
  }
  return [...merged.values()];
}

export function writeMentions(
  memoryId: string,
  versionId: string,
  text: string,
  people: ResolvedPerson[],
) {
  const timestamp = now();
  const taken: Array<[number, number]> = [];
  for (const person of people) {
    const character = findCharacter(person.characterId);
    const surfaces = [
      ...person.surfaces,
      ...(character ? [character.name, ...aliasesOf(character.id)] : []),
    ];
    const spans = findSurfaceSpans(text, surfaces).filter(
      (s) => !taken.some(([a, b]) => s.start < b && a < s.end),
    );
    if (!spans.length) {
      run(
        `INSERT INTO character_mentions (id, memory_id, version_id, character_id, surface, span_start, span_end, role,
          role_evidence, confirmed, created_at) VALUES (?, ?, ?, ?, ?, -1, -1, ?, ?, 1, ?)`,
        newId(),
        memoryId,
        versionId,
        person.characterId,
        person.surfaces[0] ?? character?.name ?? '',
        person.role,
        person.roleEvidence,
        timestamp,
      );
      continue;
    }
    for (const span of spans) {
      taken.push([span.start, span.end]);
      run(
        `INSERT INTO character_mentions (id, memory_id, version_id, character_id, surface, span_start, span_end, role,
          role_evidence, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        newId(),
        memoryId,
        versionId,
        person.characterId,
        span.text,
        span.start,
        span.end,
        person.role,
        person.roleEvidence,
        timestamp,
      );
    }
  }
}

export function personKeysFor(characterIds: string[]): string[] {
  const keys = new Set<string>(characterIds);
  for (const id of characterIds) {
    const character = findCharacter(id);
    if (!character) continue;
    if (character.kin_key) keys.add(character.kin_key);
    keys.add(normalizePersonKey(character.name));
  }
  return [...keys];
}
