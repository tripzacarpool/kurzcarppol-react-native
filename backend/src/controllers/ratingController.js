import {
  Rating,
  UserProfile,
  RideOffer,
  RideBooking,
} from '../config/models.js';

/**
 * Submit a rating for a driver or passenger
 * POST /api/ratings
 */
export const submitRating = async (req, res, next) => {
  try {
    const {
      rideId,
      bookingId,
      raterId,
      ratedId,
      raterRole,
      ratedRole,
      rating,
      feedback,
      tags,
    } = req.body;

    // Validation
    if (!rideId || !raterId || !ratedId || !rating) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'rideId, raterId, ratedId, and rating are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Invalid rating',
        details: 'Rating must be between 1 and 5',
      });
    }

    if (raterId === ratedId) {
      return res.status(400).json({
        error: 'Invalid rating',
        details: 'Cannot rate yourself',
      });
    }

    // Check if rating already exists
    const existingRating = await Rating.findOne({
      rideId,
      raterId,
      ratedId,
    });

    if (existingRating) {
      return res.status(409).json({
        error: 'Rating already submitted',
        details: 'You have already rated this person for this ride',
      });
    }

    // Create new rating
    const newRating = new Rating({
      rideId,
      bookingId,
      raterId,
      ratedId,
      raterRole,
      ratedRole,
      rating,
      feedback: feedback || '',
      tags: tags || [],
    });

    await newRating.save();

    // Update user's average rating
    await updateUserRating(ratedId);

    console.log(
      `✅ Rating submitted: ${raterId} rated ${ratedId} with ${rating} stars`,
    );

    return res.status(201).json({
      success: true,
      rating: newRating,
      message: 'Rating submitted successfully',
    });
  } catch (error) {
    console.error('❌ Error submitting rating:', error);
    next(error);
  }
};

/**
 * Get ratings for a user
 * GET /api/ratings/:userId
 */
export const getUserRatings = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, limit = 50 } = req.query;

    const query = { ratedId: userId };
    if (role) {
      query.ratedRole = role;
    }

    const ratings = await Rating.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('rideId', 'from to departureTime');

    const stats = await getRatingStats(userId, role);

    return res.status(200).json({
      success: true,
      ratings,
      stats,
      count: ratings.length,
    });
  } catch (error) {
    console.error('❌ Error getting ratings:', error);
    next(error);
  }
};

/**
 * Check if user has rated a specific ride
 * GET /api/ratings/check/:rideId/:userId
 */
export const checkRatingStatus = async (req, res, next) => {
  try {
    const { rideId, userId } = req.params;

    const rating = await Rating.findOne({
      rideId,
      raterId: userId,
    });

    return res.status(200).json({
      success: true,
      hasRated: !!rating,
      rating: rating || null,
    });
  } catch (error) {
    console.error('❌ Error checking rating status:', error);
    next(error);
  }
};

/**
 * Get pending ratings for a user (rides that need rating)
 * GET /api/ratings/pending/:userId
 */
export const getPendingRatings = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Find completed rides where user was involved but hasn't rated
    const completedRidesAsDriver = await RideOffer.find({
      clerkId: userId,
      status: 'completed',
    }).select('_id from to departureTime completedAt bookings');

    const completedBookings = await RideBooking.find({
      passengerId: userId,
      approvalStatus: 'confirmed',
    })
      .populate('rideId', 'from to departureTime completedAt status driverId')
      .select('_id rideId driverId');

    // Check which ones haven't been rated
    const pendingRatings = [];

    // Check driver ratings (driver needs to rate passengers)
    for (const ride of completedRidesAsDriver) {
      if (ride.bookings && ride.bookings.length > 0) {
        for (const booking of ride.bookings) {
          if (booking.status === 'confirmed' && booking.passengerClerkId) {
            const existingRating = await Rating.findOne({
              rideId: ride._id,
              raterId: userId,
              ratedId: booking.passengerClerkId,
            });

            if (!existingRating) {
              pendingRatings.push({
                rideId: ride._id,
                bookingId: booking._id,
                from: ride.from,
                to: ride.to,
                departureTime: ride.departureTime,
                completedAt: ride.completedAt,
                ratedId: booking.passengerClerkId,
                ratedName: booking.passengerName,
                ratedRole: 'passenger',
                raterRole: 'driver',
              });
            }
          }
        }
      }
    }

    // Check passenger ratings (passenger needs to rate driver)
    for (const booking of completedBookings) {
      if (booking.rideId && booking.rideId.status === 'completed') {
        const existingRating = await Rating.findOne({
          rideId: booking.rideId._id,
          raterId: userId,
          ratedId: booking.driverId,
        });

        if (!existingRating) {
          pendingRatings.push({
            rideId: booking.rideId._id,
            bookingId: booking._id,
            from: booking.rideId.from,
            to: booking.rideId.to,
            departureTime: booking.rideId.departureTime,
            completedAt: booking.rideId.completedAt,
            ratedId: booking.driverId,
            ratedRole: 'driver',
            raterRole: 'passenger',
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      pendingRatings,
      count: pendingRatings.length,
    });
  } catch (error) {
    console.error('❌ Error getting pending ratings:', error);
    next(error);
  }
};

/**
 * Helper function to update user's average rating
 */
async function updateUserRating(userId) {
  try {
    const ratings = await Rating.find({ ratedId: userId });

    if (ratings.length === 0) {
      return;
    }

    const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / ratings.length;

    await UserProfile.findOneAndUpdate(
      { clerkId: userId },
      { rating: parseFloat(averageRating.toFixed(2)) },
    );

    console.log(
      `✅ Updated ${userId} rating to ${averageRating.toFixed(2)} (${ratings.length} ratings)`,
    );
  } catch (error) {
    console.error('❌ Error updating user rating:', error);
  }
}

/**
 * Helper function to get rating statistics
 */
async function getRatingStats(userId, role) {
  try {
    const query = { ratedId: userId };
    if (role) {
      query.ratedRole = role;
    }

    const ratings = await Rating.find(query);

    if (ratings.length === 0) {
      return {
        average: 5,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const total = ratings.length;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / total;

    const distribution = ratings.reduce(
      (acc, r) => {
        acc[r.rating] = (acc[r.rating] || 0) + 1;
        return acc;
      },
      { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    );

    return {
      average: parseFloat(average.toFixed(2)),
      total,
      distribution,
    };
  } catch (error) {
    console.error('❌ Error calculating rating stats:', error);
    return {
      average: 5,
      total: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }
}

export default {
  submitRating,
  getUserRatings,
  checkRatingStatus,
  getPendingRatings,
};
