-- SDDW-006: additive unclaimed identities. PREPARED; do not apply without approval.
-- Existing users/email constraints, sessions and consent tables stay unchanged.
-- The ID is already represented by participation_identities, shared with users.
CREATE TABLE user_stubs (
 id TEXT PRIMARY KEY NOT NULL REFERENCES participation_identities(id),
 email TEXT UNIQUE CHECK(email IS NULL OR (email=lower(trim(email)) AND length(email) BETWEEN 3 AND 254 AND instr(email,'@')>1)),
 first_name TEXT NOT NULL CHECK(length(trim(first_name)) BETWEEN 1 AND 100 AND first_name=trim(first_name)),
 last_name TEXT NOT NULL CHECK(length(trim(last_name)) BETWEEN 1 AND 100 AND last_name=trim(last_name)),
 date_of_birth TEXT CHECK(date_of_birth IS NULL OR (length(date_of_birth)=10 AND date_of_birth GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL CHECK(updated_at>=created_at),
 claimed_at INTEGER
);
CREATE INDEX idx_user_stubs_name ON user_stubs(last_name,first_name,id);
CREATE TRIGGER user_stubs_created_at_immutable BEFORE UPDATE OF created_at ON user_stubs
WHEN NEW.created_at!=OLD.created_at BEGIN SELECT RAISE(ABORT,'created_at is immutable'); END;
