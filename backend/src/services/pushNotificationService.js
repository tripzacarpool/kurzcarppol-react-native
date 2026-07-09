import { Expo } from 'expo-server-sdk';
import { UserProfile } from '../models/userProfile.model.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';

const expo = new Expo();

export function isValidPushToken(pushToken) {
  return Expo.isExpoPushToken(pushToken);
}

class PushNotificationError extends Error {
  constructor(message, { status = 400, code, details, debug } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.debug = debug;
  }
}

export async function registerUserPushToken({ clerkId, pushToken }) {
  if (!clerkId) {
    throw new PushNotificationError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'clerkId is required',
    });
  }

  if (!pushToken) {
    throw new PushNotificationError('Invalid request', {
      code: 'MISSING_PUSH_TOKEN',
      details: 'pushToken is required',
    });
  }

  if (!isValidPushToken(pushToken)) {
    throw new PushNotificationError('Invalid push token format', {
      code: 'INVALID_PUSH_TOKEN',
      details: 'The provided push token is not a valid Expo push token',
    });
  }

  const user = await UserProfile.findOneAndUpdate(
    { clerkId },
    {
      pushToken,
      pushTokenUpdatedAt: new Date(),
    },
    { new: true },
  ).select('clerkId pushTokenUpdatedAt');

  if (!user) {
    throw new PushNotificationError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: 'No user profile found for this clerkId',
    });
  }

  await publishEvent(EventTypes.UserPushTokenRegistered, {
    userId: clerkId,
    pushTokenUpdatedAt: user.pushTokenUpdatedAt,
  });

  return {
    clerkId: user.clerkId,
    pushTokenUpdatedAt: user.pushTokenUpdatedAt,
  };
}

export async function sendTestPushToUser(clerkId) {
  if (!clerkId) {
    throw new PushNotificationError('Missing clerkId', {
      code: 'MISSING_CLERK_ID',
      details: 'clerkId is required to test push notification',
    });
  }

  const user = await UserProfile.findOne({ clerkId }).select('clerkId pushToken');
  if (!user) {
    throw new PushNotificationError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: 'No user profile found for this clerkId',
    });
  }

  if (!user.pushToken) {
    throw new PushNotificationError('No push token', {
      code: 'NO_PUSH_TOKEN',
      details: 'User does not have a push token registered',
      debug: {
        clerkId,
        hasPushToken: false,
        profileExists: true,
      },
    });
  }

  if (!isValidPushToken(user.pushToken)) {
    throw new PushNotificationError('Invalid push token format', {
      code: 'INVALID_TOKEN_FORMAT',
      details: 'The stored push token is not in the correct format',
      debug: {
        tokenPrefix: user.pushToken.substring(0, 20),
        expectedPrefix: 'ExponentPushToken[',
      },
    });
  }

  const results = await sendPushToToken({
    pushToken: user.pushToken,
    title: 'Test Push Notification',
    body: 'This is a test notification. If you see this, push notifications are working!',
    data: {
      type: 'test',
      timestamp: new Date().toISOString(),
    },
  });

  return {
    results,
    debug: {
      clerkId,
      tokenValid: true,
      messagesSent: 1,
    },
  };
}

export async function sendPushMessages(messages) {
  const validMessages = messages.filter((message) => {
    if (!Expo.isExpoPushToken(message.to)) {
      console.warn(`Invalid Expo push token skipped: ${message.to}`);
      return false;
    }
    return true;
  });

  const chunks = expo.chunkPushNotifications(validMessages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending push notification chunk:', error);
    }
  }

  await publishEvent(EventTypes.NotificationPushSent, {
    requested: messages.length,
    sent: tickets.length,
  });

  return tickets;
}

export async function sendPushToUsers({ userIds, title, body, data = {} }) {
  const users = await UserProfile.find({
    clerkId: { $in: userIds },
    pushToken: { $exists: true, $ne: null },
  }).select('clerkId pushToken');

  const messages = users
    .map((user) => ({
      to: user.pushToken,
      sound: 'default',
      title,
      body,
      data,
      channelId: data?.channelId || 'default',
      priority: 'high',
    }))
    .filter((message) => Boolean(message.to));

  await publishEvent(EventTypes.NotificationPushRequested, {
    userIds,
    title,
    notificationType: data?.type,
    resolvedTokens: messages.length,
  });

  if (messages.length === 0) {
    return [];
  }

  return sendPushMessages(messages);
}

export async function sendPushToUsersByRole({
  role,
  title,
  body,
  data = {},
  excludeClerkId,
  pickupLatitude,
  pickupLongitude,
  pickupCity,
  radiusKm = 12,
  limit = 100,
}) {
  const query = {
    role,
    isActive: true,
    pushToken: { $exists: true, $ne: null },
  };
  if (excludeClerkId) {
    query.clerkId = { $ne: excludeClerkId };
  }

  const users = await UserProfile.find(query)
    .select('clerkId pushToken location')
    .limit(limit);

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const toRadians = (degrees) => degrees * (Math.PI / 180);
  const pickupLat = toNumber(pickupLatitude);
  const pickupLng = toNumber(pickupLongitude);
  const normalizedPickupCity = (pickupCity || '').trim().toLowerCase();
  const boundedRadius = Math.min(Math.max(Number(radiusKm) || 12, 1), 50);

  const filteredUsers =
    role === 'ride_partner' && (pickupLat !== null || normalizedPickupCity)
      ? users.filter((user) => {
          const location = user.location || {};
          const driverLat = toNumber(location.latitude);
          const driverLng = toNumber(location.longitude);

          if (
            pickupLat !== null &&
            pickupLng !== null &&
            driverLat !== null &&
            driverLng !== null
          ) {
            const dLat = toRadians(driverLat - pickupLat);
            const dLng = toRadians(driverLng - pickupLng);
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(pickupLat)) *
                Math.cos(toRadians(driverLat)) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
            const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return distanceKm <= boundedRadius;
          }

          const driverCity = (location.city || '').trim().toLowerCase();
          return Boolean(normalizedPickupCity && driverCity === normalizedPickupCity);
        })
      : users;

  const messages = filteredUsers.map((user) => ({
    to: user.pushToken,
    sound: 'default',
    title,
    body,
    data,
    channelId: data?.channelId || 'default',
    priority: 'high',
  }));

  await publishEvent(EventTypes.NotificationPushRequested, {
    role,
    title,
    notificationType: data?.type,
    resolvedTokens: messages.length,
  });

  if (messages.length === 0) {
    return [];
  }

  return sendPushMessages(messages);
}

export async function sendPushToToken({ pushToken, title, body, data = {} }) {
  return sendPushMessages([
    {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      channelId: data?.channelId || 'default',
      priority: 'high',
    },
  ]);
}

export async function queueRideCreatedNotification({
  rideId,
  from,
  to,
  passengers,
  fare,
}) {
  if (!rideId || !from || !to) {
    throw new PushNotificationError('Invalid ride notification request', {
      code: 'MISSING_RIDE_NOTIFICATION_FIELDS',
      details: 'rideId, from, and to are required',
    });
  }

  await publishEvent(EventTypes.NotificationPushRequested, {
    notificationType: 'ride_created',
    rideId,
    from,
    to,
    passengers,
    fare,
  });
}

export async function scheduleRideReminderNotification({
  userId,
  rideId,
  from,
  to,
  departureTime,
}) {
  if (!userId || !rideId || !from || !to || !departureTime) {
    throw new PushNotificationError('Invalid reminder request', {
      code: 'MISSING_REMINDER_FIELDS',
      details: 'userId, rideId, from, to, and departureTime are required',
    });
  }

  const departureDate = new Date(departureTime);
  const reminderTime = new Date(departureDate.getTime() - 30 * 60 * 1000);
  const now = new Date();

  if (Number.isNaN(departureDate.getTime()) || reminderTime <= now) {
    throw new PushNotificationError('Ride time is too soon or invalid for reminder', {
      code: 'INVALID_REMINDER_TIME',
    });
  }

  await publishEvent(EventTypes.NotificationPushRequested, {
    notificationType: 'ride_reminder_scheduled',
    userId,
    rideId,
    from,
    to,
    departureTime,
    reminderTime,
  });

  return { reminderTime };
}
