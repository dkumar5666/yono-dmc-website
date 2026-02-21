# Environment Checklist (Dev / Staging / Prod)

## How to Use
- Never commit real secrets.
- Keep values in `.env.local` for local dev.
- Use platform secret manager for staging/prod.

## Required Variables

### Content / Images
- `PEXELS_API_KEY`

### Flights (Amadeus)
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`

### Admin Auth
- `AUTH_SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `EDITOR_USERNAME` (optional)
- `EDITOR_PASSWORD` (optional)
- `ADMIN_API_TOKEN` (optional fallback path)

### Customer Google OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

### Customer Mobile OTP (Twilio Verify)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `TWILIO_PHONE_NUMBER` (optional for Verify path, useful for SMS fallback)

## Current Local Status (from key-name audit)

### Present
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`
- `PEXELS_API_KEY`
- `AUTH_SESSION_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `EDITOR_USERNAME`
- `EDITOR_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `TWILIO_PHONE_NUMBER`

### Missing (must add for full auth flow)
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

## Provider Notes
- Google OAuth redirect URI must include:
  - `{NEXTAUTH_URL}/api/customer-auth/google/callback`
- Twilio Verify must have an active Verify Service SID:
  - starts with `VA...`
