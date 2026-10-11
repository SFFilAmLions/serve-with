-- SDDW-004 Batch 1: additive identity, consent history and legacy-session transition.
-- Do not rewrite earlier migrations or backfill unknown profile/agreement information.
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '[0-9a-f]*'),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email)) AND length(email) BETWEEN 3 AND 254 AND instr(email, '@') > 1),
  first_name TEXT CHECK (first_name IS NULL OR (length(trim(first_name)) BETWEEN 1 AND 100 AND first_name = trim(first_name))),
  last_name TEXT CHECK (last_name IS NULL OR (length(trim(last_name)) BETWEEN 1 AND 100 AND last_name = trim(last_name))),
  date_of_birth TEXT CHECK (date_of_birth IS NULL OR (length(date_of_birth) = 10 AND date_of_birth GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
  email_verified_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
  terms_accepted_at INTEGER,
  accepted_terms_version TEXT,
  accepted_privacy_version TEXT,
  CHECK ((terms_accepted_at IS NULL AND accepted_terms_version IS NULL AND accepted_privacy_version IS NULL)
     OR (terms_accepted_at IS NOT NULL AND length(trim(accepted_terms_version)) > 0 AND length(trim(accepted_privacy_version)) > 0))
);
CREATE INDEX idx_users_last_first ON users(last_name, first_name, id);
CREATE INDEX idx_users_first_last ON users(first_name, last_name, id);
CREATE TRIGGER users_created_at_immutable BEFORE UPDATE OF created_at ON users
WHEN NEW.created_at != OLD.created_at BEGIN SELECT RAISE(ABORT, 'created_at is immutable'); END;

CREATE TABLE agreement_acceptances (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  terms_version TEXT NOT NULL CHECK (length(trim(terms_version)) > 0),
  privacy_version TEXT NOT NULL CHECK (length(trim(privacy_version)) > 0),
  accepted_at INTEGER NOT NULL
);
CREATE INDEX idx_agreement_acceptances_user_time ON agreement_acceptances(user_id, accepted_at);
CREATE TRIGGER agreement_acceptances_no_update BEFORE UPDATE ON agreement_acceptances
BEGIN SELECT RAISE(ABORT, 'agreement history is append-only'); END;
CREATE TRIGGER agreement_acceptances_no_delete BEFORE DELETE ON agreement_acceptances
BEGIN SELECT RAISE(ABORT, 'agreement history is append-only'); END;

CREATE TABLE user_dob_audit (
  id TEXT PRIMARY KEY NOT NULL,
  subject_user_id TEXT NOT NULL REFERENCES users(id),
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  changed_at INTEGER NOT NULL
);
CREATE INDEX idx_user_dob_audit_subject_time ON user_dob_audit(subject_user_id, changed_at);
CREATE INDEX idx_user_dob_audit_actor ON user_dob_audit(actor_user_id);

ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
