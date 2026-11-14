ALTER TABLE profile ADD place_name TEXT;
ALTER TABLE profile ADD place_lat REAL;
ALTER TABLE profile ADD place_lon REAL;
ALTER TABLE profile ADD weather_on INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile ADD temp_unit TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE memory_versions ADD capture_context TEXT;

CREATE TABLE memory_weather (
  memory_id TEXT PRIMARY KEY REFERENCES memories (id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  place TEXT,
  date TEXT,
  code INTEGER,
  temp_max REAL,
  temp_min REAL,
  precipitation REAL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE place_cache (
  query TEXT PRIMARY KEY,
  name TEXT,
  lat REAL,
  lon REAL,
  fetched_at TEXT NOT NULL
);
