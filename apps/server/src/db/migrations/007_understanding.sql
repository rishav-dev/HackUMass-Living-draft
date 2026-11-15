ALTER TABLE memories ADD summary TEXT;
ALTER TABLE memories ADD time_kind TEXT;
ALTER TABLE memories ADD time_hint TEXT;
ALTER TABLE memories ADD bookmarked_at TEXT;

CREATE TABLE memory_questions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  version_id TEXT REFERENCES memory_versions (id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT,
  asked_at TEXT NOT NULL,
  answered_at TEXT
);
CREATE INDEX memory_questions_memory ON memory_questions (memory_id);

CREATE TABLE memory_themes (
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  evidence TEXT,
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'user')),
  PRIMARY KEY (memory_id, theme)
);
CREATE INDEX memory_themes_theme ON memory_themes (theme);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT,
  region TEXT,
  country TEXT,
  lat REAL,
  lon REAL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX places_name ON places (name COLLATE NOCASE);

CREATE TABLE memory_places (
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  place_id TEXT NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, place_id)
);
CREATE INDEX memory_places_place ON memory_places (place_id);

CREATE TABLE memory_vectors (
  memory_id TEXT PRIMARY KEY REFERENCES memories (id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  vector TEXT NOT NULL
);
