# 5-Day Execution Task Board (V1 Build Sprint)

Use this as the daily working board.  
Status keys:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## Today Focus (Update Every Morning)
- Date: 2026-02-22
- Day Target: Day 5 - Launch Readiness + Hard QA
- Top 3 Priorities:
  - 1. Security guardrails (rate limiting + auth hardening)
  - 2. Performance and cleanup checks
  - 3. Deployment readiness checks + status tracking
- Expected Output by EOD: Day 5 baseline hardened and verified with lint/build
- Known Risks/Blockers: Missing `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

---

## Day 1 - Foundation Hardening

### A. Branching & Scope Lock
- [x] Create branch `v1-hardening`
- [x] Freeze current baseline in `main`
- [x] Finalize V1 in-scope and out-of-scope (`docs/v1-scope.md`)
- [x] Define DoD (Definition of Done) for each day

### B. Environment & Config
- [x] Validate `.env.local` completeness against required variables
- [x] Create `docs/env-checklist.md` with dev/staging/prod values matrix
- [x] Ensure secrets are not committed (`.gitignore` and checks)

### C. Data Layer Direction
- [x] Confirm production DB target (PostgreSQL recommended)
- [x] Map SQLite -> PostgreSQL migration approach
- [x] Identify tables requiring immediate migration

### D. Reliability Baseline
- [x] Standardize API error response format
- [x] Add centralized logger utility and request-id convention
- [x] Add generic fallback error UI for page/API failures

### EOD Exit Criteria
- [x] V1 scope doc complete
- [x] Environment checklist complete
- [x] DB migration strategy documented

---

## Day 2 - Customer Auth Completion (Google + Mobile OTP)

### A. Google OAuth
- [x] Validate OAuth start route and callback route behavior
- [!] Confirm redirect URI matches env + Google console
- [x] Add robust error states (`?error=` mapping on `/login`)
- [x] Add post-login redirect target handling

### B. Twilio OTP
- [x] OTP send endpoint: validation, normalization, error handling
- [x] OTP verify endpoint: failed-attempt handling
- [x] Add resend cooldown timer in UI
- [x] Add max-attempt limits + lockout handling

### C. Customer Session/Persistence
- [x] Add `customers` table (id, provider, email, phone, created_at, last_login)
- [x] Upsert customer on successful OAuth/OTP login
- [x] Tie customer session to persisted customer record

### D. Forgot Password
- [x] Define reset flow with OTP (mobile-first)
- [x] Add reset verification endpoint (if not already complete)
- [x] Add UI messaging for success/failure states

### EOD Exit Criteria
- [ ] Google login works end-to-end
- [ ] Mobile OTP login works end-to-end
- [ ] Signup and forgot flow use OTP with clear UX

---

## Day 3 - Booking Engine Backbone (Flights First)

### A. Search -> Offer -> Booking
- [x] Validate flight search API response normalization
- [x] Validate offer selection contract in frontend
- [x] Create booking record with status `draft/pending_payment`
- [x] Persist booking payload safely (sanitized structured data)

### B. Payment Flow
- [x] Create payment intent endpoint contract
- [x] Confirm payment endpoint contract
- [x] Add provider abstraction interface (even if one gateway)
- [~] Add webhook route skeleton + signature verification plan
  Deferred live provider event mapping until public demo URL is available.

### C. Booking State Machine
- [x] Implement statuses: `draft`, `pending_payment`, `paid`, `confirmed`, `failed`, `cancelled`
- [x] Add transition guard logic (invalid transitions blocked)
- [x] Add timestamps for each major transition

### D. Notifications
- [x] Trigger booking-created notification
- [x] Trigger payment-confirmed notification
- [x] Capture notification logs for audit/debug

### EOD Exit Criteria
- [ ] End-to-end booking flow passes manual test
- [ ] Booking status lifecycle persists correctly
- [ ] Payment integration contract is stable

---

## Day 4 - Admin + Operations Core

### A. Admin Destination/Package QA
- [ ] Validate all destination fields (name/tagline/continent/cities/image)
- [ ] Validate package builder save/edit/duplicate/status
- [ ] Fix UI/validation edge cases

### B. Operations Dashboard Basics
- [ ] Create booking list page in admin (filters by status/date/payment)
- [ ] Add booking detail page with timeline/state
- [ ] Add manual ops actions (confirm/cancel with checks)

### C. Access Control
- [ ] Enforce role checks for all admin endpoints/pages
- [ ] Confirm no admin links exposed in public UX
- [ ] Add unauthorized response consistency

### D. Audit Trail
- [ ] Log admin create/update/delete actions
- [ ] Log sensitive actions with actor + timestamp + target id

### EOD Exit Criteria
- [ ] Admin can manage content and bookings reliably
- [ ] Role restrictions verified
- [ ] Critical admin actions are auditable

---

## Day 5 - Launch Readiness + Hard QA

### A. UX/Content Polish
- [ ] Check all pages for layout consistency (desktop/mobile)
- [ ] Ensure clickable cards/buttons behavior is consistent
- [ ] Validate copy, labels, and brand naming consistency

### B. Security + Guardrails
- [x] Add rate limit on login and OTP endpoints
- [x] Validate cookie flags (`httpOnly`, `sameSite`, `secure` in prod)
- [x] Validate input sanitization on all mutation endpoints

### C. Performance
- [x] Validate image route caching strategy
- [ ] Remove dead imports/components/routes
- [ ] Quick Lighthouse baseline for Home + key pages

### D. Testing & Smoke Suite
- [ ] Customer login (Google)
- [ ] Customer login (OTP)
- [ ] Destination -> Package -> Booking flow
- [ ] Admin login + package update
- [ ] Footer/header critical links

### E. Deployment Prep
- [~] Prepare staging env vars
- [x] Run production build
- [x] Prepare rollback plan and release notes

### EOD Exit Criteria
- [ ] Staging build stable
- [ ] Smoke tests passed
- [ ] Go-live checklist signed

---

## Cross-Day Blockers Tracker
- [!] Google OAuth callback mismatch
- [ ] Twilio Verify limits/region issues
- [ ] Missing payment gateway credentials
- [!] Razorpay live webhook cannot be validated on localhost (pending public demo URL)
- [ ] DB migration script failures
- [ ] Admin role misconfiguration
- [!] Missing `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

---

## Mandatory Daily Ritual (Do Not Skip)
- [x] Morning: update this board before coding
- [ ] Midday: mark blockers with `[!]`
- [~] Evening: run lint/build + commit + push
- [ ] End day: update docs touched today

---

## Suggested Commit Cadence
- [ ] `feat(auth): ...`
- [ ] `feat(booking): ...`
- [ ] `feat(admin): ...`
- [ ] `fix(ui): ...`
- [ ] `docs(handover): ...`
