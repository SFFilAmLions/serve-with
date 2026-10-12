-- SDDW-006: signup persistence. PREPARED ONLY; do not apply before staging authorization.
-- Email-null stub migration is intentionally separate because rebuilding users
-- must preserve sessions, agreement history and other foreign key references.
ALTER TABLE events ADD COLUMN capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0);

-- Shared participation IDs cover registered users and unclaimed stubs
-- without rebuilding the existing users table or its foreign keys.
CREATE TABLE participation_identities (
 id TEXT PRIMARY KEY NOT NULL
);
INSERT INTO participation_identities(id) SELECT id FROM users;
CREATE TRIGGER participation_user_insert AFTER INSERT ON users
BEGIN
 INSERT OR IGNORE INTO participation_identities(id) VALUES(NEW.id);
END;


CREATE TABLE event_signups (
  id TEXT PRIMARY KEY NOT NULL,
  event_id TEXT NOT NULL REFERENCES events(id),
  user_id TEXT NOT NULL REFERENCES participation_identities(id),
  created_at INTEGER NOT NULL,
  deleted_at INTEGER CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);
CREATE UNIQUE INDEX idx_event_signups_active_pair
  ON event_signups(event_id,user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_event_signups_event_active
  ON event_signups(event_id,created_at,id) WHERE deleted_at IS NULL;
CREATE INDEX idx_event_signups_event_history
  ON event_signups(event_id,created_at DESC,id);
CREATE INDEX idx_event_signups_user_history
  ON event_signups(user_id,created_at DESC,id);

-- Atomic capacity enforcement: SQLite/D1 executes each INSERT serially.
-- This guard runs inside the INSERT statement transaction, *not* in the UI
-- or in a prior count query. The handler must independently check that the
-- event has not started, and use INSERT (not INSERT OR REPLACE).
CREATE TRIGGER event_signups_capacity_before_insert
BEFORE INSERT ON event_signups
WHEN NEW.deleted_at IS NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM events WHERE id = NEW.event_id AND deleted_at IS NULL
  ) THEN RAISE(ABORT, 'Event unavailable') END;
  SELECT CASE WHEN NEW.created_at >= (
    SELECT start_at FROM events WHERE id = NEW.event_id
  ) THEN RAISE(ABORT, 'Signups closed') END;
  SELECT CASE WHEN (
    SELECT capacity FROM events WHERE id = NEW.event_id
  ) IS NOT NULL AND (
    SELECT COUNT(*) FROM event_signups
    WHERE event_id = NEW.event_id AND deleted_at IS NULL
  ) >= (
    SELECT capacity FROM events WHERE id = NEW.event_id
  ) THEN RAISE(ABORT, 'Event full') END;
END;

-- Never lower capacity below the actual active roster, including concurrent
-- mutations; legacy event editors must handle this constraint gracefully.
CREATE TRIGGER events_capacity_before_update
BEFORE UPDATE OF capacity ON events
WHEN NEW.capacity IS NOT NULL AND NEW.capacity < (
  SELECT COUNT(*) FROM event_signups WHERE event_id = NEW.id AND deleted_at IS NULL
)
BEGIN SELECT RAISE(ABORT, 'Capacity below active signups'); END;
