# Release Process (Yono DMC)

## Branching Strategy
- `main` = production.
- Feature/fix work on short-lived branches:
  - `feat/*`
  - `fix/*`
  - `hotfix/*`
- Merge to `main` only after lint/build and smoke tests pass.

## Staging Deploy (Vercel Preview)
1. Push feature branch to GitHub.
2. Open Vercel preview deployment for that commit.
3. Set `APP_MODE=staging` for preview environment.
4. Run staging checklist:
   - auth flow
   - CRM intake
   - admin control center
   - system health
   - automation retry

## Production Deploy
1. Merge approved branch to `main`.
2. Confirm Vercel production deployment is `Ready`.
3. Verify required env vars in production:
   - `/api/admin/system/env-check`
4. Run production smoke tests:
   - login
   - `/my-trips`
   - webhook heartbeat
   - cron heartbeat
   - document access

## Hotfix Process
1. Create `hotfix/*` branch from `main`.
2. Apply minimal scoped fix.
3. Run `npm run lint` and `npm run build`.
4. Merge to `main`.
5. Confirm production deployment and logs stabilize.

## Pre-Merge Quality Gate
- [ ] No secrets in code/logs.
- [ ] No breaking API route changes.
- [ ] Build passes locally.
- [ ] Admin pages load with empty/fallback data.

