-- Auth throttling counters are isolated to staging D1 and store only pepper-hashed identities.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window)
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_window ON auth_rate_limits(window);
