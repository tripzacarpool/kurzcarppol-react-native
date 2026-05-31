# Backend Setup Status

## Completed In Code

- Express app/process split: `src/app.js` and `src/server.js`.
- Route registration moved to `src/routes/index.js`.
- Shared HTTP security and request logging are isolated under `src/shared/http`.
- Runtime config reads are centralized in `src/config/env.js`.
- Controllers are thin HTTP adapters with no direct domain model, event bus, realtime transport, push delivery, or SDK ownership.
- Approval, chat, notification, user push-token, ride request, ride offer, ride-offer pickup, and SOS controllers now delegate side effects to services.
- Services own user, notification, payment/wallet, ride request, ride offer, approval, chat, rating, SOS, maps, ride-partner, and admin domains.
- Socket.IO bootstrap is isolated in `src/realtime/socket.js`.
- Live location socket events are isolated in `src/realtime/locationEvents.js`.
- Socket room joins are constrained and covered by realtime smoke validation.
- Service flows use the `src/realtime/realtimeBus.js` publisher facade for transitional realtime emits until realtime consumers are introduced.
- Scheduled jobs call services directly from `src/jobs/backgroundTasks.js`.
- Worker start/stop lifecycle is available through `startBackgroundTasks` and `stopBackgroundTasks`.
- Kafka-style event contracts are documented in `docs/event-contracts.md`.
- Service ownership and extraction order are documented in `docs/service-architecture.md`.
- Deployable service boundaries are cataloged in `docs/service-catalog.md`.
- Security baseline and public route exposure are documented in `docs/security-baseline.md`.
- Backend validation and startup operations are documented in `docs/operations-runbook.md`.
- Architecture guard is available through `npm run backend:arch`.
- Full backend validation is available through `npm run backend:check`.
- Matching service syntax validation is available through `npm run matching:check`.
- Full Docker service stack is available through `npm run services:up`.
- Hybrid local service stack is available through `npm run services:local:up`.
- Integrated runtime verification is available through `npm run services:verify`.
- Razorpay and Google Maps secrets are environment-only; hardcoded fallbacks were removed.
- Production environment validation fails fast when required MongoDB, Clerk, Razorpay, or CORS settings are missing.
- `/health/ready` reports required database readiness and optional matching-service dependency status.
- High-traffic ride, offer, approval, wallet, chat, and SOS access patterns have query-shaped Mongo indexes.

## Current Validation

Run from repository root:

```bash
npm run backend:check
npm run services:verify
```

This currently passes and runs:

- backend syntax checks
- backend maintenance script syntax checks
- backend architecture guard
- backend environment validation smoke
- backend module import smoke
- backend event contract documentation smoke
- backend event correlation smoke
- backend realtime socket room smoke
- backend production error-handler smoke
- backend required-dependency readiness smoke
- no-database app smoke test for `/health` and `/health/ready`
- Python matching-service compile check
- TypeScript check
- live API readiness, matching health, matching fare-split contract, and Mongo/Redis/Kafka/API port checks

## Required Environment Before Real Deployment

Minimum:

- `MONGODB_URI`
- `MONGODB_DB`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `ALLOWED_ORIGINS`

Optional but recommended:

- `GOOGLE_MAPS_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `KAFKA_BROKERS`
- `REDIS_URL`
- `MATCHING_SERVICE_URL`
- `MATCHING_SERVICE_TIMEOUT_MS`

## Deferred Infrastructure

These are still deferred beyond the local Compose stack:

- PostgreSQL wallet ledger migration
- Redis-backed rate limiting and locks
- Kafka worker processes for notification/realtime consumers
- Independent deployable service repositories/images

## Next Extraction Steps

1. Add Redis adapter for Socket.IO and replace process-local `realtimeBus` for multi-instance deployments.
2. Replace service-owned direct push/realtime calls with Kafka consumers for notification and realtime delivery.
3. Add Kafka topics and consumers for ride, booking, payment, notification, and SOS events.
4. Move wallet ledger to PostgreSQL with idempotent transaction keys.
5. Split services into deployable packages once infrastructure is approved.
