# Tripza Backend Service Architecture

This migration keeps the current mobile API stable while moving the backend toward independently deployable services.

Security route exposure is documented in `backend/docs/security-baseline.md`.

## Current Phase: Extraction-Ready Modular Backend

The Node API still serves the existing routes, but process-level concerns are separated:

- `src/app.js` builds the Express app.
- `src/server.js` starts the process and coordinates graceful shutdown for HTTP, workers, event bus, and MongoDB.
- `src/config/env.js` owns runtime configuration reads. Services/controllers/jobs should not read `process.env` directly.
- `src/realtime/socket.js` owns Socket.IO wiring.
- `src/realtime/realtimeBus.js` owns the process-local Socket.IO registry and exposes only a small publisher facade to service flows during the transition to event consumers.
- `src/realtime/locationEvents.js` owns live location socket events.
- `src/jobs/backgroundTasks.js` owns scheduled worker orchestration and graceful worker shutdown.
- `src/routes/index.js` owns route registration.
- `src/shared/http/*` owns shared HTTP concerns.
- `src/services/userProfileService.js` owns Clerk profile sync, role updates, logout state, location/IP, driver verification, and user role stats.
- `src/services/pushNotificationService.js` owns Expo token validation, push dispatch, role/user fanout, test push, push-token events, ride notification queueing, and ride reminder scheduling events.
- `src/services/paymentWalletService.js` owns Razorpay order verification and wallet mutations. Razorpay credentials are environment-only; missing `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` fails payment operations explicitly.
- `src/services/rideRequestService.js` owns passenger ride request creation and reads.
- `src/services/rideDiscoveryService.js` owns available ride request/offer discovery read models.
- `src/services/rideLifecycleService.js` owns ride request acceptance, booking confirmation, shared joins, cancellation, pickup confirmations, ride start, ride completion, departure extensions, driver earnings crediting, and expired ride cleanup.
- `src/services/rideOfferCreationService.js` owns driver ride offer creation.
- `src/services/rideOfferLifecycleService.js` owns ride offer booking, cancellation, hold request/response transitions, offer pickup initiation/confirmation, and expired offer cleanup.
- `src/services/rideOfferReadService.js` owns ride offer search/read models, owner updates, departure extensions, driver offer history, and expiring-offer notification checks.
- `src/services/approvalService.js` owns booking approval creation, approve/reject/cancel transitions, payment confirmation, approval settings, approval read models, reusable background jobs, and expiry handling.
- `src/services/chatService.js` owns conversation/message writes.
- `src/services/ratingService.js` owns rating writes and reads.
- `src/services/safetySosService.js` owns SOS activation, ride ID validation for SOS flows, resolution, active alerts, emergency dispatch context, and SOS history.
- `src/services/adminService.js` owns admin overview and ride-partner moderation read/write models.
- `src/services/ridePartnerService.js` owns ride-partner onboarding submission, uploaded document normalization, profile reads, and status moderation.
- `src/services/mapsGeoService.js` owns Google Maps/OpenStreetMap proxy behavior, local NCR fallback predictions, geocoding, place details, and directions.

## Target Services

| Service | Runtime | Owns |
| --- | --- | --- |
| API Gateway | Node/NestJS or Express | Auth edge, CORS, rate limits, routing |
| User Service | Node/NestJS | Clerk sync, profiles, roles, driver/passenger identity |
| Ride Request Service | Node/NestJS | Passenger ride requests and ride lifecycle |
| Ride Offer Service | Node/NestJS | Driver offers, seats, hold requests |
| Booking Approval Service | Node/NestJS | Seat locks, manual approval, booking state |
| Matching Pricing Service | Python/FastAPI | Matching, fare split, route/time optimization |
| Payment Wallet Service | Node/NestJS, later PostgreSQL | Razorpay, wallet ledger, settlements |
| Realtime Service | Node/Socket.IO + Redis | Live location, socket rooms, realtime events |
| Chat Service | Node/NestJS | Conversations, messages, read receipts |
| Notification Service | Node worker | Expo push, reminders, transactional alerts |
| Safety SOS Service | Node/NestJS | SOS alerts, admin response, safety history |
| Maps Geo Service | Python/FastAPI | Google Maps proxy, geocoding, caching |
| Ratings Trust Service | Python or Node | Ratings, trust scoring, reliability |
| Admin Analytics Service | Python/FastAPI | Dashboards and operational analytics |

## Communication Rules

- Synchronous calls are allowed only for user-facing reads that need immediate data.
- State changes should publish Kafka events.
- Realtime and notification side effects should consume events, not be called directly from controllers.
- Infrastructure modules must not import HTTP controllers; jobs call services directly, worker intervals expose stop hooks, and realtime bootstraps through `realtimeBus`.
- Runtime configuration is read through `config/env.js`; integration services receive environment-derived settings from that module.
- Redis should be used for short-lived locks, live locations, rate limit backing stores, and Socket.IO scaling.
- Payment and wallet events must be idempotent.

## Extraction Order

1. Notification worker: ride request, ride offer, pickup, payment, approval, chat, SOS, and notification flows now route push delivery through services and `pushNotificationService`; the next step is replacing service-owned direct push calls with event consumers.
2. Realtime gateway: Socket.IO bootstrap, location events, and process-local realtime registry are isolated in `src/realtime/*`; domain emits now sit in service flows until dedicated realtime event consumers are introduced.
3. Matching/pricing Python service: scaffold exists in `services/matching-service`; current fare rules are in `rideFareService`.
4. Payment/wallet service: payment controller is now an adapter over `paymentWalletService`; wallet debit/recharge accepts `Idempotency-Key`, uses atomic Mongo balance updates, and reuses existing matching transactions for retry-safe client behavior.
5. Booking/approval service: booking creation, approval transitions, payment confirmation, approval settings, cancellation, read models, and expiry jobs are service-owned; remaining work is moving realtime side effects to event consumers.
6. Ride request and ride offer services: request creation/lifecycle, offer creation/lifecycle, offer read/update models, departure extensions, and expiry checks are service-owned; ride controllers now have no direct model/event/push transport dependencies.
7. User, admin, safety, ratings services: profile, push-token, driver verification, SOS, admin overview/moderation, chat, and ratings slices are service-owned.
