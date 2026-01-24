import express from 'express';
import {
  syncUser,
  getUserProfile,
  updateUserRole,
  updateUserLocation,
  updateUserIP,
  logoutUser,
} from '../controllers/userController.js';

const router = express.Router();

// POST /api/users/sync - Sync user from Clerk
router.post('/sync', syncUser);

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

export default router;
