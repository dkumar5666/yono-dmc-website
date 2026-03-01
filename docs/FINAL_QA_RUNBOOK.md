# Final QA Runbook (Launch-Grade)

This runbook is the final manual sweep before production traffic scaling.

## Preconditions
- Production deployment is healthy in Vercel.
- `SITE_URL` matches canonical host.
- `/admin/system/smoke-tests` shows no `FAIL` checks.

## Customer Portal
1. Open `/login` and confirm page renders with customer sign-in methods.
2. Test Google sign-in:
   - Start login.
   - Complete Google consent.
   - Verify redirect back succeeds and session is active.
3. Test Mobile OTP:
   - Request OTP.
   - Verify OTP.
   - Confirm clear error message appears for invalid OTP.
4. Open `/my-trips`:
   - Empty state must render without crash if no bookings.
5. Open `/my-trips/[booking_id]` (owned booking):
   - Documents section renders.
   - Pay Now appears only when unpaid link exists.
6. Submit support request from `/my-trips/[booking_id]/support`.

## Agent Portal
1. Open `/agent/login` and complete login.
2. Open `/agent/dashboard` and verify KPI cards load.
3. Create a lead from `/agent/leads/new`.
4. Confirm lead appears in `/agent/leads`.
5. Open `/agent/quotes` and `/agent/bookings` for owned records only.

## Supplier Portal
1. Open `/supplier/login` and complete login.
2. Open `/supplier/dashboard` and verify assigned bookings load.
3. Open `/supplier/bookings/[booking_id]` for an assigned booking.
4. Run Confirm action.
5. Upload supplier invoice from supplier portal.
6. Submit an issue report and verify success state.

## Official/Admin Portal
1. Open `/official/login` and complete login.
2. Verify `/admin/control-center` loads and KPIs render.
3. Open `/admin/crm/leads` and confirm pipeline + table views load.
4. Open:
   - `/admin/bookings`
   - `/admin/payments`
   - `/admin/refunds`
   - `/admin/documents`
   and verify empty/non-empty states do not crash.
5. Verify global admin search returns results and navigates correctly.
6. Open `/admin/automation/failures` and `/admin/automation/failures/[id]`.

## Automations + Reliability
1. Verify cron retry heartbeat is fresh in:
   - `/admin/system/health`
   - `/admin/system/smoke-tests`
2. Verify payment webhook heartbeat is fresh.
3. Retry at least one failed automation record from admin queue.
4. Confirm failed docs can be retried and status updates correctly.

## Security Assertions
1. Customer cannot access `/admin/*`.
2. Agent cannot access `/supplier/*`.
3. Supplier cannot open unassigned booking by guessed `booking_id`.
4. Customer cannot open another customer’s booking.

## Log Correlation
- For each failed API action, capture `x-request-id` from response.
- Use Vercel logs filtered by request id and route for root-cause analysis.

## Exit Criteria
- No blocker failures in smoke tests.
- No unhandled 500s across auth, payment webhook, and lead intake flows.
- All critical role-isolation checks pass.
