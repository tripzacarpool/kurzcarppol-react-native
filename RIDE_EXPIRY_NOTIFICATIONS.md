# Ride Expiry Notifications Feature

## Overview

Automatically sends push notifications to ride creators 10 minutes before their ride departs, allowing them to extend the time if needed. When they tap the notification, they're redirected to a time extension screen.

## Backend Implementation

### 1. Push Token Storage

**File:** `backend/src/config/models.js`

- Added `pushToken` field to UserProfile schema
- Added `pushTokenUpdatedAt` timestamp

**File:** `backend/src/controllers/userController.js`

- New endpoint: `POST /api/users/push-token`
- Stores Expo push token for notifications

**File:** `backend/src/routes/userRoutes.js`

- Added route for push token updates

### 2. Expiring Rides Checker

**File:** `backend/src/controllers/rideOfferController.js`

- **Function:** `checkExpiringRides()`
- Finds rides departing in 10-15 minutes
- Sends push notifications to creators
- Notification data includes:
  - `type: 'ride_expiring'`
  - `offerId`, `rideId`
  - `screen: 'ExtendTime'` (for deep linking)
  - Route details and time info

**File:** `backend/src/routes/rideOfferRoutes.js`

- Added route: `POST /api/ride-offers/check-expiring`

### 3. Background Task

**File:** `backend/src/server.js`

- Checks for expiring rides every 5 minutes
- Runs automatically after database connection
- Logs notification counts

```javascript
// Runs every 5 minutes
setInterval(checkExpiringRidesTask, 5 * 60 * 1000);
```

## Frontend Implementation

### 1. Push Token Registration

**File:** `lib/notificationService.ts`

- Updated `registerPushToken()` to call backend API
- Sends token to `/api/users/push-token`
- Stores locally even if backend fails

### 2. Notification Click Handler

**File:** `contexts/NotificationContext.tsx`

- Handles notification response when user taps
- For `ride_expiring` notifications:
  - Stores pending navigation in AsyncStorage
  - Includes screen and params for deep linking

```typescript
if (data.type === 'ride_expiring' && data.offerId) {
  await AsyncStorage.setItem(
    'pendingNavigation',
    JSON.stringify({
      screen: 'ExtendTime',
      params: { offerId, rideId, from, to, departureTime },
    }),
  );
}
```

### 3. Deep Linking Navigation

**File:** `app/_layout.tsx`

- Checks for pending navigation on app startup
- Navigates to `extend-time` screen with params
- Clears pending navigation after use

### 4. Time Extension Screen

**File:** `app/extend-time.tsx`

- Beautiful dedicated screen for extending ride time
- Shows:
  - Alert banner with time remaining
  - Ride details (from/to/departure)
  - Quick tip card
  - "Extend Ride Time" button
- Opens TimeExtensionPicker modal
- Calls `extendRideOfferTime()` API
- Shows success alert and navigates back

**Features:**

- Loading state while fetching ride details
- Time remaining countdown
- Date/time formatting
- Back navigation button
- Styled with TripZa theme

### 5. API Functions

**File:** `lib/api.ts`

- `checkExpiringRides()` - Trigger check manually
- `extendRideOfferTime(offerId, additionalMinutes)` - Extend time
- `getRideOfferById(offerId)` - Get ride details

## Notification Flow

```
1. Backend checks for expiring rides (every 5 min)
   ↓
2. Finds rides departing in 10-15 minutes
   ↓
3. Gets user push tokens from database
   ↓
4. Sends push notification with ride details
   ↓
5. User receives notification: "⏰ Ride Departing Soon!"
   ↓
6. User taps notification
   ↓
7. App stores pending navigation in AsyncStorage
   ↓
8. App opens and checks for pending navigation
   ↓
9. Navigates to extend-time screen with ride details
   ↓
10. User extends time via TimeExtensionPicker
   ↓
11. Backend updates ride departure time
   ↓
12. All passengers notified of time change (via Socket.IO)
```

## Notification Payload

```javascript
{
  to: "ExponentPushToken[xxx]",
  sound: "default",
  title: "⏰ Ride Departing Soon!",
  body: "Your ride from Mumbai to Pune departs in 12 minutes. Extend time if needed.",
  data: {
    type: "ride_expiring",
    rideId: "6978d8f57fbeef2cf237cb52",
    offerId: "6978d8f57fbeef2cf237cb52",
    kind: "offer",
    from: "Mumbai",
    to: "Pune",
    departureTime: "2026-02-05T10:00:00.000Z",
    minutesUntilDeparture: 12,
    screen: "ExtendTime"
  },
  priority: "high",
  channelId: "ride-alerts"
}
```

## Testing

### 1. Register Push Token

```bash
# User logs in, token is automatically registered
# Check logs: "📱 Push token updated for user user_xxx"
```

### 2. Trigger Expiring Check (Manual)

```bash
POST http://localhost:5000/api/ride-offers/check-expiring

Response:
{
  "success": true,
  "ridesChecked": 5,
  "notificationsSent": 2
}
```

### 3. Simulate Notification Tap

1. Create a ride offer that departs in 10 minutes
2. Wait for notification (or trigger manually)
3. Tap notification
4. Should open extend-time screen with ride details

### 4. Extend Time Flow

1. Open extend-time screen
2. Tap "Extend Ride Time" button
3. Select additional time (5, 10, 15, 30, 60 min)
4. Confirm
5. See success alert
6. Backend updates departure time
7. Passengers notified via Socket.IO

## Configuration

### Backend

```javascript
// Check interval (server.js)
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Warning threshold (rideOfferController.js)
const warningThreshold = 10 * 60 * 1000; // 10 min before expiry

// Expiry buffer
const expiryThreshold = 5 * 60 * 1000; // 5 min after departure
```

### Frontend

```typescript
// Notification channels (notificationService.ts)
'ride-alerts' - High priority for time-sensitive alerts
'ride-updates' - Normal ride updates
'default' - General notifications
```

## Error Handling

1. **No Push Token:** Logs warning, skips notification
2. **Invalid Push Token:** Logs error, skips notification
3. **Network Error:** Tries to send remaining notifications
4. **Backend Unreachable:** Stores token locally, retries later
5. **Ride Not Found:** Shows error alert, allows back navigation

## Benefits

✅ **Proactive:** Warns drivers before rides expire  
✅ **Convenient:** One-tap to extend time screen  
✅ **User-Friendly:** Beautiful UI with clear instructions  
✅ **Reliable:** Background task runs automatically  
✅ **Scalable:** Handles multiple expiring rides efficiently  
✅ **Offline-Ready:** Stores tokens locally as fallback

## Future Enhancements

1. **Customizable Timing:** Let users set when to receive warnings
2. **Quick Extend:** Add quick action buttons in notification (Android)
3. **Recurring Rides:** Auto-extend option for regular rides
4. **Passenger Alerts:** Notify passengers of time changes
5. **Analytics:** Track extension patterns for insights
6. **Smart Suggestions:** ML-based time extension recommendations
