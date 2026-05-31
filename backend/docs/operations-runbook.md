# Backend Operations Runbook

Use this runbook to validate and run the extraction-ready backend.

## Local Validation

From the repository root:

```bash
npm run backend:check
```

This runs:

- backend JavaScript syntax checks
- architecture guard
- environment validation smoke
- event-contract documentation smoke
- event correlation smoke
- realtime socket room smoke
- production error-handler smoke
- required-dependency readiness smoke
- health/readiness smoke
- Python matching-service compile check
- TypeScript check

## Local API Startup

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

## Full Service Stack

From the repository root:

```bash
npm run services:up
npm run services:status
```

This starts:

- `api` on `http://localhost:5000`
- `worker` for background jobs
- `matching-service` on `http://localhost:7001`
- `mongo` on `localhost:27017`
- `redis` on `localhost:6379`
- `kafka` on the internal Compose network at `kafka:9092`

The API container disables in-process background jobs with `ENABLE_BACKGROUND_TASKS=false`; the `worker` container owns scheduled background work. Stop the stack with:

```bash
npm run services:down
```

If Docker Desktop is unstable while building local project images, use the hybrid local mode:

```bash
npm run services:local:up
npm run services:local:down
```

Hybrid mode runs Mongo, Redis, and Kafka in Docker, then runs the API, worker, and matching service as local processes with the same integration settings.

Minimum local `.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/tripza
MONGODB_DB=tripzaapp
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2
ALLOWED_ORIGINS=http://localhost:8081
```

Payment operations require:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Wallet debit and recharge endpoints accept `Idempotency-Key`. Reusing the same key returns the existing wallet transaction instead of applying the mutation again.

Production additionally requires Clerk and explicit CORS:

```env
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=
ALLOWED_ORIGINS=https://your-mobile-or-web-origin.example
```

## Matching Service

Run the Python sidecar:

```bash
cd backend/services/matching-service
python -m venv .venv
.venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --port 7001
```

Enable it in the Node API:

```env
MATCHING_SERVICE_URL=http://localhost:7001
MATCHING_SERVICE_REQUIRED=false
MATCHING_SERVICE_TIMEOUT_MS=1500
```

If `MATCHING_SERVICE_URL` is empty, the Node API keeps using in-process fare logic.
Set `MATCHING_SERVICE_REQUIRED=true` only when the sidecar must be healthy before `/health/ready` returns `ready`.

## Event Bus Policy

Set `KAFKA_BROKERS` to publish domain events to Kafka. When Kafka is unavailable, the API logs `event_publish_failed` and continues by default. Set `EVENT_BUS_STRICT=true` when downstream consumers are mandatory and a failed publish should fail the request.

## Realtime Rooms

The Socket.IO bootstrap accepts constrained `join:room` / `leave:room` requests for namespaced rooms such as `user:<id>`, `ride:<id>`, and `conversation:<id>`. `join:user` also joins compatibility rooms used by older realtime flows, including `passenger_<id>` and `driver_<id>`.

## Health Checks

- `GET /health` and `GET /health/live` are liveness.
- `GET /health/ready` is readiness.

Readiness is `ready` only when MongoDB is connected and all required dependencies are healthy. Optional dependencies, such as the matching service, Kafka event bus, and Redis, are reported under `checks` but do not block local readiness unless configured as required.

Every HTTP response includes `X-Request-Id`. Clients may send `X-Request-Id`; otherwise the API generates one. Request logs, health payloads, common auth failures, error responses, and request-triggered events include the same ID.

## Production Startup Behavior

In development, missing external dependencies are logged and the process can still expose health endpoints.

In production, environment validation fails fast for missing:

- `MONGODB_URI`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `ALLOWED_ORIGINS`

Shutdown is bounded by `SERVER_SHUTDOWN_TIMEOUT_MS` and closes background jobs, Socket.IO, Kafka producer state, MongoDB, and the HTTP server before process exit.

## Guardrails

The architecture guard rejects:

- services, jobs, or realtime modules importing HTTP controllers
- controllers importing models, Mongoose, SDK clients, event bus, realtime transport, or push delivery
- runtime configuration reads outside `src/config/env.js`
- hardcoded Razorpay credentials or fallback payment secrets

Maintenance scripts in `backend/*.js` also use `src/config/env.js` and are covered by:

```bash
npm --prefix backend run check:maintenance
```

Do not add local Mongo fallback URIs to maintenance scripts. Set `MONGODB_URI` and `MONGODB_DB` explicitly instead.

## Next Infrastructure Cutover

When infrastructure is approved:

1. Add Redis-backed Socket.IO adapter.
2. Add Kafka topics and consumers for realtime and notification delivery.
3. Move service-owned direct push/realtime calls into consumers.
4. Move wallet ledger to PostgreSQL with idempotency keys.
5. Package matching service and Node API as separately deployable services.
