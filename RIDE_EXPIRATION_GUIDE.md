# Ride Auto-Expiration & Time Extension Feature

## ✅ Implemented Features

### 1. **Auto-Expiration System**

- Rides automatically expire 5 minutes after their scheduled departure time
- Expired rides are hidden from the UI automatically
- Backend cleanup endpoint to mark expired rides

### 2. **Beautiful Time Extension Picker**

- Gorgeous modal with smooth animations
- Quick preset buttons (5, 10, 15, 30, 60 minutes)
- Custom time adjuster with +/- buttons
- Visual range slider indicator
- Shows current time → new time clearly
- Only visible to ride creators

### 3. **Live Countdown Timer**

- Real-time countdown displayed on each ride card
- Color-coded indicators:
  - 🟢 **Green**: More than 30 minutes remaining
  - 🟠 **Orange**: Less than 15 minutes remaining
  - 🔴 **Red**: Expired
- Format: "2h 30m" → "30m" → "Less than 1m"

### 4. **Extend Button**

- Only visible to the ride creator (owner)
- Opens the time extension picker
- Updates ride time in real-time
- Notifies all connected clients via Socket.io

## 📁 New Files Created

### Frontend:

1. **`components/TimeExtensionPicker.tsx`** - Beautiful time picker modal
2. **`hooks/useRideTimer.ts`** - Countdown timer logic and utilities

### Updated Files:

1. **`components/RideCard.tsx`** - Added timer display and extend button
2. **`lib/api.ts`** - Added API functions for extending time
3. **`backend/src/controllers/rideController.js`** - Added expiration & extension logic
4. **`backend/src/routes/rideRoutes.js`** - Added new API endpoints

## 🔌 API Endpoints

### 1. Extend Ride Time

```
PATCH /api/rides/:rideId/extend
```

**Body:**

```json
{
  "newDepartureTime": "2026-02-05T15:30:00.000Z"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Ride time extended successfully",
  "ride": {
    "id": "ride123",
    "departureTime": "2026-02-05T15:30:00.000Z"
  }
}
```

### 2. Cleanup Expired Rides

```
GET /api/rides/cleanup-expired
```

**Response:**

```json
{
  "success": true,
  "message": "Cleaned up 5 expired rides",
  "count": 5
}
```

## 🎨 How to Use

### For Passengers/Drivers Creating Rides:

1. **View Timer**: Every ride card shows a live countdown timer
2. **Extend Time**: Click the "Extend" button (only visible if you created the ride)
3. **Choose Extension**:
   - Tap quick preset (5m, 10m, 15m, 30m, 60m)
   - Or use +/- buttons for custom time
4. **Confirm**: Tap "Extend Time" button
5. **Automatic Update**: Your ride time is updated everywhere

### For Viewing Rides:

- Timer shows time remaining until departure
- Color changes based on urgency
- Expired rides disappear automatically

## 🚀 Integration Example

### Using in Your Components:

```tsx
import { RideCard } from '@/components/RideCard';
import { extendRideTime } from '@/lib/api';

const handleExtendTime = async (rideId: string, newTime: Date) => {
  try {
    await extendRideTime(rideId, newTime);
    // Refresh your rides list
  } catch (error) {
    console.error('Failed to extend time:', error);
  }
};

<RideCard
  ride={ride}
  onPress={() => handleRidePress(ride)}
  isOwner={ride.clerkId === user?.id}
  onExtendTime={handleExtendTime}
/>;
```

### Socket.io Events:

Listen for real-time updates:

```typescript
socket.on('ride:time-extended', (data) => {
  console.log('Ride time extended:', data);
  // Update local ride list
});

socket.on('ride:expired', (data) => {
  console.log('Ride expired:', data);
  // Remove from local list
});
```

## ⚙️ Auto-Cleanup Setup

### Option 1: Manual Trigger

Call the cleanup endpoint manually:

```bash
curl http://localhost:5000/api/rides/cleanup-expired
```

### Option 2: Cron Job (Recommended)

Set up a cron job to run every 5 minutes:

**Using node-cron (install: `npm install node-cron`):**

In `backend/src/server.js`:

```javascript
import cron from 'node-cron';
import { cleanupExpiredRides } from './controllers/rideController.js';

// Run cleanup every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('🔄 Running auto-cleanup of expired rides...');
  try {
    await cleanupExpiredRides(
      { body: {} },
      {
        status: () => ({ json: (data) => console.log(data) }),
      },
    );
  } catch (error) {
    console.error('Error in auto-cleanup:', error);
  }
});
```

### Option 3: Client-Side Filtering

Expired rides are automatically hidden in the UI using the `useRideTimer` hook.

## 🎯 Timer States

1. **Active**: More than 30 min remaining (Green)
2. **Warning**: 15-30 min remaining (Orange)
3. **Critical**: Less than 15 min (Red)
4. **Expired**: Past departure time (Hidden/Red)

## 🔔 Notifications

When a ride time is extended:

- All passengers who booked the ride get notified
- Socket.io broadcasts the update
- Timer updates automatically on all devices

## 💡 Pro Tips

1. **Quick Extensions**: Use preset buttons for common extensions
2. **Last Minute**: Extend 5-10 minutes for traffic delays
3. **Custom Time**: Use +/- buttons to fine-tune exact minutes
4. **Visual Feedback**: Watch the slider move as you adjust time
5. **Real-time Updates**: Changes appear instantly for all users

## 🎨 Customization

### Change Expiration Time

In `backend/src/controllers/rideController.js`:

```javascript
// Change from 5 minutes to 10 minutes
const expirationTime = new Date(now.getTime() - 10 * 60000);
```

### Change Timer Colors

In `hooks/useRideTimer.ts`:

```typescript
export const getTimeColor = (timeRemaining: TimeRemaining): string => {
  if (timeRemaining.isExpired) return '#EF4444';
  if (timeRemaining.total < 30 * 60 * 1000) return '#F59E0B'; // Change threshold
  return '#10B981';
};
```

### Change Quick Preset Times

In `components/TimeExtensionPicker.tsx`:

```typescript
const quickOptions = [5, 10, 15, 30, 60, 90, 120]; // Add more options
```

## 🐛 Troubleshooting

### Timer Not Updating

- Check that the ride has a valid `departureTime`
- Ensure the component is re-rendering
- Verify `useRideTimer` hook is called

### Extend Button Not Showing

- Verify `isOwner` prop is set correctly
- Check that `user.id` matches `ride.clerkId`

### API Errors

- Ensure backend is running
- Check authentication headers
- Verify ride ID is correct

## 🔮 Future Enhancements

- [ ] Push notifications when ride is about to expire
- [ ] Auto-suggest extension when <5 minutes remaining
- [ ] History of time extensions
- [ ] Maximum extension limit (e.g., can't extend more than 2 hours)
- [ ] Reason field for extension
