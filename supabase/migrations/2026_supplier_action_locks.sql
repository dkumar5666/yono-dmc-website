CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS supplier_action_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL,
  supplier text NOT NULL,
  action text NOT NULL,
  idempotency_key text NOT NULL,
  status text DEFAULT 'locked',
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_supplier_action_locks_key
ON supplier_action_locks(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_supplier_action_locks_booking
ON supplier_action_locks(booking_id);

ALTER TABLE supplier_action_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'supplier_action_locks'
      AND policyname = 'supplier_action_locks_admin_only'
  ) THEN
    CREATE POLICY "supplier_action_locks_admin_only"
    ON supplier_action_locks
    FOR ALL
    USING (false);
  END IF;
END $$;
