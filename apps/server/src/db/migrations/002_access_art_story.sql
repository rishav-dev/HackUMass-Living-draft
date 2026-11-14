CREATE TABLE auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE scene_art (
  key TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE art_usage (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL
);

CREATE TABLE chapter_notes (
  age INTEGER PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE memories ADD COLUMN story_order INTEGER;
ALTER TABLE profile ADD COLUMN art_online INTEGER NOT NULL DEFAULT 1;
ALTER TABLE profile ADD COLUMN art_daily_limit INTEGER NOT NULL DEFAULT 8;
ALTER TABLE profile ADD COLUMN auto_lock_minutes INTEGER NOT NULL DEFAULT 30;
