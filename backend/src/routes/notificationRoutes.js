import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';

const router = express.Router();
// All notification routes require authentication
router.use(requireClerkAuth);

// Register push token
router.post('/register-token', notificationController.registerPushToken);

// Send push notification
router.post('/send', notificationController.sendPushNotification);

// Send ride notification
router.post('/ride', notificationController.sendRideNotification);

// Send welcome notification
router.post('/welcome', notificationController.sendWelcomeNotification);

// Schedule ride reminder
router.post('/schedule-reminder', notificationController.scheduleRideReminder);

export default router;
