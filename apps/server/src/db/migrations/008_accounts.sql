ALTER TABLE auth ADD email TEXT;
ALTER TABLE auth ADD display_name TEXT;
ALTER TABLE auth ADD verified_at TEXT;
ALTER TABLE auth ADD totp_secret TEXT;
ALTER TABLE auth ADD google_sub TEXT;
ALTER TABLE sessions ADD persistent INTEGER NOT NULL DEFAULT 1;
ALTER TABLE profile ADD location_mode TEXT NOT NULL DEFAULT 'home';

CREATE TABLE auth_codes (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  payload TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE trusted_devices (
  token_hash TEXT PRIMARY KEY,
  label TEXT,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
