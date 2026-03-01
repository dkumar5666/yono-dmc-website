# Daily Automation Summary (Ops Runbook)

Use this checklist once per day to review automation health using existing admin pages.

## Inputs
- `/admin/control-center`
- `/admin/system/health`
- `/admin/automation/failures`
- `/admin/documents?missing_only=1`

## Daily Summary Template
- Date:
- Reviewer:

### KPI Snapshot
- Failed Automations (24h):
- Retries In Progress:
- Missing Documents:
- Pending Payments:
- Open Support:

### Heartbeats
- Last Cron Retry:
- Last Payment Webhook:
- Hard Fail Banner present? (Yes/No)

### Queue Review
- New failures reviewed:
- Failures resolved manually:
- Unresolved blockers:

### Actions Taken
- Marked resolved IDs:
- Escalated booking IDs:
- Supplier follow-ups:

### Notes
- Known incidents:
- Next follow-up time:

## Rule of Thumb
- If either heartbeat is stale, treat as P1 until recovered.
- If failed automations trend up day-over-day, pause non-critical deployments and investigate root cause.
