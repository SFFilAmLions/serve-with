-- SDDW-006: prepare nullable emails and marked, unclaimed stub identities.
-- NEVER APPLY until separately approved and tested on staging D1.
-- D1 applies migrations transactionally. Defer FKs for the required SQLite
-- table rebuild and verify there are no orphan references before releasing.
PRAGMA defer_foreign_keys=ON;

CREATE TABLE users_new (
 id TEXT PRIMARY KEY NOT NULL CHECK(length(id)=36 AND id GLOB '[0-9a-f]*'),
 email TEXT UNIQUE CHECK(email IS NULL OR (email=lower(trim(email)) AND length(email) BETWEEN 3 AND 254 AND instr(email,'@')>1)),
 first_name TEXT CHECK(first_name IS NULL OR (length(trim(first_name)) BETWEEN 1 AND 100 AND first_name=trim(first_name))),
 last_name TEXT CHECK(last_name IS NULL OR (length(trim(last_name)) BETWEEN 1 AND 100 AND last_name=trim(last_name))),
 date_of_birth TEXT CHECK(date_of_birth IS NULL OR (length(date_of_birth)=10 AND date_of_birth GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
 email_verified_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL CHECK(updated_at>=created_at),
 terms_accepted_at INTEGER,
 accepted_terms_version TEXT,
 accepted_privacy_version TEXT,
 is_stub INTEGER NOT NULL DEFAULT 0 CHECK(is_stub IN (0,1)),
 CHECK(is_stub=1 OR email IS NOT NULL),
 CHECK(is_stub=0 OR (first_name IS NOT NULL AND last_name IS NOT NULL)),
 CHECK((terms_accepted_at IS NULL AND accepted_terms_version IS NULL AND accepted_privacy_version IS NULL)
   OR (terms_accepted_at IS NOT NULL AND length(trim(coalesce(accepted_terms_version,'')))>0
     AND length(trim(coalesce(accepted_privacy_version,'')))>0))
);
INSERT INTO users_new(id,email,first_name,last_name,date_of_birth,email_verified_at,created_at,updated_at,
 terms_accepted_at,accepted_terms_version,accepted_privacy_version,is_stub)
SELECT id,email,first_name,last_name,date_of_birth,email_verified_at,created_at,updated_at,
 terms_accepted_at,accepted_terms_version,accepted_privacy_version,0 FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE INDEX idx_users_last_first ON users(last_name,first_name,id);
CREATE INDEX idx_users_first_last ON users(first_name,last_name,id);
CREATE TRIGGER users_created_at_immutable BEFORE UPDATE OF created_at ON users
WHEN NEW.created_at!=OLD.created_at BEGIN SELECT RAISE(ABORT,'created_at is immutable'); END;
