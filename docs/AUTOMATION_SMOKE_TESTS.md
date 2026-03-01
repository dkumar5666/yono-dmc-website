# Automation Smoke Tests

Date: 2026-02-27

These tests verify retry queue behavior, manual override, and heartbeat visibility.

## Preconditions
- Supabase env vars configured (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- `INTERNAL_CRON_KEY` configured in environment.
- Admin user can access `/admin` routes.

## Test 1: Seed a Failed Automation Row

Run in Supabase SQL Editor:

```sql
insert into automation_failures (
  booking_id,
  event,
  status,
  attempts,
  last_error,
  payload,
  meta,
  updated_at
) values (
  '<BOOKING_ID_OR_CODE>',
  'documents.generated',
  'failed',
  0,
  'smoke test seed',
  jsonb_build_object('booking_id', '<BOOKING_ID_OR_CODE>'),
  jsonb_build_object('source', 'smoke_test'),
  now() - interval '10 minutes'
);
```

Expected:
- Row is created in `automation_failures`.

## Test 2: Trigger Retry Worker

Call:

```bash
curl "https://www.yonodmc.in/api/internal/automation/retry?key=<INTERNAL_CRON_KEY>"
```

Expected:
- JSON summary returns (no 500):
  - `processed` >= 1
- Seeded row transitions:
  - `status` becomes `retrying` during claim and then `resolved` or `failed`
  - `attempts` increments by 1
  - `meta.retry_history` appends timestamp
  - `last_error` updates on failure

## Test 3: Backoff + Retry Limit

For a row that keeps failing:
- Attempt 1 eligible after 5 min
- Attempt 2 eligible after 15 min
- Attempt 3 eligible after 45 min
- After attempts reaches 3, row is no longer eligible.

Expected:
- Worker does not process rows before backoff window.
- Worker does not process rows with `attempts >= 3`.

## Test 4: Heartbeat Freshness

Open:
- `/admin/system/health`

Expected:
- `Last Cron Retry` shows a recent time.
- Status badge is `OK` if within 15 minutes.
- Stale heartbeat shows red hard-fail banner.

## Test 5: Admin Queue + Detail

1. Open `/admin/automation/failures`
2. Open a failure detail page.
3. Click **Mark Resolved**.

Expected:
- API returns success.
- Failure row status updates to `resolved`.
- `admin_audit_logs` gets an entry with action `mark_failure_resolved`.

## Test 6: Audit Verification

Query in Supabase:

```sql
select created_at, action, entity_type, entity_id, message
from admin_audit_logs
where entity_type = 'automation_failure'
order by created_at desc
limit 20;
```

Expected:
- Mark Resolved action exists for the selected failure id.

## Test 7: Control Center Consistency

Open:
- `/admin/control-center`

Expected:
- `Failed Automations` and `Retries In Progress` reflect queue status.
- Alerts link to failures page when failures are present.

## Troubleshooting

- If retry endpoint returns `401`, verify `INTERNAL_CRON_KEY`.
- If no rows process, check `status='failed'`, attempts `<3`, and backoff timing.
- If tables are missing, UI should still load with empty/fallback states.
