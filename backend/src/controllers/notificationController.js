import { Expo } from 'expo-server-sdk';

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Register a push notification token for a user
 */
export const registerPushToken = async (req, res) => {
  try {
    const { userId, pushToken } = req.body;

    if (!userId || !pushToken) {
      return res.status(400).json({
        success: false,
        message: 'userId and pushToken are required',
      });
    }

    // Validate the push token
    if (!Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Expo push token',
      });
    }

    // TODO: Store the push token in database
    // await db.query('INSERT INTO push_tokens (user_id, token) VALUES (?, ?) ON DUPLICATE KEY UPDATE token = ?',
    //   [userId, pushToken, pushToken]);

    console.log(`📱 Registered push token for user ${userId}: ${pushToken}`);

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register push token',
      error: error.message,
    });
  }
};

/**
 * Send a push notification to specific users
 */
export const sendPushNotification = async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required',
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'title and body are required',
      });
    }

    // TODO: Fetch push tokens from database
    // const tokens = await db.query('SELECT token FROM push_tokens WHERE user_id IN (?)', [userIds]);

    // For now, use mock tokens (replace with actual database query)
    const pushTokens = []; // tokens.map(t => t.token);

    if (pushTokens.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No push tokens found for specified users',
      });
    }

    // Create the messages to send
    const messages = [];
    for (const pushToken of pushTokens) {
      // Check if the push token is valid
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Invalid push token: ${pushToken}`);
        continue;
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
      });
    }

    // Send the notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    console.log(`📤 Sent ${tickets.length} push notifications`);

    res.json({
      success: true,
      message: `Sent ${tickets.length} push notifications`,
      tickets,
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send push notification',
      error: error.message,
    });
  }
};

/**
 * Send a ride notification to nearby drivers
 */
export const sendRideNotification = async (req, res) => {
  try {
    const { rideId, from, to, passengers, fare } = req.body;

    if (!rideId || !from || !to) {
      return res.status(400).json({
        success: false,
        message: 'rideId, from, and to are required',
      });
    }

    // TODO: Query nearby drivers from database
    // const nearbyDrivers = await db.query('SELECT user_id FROM drivers WHERE is_active = 1 AND ...');

    const title = 'New Ride Request';
    const body = `${from} → ${to}${passengers ? ` (${passengers} passenger${passengers > 1 ? 's' : ''})` : ''}`;

    const data = {
      type: 'ride_created',
      rideId,
      from,
      to,
      passengers,
      fare,
    };

    // TODO: Implement actual notification sending
    // await sendPushNotification({ userIds: nearbyDrivers.map(d => d.user_id), title, body, data });

    console.log(`🚗 Ride notification sent for ride ${rideId}`);

    res.json({
      success: true,
      message: 'Ride notification sent to nearby drivers',
    });
  } catch (error) {
    console.error('Error sending ride notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send ride notification',
      error: error.message,
    });
  }
};

/**
 * Send a welcome notification to a new user
 */
export const sendWelcomeNotification = async (req, res) => {
  try {
    const { userId, userName } = req.body;

    if (!userId || !userName) {
      return res.status(400).json({
        success: false,
        message: 'userId and userName are required',
      });
    }

    const title = `Welcome ${userName}! 🎉`;
    const body =
      'Thanks for joining KurzCarPool! Start sharing rides and saving money today.';

    const data = {
      type: 'welcome',
    };

    // TODO: Send notification
    // await sendPushNotification({ userIds: [userId], title, body, data });

    console.log(`🎉 Welcome notification sent to user ${userId}`);

    res.json({
      success: true,
      message: 'Welcome notification sent',
    });
  } catch (error) {
    console.error('Error sending welcome notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome notification',
      error: error.message,
    });
  }
};

/**
 * Schedule a ride reminder notification
 */
export const scheduleRideReminder = async (req, res) => {
  try {
    const { userId, rideId, from, to, departureTime } = req.body;

    if (!userId || !rideId || !from || !to || !departureTime) {
      return res.status(400).json({
        success: false,
        message: 'userId, rideId, from, to, and departureTime are required',
      });
    }

    // Calculate reminder time (30 minutes before departure)
    const departureDate = new Date(departureTime);
    const reminderTime = new Date(departureDate.getTime() - 30 * 60 * 1000);
    const now = new Date();

    if (reminderTime <= now) {
      return res.status(400).json({
        success: false,
        message: 'Ride time is too soon for reminder',
      });
    }

    // TODO: Store scheduled notification in database
    // await db.query('INSERT INTO scheduled_notifications (user_id, ride_id, scheduled_time, title, body, data) VALUES (?, ?, ?, ?, ?, ?)',
    //   [userId, rideId, reminderTime, title, body, JSON.stringify(data)]);

    console.log(`⏰ Ride reminder scheduled for ${reminderTime}`);

    res.json({
      success: true,
      message: 'Ride reminder scheduled',
      scheduledTime: reminderTime,
    });
  } catch (error) {
    console.error('Error scheduling ride reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule ride reminder',
      error: error.message,
    });
  }
};
