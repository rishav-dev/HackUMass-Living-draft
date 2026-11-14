import type { ChapterNoteDto } from '@living-draft/contracts';
import { all, run, transaction } from '../../db/database';
import { now } from '../../lib/http';

export function chapterNotes(): ChapterNoteDto[] {
  return all<{ age: number; body: string; updated_at: string }>(
    'SELECT * FROM chapter_notes ORDER BY age',
  ).map((r) => ({
    age: r.age,
    body: r.body,
    updatedAt: r.updated_at,
  }));
}

export function saveChapterNote(age: number, body: string): ChapterNoteDto {
  const timestamp = now();
  if (!body.trim()) {
    run('DELETE FROM chapter_notes WHERE age = ?', age);
    return { age, body: '', updatedAt: null };
  }
  run(
    'INSERT INTO chapter_notes (age, body, updated_at) VALUES (?, ?, ?) ON CONFLICT (age) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at',
    age,
    body,
    timestamp,
  );
  return { age, body, updatedAt: timestamp };
}

export function saveStoryOrder(memoryIds: string[]) {
  transaction(() => {
    memoryIds.forEach((id, index) =>
      run('UPDATE memories SET story_order = ? WHERE id = ?', index, id),
    );
  });
}
