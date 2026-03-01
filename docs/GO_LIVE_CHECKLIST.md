# Go Live Checklist (Yono DMC)

## Final Canonical Domain
- [x] Canonical domain selected: `https://www.yonodmc.in`
- [x] Redirect rule: `https://yonodmc.in/*` -> `https://www.yonodmc.in/*`
- [ ] `SITE_URL` in Vercel Production is set to: `https://www.yonodmc.in`

## Google OAuth (Customer Login)
- [ ] Authorized JavaScript origins include:
  - [ ] `https://www.yonodmc.in`
  - [ ] `https://yonodmc.in`
  - [ ] `http://localhost:3000`
- [ ] Authorized redirect URIs include:
  - [ ] `https://www.yonodmc.in/api/customer-auth/google/callback`
  - [ ] `https://yonodmc.in/api/customer-auth/google/callback`
  - [ ] `http://localhost:3000/api/customer-auth/google/callback`

## Razorpay
- [ ] Webhook URL configured exactly as:
  - [ ] `https://www.yonodmc.in/api/payments/webhook?provider=razorpay`
- [ ] `RAZORPAY_WEBHOOK_SECRET` set in Vercel Production.
- [ ] Sandbox webhook test updates payment + booking status.

## Automation Cron
- [ ] Cron URL configured with canonical host:
  - [ ] `https://www.yonodmc.in/api/internal/automation/retry?key=<INTERNAL_CRON_KEY>`
- [ ] `INTERNAL_CRON_KEY` set in Vercel Production.
- [ ] `Last Cron Retry` in `/admin/system/health` is fresh.

## Supabase
- [ ] RLS enabled on sensitive tables.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-side only.
- [ ] Storage policies allow required document read paths.

## CRM + Intake
- [ ] Website lead intake works and dedupes.
- [ ] WhatsApp webhook secured with `WHATSAPP_WEBHOOK_KEY`.

## Documents
- [ ] Invoice/voucher generation verified.
- [ ] Customer can access own docs in `/my-trips`.
- [ ] Missing documents reflected in KPI when failures occur.

## Admin Checks
- [ ] `/admin/control-center` loads with KPIs.
- [ ] `/admin/system/health` is green (webhook + cron fresh).
- [ ] `/admin/system/smoke-tests` returns no blocking failures.

## Logs
- [ ] No repeated 500s in auth/webhook/cron routes during smoke test window.
