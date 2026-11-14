CREATE TABLE story_books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  premise TEXT,
  mood TEXT NOT NULL DEFAULT 'cosmos',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE story_chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES story_books (id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE story_characters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES story_books (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE story_scenes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES story_books (id) ON DELETE CASCADE,
  chapter_id TEXT REFERENCES story_chapters (id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  original_text TEXT NOT NULL,
  mood TEXT,
  pov_id TEXT REFERENCES story_characters (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE story_scene_characters (
  scene_id TEXT NOT NULL REFERENCES story_scenes (id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES story_characters (id) ON DELETE CASCADE,
  PRIMARY KEY (scene_id, character_id)
);

CREATE TABLE story_links (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES story_books (id) ON DELETE CASCADE,
  from_scene TEXT NOT NULL REFERENCES story_scenes (id) ON DELETE CASCADE,
  to_scene TEXT NOT NULL REFERENCES story_scenes (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE story_notes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES story_books (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX story_scenes_book ON story_scenes (book_id, chapter_id, position);
CREATE INDEX story_chapters_book ON story_chapters (book_id, number);
