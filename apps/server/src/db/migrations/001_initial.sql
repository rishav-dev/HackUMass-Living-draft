CREATE TABLE profile (
  id TEXT PRIMARY KEY,
  preferred_name TEXT NOT NULL,
  current_age INTEGER NOT NULL,
  age_recorded_on TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  pronouns TEXT,
  hemisphere TEXT NOT NULL DEFAULT 'unknown',
  date_order TEXT NOT NULL DEFAULT 'mdy',
  narrative_voice TEXT NOT NULL DEFAULT 'first',
  owl_name TEXT NOT NULL DEFAULT 'Pip',
  motion TEXT NOT NULL DEFAULT 'system',
  density TEXT NOT NULL DEFAULT 'rich',
  keep_audio INTEGER NOT NULL DEFAULT 1,
  sound_effects INTEGER NOT NULL DEFAULT 1,
  ambient_sound INTEGER NOT NULL DEFAULT 1,
  volume REAL NOT NULL DEFAULT 0.6,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('life', 'story')),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  current_version_id TEXT,
  place TEXT,
  sensitive INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'ok' CHECK (review_status IN ('ok', 'needs_review')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE memory_versions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  source_kind TEXT NOT NULL,
  mode TEXT NOT NULL,
  original_text TEXT NOT NULL,
  reading_copy TEXT NOT NULL,
  composed_text TEXT NOT NULL,
  audio_id TEXT,
  note TEXT,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX memory_versions_memory ON memory_versions (memory_id, seq);

CREATE TABLE temporal_estimates (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  precision TEXT NOT NULL,
  age_min INTEGER,
  age_max INTEGER,
  year INTEGER,
  month INTEGER,
  day INTEGER,
  season TEXT,
  approximate INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  superseded_at TEXT
);
CREATE INDEX temporal_current ON temporal_estimates (memory_id, superseded_at);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  relationship TEXT,
  kin_key TEXT,
  notes TEXT,
  provisional INTEGER NOT NULL DEFAULT 1,
  photo_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE character_aliases (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized TEXT NOT NULL,
  UNIQUE (character_id, normalized)
);
CREATE INDEX character_aliases_normalized ON character_aliases (normalized);

CREATE TABLE character_mentions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES memory_versions (id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
  surface TEXT NOT NULL,
  span_start INTEGER NOT NULL,
  span_end INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('central', 'supporting', 'mentioned')),
  role_evidence TEXT,
  confirmed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX character_mentions_version ON character_mentions (version_id);
CREATE INDEX character_mentions_character ON character_mentions (character_id);

CREATE TABLE emotion_tags (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('then', 'now')),
  source TEXT NOT NULL CHECK (source IN ('suggested', 'user')),
  evidence TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (memory_id, tag, phase)
);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('pending', 'memory', 'capsule', 'reflection', 'character')),
  owner_id TEXT,
  version_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'video', 'audio', 'scan')),
  file_name TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  caption TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX media_owner ON media_assets (owner_type, owner_id);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  age_min INTEGER,
  age_max INTEGER,
  year INTEGER,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE milestone_memories (
  milestone_id TEXT NOT NULL REFERENCES milestones (id) ON DELETE CASCADE,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, memory_id)
);

CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('suggested', 'confirmed', 'dismissed')),
  origin TEXT NOT NULL CHECK (origin IN ('suggested', 'manual')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE connection_endpoints (
  connection_id TEXT NOT NULL REFERENCES connections (id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('memory', 'character', 'milestone')),
  node_id TEXT NOT NULL,
  evidence_quote TEXT,
  evidence_start INTEGER,
  evidence_end INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (connection_id, node_type, node_id)
);
CREATE INDEX connection_endpoints_node ON connection_endpoints (node_type, node_id);

CREATE TABLE review_items (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  earlier_version_id TEXT NOT NULL,
  later_version_id TEXT NOT NULL,
  change_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL
);

CREATE TABLE version_resolutions (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  earlier_version_id TEXT NOT NULL,
  later_version_id TEXT NOT NULL,
  change_kind TEXT NOT NULL,
  earlier_text TEXT,
  later_text TEXT,
  resolution TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE reflections (
  id TEXT PRIMARY KEY,
  original_text TEXT NOT NULL,
  body TEXT NOT NULL,
  audio_id TEXT,
  capsule_id TEXT,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE reflection_memories (
  reflection_id TEXT NOT NULL REFERENCES reflections (id) ON DELETE CASCADE,
  memory_id TEXT NOT NULL REFERENCES memories (id) ON DELETE CASCADE,
  PRIMARY KEY (reflection_id, memory_id)
);

CREATE TABLE capsules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_text TEXT NOT NULL,
  body TEXT NOT NULL,
  authored_at TEXT NOT NULL,
  authored_age INTEGER NOT NULL,
  unlock_kind TEXT NOT NULL CHECK (unlock_kind IN ('date', 'milestone')),
  unlock_date TEXT,
  unlock_milestone TEXT,
  milestone_reached INTEGER NOT NULL DEFAULT 0,
  opened_at TEXT,
  reflection_id TEXT,
  audio_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  question TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE map_positions (
  node_id TEXT PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  updated_at TEXT NOT NULL
);
