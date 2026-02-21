# API Response Standard (V1)

## Success
```json
{
  "ok": true,
  "data": {},
  "requestId": "uuid"
}
```

## Error
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "requestId": "uuid",
    "details": {}
  }
}
```

## Notes
- Include `x-request-id` response header.
- Reuse helpers from `lib/backend/http.ts`:
  - `apiSuccess(req, data, status?)`
  - `apiError(req, status, code, message, details?)`
- Use `lib/backend/logger.ts` for logs:
  - `logInfo`
  - `logWarn`
  - `logError`

