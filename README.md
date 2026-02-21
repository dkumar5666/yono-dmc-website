This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Pexels Images Setup

Add your Pexels API key in `.env.local`:

```bash
PEXELS_API_KEY=your_pexels_api_key_here
```

The app serves travel images through `/api/images/[key]` so the key stays server-side.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Backend MVP APIs

### Flights

- `GET /api/flights?from=DEL&to=DXB&date=2026-03-10`
- `POST /api/flights/search`

Request body:

```json
{
  "from": "DEL",
  "to": "DXB",
  "date": "2026-03-10",
  "adults": 1,
  "travelClass": "ECONOMY",
  "currency": "INR"
}
```

### Bookings

- `POST /api/bookings` create booking
- `GET /api/bookings` list bookings
- `GET /api/bookings?status=confirmed&from=2026-02-01&to=2026-02-28` list with filters
- `GET /api/bookings/:id` fetch booking
- `PATCH /api/bookings/:id` update status/fields (pnr, ticketNumbers, issuedAt, issuedBy, notes)
- `POST /api/bookings/:id/cancel` cancel booking with reason

Admin-protected endpoints:

- `GET /api/bookings`
- `PATCH /api/bookings/:id`
- `POST /api/bookings/:id/cancel`

Admin auth header:

- `x-admin-token: <ADMIN_API_TOKEN>` or
- `Authorization: Bearer <ADMIN_API_TOKEN>`

### Payments

- `POST /api/payments/intent` create payment intent
- `POST /api/payments/confirm` confirm payment and booking
- `POST /api/payments/webhook` webhook skeleton (signature header: `x-payment-signature`)

Booking lifecycle statuses:

- `draft -> pending_payment -> paid -> confirmed`
- terminal states: `failed`, `cancelled`

### Runtime storage

Bookings and payment intents are persisted locally at `.runtime/bookings.json`
(development-friendly storage for MVP).

Notification payload stubs are logged at `.runtime/notifications.json`.

## Admin setup

Add admin token in `.env.local`:

```bash
ADMIN_API_TOKEN=your_secure_admin_token
```

Role-based admin login setup:

```bash
AUTH_SESSION_SECRET=strong_random_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password
EDITOR_USERNAME=ops_user
EDITOR_PASSWORD=change_this_password
```

Admin UI:

- `GET /admin/login`
- `GET /admin/catalog`

Image upload API (admin/editor session required):

- `POST /api/admin/uploads` with `multipart/form-data` field `file`

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
