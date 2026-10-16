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

-- Enforce the same exact cutoff when withdrawing, even if two concurrent
-- Worker requests interleave after the initial event-start check.
CREATE TRIGGER event_signups_withdraw_before_update
BEFORE UPDATE OF deleted_at ON event_signups
WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.deleted_at >= (
    SELECT start_at FROM events WHERE id = OLD.event_id
  ) THEN RAISE(ABORT, 'Withdrawals closed') END;
END;

-- A withdrawn row is immutable: re-signing creates a new distinct row.
CREATE TRIGGER event_signups_withdrawn_immutable
BEFORE UPDATE OF deleted_at ON event_signups
WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NOT OLD.deleted_at
BEGIN SELECT RAISE(ABORT, 'Withdrawal history is immutable'); END;

-- A signup is an append-only identity/event association. Neither an admin
-- operation nor a later identity claim may reassign or backdate the record.
-- Withdrawals only set deleted_at and preserve this original audit history.
CREATE TRIGGER event_signups_identity_immutable
BEFORE UPDATE OF id,event_id,user_id,created_at ON event_signups
WHEN NEW.id IS NOT OLD.id
  OR NEW.event_id IS NOT OLD.event_id
  OR NEW.user_id IS NOT OLD.user_id
  OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT, 'Signup identity and creation time are immutable'); END;

-- Participation history is append-only: ordinary withdrawals are soft-deletes.
-- Hard deletes would erase accountability for delegated signup operations.
CREATE TRIGGER event_signups_no_hard_delete
BEFORE DELETE ON event_signups
BEGIN SELECT RAISE(ABORT, 'Signup history must be retained'); END;
