CREATE TABLE character_links (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (from_id, to_id)
);

CREATE INDEX character_links_to ON character_links (to_id);

CREATE TABLE art_declined (
  key TEXT PRIMARY KEY,
  declined_at TEXT NOT NULL
);
