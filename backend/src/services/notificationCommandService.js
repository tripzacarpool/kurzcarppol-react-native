import {
  queueRideCreatedNotification,
  registerUserPushToken,
  scheduleRideReminderNotification,
  sendPushToUsers,
} from './pushNotificationService.js';

class NotificationCommandError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function registerPushTokenCommand({ userId, pushToken }) {
  await registerUserPushToken({ clerkId: userId, pushToken });
}

export async function sendPushNotificationCommand({
  userIds,
  title,
  body,
  data = {},
}) {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new NotificationCommandError('userIds array is required', {
      code: 'MISSING_USER_IDS',
    });
  }

  if (!title || !body) {
    throw new NotificationCommandError('title and body are required', {
      code: 'MISSING_MESSAGE',
    });
  }

  const tickets = await sendPushToUsers({ userIds, title, body, data });
  if (tickets.length === 0) {
    throw new NotificationCommandError('No push tokens found for specified users', {
      status: 404,
      code: 'NO_PUSH_TOKENS',
    });
  }

  return tickets;
}

export async function sendRideNotificationCommand({
  rideId,
  from,
  to,
  passengers,
  fare,
}) {
  if (!rideId || !from || !to) {
    throw new NotificationCommandError('rideId, from, and to are required', {
      code: 'MISSING_RIDE_FIELDS',
    });
  }

  await queueRideCreatedNotification({ rideId, from, to, passengers, fare });
}

export async function sendWelcomeNotificationCommand({ userId, userName }) {
  if (!userId || !userName) {
    throw new NotificationCommandError('userId and userName are required', {
      code: 'MISSING_WELCOME_FIELDS',
    });
  }

  return sendPushToUsers({
    userIds: [userId],
    title: `Welcome ${userName}!`,
    body: 'Thanks for joining Tripza. Start sharing rides and saving money today.',
    data: {
      type: 'welcome',
    },
  });
}

export async function scheduleRideReminderCommand({
  userId,
  rideId,
  from,
  to,
  departureTime,
}) {
  if (!userId || !rideId || !from || !to || !departureTime) {
    throw new NotificationCommandError(
      'userId, rideId, from, to, and departureTime are required',
      {
        code: 'MISSING_REMINDER_FIELDS',
      },
    );
  }

  return scheduleRideReminderNotification({
    userId,
    rideId,
    from,
    to,
    departureTime,
  });
}
