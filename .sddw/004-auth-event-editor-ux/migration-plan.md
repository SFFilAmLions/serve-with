-- SDDW 004 proposed migration shape (DESIGN ONLY; not a deployable migration).
-- Final SQL belongs in migrations/0004_users_and_agreements.sql after approval.

users
  id TEXT PRIMARY KEY
  email TEXT NOT NULL UNIQUE                  -- normalized lowercase
  first_name TEXT                             -- required before privileged mutations
  last_name TEXT
  date_of_birth TEXT                          -- YYYY-MM-DD calendar date
  email_verified_at INTEGER
  created_at INTEGER NOT NULL                 -- immutable
  updated_at INTEGER NOT NULL
  terms_accepted_at INTEGER                   -- latest required-bundle acceptance
  accepted_terms_version TEXT
  accepted_privacy_version TEXT

agreement_acceptances
  id TEXT PRIMARY KEY
  user_id TEXT NOT NULL REFERENCES users(id)
  terms_version TEXT NOT NULL
  privacy_version TEXT NOT NULL
  accepted_at INTEGER NOT NULL
  -- append only; index (user_id, accepted_at)

user_dob_audit
  id TEXT PRIMARY KEY
  subject_user_id TEXT NOT NULL REFERENCES users(id)
  actor_user_id TEXT NOT NULL REFERENCES users(id)
  changed_at INTEGER NOT NULL
  -- Deliberately do NOT retain old/new DOB values in this audit table.
  -- The audit proves that an administrator performed a correction; the current
  -- DOB remains only on the user record. Do not write DOB values to logs.

sessions (existing)
  -- Keep token_hash PK/expires/created fields.
  -- Add nullable user_id during transition.
  -- For an existing valid session, resolve normalized session.email to a user
  -- idempotently, set sessions.user_id, and continue the session subject to
  -- profile/current-agreement gates. Do not force logout solely for migration.
  -- Retain email temporarily for backwards-compatible active-session migration.
  -- New sessions write user_id immediately after verified-email resolution.
  -- Make stable user_id authoritative after transition; removal of legacy email is later cleanup.

login_challenges (existing)
  -- Keep challenge email because verification begins before a user necessarily exists.

Concurrency rule
  INSERT user with a generated UUID using normalized email uniqueness;
  on uniqueness conflict, select the existing row. Never create two identities for one normalized email.

Authorization rule
  session -> user_id -> verified/profile/current-agreement gates -> role check.
  config/admins.yaml remains the administrator-role source in SDDW 004.
  staging registration eligibility is a separate server-only configuration.


Data constraints for executable migration
  normalized email is lower-case/trimmed before persistence and uniqueness checks;
  first_name/last_name are trimmed and length-bounded by server validation;
  date_of_birth, when present, matches YYYY-MM-DD and is validated as a real calendar date by application logic;
  accepted version summary fields are either both current values from one successful acceptance transaction or nullable before acceptance;
  agreement_acceptances rows are append-only at the application/API layer;
  foreign-key indexes are added for user_id/subject_user_id and directory sort/search indexes are reviewed against D1 query plans before finalization.

DOB correction audit decision
  SDDW 004 stores actor_user_id, subject_user_id and changed_at only.
  It does not retain previous/new DOB values in the audit history.
  This minimizes sensitive historical data while still recording use of the privileged correction capability.
