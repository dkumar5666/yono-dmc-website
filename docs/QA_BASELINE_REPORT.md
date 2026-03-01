# QA Baseline Report

Date: 2026-02-27
Branch: `v1-hardening`
Scope: Automation engine QA + go-live hardening only.

## 1) Repo State at Start
- `git status` had unrelated auth UI changes.
- Those unrelated changes were isolated using stash:
  - stash name: `wip-auth-ui-before-automation-qa`
- QA hardening then continued on a clean working tree.

## 2) Baseline Checks
- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run typecheck`: PASS

## 3) Baseline Observations
- Automation retry endpoint existed but used simulated resolution logic.
- Admin mark-resolved endpoint existed but did not update failure status in DB.
- Event automation failures were not consistently persisted into `automation_failures`.
- Document generation could create duplicates on repeated automation retries.

## 4) Baseline Risks Identified
- Simulated retries can hide real handler failures.
- Manual override in admin queue was audit-only, not operational.
- Duplicate document rows possible for same `booking_id + type` under retries.

## 5) Hardening Applied in This QA Pass
- Retry worker upgraded to real handler mode with safe claim + backoff + retry limits.
- Added automation failure logging helper (`automation_failures` + fallbacks).
- Added core automation event router for:
  - `payment.confirmed`
  - `supplier.confirmed`
  - `documents.generated`
- Mark Resolved now updates failure row status to `resolved` and writes admin audit.
- Document generation made idempotent by checking existing document per `booking_id + type`.

## 6) Final Verification Snapshot (Post-Fix)
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
