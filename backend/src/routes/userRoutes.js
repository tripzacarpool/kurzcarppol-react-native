import express from 'express';
import {
  syncUser,
  getUserProfile,
  updateUserRole,
  updateUserLocation,
  updateUserIP,
  updateSafetySettings,
  logoutUser,
  getProfile,
  updatePushToken,
  testPushNotification,
  updateDriverVerification,
  checkEmailExists,
  getAdminOverview,
  getAdminDrivers,
  updateAdminDriver,
} from '../controllers/userController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireSelfOrRole } from '../middleware/requireSelfOrRole.js';

const router = express.Router();

// POST /api/users/sync - Sync user from Clerk
router.post('/sync', requireClerkAuth, syncUser);

// GET /api/users/check-email - Check if email exists
router.get('/check-email', checkEmailExists);

// GET /api/users/profile - Get current user profile (requires auth)
router.get('/profile', requireClerkAuth, getProfile);

// PUT /api/users/safety-settings - Update SOS emergency contacts and safety preferences
router.put('/safety-settings', requireClerkAuth, updateSafetySettings);

// Admin user and driver management
router.get('/admin/overview', requireClerkAuth, requireRole('admin'), getAdminOverview);
router.get('/admin/drivers', requireClerkAuth, requireRole('admin'), getAdminDrivers);
router.patch(
  '/admin/drivers/:clerkId',
  requireClerkAuth,
  requireRole('admin'),
  updateAdminDriver,
);

// POST /api/users/logout - Logout user
router.post(
  '/logout',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['body.clerkId'] }),
  logoutUser,
);

// GET /api/users/:clerkId - Get user profile
router.get(
  '/:clerkId',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['params.clerkId'] }),
  getUserProfile,
);

// PATCH /api/users/:clerkId/role - Update user role
router.patch('/:clerkId/role', requireClerkAuth, requireRole('admin'), updateUserRole);

// PUT /api/users/location - Update user location
router.put(
  '/location',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  updateUserLocation,
);

// PUT /api/users/ip - Store user IP address
router.put(
  '/ip',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  updateUserIP,
);

// POST /api/users/push-token - Update push notification token
router.post(
  '/push-token',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['body.clerkId'] }),
  updatePushToken,
);

// POST /api/users/test-push - Test push notification
router.post(
  '/test-push',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['body.clerkId'] }),
  testPushNotification,
);

// POST /api/users/driver-verification - Update driver verification status
router.post('/driver-verification', requireClerkAuth, updateDriverVerification);

export default router;
