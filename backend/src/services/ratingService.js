import { Rating } from '../models/rating.model.js';
import { UserProfile } from '../models/userProfile.model.js';
import { RideOffer } from '../models/rideOffer.model.js';
import { RideBooking } from '../models/rideBooking.model.js';

class RatingServiceError extends Error {
  constructor(message, { status = 400, details } = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function submitRideRating(payload) {
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
  } = payload;

  if (!rideId || !raterId || !ratedId || !rating) {
    throw new RatingServiceError('Missing required fields', {
      details: 'rideId, raterId, ratedId, and rating are required',
    });
  }

  if (rating < 1 || rating > 5) {
    throw new RatingServiceError('Invalid rating', {
      details: 'Rating must be between 1 and 5',
    });
  }

  if (raterId === ratedId) {
    throw new RatingServiceError('Invalid rating', {
      details: 'Cannot rate yourself',
    });
  }

  const existingRating = await Rating.findOne({
    rideId,
    raterId,
    ratedId,
  });

  if (existingRating) {
    throw new RatingServiceError('Rating already submitted', {
      status: 409,
      details: 'You have already rated this person for this ride',
    });
  }

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
  await updateUserRating(ratedId);

  return newRating;
}

export async function getRatingsForUser(userId, { role, limit = 50 } = {}) {
  const query = { ratedId: userId };
  if (role) {
    query.ratedRole = role;
  }

  const ratings = await Rating.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10))
    .populate('rideId', 'from to departureTime');

  const stats = await getRatingStats(userId, role);

  return { ratings, stats };
}

export async function getRatingStatus(rideId, userId) {
  const rating = await Rating.findOne({
    rideId,
    raterId: userId,
  });

  return {
    hasRated: Boolean(rating),
    rating: rating || null,
  };
}

export async function getPendingRatingsForUser(userId) {
  const completedRidesAsDriver = await RideOffer.find({
    clerkId: userId,
    status: 'completed',
  }).select('_id from to departureTime completedAt bookings');

  const completedBookings = await RideBooking.find({
    $or: [{ passengerId: userId }, { passengerClerkId: userId }],
    approvalStatus: 'confirmed',
  })
    .populate('rideId', 'from to departureTime completedAt status driverId')
    .select('_id rideId driverId');

  const pendingRatings = [];

  for (const ride of completedRidesAsDriver) {
    if (!ride.bookings?.length) continue;

    for (const booking of ride.bookings) {
      if (booking.status !== 'confirmed' || !booking.passengerClerkId) continue;

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

  for (const booking of completedBookings) {
    if (!booking.rideId || booking.rideId.status !== 'completed') continue;

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

  return pendingRatings;
}

async function updateUserRating(userId) {
  const ratings = await Rating.find({ ratedId: userId });
  if (ratings.length === 0) return;

  const totalRating = ratings.reduce((sum, item) => sum + item.rating, 0);
  const averageRating = totalRating / ratings.length;
  const roundedAverage = parseFloat(averageRating.toFixed(2));

  const user = await UserProfile.findOne({ clerkId: userId });
  if (!user) return;

  const update = { rating: roundedAverage };

  if (user.role === 'ride_partner' && user.ridePartnerProfile) {
    const privacyType =
      user.ridePartnerProfile.driverPrivacyType || 'private_vehicle';
    const ratingScore = Math.min(50, Math.max(0, roundedAverage * 10));
    const tripScore = Math.min(
      30,
      Math.floor((Number(user.totalTrips) || 0) / 2),
    );
    const ratingVolumeScore = Math.min(10, ratings.length * 2);
    const disclosureScore = privacyType === 'full_detail' ? 10 : 4;
    const trustScore = Math.min(
      100,
      ratingScore + tripScore + ratingVolumeScore + disclosureScore,
    );
    const publicityScore = Math.min(
      100,
      trustScore + (privacyType === 'full_detail' ? 10 : -5),
    );
    const trustBatch =
      trustScore >= 85
        ? 'featured'
        : trustScore >= 70
          ? 'trusted'
          : trustScore >= 55
            ? 'community'
            : 'new';

    update['ridePartnerProfile.trustBatch'] = trustBatch;
    update['ridePartnerProfile.trustScore'] = trustScore;
    update['ridePartnerProfile.publicityScore'] = publicityScore;
  }

  await UserProfile.findOneAndUpdate({ clerkId: userId }, update);
}

async function getRatingStats(userId, role) {
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
  const sum = ratings.reduce((acc, item) => acc + item.rating, 0);
  const average = sum / total;
  const distribution = ratings.reduce(
    (acc, item) => {
      acc[item.rating] = (acc[item.rating] || 0) + 1;
      return acc;
    },
    { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  );

  return {
    average: parseFloat(average.toFixed(2)),
    total,
    distribution,
  };
}
