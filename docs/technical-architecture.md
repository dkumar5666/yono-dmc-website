# Yono DMC - Technical Architecture & Handover

## 1. Stack Overview
- Framework: Next.js 16 (App Router)
- Language: TypeScript
- UI: React 19 + Tailwind CSS
- Data Layer:
  - Static/catalog content in `data/*.ts`
  - Runtime/admin persistence in SQLite
- Media:
  - Pexels API via internal proxy route `/api/images/[key]`
- Auth:
  - Admin/Staff: custom cookie session auth
  - Customer: Google OAuth + Twilio mobile OTP flow

---

## 2. App Structure
- Global layout: `app/layout.tsx`
  - Shared header + footer
  - Global styles: `app/globals.css`
- Core UI components in `components/`
- Data sources:
  - `data/holidays.ts` (package master)
  - `data/mockData.ts` (fallback/support data)
  - `data/travelTips.ts` (blog/travel tips)

---

## 3. Route Map

### Public Pages
- `/` Home
- `/holidays`
- `/holidays/[slug]`
- `/destinations`
- `/destinations/[slug]`
- `/flights`
- `/hotels`
- `/visa`
- `/attractions` (linked in nav; ensure content page remains in deployment branch)
- `/about`
- `/contact`
- `/travel-tips-guides`
- `/travel-tips-guides/[slug]`
- `/customer-reviews`
- `/login` (customer-facing auth UI)
- `/privacy-policy`
- `/refund-policy`
- `/packages` -> redirect to `/holidays`

### Admin Pages
- `/admin/login`
- `/admin/catalog`
- `/admin/destinations`
- `/admin/holiday-builder`

### API Routes (Selected)
- Image proxy:
  - `/api/images/[key]`
- Catalog:
  - `/api/catalog`
- Admin auth:
  - `/api/auth/login`
  - `/api/auth/me`
  - `/api/auth/logout`
- Customer auth:
  - `/api/customer-auth/google/start`
  - `/api/customer-auth/google/callback`
  - `/api/customer-auth/otp/send`
  - `/api/customer-auth/otp/verify`
  - `/api/customer-auth/me`
  - `/api/customer-auth/logout`
- Admin data:
  - `/api/admin/destinations`
  - `/api/admin/destinations/[id]`
  - `/api/admin/holiday-packages`
  - `/api/admin/holiday-packages/[id]`
  - `/api/admin/holiday-packages/[id]/duplicate`

---

## 4. Current Frontend Design/Behavior
- Header:
  - Main nav + Login + WhatsApp
  - No admin link exposed in header
- Home:
  - Hero destination slider (3s autoplay, clickable destination banners)
  - Top destination carousel
  - Popular holiday package carousel
  - Contact + email signup block
  - Travel tips section
  - Customer reviews section
- Cards:
  - Destination/package cards are fully clickable (image + text + CTA area)
- Footer:
  - Updated address, map link, social links, contact data
  - Larger icons and typography for readability

---

## 5. Database Logic (SQLite)

### Migration
- `db/migrations/001_travel_core.sql`

### Runtime/Access
- SQLite helper: `lib/backend/sqlite.ts`
- Business logic/service layer: `lib/backend/travelAdmin.ts`

### Core Tables (normalized)
- `holiday_packages`
- `package_hotels`
- `package_itinerary`
- `package_addons`
- `package_passenger_details`
- Destination model includes extra fields and city relations support

### Functional Capabilities
- Destination CRUD (with tagline/continent/cities support)
- Package CRUD
- Duplicate package endpoint
- Package status workflow (`draft`, `published`, `archived`)

---

## 6. ERD (Text)

`destinations (id)`  
-> 1-to-many -> `holiday_packages (destination_id)`

`holiday_packages (id)`  
-> 1-to-many -> `package_hotels (package_id)`  
-> 1-to-many -> `package_itinerary (package_id)`  
-> 1-to-many -> `package_addons (package_id)`  
-> 1-to-1/1-to-many -> `package_passenger_details (package_id)`

Optional destination city model:
- `destination_cities (id, destination_id, city_name)`
- `destinations (id)` -> 1-to-many -> `destination_cities (destination_id)`

---

## 7. Auth Design

### Admin/Staff Auth
- Cookie-based session
- Utility: `lib/backend/sessionAuth.ts`
- Intended roles: `admin`, `editor`
- Protects admin APIs/pages

### Customer Auth
- Utility: `lib/backend/customerAuth.ts`
- Customer session cookie: `yono_customer_session`
- Google OAuth callback creates customer session
- Twilio OTP verify creates customer session

---

## 8. External Services
- Pexels API
  - Dynamic travel images via internal proxy route
- Google OAuth
  - Customer login with Google
- Twilio Verify
  - Mobile OTP send + verify

---

## 9. Environment Variables Checklist

### Required (Core)
- `PEXELS_API_KEY`

### Admin Auth
- `AUTH_SESSION_SECRET` (or fallback chain currently supported)
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `EDITOR_USERNAME` (optional)
- `EDITOR_PASSWORD` (optional)

### Customer Google OAuth
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` (e.g. `http://localhost:3000`)
- `NEXTAUTH_SECRET`

### Twilio OTP
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- (`TWILIO_PHONE_NUMBER` optional depending on implementation path)

---

## 10. Deployment Checklist

1. Install and build
- `npm ci`
- `npm run build`

2. Environment setup
- Add all required env vars in server/platform secrets
- Verify Google redirect URI includes:
  - `{BASE_URL}/api/customer-auth/google/callback`

3. Database/migrations
- Ensure SQLite file path is writable in deployment environment
- Run migration bootstrap on startup/release (if not auto-initialized)

4. Security checks
- Ensure `AUTH_SESSION_SECRET` and `NEXTAUTH_SECRET` are strong random values
- Confirm `secure` cookies in production (`NODE_ENV=production`)

5. Smoke tests
- Home loads with hero slider and destination links
- `/holidays` and `/destinations/[slug]` navigation works
- Admin login + admin modules access works
- Customer Google login callback works
- Mobile OTP send/verify works
- Image proxy route returns valid images

6. Monitoring
- Check server logs for:
  - OAuth callback errors
  - Twilio API errors
  - Image fetch failures

---

## 11. Recommended Next Steps
- Add customer profile dropdown in header (`/api/customer-auth/me` based)
- Add proper customer account DB tables (instead of session-only identity)
- Add rate limiting for OTP endpoints
- Add retry + fallback strategy for image API fetch failures
- Add end-to-end tests for auth and booking-critical flows

