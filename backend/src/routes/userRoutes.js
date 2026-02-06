import express from 'express';
import {
  syncUser,
  getUserProfile,
  updateUserRole,
  updateUserLocation,
  updateUserIP,
  logoutUser,
  getProfile,
  updatePushToken,
  updateDriverVerification,
} from '../controllers/userController.js';

const router = express.Router();

// POST /api/users/sync - Sync user from Clerk
router.post('/sync', syncUser);

// GET /api/users/profile - Get current user profile (requires auth)
router.get('/profile', getProfile);

// POST /api/users/logout - Logout user
router.post('/logout', logoutUser);

// GET /api/users/:clerkId - Get user profile
router.get('/:clerkId', getUserProfile);

// PATCH /api/users/:clerkId/role - Update user role
router.patch('/:clerkId/role', updateUserRole);

// PUT /api/users/location - Update user location
router.put('/location', updateUserLocation);

// PUT /api/users/ip - Store user IP address
router.put('/ip', updateUserIP);

// POST /api/users/push-token - Update push notification token
router.post('/push-token', updatePushToken);

// POST /api/users/driver-verification - Update driver verification status
router.post('/driver-verification', updateDriverVerification);

export default router;
