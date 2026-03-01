# Backup and Recovery (Yono DMC)

## 1) Supabase Backups
- Open Supabase project: `Database -> Backups`.
- Confirm daily backups are enabled for production.
- Verify latest backup timestamp is within last 24 hours.

## 2) Table Export (Operational)
- Use Supabase SQL editor or `pg_dump` for table-level exports.
- Priority tables:
  - `bookings`
  - `booking_items`
  - `payments`
  - `documents`
  - `support_requests`
  - `automation_failures`
  - `supplier_logs`
  - `admin_audit_logs`
- Store exports in secure internal storage only.

## 3) Secret Rotation
- Rotate keys in source provider first:
  - Razorpay API keys + webhook secret
  - Google OAuth client secret
  - Supabase service role key (planned window)
  - Twilio credentials (if enabled)
- Update Vercel env vars for all environments.
- Trigger redeploy after each rotation.
- Validate:
  - `/api/health`
  - `/api/admin/system/env-check`
  - `/admin/system/health`

## 4) Vercel Rollback
- Open Vercel project `Deployments`.
- Pick last known-good production deployment.
- Click `... -> Promote to Production` (or Redeploy that commit).
- Re-run smoke checks:
  - login
  - payment webhook
  - cron heartbeat
  - documents access

## 5) Incident Restore Order
1. Freeze new risky deploys.
2. Restore app to last stable deployment.
3. Validate DB health and restore backup only if data corruption is confirmed.
4. Replay failed automations from queue (`/admin/automation/failures`).
5. Document root cause and preventive action.

