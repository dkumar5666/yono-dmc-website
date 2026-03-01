# Post Launch Plan (Yono DMC)

## Daily Monitoring (Operations)
1. Open `/admin/control-center` and review KPI cards and alerts.
2. Open `/admin/system/health` and confirm webhook + cron freshness.
3. Open `/admin/system/smoke-tests` and run checks at least once daily.
4. Review Vercel logs for repeated 4xx/5xx on:
   - `/api/customer-auth/google/callback`
   - `/api/auth/supabase/otp/send`
   - `/api/auth/supabase/otp/verify`
   - `/api/payments/webhook`
   - `/api/internal/automation/retry`

## KPI Thresholds
- Pending Payments:
  - `0-10`: normal
  - `11-30`: monitor and follow up
  - `>30`: escalation to sales ops
- Missing Documents:
  - `0`: healthy
  - `1-10`: retry generation + verify storage
  - `>10`: escalation to engineering
- Failed Automations (24h):
  - `0`: healthy
  - `1-5`: investigate queue entries
  - `>5`: incident mode
- Retries In Progress:
  - `0-5`: normal
  - `>5`: review cron/handler stability
- Open Support Requests:
  - `0-20`: normal
  - `>20`: assign extra support bandwidth

## Incident Response (Quick Runbook)
1. Check stale status in `/admin/system/health`.
2. If webhook stale:
   - verify Razorpay webhook URL + secret
   - replay latest webhook from Razorpay dashboard
3. If cron stale:
   - verify Vercel Cron job URL and key
   - run `/api/internal/automation/retry?key=...` manually once
4. If failed automations spike:
   - open `/admin/automation/failures`
   - inspect failure detail
   - resolve root cause then retry/mark resolved
5. If missing docs spike:
   - open `/admin/documents?missing_only=1`
   - inspect storage/path errors
   - trigger regenerate from booking detail

## Weekly Review
1. Export CSV:
   - `/admin/crm/leads`
   - `/admin/bookings`
   - `/admin/payments`
2. Review conversion funnel:
   - Leads -> Bookings -> Paid
3. Review auth stability:
   - Google callback success/failure trend
   - OTP provider error trend

## Ownership
- Sales Ops: leads/pending payments/support queue
- Finance Ops: payment reconciliation/webhook anomalies
- Tech Ops: automations/docs/cron/webhook health
