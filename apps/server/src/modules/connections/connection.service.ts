import type { ConnectionDto, ConnectionInput, ConnectionUpdate } from '@living-draft/contracts';
import { pairKey, suggestConnections, type ConnectionSuggestion } from '@living-draft/engine';
import { get, placeholders, all, run, transaction } from '../../db/database';
import { HttpError, newId, notFound, now } from '../../lib/http';
import { Archive } from '../archive/snapshot';

export function listConnections(status?: string): ConnectionDto[] {
  const archive = Archive.load();
  return archive.connections
    .filter((c) => (status ? c.status === status : c.status !== 'dismissed'))
    .map((c) => archive.connectionDto(c))
    .reverse();
}

function insertConnection(input: {
  type: string;
  explanation: string;
  status: 'suggested' | 'confirmed';
  origin: 'suggested' | 'manual';
  note?: string | null;
  memoryIds: string[];
  evidence: Array<{ memoryId: string; quote: string; start: number; end: number }>;
}): string {
  const id = newId();
  const timestamp = now();
  run(
    `INSERT INTO connections (id, type, explanation, status, origin, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.type,
    input.explanation,
    input.status,
    input.origin,
    input.note ?? null,
    timestamp,
    timestamp,
  );
  input.memoryIds.forEach((memoryId, position) => {
    const evidence = input.evidence.find((e) => e.memoryId === memoryId);
    run(
      `INSERT INTO connection_endpoints (connection_id, node_type, node_id, evidence_quote, evidence_start, evidence_end, position)
       VALUES (?, 'memory', ?, ?, ?, ?, ?)`,
      id,
      memoryId,
      evidence?.quote ?? null,
      evidence?.start ?? null,
      evidence?.end ?? null,
      position,
    );
  });
  return id;
}

export function createConnection(input: ConnectionInput): ConnectionDto {
  const unique = [...new Set(input.memoryIds)];
  if (unique.length < 2) throw new HttpError(400, 'A connection needs two different memories');
  const found = all<{ id: string }>(
    `SELECT id FROM memories WHERE id IN (${placeholders(unique.length)})`,
    ...unique,
  );
  if (found.length !== unique.length) throw notFound('Memory');
  const id = transaction(() =>
    insertConnection({
      type: input.type,
      explanation: input.explanation,
      status: input.status,
      origin: input.evidence.length ? 'suggested' : 'manual',
      note: input.note,
      memoryIds: unique,
      evidence: input.evidence,
    }),
  );
  const archive = Archive.load();
  return archive.connectionDto(archive.connections.find((c) => c.id === id)!);
}

export function updateConnection(id: string, input: ConnectionUpdate): ConnectionDto {
  if (!get('SELECT id FROM connections WHERE id = ?', id)) throw notFound('Connection');
  transaction(() => {
    if (input.status) run('UPDATE connections SET status = ? WHERE id = ?', input.status, id);
    if (input.explanation)
      run('UPDATE connections SET explanation = ? WHERE id = ?', input.explanation, id);
    if (input.note !== undefined)
      run('UPDATE connections SET note = ? WHERE id = ?', input.note, id);
    if (input.type) run('UPDATE connections SET type = ? WHERE id = ?', input.type, id);
    run('UPDATE connections SET updated_at = ? WHERE id = ?', now(), id);
  });
  const archive = Archive.load();
  return archive.connectionDto(archive.connections.find((c) => c.id === id)!);
}

export function deleteConnection(id: string) {
  run('DELETE FROM connections WHERE id = ?', id);
}

function knownPairs(archive: Archive): Set<string> {
  const keys = new Set<string>();
  for (const connection of archive.connections) {
    const ids = archive.connectionMemoryIds(connection.id);
    keys.add(pairKey(connection.type, ids));
  }
  return keys;
}

export function suggestAndStore(focusIds?: string[]): ConnectionDto[] {
  const archive = Archive.load();
  const suggestions: ConnectionSuggestion[] = suggestConnections(archive.docs(), {
    focusIds,
    existingPairs: knownPairs(archive),
    limit: 12,
  });
  const ids = transaction(() =>
    suggestions.map((s) =>
      insertConnection({
        type: s.type,
        explanation: s.explanation,
        status: 'suggested',
        origin: 'suggested',
        memoryIds: s.memoryIds,
        evidence: s.evidence,
      }),
    ),
  );
  const fresh = Archive.load();
  return ids.map((id) => fresh.connectionDto(fresh.connections.find((c) => c.id === id)!));
}
