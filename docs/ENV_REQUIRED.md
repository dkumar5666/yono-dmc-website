# Required Environment Variables (Names Only)

## Core
- `SITE_URL`
- `APP_MODE` (`staging` or `production`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Auth
- `AUTH_SESSION_SECRET` (or `NEXTAUTH_SECRET`)
- `GOOGLE_CLIENT_ID` (legacy Google flow)
- `GOOGLE_CLIENT_SECRET` (legacy Google flow)

## OTP
- Supabase phone auth requires valid Supabase public auth config.
- Twilio fallback (recommended):
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_VERIFY_SERVICE_SID`

## Payments
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## Internal
- `INTERNAL_CRON_KEY`
- `WHATSAPP_WEBHOOK_KEY`
- `CRM_AUTOMATION_SECRET`

## Suppliers (Amadeus)
- `AMADEUS_ENV`
- `AMADEUS_BASE_URL`
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`

## CRM Outbound Automation
- `AISENSY_API_KEY`
- `AISENSY_BASE_URL` (optional)
- `AISENSY_SENDER_ID` (optional)
- `MAILCHIMP_API_KEY`
- `MAILCHIMP_SERVER_PREFIX`
- `MAILCHIMP_AUDIENCE_ID`
- `MAILCHIMP_TAG_NEW_LEAD` (optional, default `NewLead`)
- `MAILCHIMP_TAG_QUOTE_SENT` (optional, default `QuoteSent`)
- `MAILCHIMP_TAG_WON` (optional, default `Won`)

## Optional / Compatibility
- `STAGING_ALLOW_SUPPLIER_BOOKING` (set `true` only when staging must call real suppliers)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `APP_URL`
- `NEXTAUTH_URL`
