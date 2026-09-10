# Portal HTTP Endpoint Contract

Authenticated portal integration is defined around two explicit entry points:

- `GET /api/portal/client?clientId=<client-id>` → client dashboard
- `GET /api/portal/professional?matterId=<matter-id>` → professional workspace

Both routes are protected by the HTTP authentication boundary and delegate authorization to the portal service. No portal route is public.

The public website consultation route remains the only intentionally public application entry point.
