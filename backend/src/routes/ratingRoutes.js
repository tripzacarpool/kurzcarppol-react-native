import express from 'express';
import {
  submitRating,
  getUserRatings,
  checkRatingStatus,
  getPendingRatings,
} from '../controllers/ratingController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireSelfOrRole } from '../middleware/requireSelfOrRole.js';

const router = express.Router();
router.use(requireClerkAuth);

// POST /api/ratings - Submit a new rating
router.post('/', submitRating);

// GET /api/ratings/check/:rideId/:userId - Check if user has rated a ride
router.get(
  '/check/:rideId/:userId',
  requireSelfOrRole({ userIdSources: ['params.userId'] }),
  checkRatingStatus,
);

// GET /api/ratings/pending/:userId - Get pending ratings for a user
router.get(
  '/pending/:userId',
  requireSelfOrRole({ userIdSources: ['params.userId'] }),
  getPendingRatings,
);

// GET /api/ratings/:userId - Get ratings for a user
router.get(
  '/:userId',
  requireSelfOrRole({ userIdSources: ['params.userId'] }),
  getUserRatings,
);

export default router;
