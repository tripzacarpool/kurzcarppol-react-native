# Kafka Event Contracts

These events are the first stable contracts for extracting independently deployable services from the modular backend.

## Naming

Use `domain.entity.action.v1`.

Examples:

- `users.profile.synced.v1`
- `users.push_token.registered.v1`
- `rides.request.created.v1`
- `rides.request.accepted.v1`
- `rides.request.booked.v1`
- `rides.request.joined.v1`
- `rides.request.cancelled.v1`
- `rides.pickup.driver_confirmed.v1`
- `rides.pickup.passenger_confirmed.v1`
- `rides.lifecycle.start_requested.v1`
- `rides.lifecycle.started.v1`
- `rides.lifecycle.completed.v1`
- `rides.offer.created.v1`
- `rides.offer.booked.v1`
- `rides.offer.cancelled.v1`
- `rides.offer.hold_requested.v1`
- `rides.offer.hold_responded.v1`
- `rides.offer.pickup_initiated.v1`
- `rides.offer.pickup_passenger_confirmed.v1`
- `bookings.approval.requested.v1`
- `bookings.approval.approved.v1`
- `bookings.approval.rejected.v1`
- `bookings.approval.cancelled.v1`
- `bookings.payment.confirmed.v1`
- `payments.wallet.debited.v1`
- `payments.razorpay.verified.v1`
- `safety.sos.activated.v1`
- `chat.message.sent.v1`
- `notifications.push.requested.v1`
- `notifications.push.sent.v1`
- `realtime.location.updated.v1`
- `payments.order.created.v1`
- `payments.wallet.credited.v1`

## Envelope

```json
{
  "eventId": "uuid",
  "eventType": "rides.offer.created.v1",
  "occurredAt": "2026-05-29T10:00:00.000Z",
  "source": "tripza-api",
  "correlationId": "request-id",
  "actor": {
    "clerkId": "user_xxx",
    "role": "ride_partner"
  },
  "data": {}
}
```

## Required Rules

- `eventId` must be unique.
- `correlationId` should be the HTTP `X-Request-Id` for request-triggered events.
- Consumers must be idempotent.
- Events are append-only contracts; create `v2` for breaking changes.
- Do not put secrets, tokens, full payment gateway payloads, or private documents in events.
- Use IDs and safe snapshots only.
