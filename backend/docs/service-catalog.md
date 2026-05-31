# Tripza Service Catalog

This catalog tracks the deployable-service boundary we are building toward while the current backend remains one Node process.

## Production Entry Services

| Service | Current implementation | Runtime | Public interface | Extract when |
| --- | --- | --- | --- | --- |
| API Gateway | `src/app.js`, `src/server.js`, `src/routes/index.js` | Node/Express | Mobile HTTP API, health checks | Keep as edge process; split only after service APIs exist |
| User Service | `src/services/userProfileService.js` | Node | `/api/users/*`, `users.*` events | Profile and role flows are fully event-driven |
| Ride Request Service | `src/services/rideRequestService.js`, `src/services/rideDiscoveryService.js`, `src/services/rideLifecycleService.js` | Node | `/api/rides/*`, `rides.request.*` events | Booking, payment, notification, and realtime side effects are consumers |
| Ride Offer Service | `src/services/rideOfferCreationService.js`, `src/services/rideOfferReadService.js`, `src/services/rideOfferLifecycleService.js` | Node | `/api/ride-offers/*`, `rides.offer.*` events | Seat locking and approval orchestration move behind stable events |
| Booking Approval Service | `src/services/approvalService.js` | Node | `/api/approvals/*`, `bookings.*` events | Expiry jobs and payment confirmation are idempotent worker flows |
| Payment Wallet Service | `src/services/paymentWalletService.js` | Node now, PostgreSQL later | `/api/payments/*`, `payments.*` events | Wallet ledger is moved from Mongo mutation flows to transaction records |
| Realtime Service | `src/realtime/socket.js`, `src/realtime/locationEvents.js`, `src/realtime/realtimeBus.js` | Node/Socket.IO | Socket.IO rooms, realtime event consumers | Redis adapter and event consumers are added |
| Notification Service | `src/services/pushNotificationService.js`, `src/services/departureNotificationService.js` | Node worker | Expo push, `notifications.*` events | API adapters stop sending direct push side effects |
| Chat Service | `src/services/chatService.js` | Node | `/api/chat/*`, `chat.message.sent.v1` | Realtime and notification side effects consume chat events |
| Safety SOS Service | `src/services/safetySosService.js` | Node | `/api/rides/sos/*`, `safety.sos.*` events | Admin dispatch workflow is event-backed |
| Maps Geo Service | `src/services/mapsGeoService.js` | Node now, Python/FastAPI candidate | `/api/maps/*` | Caching, quotas, and provider fallback are service-local |
| Matching Pricing Service | `services/matching-service/app/main.py`, `src/services/rideFareService.js` | Python/FastAPI + Node adapter | `/match`, `/fare-split` | Node ride flows call the FastAPI service through a resilient client |
| Admin Analytics Service | `src/services/adminService.js` | Node now, Python/FastAPI candidate | `/api/admin/*` | Dashboard reads use service-owned projections |
| Ratings Trust Service | `src/services/ratingService.js` | Node now | `/api/ratings/*` | Trust scoring becomes separate from raw rating writes |
| Ride Partner Service | `src/services/ridePartnerService.js` | Node | `/api/ride-partners/*` | Moderation document storage and status events are isolated |

## Shared Infrastructure

| Concern | Current implementation | Next production dependency |
| --- | --- | --- |
| Runtime configuration | `src/config/env.js` | Secrets manager plus environment validation |
| Database | `src/config/database.js`, MongoDB models | Per-service storage ownership |
| Event bus | `src/shared/events/eventBus.js` | Kafka-compatible broker |
| Matching client | `src/services/matchingClientService.js` | `MATCHING_SERVICE_URL` sidecar endpoint |
| Health checks | `src/controllers/healthController.js` | Per-service liveness and readiness |
| HTTP hardening | `src/shared/http/security.js`, `src/shared/http/requestLogger.js` | Edge rate limiting and request IDs |
| Worker lifecycle | `src/jobs/backgroundTasks.js` | Independent worker processes |

## Extraction Rules

- Keep controllers as adapters only: validate request shape, call one service, return HTTP response.
- Controllers must not import realtime transport or push delivery services.
- Services may publish events, but should not import HTTP controllers or route modules.
- Jobs and realtime bootstraps call services directly, never controllers.
- New cross-domain side effects should be represented as event contracts before adding direct service calls.
- Every extracted service needs health checks, environment documentation, validation commands, and idempotency strategy before deployment.
