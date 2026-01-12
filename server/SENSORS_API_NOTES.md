# Sensors API v1 (branch notes)

- Base paths: `/api` (legacy) and `/api/v1` (versioned). New combined endpoints live on `/api/v1`.
- Auth: set `SENSORS_API_KEYS` to a JSON array of keys, scopes, and optional allowed client IDs. Example:
  ```json
  [
    { "key": "internal-key", "scope": "internal" },
    { "key": "ext-key", "scope": "external", "allowedClientIds": ["client-uuid-1", "client-uuid-2"] }
  ]
  ```
  Falls back to `PA_API_KEY_PRIMARY` if `SENSORS_API_KEYS` is unset.
- Rate limiting: `SENSORS_API_RATE_LIMIT` (per minute, defaults to 600) applied per key.
- Filters (optional, query params): `deviceType=button|sensor`, `fields=light|full`, `date_from`, `date_to` (ISO8601), `months` (timeline, 1-24).
- New combined endpoints:
  - `GET /api/v1/clients/:clientId/stats`
  - `GET /api/v1/clients/:clientId/timeline?months=12`
- Tenant scoping: keys with `allowedClientIds` can only access those clients; global list endpoints are blocked when scope is set (use client-scoped routes).
