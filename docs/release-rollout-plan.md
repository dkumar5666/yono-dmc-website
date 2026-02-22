# V1 Release + Rollback Plan (Demo)

## 1. Release Scope
- Customer auth (Google + OTP)
- Booking engine (search -> booking -> payment contracts)
- Admin operations (destinations, packages, AI conversation workflow)
- AI chat widget and support flows

## 2. Pre-Release Checklist
- `npm ci`
- `npm run lint`
- `npm run build`
- Verify required env vars in target host:
  - `PEXELS_API_KEY`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
  - `AUTH_SESSION_SECRET`
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
  - payment gateway keys (`RAZORPAY_*`)
- Confirm database file path is writable and migrations are applied.

## 3. Release Procedure (demo.yonodmc.com)
1. Backup current deployment and runtime DB.
2. Deploy latest `main` build artifact.
3. Run smoke checks:
   - Home load + hero + header links
   - Login (Google + OTP send/verify)
   - `/holidays` -> package detail
   - booking create + payment intent endpoint
   - admin login + package update + AI conversation workflow
4. Monitor logs for 30 minutes:
   - OAuth callback errors
   - Twilio Verify errors
   - Payment webhook signature errors

## 4. Rollback Plan
1. Re-point deployment to previous stable release.
2. Restore previous runtime DB backup if schema/data incompatibility appears.
3. Re-apply previous env snapshot.
4. Purge app cache/CDN and verify service health.
5. Announce rollback status and incident summary.

## 5. Release Notes Template
## Version
- `v1.x.x` (date/time)

## Added
- (new features)

## Changed
- (behavior changes)

## Fixed
- (bug fixes)

## Ops/Security
- (rate limits, cookie/security updates)

## Known Issues
- (open items)
