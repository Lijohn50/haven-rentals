ALTER TABLE users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE users SET updated_at = created_at;
UPDATE bookings SET updated_at = created_at;

CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users (updated_at DESC);