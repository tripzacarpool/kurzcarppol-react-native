import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireSelfOrRole } from '../middleware/requireSelfOrRole.js';

const router = express.Router();
// All notification routes require authentication
router.use(requireClerkAuth);

// Register push token
router.post(
  '/register-token',
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  notificationController.registerPushToken,
);

// Send push notification
router.post('/send', requireRole('admin'), notificationController.sendPushNotification);

// Send ride notification
router.post('/ride', requireRole('admin'), notificationController.sendRideNotification);

// Send welcome notification
router.post(
  '/welcome',
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  notificationController.sendWelcomeNotification,
);

// Schedule ride reminder
router.post(
  '/schedule-reminder',
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  notificationController.scheduleRideReminder,
);

export default router;
