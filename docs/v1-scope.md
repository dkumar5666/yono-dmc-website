# V1 Scope Lock - Yono DMC

## Goal
Ship a stable V1 with:
- Customer auth via Google + Mobile OTP
- Destination -> Package -> Booking flow baseline
- Admin destination/package management
- Reliable content/media rendering and basic operations readiness

## In Scope (V1)
- Public website pages and navigation consistency
- Home hero/destination/package sections and clickable card UX
- Customer auth:
  - Google OAuth
  - Mobile OTP (Twilio Verify)
  - Basic session management
- Admin auth + admin modules:
  - Destinations
  - Holiday package builder
- Core booking flow foundation (current API contracts retained)
- Documentation and deployment checklist updates

## Out of Scope (V1)
- Multi-provider fallback inventory engines
- Full payment gateway webhook reconciliation
- Complete CRM automation
- Native mobile apps
- Enterprise-scale analytics and experimentation framework

## Day-wise Definition of Done (DoD)
- Day 1:
  - Branch + baseline lock
  - Scope + env docs completed
  - DB migration direction documented
- Day 2:
  - Google + OTP auth stable in local/staging
- Day 3:
  - Booking state transitions and payment contract validated
- Day 4:
  - Admin ops workflow usable and role checks verified
- Day 5:
  - Launch checklist complete, smoke tests green, staging ready

## Risks to Watch
- OAuth callback mismatch between env and provider console
- Twilio Verify service SID missing/misconfigured
- Payment credentials not finalized
- SQLite -> production DB migration slippage

