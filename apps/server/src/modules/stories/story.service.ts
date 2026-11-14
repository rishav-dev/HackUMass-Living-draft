import type {
  SceneSaveResultDto,
  StoryBookDto,
  StoryBookSummaryDto,
  StoryCharacterDto,
  StoryNoteDto,
  StorySceneDto,
} from '@living-draft/contracts';
import {
  makeReadingCopy,
  storyLinkLabel,
  suggestCharacterNames,
  suggestEchoes,
} from '@living-draft/engine';
import { all, get, placeholders, run, transaction } from '../../db/database';
import { HttpError, newId, notFound, now } from '../../lib/http';

interface BookRow {
  id: string;
  title: string;
  premise: string | null;
  mood: string;
  created_at: string;
  updated_at: string;
}

interface SceneRow {
  id: string;
  book_id: string;
  chapter_id: string | null;
  position: number;
  title: string;
  text: string;
  original_text: string;
  mood: string | null;
  pov_id: string | null;
  updated_at: string;
}

interface ChapterRow {
  id: string;
  number: number;
  title: string;
}

function requireBook(id: string): BookRow {
  const book = get<BookRow>('SELECT * FROM story_books WHERE id = ?', id);
  if (!book) throw notFound('Story book');
  return book;
}

function requireScene(bookId: string, sceneId: string): SceneRow {
  const scene = get<SceneRow>(
    'SELECT * FROM story_scenes WHERE id = ? AND book_id = ?',
    sceneId,
    bookId,
  );
  if (!scene) throw notFound('Scene');
  return scene;
}

function touch(bookId: string) {
  run('UPDATE story_books SET updated_at = ? WHERE id = ?', now(), bookId);
}

function counts(bookId: string) {
  const scalar = (sql: string) => get<{ n: number }>(sql, bookId)?.n ?? 0;
  return {
    sceneCount: scalar('SELECT COUNT(*) AS n FROM story_scenes WHERE book_id = ?'),
    chapterCount: scalar('SELECT COUNT(*) AS n FROM story_chapters WHERE book_id = ?'),
    characterCount: scalar('SELECT COUNT(*) AS n FROM story_characters WHERE book_id = ?'),
  };
}

function summary(book: BookRow): StoryBookSummaryDto {
  return {
    id: book.id,
    title: book.title,
    premise: book.premise,
    mood: book.mood,
    updatedAt: book.updated_at,
    ...counts(book.id),
  };
}

function sceneDto(row: SceneRow, characterIds: string[]): StorySceneDto {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    position: row.position,
    title: row.title,
    text: row.text,
    originalText: row.original_text,
    mood: row.mood,
    povId: row.pov_id,
    characterIds,
    updatedAt: row.updated_at,
  };
}

function castOf(sceneIds: string[]): Map<string, string[]> {
  const cast = new Map<string, string[]>();
  if (!sceneIds.length) return cast;
  for (const row of all<{ scene_id: string; character_id: string }>(
    `SELECT scene_id, character_id FROM story_scene_characters WHERE scene_id IN (${placeholders(sceneIds.length)})`,
    ...sceneIds,
  )) {
    cast.set(row.scene_id, [...(cast.get(row.scene_id) ?? []), row.character_id]);
  }
  return cast;
}

export function listBooks(): StoryBookSummaryDto[] {
  return all<BookRow>('SELECT * FROM story_books ORDER BY updated_at DESC').map(summary);
}

export function createBook(input: {
  title: string;
  premise?: string | null;
  mood?: string;
}): StoryBookSummaryDto {
  const id = newId();
  const timestamp = now();
  run(
    'INSERT INTO story_books (id, title, premise, mood, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    input.title,
    input.premise ?? null,
    input.mood ?? 'cosmos',
    timestamp,
    timestamp,
  );
  run(
    'INSERT INTO story_chapters (id, book_id, number, title, created_at) VALUES (?, ?, 1, ?, ?)',
    newId(),
    id,
    'Chapter one',
    timestamp,
  );
  return summary(requireBook(id));
}

export function updateBook(
  id: string,
  input: { title?: string; premise?: string | null; mood?: string },
) {
  requireBook(id);
  if (input.title !== undefined)
    run('UPDATE story_books SET title = ? WHERE id = ?', input.title, id);
  if (input.premise !== undefined)
    run('UPDATE story_books SET premise = ? WHERE id = ?', input.premise, id);
  if (input.mood !== undefined) run('UPDATE story_books SET mood = ? WHERE id = ?', input.mood, id);
  touch(id);
  return bookDetail(id);
}

export function deleteBook(id: string) {
  requireBook(id);
  run('DELETE FROM story_books WHERE id = ?', id);
}

export function bookDetail(id: string): StoryBookDto {
  const book = requireBook(id);
  const chapters = all<ChapterRow>(
    'SELECT id, number, title FROM story_chapters WHERE book_id = ? ORDER BY number',
    id,
  );
  const scenes = all<SceneRow>(
    'SELECT * FROM story_scenes WHERE book_id = ? ORDER BY position, created_at',
    id,
  );
  const cast = castOf(scenes.map((s) => s.id));
  const characters = all<{ id: string; name: string; role: string | null; notes: string | null }>(
    'SELECT id, name, role, notes FROM story_characters WHERE book_id = ? ORDER BY name',
    id,
  );
  const appearances = new Map<string, number>();
  for (const ids of cast.values())
    for (const cid of ids) appearances.set(cid, (appearances.get(cid) ?? 0) + 1);

  return {
    ...summary(book),
    chapters: chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      sceneIds: scenes.filter((s) => s.chapter_id === c.id).map((s) => s.id),
    })),
    floating: scenes.filter((s) => s.chapter_id === null).map((s) => s.id),
    scenes: scenes.map((s) => sceneDto(s, cast.get(s.id) ?? [])),
    characters: characters.map((c): StoryCharacterDto => ({
      ...c,
      sceneCount: appearances.get(c.id) ?? 0,
    })),
    links: all<{
      id: string;
      from_scene: string;
      to_scene: string;
      type: string;
      note: string | null;
    }>(
      'SELECT id, from_scene, to_scene, type, note FROM story_links WHERE book_id = ? ORDER BY created_at',
      id,
    ).map((l) => ({
      id: l.id,
      fromSceneId: l.from_scene,
      toSceneId: l.to_scene,
      type: l.type,
      label: storyLinkLabel(l.type),
      note: l.note,
    })),
    notes: all<{ id: string; title: string; body: string; updated_at: string }>(
      'SELECT id, title, body, updated_at FROM story_notes WHERE book_id = ? ORDER BY updated_at DESC',
      id,
    ).map((n): StoryNoteDto => ({
      id: n.id,
      title: n.title,
      body: n.body,
      updatedAt: n.updated_at,
    })),
  };
}

export function addChapter(bookId: string, title: string) {
  requireBook(bookId);
  const next =
    (get<{ n: number | null }>(
      'SELECT MAX(number) AS n FROM story_chapters WHERE book_id = ?',
      bookId,
    )?.n ?? 0) + 1;
  run(
    'INSERT INTO story_chapters (id, book_id, number, title, created_at) VALUES (?, ?, ?, ?, ?)',
    newId(),
    bookId,
    next,
    title,
    now(),
  );
  touch(bookId);
  return bookDetail(bookId);
}

export function renameChapter(bookId: string, chapterId: string, title: string) {
  run('UPDATE story_chapters SET title = ? WHERE id = ? AND book_id = ?', title, chapterId, bookId);
  touch(bookId);
  return bookDetail(bookId);
}

export function deleteChapter(bookId: string, chapterId: string) {
  transaction(() => {
    run(
      'UPDATE story_scenes SET chapter_id = NULL WHERE chapter_id = ? AND book_id = ?',
      chapterId,
      bookId,
    );
    run('DELETE FROM story_chapters WHERE id = ? AND book_id = ?', chapterId, bookId);
    const rest = all<{ id: string }>(
      'SELECT id FROM story_chapters WHERE book_id = ? ORDER BY number',
      bookId,
    );
    rest.forEach((c, i) => run('UPDATE story_chapters SET number = ? WHERE id = ?', i + 1, c.id));
  });
  touch(bookId);
  return bookDetail(bookId);
}

function chapterOrder(bookId: string, chapterId: string | null): number | null {
  if (!chapterId) return null;
  return (
    get<{ number: number }>(
      'SELECT number FROM story_chapters WHERE id = ? AND book_id = ?',
      chapterId,
      bookId,
    )?.number ?? null
  );
}

function setCast(bookId: string, sceneId: string, characterIds: string[]) {
  run('DELETE FROM story_scene_characters WHERE scene_id = ?', sceneId);
  const valid = characterIds.length
    ? all<{ id: string }>(
        `SELECT id FROM story_characters WHERE book_id = ? AND id IN (${placeholders(characterIds.length)})`,
        bookId,
        ...characterIds,
      )
    : [];
  for (const { id } of valid)
    run(
      'INSERT OR IGNORE INTO story_scene_characters (scene_id, character_id) VALUES (?, ?)',
      sceneId,
      id,
    );
}

function afterSave(bookId: string, sceneId: string): SceneSaveResultDto {
  const scene = requireScene(bookId, sceneId);
  const known = all<{ name: string }>(
    'SELECT name FROM story_characters WHERE book_id = ?',
    bookId,
  ).map((r) => r.name);
  const others = all<SceneRow>(
    'SELECT * FROM story_scenes WHERE book_id = ? AND id != ?',
    bookId,
    sceneId,
  );
  const linked = new Set(
    all<{ other: string }>(
      'SELECT CASE WHEN from_scene = ? THEN to_scene ELSE from_scene END AS other FROM story_links WHERE from_scene = ? OR to_scene = ?',
      sceneId,
      sceneId,
      sceneId,
    ).map((r) => r.other),
  );
  const echoes = suggestEchoes(
    {
      id: scene.id,
      title: scene.title,
      text: scene.text,
      order: chapterOrder(bookId, scene.chapter_id),
    },
    others
      .filter((o) => !linked.has(o.id))
      .map((o) => ({
        id: o.id,
        title: o.title,
        text: o.text,
        order: chapterOrder(bookId, o.chapter_id),
      })),
  );
  return {
    scene: sceneDto(scene, castOf([sceneId]).get(sceneId) ?? []),
    newNames: suggestCharacterNames(scene.text, known),
    echoes: echoes.map(({ sceneId: id, title, type, shared }) => ({
      sceneId: id,
      title,
      type,
      shared,
    })),
  };
}

function titleFor(text: string): string {
  const first = text.trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  const words = first
    .split(/\s+/)
    .slice(0, 7)
    .join(' ')
    .replace(/[.,;:!?]+$/, '');
  return words || 'Untitled scene';
}

export function createScene(
  bookId: string,
  input: {
    title?: string;
    text: string;
    originalText?: string;
    chapterId?: string | null;
    mood?: string | null;
    povId?: string | null;
    characterIds: string[];
  },
): SceneSaveResultDto {
  requireBook(bookId);
  if (input.chapterId && chapterOrder(bookId, input.chapterId) === null) throw notFound('Chapter');
  const id = newId();
  const timestamp = now();
  const original = input.originalText ?? input.text;
  const position =
    (get<{ n: number | null }>(
      'SELECT MAX(position) AS n FROM story_scenes WHERE book_id = ? AND chapter_id IS ?',
      bookId,
      input.chapterId ?? null,
    )?.n ?? -1) + 1;
  transaction(() => {
    run(
      `INSERT INTO story_scenes (id, book_id, chapter_id, position, title, text, original_text, mood, pov_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      bookId,
      input.chapterId ?? null,
      position,
      input.title?.trim() || titleFor(input.text),
      input.text,
      original,
      input.mood ?? null,
      input.povId ?? null,
      timestamp,
      timestamp,
    );
    setCast(
      bookId,
      id,
      input.povId ? [...new Set([...input.characterIds, input.povId])] : input.characterIds,
    );
  });
  touch(bookId);
  return afterSave(bookId, id);
}

export function updateScene(
  bookId: string,
  sceneId: string,
  input: Partial<{
    title: string;
    text: string;
    chapterId: string | null;
    mood: string | null;
    povId: string | null;
    characterIds: string[];
  }>,
): SceneSaveResultDto {
  const scene = requireScene(bookId, sceneId);
  if (input.chapterId && chapterOrder(bookId, input.chapterId) === null) throw notFound('Chapter');
  transaction(() => {
    if (input.title !== undefined)
      run(
        'UPDATE story_scenes SET title = ? WHERE id = ?',
        input.title.trim() || titleFor(input.text ?? scene.text),
        sceneId,
      );
    if (input.text !== undefined)
      run('UPDATE story_scenes SET text = ? WHERE id = ?', input.text, sceneId);
    if (input.chapterId !== undefined && input.chapterId !== scene.chapter_id) {
      const position =
        (get<{ n: number | null }>(
          'SELECT MAX(position) AS n FROM story_scenes WHERE book_id = ? AND chapter_id IS ?',
          bookId,
          input.chapterId,
        )?.n ?? -1) + 1;
      run(
        'UPDATE story_scenes SET chapter_id = ?, position = ? WHERE id = ?',
        input.chapterId,
        position,
        sceneId,
      );
    }
    if (input.mood !== undefined)
      run('UPDATE story_scenes SET mood = ? WHERE id = ?', input.mood, sceneId);
    if (input.povId !== undefined)
      run('UPDATE story_scenes SET pov_id = ? WHERE id = ?', input.povId, sceneId);
    if (input.characterIds !== undefined) {
      const pov = input.povId !== undefined ? input.povId : scene.pov_id;
      setCast(
        bookId,
        sceneId,
        pov ? [...new Set([...input.characterIds, pov])] : input.characterIds,
      );
    }
    run('UPDATE story_scenes SET updated_at = ? WHERE id = ?', now(), sceneId);
  });
  touch(bookId);
  return afterSave(bookId, sceneId);
}

export function tidyScene(bookId: string, sceneId: string): StorySceneDto {
  const scene = requireScene(bookId, sceneId);
  const tidy = makeReadingCopy(scene.text).text;
  run('UPDATE story_scenes SET text = ?, updated_at = ? WHERE id = ?', tidy, now(), sceneId);
  return afterSave(bookId, sceneId).scene;
}

export function restoreSceneOriginal(bookId: string, sceneId: string): StorySceneDto {
  const scene = requireScene(bookId, sceneId);
  run(
    'UPDATE story_scenes SET text = ?, updated_at = ? WHERE id = ?',
    scene.original_text,
    now(),
    sceneId,
  );
  return afterSave(bookId, sceneId).scene;
}

export function deleteScene(bookId: string, sceneId: string) {
  requireScene(bookId, sceneId);
  run('DELETE FROM story_scenes WHERE id = ?', sceneId);
  touch(bookId);
}

export function reorderScenes(
  bookId: string,
  order: { chapters: Array<{ id: string; sceneIds: string[] }>; floating: string[] },
) {
  requireBook(bookId);
  const chapterIds = new Set(
    all<{ id: string }>('SELECT id FROM story_chapters WHERE book_id = ?', bookId).map((c) => c.id),
  );
  const sceneIds = new Set(
    all<{ id: string }>('SELECT id FROM story_scenes WHERE book_id = ?', bookId).map((s) => s.id),
  );
  transaction(() => {
    const place = (ids: string[], chapterId: string | null) =>
      ids.forEach((id, index) => {
        if (sceneIds.has(id))
          run(
            'UPDATE story_scenes SET chapter_id = ?, position = ? WHERE id = ?',
            chapterId,
            index,
            id,
          );
      });
    for (const chapter of order.chapters)
      if (chapterIds.has(chapter.id)) place(chapter.sceneIds, chapter.id);
    place(order.floating, null);
  });
  touch(bookId);
  return bookDetail(bookId);
}

export function addCharacter(
  bookId: string,
  input: { name: string; role?: string | null; notes?: string | null },
) {
  requireBook(bookId);
  const exists = get<{ id: string }>(
    'SELECT id FROM story_characters WHERE book_id = ? AND lower(name) = lower(?)',
    bookId,
    input.name,
  );
  if (exists) throw new HttpError(409, `${input.name} is already in this book`);
  run(
    'INSERT INTO story_characters (id, book_id, name, role, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId(),
    bookId,
    input.name,
    input.role ?? null,
    input.notes ?? null,
    now(),
  );
  touch(bookId);
  return bookDetail(bookId);
}

export function updateCharacter(
  bookId: string,
  characterId: string,
  input: { name?: string; role?: string | null; notes?: string | null },
) {
  if (input.name !== undefined)
    run(
      'UPDATE story_characters SET name = ? WHERE id = ? AND book_id = ?',
      input.name,
      characterId,
      bookId,
    );
  if (input.role !== undefined)
    run(
      'UPDATE story_characters SET role = ? WHERE id = ? AND book_id = ?',
      input.role,
      characterId,
      bookId,
    );
  if (input.notes !== undefined)
    run(
      'UPDATE story_characters SET notes = ? WHERE id = ? AND book_id = ?',
      input.notes,
      characterId,
      bookId,
    );
  touch(bookId);
  return bookDetail(bookId);
}

export function deleteCharacter(bookId: string, characterId: string) {
  run('DELETE FROM story_characters WHERE id = ? AND book_id = ?', characterId, bookId);
  touch(bookId);
  return bookDetail(bookId);
}

export function addLink(
  bookId: string,
  input: { fromSceneId: string; toSceneId: string; type: string; note?: string | null },
) {
  if (input.fromSceneId === input.toSceneId) throw new HttpError(400, 'Pick two different scenes');
  requireScene(bookId, input.fromSceneId);
  requireScene(bookId, input.toSceneId);
  run(
    'INSERT INTO story_links (id, book_id, from_scene, to_scene, type, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newId(),
    bookId,
    input.fromSceneId,
    input.toSceneId,
    input.type,
    input.note ?? null,
    now(),
  );
  touch(bookId);
  return bookDetail(bookId);
}

export function deleteLink(bookId: string, linkId: string) {
  run('DELETE FROM story_links WHERE id = ? AND book_id = ?', linkId, bookId);
  touch(bookId);
  return bookDetail(bookId);
}

export function addNote(bookId: string, input: { title: string; body: string }) {
  requireBook(bookId);
  const timestamp = now();
  run(
    'INSERT INTO story_notes (id, book_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId(),
    bookId,
    input.title,
    input.body,
    timestamp,
    timestamp,
  );
  touch(bookId);
  return bookDetail(bookId);
}

export function updateNote(
  bookId: string,
  noteId: string,
  input: { title?: string; body?: string },
) {
  if (input.title !== undefined)
    run(
      'UPDATE story_notes SET title = ? WHERE id = ? AND book_id = ?',
      input.title,
      noteId,
      bookId,
    );
  if (input.body !== undefined)
    run('UPDATE story_notes SET body = ? WHERE id = ? AND book_id = ?', input.body, noteId, bookId);
  run('UPDATE story_notes SET updated_at = ? WHERE id = ? AND book_id = ?', now(), noteId, bookId);
  touch(bookId);
  return bookDetail(bookId);
}

export function deleteNote(bookId: string, noteId: string) {
  run('DELETE FROM story_notes WHERE id = ? AND book_id = ?', noteId, bookId);
  touch(bookId);
  return bookDetail(bookId);
}
