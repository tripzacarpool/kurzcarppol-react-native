# Backend Security Baseline

## Authentication

All API routes pass through Clerk middleware. Sensitive route groups also use `requireClerkAuth` at route level.

Public read endpoints:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /`
- `GET /api/users/check-email`
- `GET /api/rides/available`
- `GET /api/ride-offers/available`
- `GET /api/ride-offers/:id`
- `GET /api/maps/autocomplete`
- `GET /api/maps/place-details`
- `GET /api/maps/geocode`
- `GET /api/maps/directions`
- `GET /api/payments/test`

## Authorization

Admin-only routes use `requireRole('admin')`.

Self-or-admin routes use `requireSelfOrRole`, including:

- user profile reads and self updates
- push token/logout updates
- ride-partner profile reads/submissions
- wallet balance and wallet transaction reads
- user conversation reads
- rating reads scoped to user IDs

Domain ownership checks live in services for ride, ride-offer, approval, payment, and SOS workflows.

## Secrets

No service may hardcode payment, map, or auth secrets.

Runtime configuration is centralized in `src/config/env.js`.

HTTP hardening is centralized in `src/shared/http/security.js`; wildcard CORS helpers are not allowed in controllers or middleware.

The API disables the Express fingerprint header, applies Helmet defaults, uses explicit CORS allowlists in production, rejects wildcard production origins, and returns structured rate-limit responses with `code: RATE_LIMITED`.

All HTTP responses include `X-Request-Id`. Operational responses and common auth/error responses also include `requestId` in the JSON body so support logs, client errors, and published events can be correlated without exposing server internals. Production `500` responses use a generic message.

CORS exposes `X-Request-Id` and standard rate-limit headers to browser clients. Mutating wallet endpoints may send `Idempotency-Key`.

Required production configuration:

- `MONGODB_URI`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `ALLOWED_ORIGINS`

Production startup fails fast when these are missing. Development startup remains lenient so health checks can run while external dependencies are being configured.

Optional integration credentials:

- `GOOGLE_MAPS_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `KAFKA_BROKERS`
- `REDIS_URL`

## Guardrail

Run:

```bash
npm run backend:check
```

This runs backend syntax checks, architecture guard, and TypeScript. The architecture guard rejects:

- services/jobs/realtime importing HTTP controllers
- controllers importing domain models, SDK clients, or event-bus contracts
- controllers importing realtime transport or push delivery services
- runtime configuration reads outside `src/config/env.js`
- wildcard CORS helper reintroduction
- hardcoded Razorpay keys or fallback payment secrets
