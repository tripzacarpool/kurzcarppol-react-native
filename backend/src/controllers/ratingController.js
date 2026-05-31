import {
  getPendingRatingsForUser,
  getRatingsForUser,
  getRatingStatus,
  submitRideRating,
} from '../services/ratingService.js';
import { sendErrorResponse } from '../shared/http/responses.js';

export const submitRating = async (req, res, next) => {
  try {
    const rating = await submitRideRating(req.body);

    return res.status(201).json({
      success: true,
      rating,
      message: 'Rating submitted successfully',
    });
  } catch (error) {
    if (error.status) {
      return sendErrorResponse(req, res, error, {
        fallbackCode: 'RATING_SUBMIT_ERROR',
      });
    }
    return next(error);
  }
};

export const getUserRatings = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, limit = 50 } = req.query;
    const { ratings, stats } = await getRatingsForUser(userId, {
      role,
      limit,
    });

    return res.status(200).json({
      success: true,
      ratings,
      stats,
      count: ratings.length,
    });
  } catch (error) {
    return next(error);
  }
};

export const checkRatingStatus = async (req, res, next) => {
  try {
    const { rideId, userId } = req.params;
    const status = await getRatingStatus(rideId, userId);

    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPendingRatings = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const pendingRatings = await getPendingRatingsForUser(userId);

    return res.status(200).json({
      success: true,
      pendingRatings,
      count: pendingRatings.length,
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  submitRating,
  getUserRatings,
  checkRatingStatus,
  getPendingRatings,
};
