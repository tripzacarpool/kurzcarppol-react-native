# Real-Time Location Tracking System

## Industry-Standard WebSocket Implementation

### Architecture Overview

```
Driver App                Backend Server              Rider App
   |                         |                           |
   |-- WebSocket Connect     |                           |
   |<-- Connected OK         |                           |
   |                         |                           |
   |-- driver:online         |                           |
   |                         |                           |
   |-- driver:location       |                           |-- WebSocket Connect
   |   (every 2-3s)          |-- In-Memory Store         |<-- Connected OK
   |                         |   (rideId -> location)    |
   |-- driver:location       |                           |-- rider:subscribe
   |   (every 2-3s)          |-- Push Update             |   (for rideId)
   |                         |-->--->--->--->----------->|-- ride:location-update
   |                         |                           |   (automatic update)
   |                         |                           |-- Update Map Marker
   |-- driver:location       |                           |
   |   (every 2-3s)          |-- Push Update             |-- ride:location-update
   |                         |-->--->--->--->----------->|   (automatic update)
   |                         |                           |-- Update Map Marker
```

### Key Features

1. **Persistent Real-Time Connection**
   - Uses WebSocket (with fallback to polling)
   - No REST polling overhead
   - Instant location updates

2. **Driver Side (2-3 second intervals)**
   - `driver:online` - Initialize when going live
   - `driver:location` - Send GPS coordinates every 2-3 seconds
   - `driver:offline` - Clean up on disconnect

3. **Rider Side**
   - `rider:subscribe` - Subscribe to ride's live location
   - `ride:location-update` - Receive instant location updates
   - `ride:driver-offline` - Notified if driver disconnects
   - `rider:unsubscribe` - Cleanup when ride ends

4. **In-Memory Storage**
   - No database writes for live updates
   - Stores only latest location per ride
   - Lightning-fast access
   - Automatic cleanup when ride ends

5. **Security**
   - Only assigned riders receive driver location
   - Driver data private to specific ride
   - Automatic cleanup on disconnect

### Backend Services

**`/backend/src/services/locationService.js`**

- Manages in-memory location storage
- Handles rider subscriptions
- Tracks active driver status
- Provides location queries

**`/backend/src/controllers/locationController.js`**

- Socket.io event handlers
- Real-time communication logic
- Error handling

**`/backend/src/server.js`**

- Socket.io server initialization
- Connection handling
- Event routing

### Frontend Utilities

**`/lib/locationSocket.ts`**

- Socket connection management
- Driver location emission
- Rider subscription handling
- Location update callbacks

### Usage Examples

**Driver (emit location every 2-3 seconds)**

```typescript
import {
  emitDriverLocation,
  driverGoesOnline,
  driverGoesOffline,
} from '@/lib/locationSocket';

// When driver goes live
driverGoesOnline(driverId);

// Every 2-3 seconds during ride
emitDriverLocation(rideId, latitude, longitude);

// When driver goes offline
driverGoesOffline();
```

**Rider (subscribe to live location)**

```typescript
import {
  subscribeToRideLocation,
  unsubscribeFromRideLocation,
} from '@/lib/locationSocket';

// Subscribe to ride updates
subscribeToRideLocation(rideId, (location) => {
  if (location.offline) {
    console.log('Driver went offline');
  } else {
    console.log(`Driver at: ${location.latitude}, ${location.longitude}`);
    // Update map marker
  }
});

// When ride ends
unsubscribeFromRideLocation(rideId);
```

### Performance Optimization

✅ **Only live updates** - Database is not hit during active ride
✅ **In-memory storage** - Nanosecond access time
✅ **Instant push** - No polling delays
✅ **Automatic cleanup** - No memory leaks
✅ **WebSocket first** - Falls back to polling if needed
✅ **Selective updates** - Only sends to subscribed riders

### Installation

Frontend:

```bash
npm install socket.io-client
```

Backend:

```bash
npm install socket.io
```

Then run:

```bash
npm install  # in both /backend and root
npm run dev  # in both folders
```

### Real-Time Events Flow

```
DRIVER WORKFLOW:
driver:online → driver:location (every 2-3s) → driver:location → ... → driver:offline

RIDER WORKFLOW:
rider:subscribe → ride:location-update → ride:location-update → ... → rider:unsubscribe

BROADCAST:
Driver sends location → Backend receives → Backend pushes to all subscribed riders
```
