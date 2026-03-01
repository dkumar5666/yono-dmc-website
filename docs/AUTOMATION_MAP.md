# Automation Map

Date: 2026-02-27

This map reflects the current automation engine implementation and operational controls.

## 1) Event / Automation Inventory

| Trigger Source | Event / Automation | Entry Route / Source | Handler File / Function | Side Effects | Idempotency | Retry Rule | Failure Logging |
|---|---|---|---|---|---|---|---|
| Payment webhook | `payment.confirmed` lifecycle transition | `POST /api/payments/webhook` | `lib/services/payment.service.ts -> handlePaymentWebhook` and `lib/core/booking-lifecycle.engine.ts -> transitionBookingLifecycle` | Updates payment record; transitions booking lifecycle to `payment_confirmed`; emits booking events | Payment idempotency via `webhook_event_id`; webhook lock via `webhook_events(provider,event_id)` | N/A (webhook is source event) | `automation_failures` via `recordAutomationFailure` on transition failures; safe fallbacks |
| Lifecycle dispatcher | Post-payment invoice generation | `transitionBookingLifecycle(...payment_confirmed)` | `lib/core/booking-lifecycle.handlers.ts` (`booking.payment_confirmed` handler) | Generates invoice document | Document idempotency guard in `lib/services/document.service.ts` (`booking_id + type` check) | Through automation retry queue if failure row exists | `automation_failures` row with event `payment.confirmed` |
| Lifecycle dispatcher | Post-supplier docs generation | `transitionBookingLifecycle(...supplier_confirmed)` | `lib/core/booking-lifecycle.handlers.ts` (`booking.supplier_confirmed` handler) | Generates voucher + itinerary documents | Document idempotency guard in `lib/services/document.service.ts` | Through automation retry queue if failure row exists | `automation_failures` row with event `supplier.confirmed` |
| Internal cron worker | Retry failed automations | `GET/POST /api/internal/automation/retry` | `app/api/internal/automation/retry/route.ts -> processRetries` | Claims rows, increments attempts, invokes real event handlers, resolves/fails row, writes heartbeat | Row claim condition (`id + status + attempts + updated_at`) prevents parallel double-processing | Max attempts=3; backoff=5m, 15m, 45m; eligible rows only | Row `last_error` updates + `system_logs` via `writeAutomationProcessLog` |
| Retry event router | Real retry execution | Called by retry worker | `lib/events/handlers.ts -> handleEvent` | Handles `payment.confirmed`, `supplier.confirmed`, `documents.generated` | Transition idempotency keys + document idempotency | Controlled by retry worker | Throws to worker; worker records failure state |
| Admin manual override | Mark failure resolved | `POST /api/admin/automation/failures/[id]/mark-resolved` | `app/api/admin/automation/failures/[id]/mark-resolved/route.ts` | Updates status to `resolved` in failures table | Idempotent status patch by `id` | Manual action only | Writes `admin_audit_logs` entry |
| Admin manual action (scaffold) | Resend documents | `POST /api/admin/bookings/[booking_id]/resend-documents` | Existing scaffold route | Audit trail only (no destructive action) | N/A | Manual | `admin_audit_logs` |
| Admin manual action (scaffold) | Resync supplier | `POST /api/admin/bookings/[booking_id]/resync-supplier` | Existing scaffold route | Audit trail only (no destructive action) | N/A | Manual | `admin_audit_logs` |
| Internal health/observability | Cron heartbeat | Retry worker after run | `lib/system/heartbeat.ts -> writeHeartbeat('cron_retry', ...)` | Writes heartbeat row/log | N/A | Every run | `system_heartbeats` fallback `system_logs` |
| Internal health/observability | Payment webhook heartbeat | Payment webhook route | `lib/system/heartbeat.ts -> writeHeartbeat('payment_webhook', ...)` | Writes heartbeat row/log | N/A | On webhook receipt | `system_heartbeats` fallback `system_logs` |

## 2) Core Storage Used by Automation

- `automation_failures` (primary retry queue)
- `event_failures` (fallback read source in admin APIs)
- `system_logs` (fallback logs and process logs)
- `system_heartbeats` (heartbeat primary)
- `documents` (generated docs, now idempotent at service layer)
- `admin_audit_logs` (manual override audit trail)

## 3) Admin Visibility

- Failures queue: `/admin/automation/failures`
- Failure detail: `/admin/automation/failures/[id]`
- Control Center KPIs include:
  - Failed Automations (24h)
  - Retries In Progress
  - Missing Documents
  - Pending Payments
  - Open Support
- System Health shows heartbeat freshness and hard-fail stale banner.

## 4) Safety Notes

- No destructive automation actions are enabled.
- Retry worker requires internal key auth.
- Retry worker processes max 10 rows/run and enforces row-claim concurrency safety.
- Payloads/tokens/secrets are not logged.
