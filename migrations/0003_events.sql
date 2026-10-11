-- SDDW 003: events (additive migration; existing authentication tables unchanged).
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  location TEXT NOT NULL CHECK(length(trim(location)) BETWEEN 1 AND 500),
  timezone TEXT NOT NULL CHECK(length(trim(timezone)) > 0),
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL CHECK(end_at > start_at),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_events_upcoming ON events(end_at, start_at, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_order ON events(start_at, id) WHERE deleted_at IS NULL;
