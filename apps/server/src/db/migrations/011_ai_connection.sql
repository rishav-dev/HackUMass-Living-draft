CREATE TABLE ai_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0,
  endpoint TEXT,
  model TEXT,
  api_key TEXT,
  updated_at TEXT
);
