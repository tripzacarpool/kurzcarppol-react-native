# Tripza Backend

Extraction-ready backend for Tripza. The current deployment remains a Node/Express API, but the code is organized around service ownership so each domain can be moved into an independent service without rewriting route contracts.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Production:

```bash
npm start
```

## Validate

From `backend/`:

```bash
npm run check
npm run smoke
```

From the repo root:

```bash
npm run backend:check
npm run backend:arch
npm run services:local:up
npm run services:verify
npm run services:local:down
npx tsc --noEmit --pretty false
```

The architecture guard fails if:

- services, jobs, or realtime modules import HTTP controllers
- controllers import domain models, SDK clients, or event-bus contracts
- hardcoded Razorpay credentials or fallback payment secrets return

## Structure

```text
backend/
  src/
    app.js                  Express app factory
    server.js               Process entrypoint
    config/                 Environment, database, model compatibility exports
    controllers/            Thin HTTP adapters
    routes/                 HTTP route registration
    middleware/             Auth, roles, error handling
    services/               Domain/application services
    realtime/               Socket.IO bootstrap, realtime registry, location events
    jobs/                   Scheduled worker orchestration
    shared/                 Event bus and HTTP shared concerns
    models/                 Mongoose domain models
    utils/                  Validation and small helpers
  docs/
    service-architecture.md Service ownership and extraction plan
    service-catalog.md      Deployable service catalog and ownership table
    event-contracts.md      Kafka-style event contracts
    operations-runbook.md   Validation, startup, health, and cutover notes
```

## Service Ownership

- `userProfileService` owns Clerk profile sync, role changes, location/IP, logout, verification, and user stats.
- `pushNotificationService` owns Expo token validation, direct push dispatch, user/role fanout, and notification events.
- `paymentWalletService` owns Razorpay order/signature handling and wallet ledger mutations.
- `rideRequestService`, `rideDiscoveryService`, and `rideLifecycleService` own passenger ride request creation, discovery, booking, pickup, start, completion, cancellation, extensions, and cleanup.
- `rideOfferCreationService`, `rideOfferReadService`, and `rideOfferLifecycleService` own driver offers, search/read models, updates, booking, hold requests, pickup, expiry checks, and cleanup.
- `approvalService` owns booking approval flow, approval settings, payment confirmation, expiry jobs, and approval analytics.
- `chatService`, `ratingService`, `safetySosService`, `mapsGeoService`, `ridePartnerService`, and `adminService` own their named domains.

## Required Environment

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
MONGODB_DB=tripzaapp
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
ALLOWED_ORIGINS=http://localhost:8081
```

Optional:

```env
GOOGLE_MAPS_API_KEY=
KAFKA_BROKERS=
KAFKA_CLIENT_ID=tripza-api
REDIS_URL=
MATCHING_SERVICE_URL=http://localhost:7001
MATCHING_SERVICE_TIMEOUT_MS=1500
```

## Health Endpoints

- `GET /health` returns liveness for load balancers.
- `GET /health/ready` returns readiness, reports database connection status, and includes optional sidecar dependency checks such as the matching service.

## Local Services

The local hybrid stack runs MongoDB, Redis, and Kafka through Docker, then starts the Node API, Node worker, and Python matching service as local processes:

```bash
npm run services:local:up
npm run services:verify
```

Use `npm run services:up` when Docker Desktop can build and run the application images end to end.

## Extraction Notes

The API is currently an extraction-ready modular backend. When Docker/PostgreSQL/Redis are approved, extract in this order:

1. Notification worker
2. Realtime gateway
3. Matching/pricing service
4. Payment/wallet service
5. Booking approval service
6. Ride request and ride offer services
7. User, admin, safety, ratings, maps, and chat services
