import express from 'express';
import {
  submitRating,
  getUserRatings,
  checkRatingStatus,
  getPendingRatings,
} from '../controllers/ratingController.js';

const router = express.Router();

// POST /api/ratings - Submit a new rating
router.post('/', submitRating);

// GET /api/ratings/:userId - Get ratings for a user
router.get('/:userId', getUserRatings);

// GET /api/ratings/check/:rideId/:userId - Check if user has rated a ride
router.get('/check/:rideId/:userId', checkRatingStatus);

// GET /api/ratings/pending/:userId - Get pending ratings for a user
router.get('/pending/:userId', getPendingRatings);

export default router;
