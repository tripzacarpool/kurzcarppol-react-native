# Push Notifications Setup Guide

## 📱 Frontend Setup

### 1. Install Required Packages

```bash
npm install expo-notifications expo-device
```

### 2. Configure app.json

Add your Expo project ID to `app.json`:

```json
{
  "expo": {
    "name": "KurzCarPool",
    "slug": "kurzcarpool",
    "extra": {
      "eas": {
        "projectId": "your-project-id-here"
      }
    }
  }
}
```

To get your project ID:

1. Run `npx expo login` (if not logged in)
2. Run `eas build:configure`
3. Your project ID will be added automatically

### 3. Rebuild the App (Important!)

After installing expo-notifications, you MUST rebuild your development build:

```bash
npx expo run:android
# or
npx expo run:ios
```

### 4. Update notificationService.ts

In `lib/notificationService.ts`, replace the project ID placeholder:

```typescript
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-actual-project-id', // Replace this!
});
```

## 🖥️ Backend Setup

### 1. Install expo-server-sdk

```bash
cd backend
npm install expo-server-sdk
```

### 2. Restart Backend Server

```bash
npm run dev
```

## ✅ Features Implemented

### In-App Notifications

✓ Welcome notification on login
✓ Ride request notifications
✓ Ride accepted notifications
✓ Booking confirmations
✓ Driver pickup notifications
✓ Ride completion notifications

### Notification Center

✓ Notifications accessible from navigation bar
✓ Dynamic badge count showing unread notifications
✓ Mark as read functionality
✓ Delete individual notifications
✓ Clear all notifications
✓ Real-time notification updates

### Push Notification System

✓ Permission request handling
✓ Push token registration
✓ Local notifications (for development)
✓ Scheduled notifications (ride reminders)
✓ Notification tap handling
✓ Android notification channels

### Backend APIs

✓ POST /api/notifications/register-token - Register device token
✓ POST /api/notifications/send - Send push notification
✓ POST /api/notifications/ride - Send ride notifications to drivers
✓ POST /api/notifications/welcome - Send welcome notification
✓ POST /api/notifications/schedule-reminder - Schedule ride reminders

## 🚀 How It Works

### 1. Login Flow

When a user logs in:

1. Welcome notification is sent immediately
2. Push token is requested (if permissions granted)
3. Token is registered with the backend
4. User sees notification in the Alerts tab

### 2. Ride Notifications

When a ride is created/accepted:

1. Real-time notification via Socket.io
2. Local notification displayed
3. Badge count updated
4. Notification stored in NotificationContext
5. Appears in Alerts tab

### 3. Notification Center

- Navigate to "Alerts" tab in bottom navigation
- See all notifications with timestamps
- Badge shows unread count
- Tap to mark as read
- Swipe/tap delete icon to remove
- "Mark all as read" button
- "Clear all" button

## 📝 Testing Push Notifications

### Test on Physical Device (Recommended)

Push notifications work best on physical devices:

```bash
npx expo run:android --device
```

### Test with Expo Go (Limited)

For basic testing with Expo Go:

```bash
npx expo start
```

Note: Some features may be limited in Expo Go

### Test Local Notifications

Local notifications work on emulators and simulators:

- Login to see welcome notification
- Create/accept rides to see notifications
- Check the Alerts tab

### Send Test Notification

Use the notification service directly in your code:

```typescript
import * as NotificationService from '@/lib/notificationService';

// Send test notification
await NotificationService.sendLocalNotification(
  'Test Title',
  'Test message body',
  { type: 'test' },
);
```

## 🎯 Notification Types

1. **welcome** - Welcome message on first login
2. **ride_created** - New ride request (for drivers)
3. **offer_created** - New ride offer (for passengers)
4. **ride_accepted** - Ride accepted by driver
5. **offer_booked** - Passenger confirmed booking
6. **ride_reminder** - Upcoming ride reminder (30 min before)

## 🔧 Troubleshooting

### "Cannot find native module 'ExpoNotifications'"

- You need to rebuild the app: `npx expo run:android`
- Expo Go doesn't include this module by default

### Notifications not appearing

1. Check permissions: Settings > Apps > KurzCarPool > Notifications
2. Verify push token is registered (check console logs)
3. Ensure app is in foreground or background (not killed)

### Badge count not updating

- Recheck that NotificationContext is properly wrapped in app layout
- Verify setBadgeCount is being called
- On iOS, ensure Info.plist has UIBackgroundModes

### Backend errors

- Install expo-server-sdk: `cd backend && npm install expo-server-sdk`
- Restart the backend server
- Check backend console for errors

## 🎨 Customization

### Add New Notification Type

1. Update the Notification interface in `contexts/NotificationContext.tsx`
2. Add icon mapping in `app/(tabs)/alerts.tsx`
3. Create notification handler in NotificationContext
4. Send notification using `addNotification()`

### Customize Notification Sounds

Edit `lib/notificationService.ts`:

```typescript
sound: 'custom-sound.wav', // Add custom sound file
```

### Schedule Custom Notifications

```typescript
await NotificationService.scheduleNotification(
  'Title',
  'Body',
  60, // seconds from now
  { customData: 'value' },
);
```

## 📱 Production Deployment

For production push notifications:

1. Get FCM credentials (Android) and APNs certificate (iOS)
2. Configure in app.json under "android" and "ios"
3. Build production app with EAS Build
4. Store push tokens in database
5. Use Expo's push notification service or your own server

## 🔐 Security Notes

- Push tokens are sensitive - store securely in backend
- Validate notification requests on backend
- Rate limit notification sending
- Don't send sensitive data in notification body
- Use deep linking for notification actions
