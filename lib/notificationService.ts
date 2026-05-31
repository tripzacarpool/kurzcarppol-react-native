import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NotificationsModule = typeof import('expo-notifications');
type PermissionStatus = 'granted' | 'denied' | 'undetermined';

const isExpoGo = Constants.appOwnership === 'expo';

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web' || isExpoGo) return null;

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export function arePushNotificationsSupported(): boolean {
  return Platform.OS !== 'web' && !isExpoGo && Device.isDevice;
}

export interface PushNotificationToken {
  token: string;
  userId: string;
}

export async function getNotificationPermissionStatus(): Promise<
  PermissionStatus | 'unsupported'
> {
  const Notifications = await loadNotifications();
  if (!Notifications || !Device.isDevice) return 'unsupported';

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermissions(options?: {
  askIfUndetermined?: boolean;
}): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications || !Device.isDevice) return false;

  const askIfUndetermined = options?.askIfUndetermined ?? true;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    if (existingStatus === 'undetermined' && !askIfUndetermined) return false;

    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem('notificationPermissionAsked', 'true');
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getExpoPushToken(options?: {
  askPermission?: boolean;
}): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications || !Device.isDevice) return null;

  const hasPermission = await requestNotificationPermissions({
    askIfUndetermined: options?.askPermission ?? false,
  });
  if (!hasPermission) return null;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '125079d6-42c5-4c68-bbbf-c3b1858c8b80',
    });
    await AsyncStorage.setItem('expoPushToken', tokenData.data);
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function registerPushToken(
  userId: string,
  token: string,
): Promise<boolean> {
  if (!userId || !token) return false;

  try {
    const { apiClient } = await import('./api');
    const response = await apiClient.post('/api/users/push-token', {
      clerkId: userId,
      pushToken: token,
    });
    await AsyncStorage.setItem(`pushToken_${userId}`, token);
    return Boolean(response.data?.success);
  } catch {
    await AsyncStorage.setItem(`pushToken_${userId}`, token);
    return false;
  }
}

export async function ensurePushNotificationsForUser(
  userId: string,
  options?: { askPermission?: boolean },
): Promise<string | null> {
  const token = await getExpoPushToken({
    askPermission: options?.askPermission ?? false,
  });
  if (token) await registerPushToken(userId, token);
  return token;
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any,
): Promise<string> {
  const Notifications = await loadNotifications();
  if (!Notifications) return '';

  const hasPermission = await requestNotificationPermissions({
    askIfUndetermined: false,
  });
  if (!hasPermission) return '';

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch {
    return '';
  }
}

export async function scheduleNotification(
  title: string,
  body: string,
  triggerSeconds: number,
  data?: any,
): Promise<string> {
  const Notifications = await loadNotifications();
  if (!Notifications) return '';

  const hasPermission = await requestNotificationPermissions({
    askIfUndetermined: false,
  });
  if (!hasPermission) return '';

  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data || {}, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: triggerSeconds,
      },
    });
  } catch {
    return '';
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

export async function clearBadge(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}

export async function setBadgeCount(count: number): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {}
}

export async function getBadgeCount(): Promise<number> {
  const Notifications = await loadNotifications();
  if (!Notifications) return 0;
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

export function setupNotificationListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationResponse?: (response: any) => void,
) {
  let receivedListener: { remove: () => void } | null = null;
  let responseListener: { remove: () => void } | null = null;

  loadNotifications().then((Notifications) => {
    if (!Notifications) return;
    receivedListener = Notifications.addNotificationReceivedListener(
      (notification) => onNotificationReceived?.(notification),
    );
    responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => onNotificationResponse?.(response),
    );
  });

  return {
    receivedListener,
    responseListener,
    remove: () => {
      receivedListener?.remove();
      responseListener?.remove();
    },
  };
}

export async function setupAndroidChannel(): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications || Platform.OS !== 'android') return;

  try {
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
    await Notifications.setNotificationChannelAsync('sos-alerts', {
      name: 'SOS Alerts',
      description: 'Critical emergency alerts for active rides',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF3B30',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });
  } catch {}
}

export async function sendWelcomeNotification(userName: string): Promise<void> {
  await sendLocalNotification(
    `Welcome ${userName}!`,
    'Thanks for joining Tripza. Start sharing rides and saving money today.',
    { type: 'welcome' },
  );
}

export async function scheduleRideReminder(
  rideId: string,
  from: string,
  to: string,
  departureTime: Date,
): Promise<string> {
  const reminderTime = departureTime.getTime() - Date.now() - 30 * 60 * 1000;
  if (reminderTime <= 0) return '';
  return scheduleNotification(
    'Upcoming Ride Reminder',
    `Your ride from ${from} to ${to} starts in 30 minutes`,
    Math.floor(reminderTime / 1000),
    { type: 'ride_reminder', rideId },
  );
}
