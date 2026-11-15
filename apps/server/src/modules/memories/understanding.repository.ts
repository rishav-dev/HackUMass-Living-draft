import type { UnderstandingInput } from '@living-draft/contracts';
import { all, get, run } from '../../db/database';
import { newId, now } from '../../lib/http';

export function placeIdFor(name: string, kind: string | null = null): string {
  const clean = name.trim();
  const found = get<{ id: string }>('SELECT id FROM places WHERE name = ? COLLATE NOCASE', clean);
  if (found) return found.id;
  const id = newId();
  run(
    'INSERT INTO places (id, name, kind, created_at) VALUES (?, ?, ?, ?)',
    id,
    clean,
    kind,
    now(),
  );
  return id;
}

export function saveUnderstanding(
  memoryId: string,
  versionId: string | null,
  input: UnderstandingInput | undefined,
  options: { replaceThemes?: boolean } = {},
) {
  if (!input) return;
  if (input.summary !== undefined)
    run('UPDATE memories SET summary = ? WHERE id = ?', input.summary, memoryId);
  if (input.time)
    run(
      'UPDATE memories SET time_kind = ?, time_hint = ? WHERE id = ?',
      input.time.kind,
      input.time.hint,
      memoryId,
    );
  if (options.replaceThemes)
    run("DELETE FROM memory_themes WHERE memory_id = ? AND source = 'ai'", memoryId);
  for (const theme of input.themes)
    run(
      `INSERT INTO memory_themes (memory_id, theme, evidence, source) VALUES (?, ?, ?, 'ai')
       ON CONFLICT (memory_id, theme) DO UPDATE SET evidence = excluded.evidence`,
      memoryId,
      theme.theme,
      theme.evidence ?? null,
    );
  const asked = new Set(
    all<{ question: string }>(
      'SELECT question FROM memory_questions WHERE memory_id = ?',
      memoryId,
    ).map((q) => q.question),
  );
  const stamp = now();
  for (const followup of input.followups) {
    if (asked.has(followup.question)) continue;
    const answer = followup.answer?.trim() || null;
    run(
      `INSERT INTO memory_questions (id, memory_id, version_id, question, answer, asked_at, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      memoryId,
      versionId,
      followup.question,
      answer,
      stamp,
      answer ? stamp : null,
    );
  }
  for (const place of input.places)
    run(
      'INSERT OR IGNORE INTO memory_places (memory_id, place_id) VALUES (?, ?)',
      memoryId,
      placeIdFor(place.name, place.kind ?? null),
    );
}
