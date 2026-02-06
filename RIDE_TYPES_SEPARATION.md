# Ride Types Separation - Requests vs Offers

## Overview

The system now separates **ride requests** (passengers looking for rides) and **ride offers** (drivers offering rides) into different database collections and APIs.

## Database Models

### 1. RideRequest (for passengers)

**Collection:** `riderequests`

- Used when passengers request a ride
- Stored in `/api/rides/*` endpoints
- Fields: from, to, passengers, vehicleType, status, etc.

### 2. RideOffer (for drivers)

**Collection:** `rideoffers`

- Used when drivers offer rides
- Stored in `/api/ride-offers/*` endpoints
- Fields: from, to, totalSeats, availableSeats, farePerSeat, departureTime, driver info, vehicle info, bookings array, etc.

## API Endpoints

### Ride Requests (`/api/rides`)

- `POST /api/rides/create` - Create ride request
- `GET /api/rides/requests` - Get user's ride requests
- `GET /api/rides/available` - Get available rides for drivers
- `POST /api/rides/:id/accept` - Accept a ride request
- `DELETE /api/rides/:id/cancel` - Cancel ride request
- `PATCH /api/rides/:id/extend` - Extend ride time
- `GET /api/rides/cleanup-expired` - Cleanup expired requests

### Ride Offers (`/api/ride-offers`)

- `POST /api/ride-offers/create` - Create ride offer
- `GET /api/ride-offers/available` - Get available ride offers
- `GET /api/ride-offers/my-offers` - Get my ride offers (as driver)
- `GET /api/ride-offers/:id` - Get single ride offer
- `POST /api/ride-offers/:id/extend-time` - Extend ride offer time
- `POST /api/ride-offers/:id/book` - Book a ride offer (passenger)
- `POST /api/ride-offers/:id/cancel` - Cancel ride offer (driver)
- `POST /api/ride-offers/cleanup-expired` - Cleanup expired offers

## Frontend API Functions

### New Functions (in `lib/api.ts`)

```typescript
// Ride Offer APIs
createRideOffer(offerData) - Create new ride offer
getAvailableRideOffers(params?) - Get available offers
getMyRideOffers(clerkId?) - Get driver's offers
getRideOfferById(offerId) - Get single offer
extendRideOfferTime(offerId, additionalMinutes) - Extend time
bookRideOffer(offerId, bookingData) - Book a ride offer
cancelRideOffer(offerId) - Cancel offer
cleanupExpiredRideOffers() - Cleanup expired

// Combined API
getAllRides(params?) - Fetches both requests and offers
```

### Existing Functions (updated)

```typescript
createRide() - Creates ride request (for passengers)
getAvailableRides() - Gets ride requests (for drivers to accept)
getUserRides() - Gets user's ride requests
```

## Data Structure Differences

### Ride Request

```javascript
{
  userId, clerkId,
  from, to,
  passengers,  // Number of passengers needed
  vehicleType,
  status: 'waiting' | 'accepted' | 'booked' | 'ongoing' | 'completed' | 'cancelled',
  acceptedBy: { userId, clerkId, driverName, driverRating },
  bookingDetails: { confirmedAt, seatNumbers, totalAmount, paymentMethod },
  // ... other fields
}
```

### Ride Offer

```javascript
{
  userId, clerkId,
  from, to,
  totalSeats: 4,  // Total seats in vehicle
  availableSeats: [1, 2, 3, 4],  // Array of available seat numbers
  farePerSeat: 35,  // Price per seat
  departureTime: Date,  // Required departure time
  driverMode: 'commuter' | 'daily' | 'casual' | 'professional',
  status: 'waiting' | 'accepted' | 'booked' | 'ongoing' | 'completed' | 'cancelled',
  vehicle: { model, color, number },
  driver: { name, profileImage, rating, ridesCompleted, gender },
  bookings: [  // Array of passenger bookings
    {
      passengerId, passengerClerkId,
      passengerName, passengerPhone,
      seatNumbers: [1, 2],
      totalAmount: 70,
      paymentMethod: 'wallet' | 'upi' | 'cash',
      status: 'pending' | 'confirmed' | 'cancelled',
      bookedAt: Date
    }
  ],
  // ... other fields
}
```

## Key Differences

| Feature         | Ride Request                                      | Ride Offer                                                    |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| **Who creates** | Passengers                                        | Drivers                                                       |
| **Purpose**     | Find a driver                                     | Offer seats                                                   |
| **Seats**       | `passengers` (how many needed)                    | `totalSeats` + `availableSeats`                               |
| **Pricing**     | Optional `fare`                                   | Required `farePerSeat`                                        |
| **Time**        | Flexible with window                              | Specific `departureTime`                                      |
| **Acceptance**  | Driver accepts whole request                      | Passengers book individual seats                              |
| **Booking**     | Single booking for all passengers                 | Multiple bookings in `bookings[]`                             |
| **Status flow** | waiting → accepted → booked → ongoing → completed | waiting → booked (when all seats taken) → ongoing → completed |

## Frontend Usage

### Home Screen (Passengers)

```typescript
// Shows ride offers from drivers
const response = await getAvailableRideOffers();
const offers = response.rideOffers; // Array of ride offers
```

### Create Ride Flow

```typescript
// Passenger requesting a ride
await createRide({ from, to, passengers: 2, ... });

// Driver offering a ride
await createRideOffer({
  from, to,
  totalSeats: 4,
  farePerSeat: 35,
  departureTime: '2026-02-05T10:00:00Z',
  ...
});
```

### Booking Flow

```typescript
// Passenger books seats in a ride offer
await bookRideOffer(offerId, {
  seatNumbers: [1, 2], // Book seats 1 and 2
  paymentMethod: 'wallet',
  customRequest: 'Need AC',
});
```

## Migration Notes

1. **Existing data**: Old rides in `riderequests` collection will continue to work
2. **New offers**: All new driver offers go to `rideoffers` collection
3. **`kind` field**: Frontend adds `kind: 'offer'` or `kind: 'request'` to distinguish
4. **Socket events**:
   - `newRideRequest` - For ride requests
   - `newRideOffer` - For ride offers
   - Both trigger UI updates

## Testing

### Test Ride Offer Creation

```bash
POST http://localhost:5000/api/ride-offers/create
{
  "clerkId": "user_xxx",
  "from": "Mumbai",
  "to": "Pune",
  "totalSeats": 4,
  "farePerSeat": 350,
  "departureTime": "2026-02-06T10:00:00Z",
  "vehicleType": "four_wheeler"
}
```

### Test Booking

```bash
POST http://localhost:5000/api/ride-offers/:offerId/book
{
  "clerkId": "user_yyy",
  "seatNumbers": [1, 2],
  "paymentMethod": "wallet"
}
```

## Benefits

✅ **Clear separation**: Requests vs Offers are distinct concepts  
✅ **Scalability**: Can optimize queries for each type separately  
✅ **Flexibility**: Different schemas for different use cases  
✅ **Better UX**: Passengers see only available offers, drivers see only requests  
✅ **Seat management**: Proper handling of multi-passenger bookings in offers  
✅ **Type safety**: Clear distinction in frontend code with `kind` field

## Socket.IO Events

### Ride Offers

- `newRideOffer` - Emitted when new offer created
- `rideOfferBooked` - Emitted when passenger books seats
- `rideOfferTimeExtended` - Emitted when driver extends time
- `rideOfferCancelled` - Emitted when driver cancels

### Ride Requests (existing)

- `newRideRequest` - Emitted when passenger requests ride
- `rideAccepted` - Emitted when driver accepts request
- `rideCancelled` - Emitted when request cancelled
