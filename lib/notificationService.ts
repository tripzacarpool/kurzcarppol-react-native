import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  userId: string;
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('⚠️ Push notifications only work on physical devices');
    return false;
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permission denied');
      return false;
    }

    console.log('✅ Notification permission granted');
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get the Expo push notification token
 * Note: Requires Firebase setup for Android. Optional for local notifications.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('⚠️ Must use physical device for remote push notifications');
      return null;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return null;
    }

    // Get the token - this requires Firebase/FCM setup on Android
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '125079d6-42c5-4c68-bbbf-c3b1858c8b80', // From your app.json
    });

    console.log('📱 Expo Push Token:', tokenData.data);

    // Store token locally
    await AsyncStorage.setItem('expoPushToken', tokenData.data);

    return tokenData.data;
  } catch (error: any) {
    // Gracefully handle Firebase not being set up
    if (
      error.message?.includes('FirebaseApp') ||
      error.message?.includes('FCM')
    ) {
      console.log('ℹ️ Remote push notifications require Firebase setup');
      console.log('ℹ️ Local notifications will still work for development');
      console.log(
        'ℹ️ See: https://docs.expo.dev/push-notifications/fcm-credentials/',
      );
      return null;
    }
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Register push token with backend server
 */
export async function registerPushToken(
  userId: string,
  token: string,
): Promise<boolean> {
  try {
    // Import API client dynamically to avoid circular dependency
    const { apiClient } = await import('./api');

    // Send token to backend
    const response = await apiClient.post('/api/users/push-token', {
      clerkId: userId,
      pushToken: token,
    });

    console.log('📤 Push token registered for user:', userId);
    await AsyncStorage.setItem(`pushToken_${userId}`, token);
    return response.data.success;
  } catch (error) {
    console.error('Error registering push token:', error);
    // Still save locally even if backend fails
    await AsyncStorage.setItem(`pushToken_${userId}`, token);
    return false;
  }
}

/**
 * Send a local notification (for development/testing)
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any,
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });

    console.log('📬 Local notification sent:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error sending local notification:', error);
    throw error;
  }
}

/**
 * Schedule a notification for later
 */
export async function scheduleNotification(
  title: string,
  body: string,
  triggerSeconds: number,
  data?: any,
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: {
        seconds: triggerSeconds,
      },
    });

    console.log('⏰ Notification scheduled for', triggerSeconds, 'seconds');
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('🚫 Notification cancelled:', notificationId);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🚫 All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
}

/**
 * Clear notification badge
 */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge:', error);
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (
    response: Notifications.NotificationResponse,
  ) => void,
) {
  // Listener for notifications received while app is foregrounded
  const receivedListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('📬 Notification received:', notification);
      onNotificationReceived?.(notification);
    },
  );

  // Listener for when user taps on notification
  const responseListener =
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      onNotificationResponse?.(response);
    });

  return {
    receivedListener,
    responseListener,
    remove: () => {
      receivedListener.remove();
      responseListener.remove();
    },
  };
}

/**
 * Configure Android notification channel
 */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFD700',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'Chat Messages',
      description: 'Notifications for new chat messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFD700',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    await Notifications.setNotificationChannelAsync('ride-updates', {
      name: 'Ride Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFD700',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Promotions',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    console.log('✅ Android notification channels configured');
  }
}

/**
 * Welcome notification for new users
 */
export async function sendWelcomeNotification(userName: string): Promise<void> {
  await sendLocalNotification(
    `Welcome ${userName}! 🎉`,
    'Thanks for joining KurzCarPool! Start sharing rides and saving money today.',
    { type: 'welcome' },
  );
}

/**
 * Ride reminder notifications
 */
export async function scheduleRideReminder(
  rideId: string,
  from: string,
  to: string,
  departureTime: Date,
): Promise<string> {
  const now = new Date();
  const timeUntilRide = departureTime.getTime() - now.getTime();
  const reminderTime = timeUntilRide - 30 * 60 * 1000; // 30 minutes before

  if (reminderTime > 0) {
    return await scheduleNotification(
      'Upcoming Ride Reminder',
      `Your ride from ${from} to ${to} starts in 30 minutes`,
      Math.floor(reminderTime / 1000),
      { type: 'ride_reminder', rideId },
    );
  }

  throw new Error('Ride time is too soon for reminder');
}
