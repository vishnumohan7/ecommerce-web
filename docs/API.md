# API

The public contract is versioned beneath `/api/v1`. Interactive OpenAPI documentation is served at `/api/docs` and JSON at `/api/docs-json`.

Requests use bearer access tokens and `application/json`. Successful monetary values are strings containing integer minor units plus an ISO 4217 currency. Errors have this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request failed",
    "requestId": "uuid"
  },
  "path": "/api/v1/example",
  "timestamp": "2026-10-05T12:00:00.000Z"
}
```

`x-request-id` may be supplied by a trusted caller and is returned on every response. Multi-tenant mode requires `x-tenant-id`; single-tenant mode derives the configured default tenant.
