CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  message text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_entity
ON admin_audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
ON admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text,
  customer_id text,
  customer_email text,
  customer_phone text,
  category text,
  subject text,
  message text,
  status text DEFAULT 'open',
  priority text DEFAULT 'normal',
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_booking
ON support_requests(booking_id);

CREATE INDEX IF NOT EXISTS idx_support_status
ON support_requests(status);

CREATE INDEX IF NOT EXISTS idx_support_created
ON support_requests(created_at DESC);

CREATE TABLE IF NOT EXISTS automation_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text,
  event text,
  status text DEFAULT 'failed',
  attempts integer DEFAULT 0,
  last_error text,
  payload jsonb,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_fail_booking
ON automation_failures(booking_id);

CREATE INDEX IF NOT EXISTS idx_auto_fail_status
ON automation_failures(status);
