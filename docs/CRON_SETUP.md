# Cron Setup (Automation Retry Worker)

Date: 2026-02-27

## Endpoint
- Route: `GET /api/internal/automation/retry`
- Also supports: `POST /api/internal/automation/retry`
- Auth requirement: internal key
  - Header: `x-internal-key: <INTERNAL_CRON_KEY>`
  - Or query string: `?key=<INTERNAL_CRON_KEY>`

## Recommended Production Setup (Vercel Dashboard)

Use Vercel Cron Jobs in dashboard to avoid hardcoding secrets in repo.

1. Open Vercel project: `yono-dmc-b2c`
2. Go to: **Settings -> Cron Jobs**
3. Add job:
   - Path:
     - `/api/internal/automation/retry?key=${INTERNAL_CRON_KEY}`
     - If dashboard does not support env interpolation in path, paste the actual key value once.
   - Schedule: `*/5 * * * *` (every 5 minutes)
4. Save.

## Optional vercel.json (only if team prefers code-managed cron)

Current repo uses dashboard-driven cron. If you switch to file-based cron, add a `crons` entry in `vercel.json` and keep secrets out of Git.

## Required Env Vars
- `INTERNAL_CRON_KEY` (Production, Preview, Development as needed)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Verify Cron Is Running

1. Trigger once manually:
   - `https://www.yonodmc.in/api/internal/automation/retry?key=<INTERNAL_CRON_KEY>`
2. Expect JSON summary:
   - `{ "processed": <n>, "resolved": <n>, "still_failed": <n> }`
3. Check heartbeat freshness:
   - `/admin/system/health`
   - `Last Cron Retry` should show recent timestamp and `OK` (not stale > 15 min).
4. Check logs:
   - Vercel -> Logs, filter path `/api/internal/automation/retry`

## Security Notes

- Never expose `INTERNAL_CRON_KEY` in client code.
- Keep retry route internal-only.
- Rotate `INTERNAL_CRON_KEY` periodically.
