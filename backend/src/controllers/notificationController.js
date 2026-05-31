import {
  registerPushTokenCommand,
  scheduleRideReminderCommand,
  sendPushNotificationCommand,
  sendRideNotificationCommand,
  sendWelcomeNotificationCommand,
} from '../services/notificationCommandService.js';

const sendNotificationError = (req, res, error, fallbackMessage) =>
  res.status(error.status || 500).json({
    success: false,
    message: error.details || error.message || fallbackMessage,
    code: error.code,
    error: error.message,
    requestId: req.requestId,
  });

export const registerPushToken = async (req, res) => {
  try {
    const { userId, pushToken } = req.body;

    await registerPushTokenCommand({ userId, pushToken });

    return res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return sendNotificationError(req, res, error, 'Failed to register push token');
  }
};

export const sendPushNotification = async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;

    const tickets = await sendPushNotificationCommand({
      userIds,
      title,
      body,
      data: data || {},
    });

    return res.json({
      success: true,
      message: `Sent ${tickets.length} push notifications`,
      tickets,
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    return sendNotificationError(req, res, error, 'Failed to send push notification');
  }
};

export const sendRideNotification = async (req, res) => {
  try {
    const { rideId, from, to, passengers, fare } = req.body;

    await sendRideNotificationCommand({
      rideId,
      from,
      to,
      passengers,
      fare,
    });

    return res.json({
      success: true,
      message: 'Ride notification request queued',
    });
  } catch (error) {
    console.error('Error sending ride notification:', error);
    return sendNotificationError(req, res, error, 'Failed to send ride notification');
  }
};

export const sendWelcomeNotification = async (req, res) => {
  try {
    const { userId, userName } = req.body;

    const tickets = await sendWelcomeNotificationCommand({ userId, userName });

    return res.json({
      success: true,
      message: 'Welcome notification processed',
      tickets,
    });
  } catch (error) {
    console.error('Error sending welcome notification:', error);
    return sendNotificationError(req, res, error, 'Failed to send welcome notification');
  }
};

export const scheduleRideReminder = async (req, res) => {
  try {
    const { userId, rideId, from, to, departureTime } = req.body;

    const { reminderTime } = await scheduleRideReminderCommand({
      userId,
      rideId,
      from,
      to,
      departureTime,
    });

    return res.json({
      success: true,
      message: 'Ride reminder scheduled',
      scheduledTime: reminderTime,
    });
  } catch (error) {
    console.error('Error scheduling ride reminder:', error);
    return sendNotificationError(req, res, error, 'Failed to schedule ride reminder');
  }
};
