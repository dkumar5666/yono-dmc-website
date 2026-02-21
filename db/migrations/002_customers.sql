CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  full_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id),
  UNIQUE(email),
  UNIQUE(phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_provider_user
  ON customers(provider, provider_user_id);

