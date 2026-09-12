PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  draft TEXT NOT NULL,
  published TEXT,
  share_token TEXT UNIQUE NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  passcode_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS api_locks (
  key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS api_gate (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO api_gate (id, next_at) VALUES (1, 0);
