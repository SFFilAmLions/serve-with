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
  -- Store enough change evidence for audit only after retention/privacy review.
  -- Do not write DOB values to application logs.

sessions (existing)
  -- Keep token_hash PK/expires/created fields.
  -- Add nullable user_id during transition, backfilled/resolved from normalized email.
  -- Retain email temporarily for backwards-compatible active-session migration.
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
