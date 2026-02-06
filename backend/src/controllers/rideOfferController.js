import { UserProfile, RideOffer } from '../config/models.js';
import { locationService } from '../services/locationService.js';
import { Expo } from 'expo-server-sdk';

// Socket.io instance will be injected
let io = null;

// Expo notification client
const expo = new Expo();

export function setSocketIO(socketInstance) {
  io = socketInstance;
}

const VEHICLE_TYPES = ['two_wheeler', 'four_wheeler'];
const normalizeVehicleType = (value) =>
  VEHICLE_TYPES.includes(value) ? value : 'four_wheeler';

/**
 * Helper to get userId from Clerk auth
 */
const getClerkUserId = (req) => {
  try {
    if (typeof req.auth === 'function') {
      return req.auth()?.userId;
    }
    return req.auth?.userId;
  } catch (error) {
    console.error('❌ Error getting Clerk userId:', error);
    return null;
  }
};

/**
 * Create a new ride offer
 * POST /api/ride-offers/create
 */
export const createRideOffer = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
        code: 'NO_AUTH_USER',
      });
    }

    const {
      from,
      to,
      totalSeats = 4,
      farePerSeat = 0,
      vehicleType,
      driverMode = 'commuter',
      notes = '',
      womenOnly = false,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
      dropoffLatitude,
      dropoffLongitude,
      dropoffCity,
      dropoffCountry,
      departureTime,
      scheduledDeparture,
      timeFlexibilityMinutes,
      vehicle,
      driver,
    } = req.body || {};

    if (!from || !to) {
      return res.status(400).json({
        error: 'Invalid ride offer',
        details: '`from` and `to` are required',
        code: 'MISSING_FIELDS',
      });
    }

    if (!departureTime) {
      return res.status(400).json({
        error: 'Invalid ride offer',
        details: '`departureTime` is required',
        code: 'MISSING_DEPARTURE_TIME',
      });
    }

    // Get user profile
    const userProfile = await UserProfile.findOne({ clerkId });
    if (!userProfile) {
      return res.status(404).json({
        error: 'User not found',
        details: 'No user profile found for this clerkId',
        code: 'USER_NOT_FOUND',
      });
    }

    // Generate available seats array
    const availableSeats = Array.from({ length: totalSeats }, (_, i) => i + 1);

    // Create ride offer
    const rideOffer = new RideOffer({
      userId: userProfile._id,
      clerkId,
      from,
      to,
      totalSeats,
      availableSeats,
      farePerSeat,
      vehicleType: normalizeVehicleType(vehicleType),
      driverMode,
      notes,
      womenOnly,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
      dropoffLatitude,
      dropoffLongitude,
      dropoffCity,
      dropoffCountry,
      departureTime: new Date(departureTime),
      scheduledDeparture: scheduledDeparture
        ? new Date(scheduledDeparture)
        : null,
      timeFlexibilityMinutes: timeFlexibilityMinutes || 60,
      status: 'waiting',
      vehicle: vehicle || {
        model: userProfile.vehicleInfo?.model || 'Vehicle',
        color: userProfile.vehicleInfo?.color || 'Unknown',
        number: userProfile.vehicleInfo?.licensePlate || 'N/A',
      },
      driver: driver || {
        name:
          `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
          userProfile.email,
        profileImage:
          userProfile.profileImage || 'https://www.gravatar.com/avatar?d=mp',
        rating: userProfile.rating || 5,
        ridesCompleted: userProfile.totalTrips || 0,
        gender: 'other',
      },
      bookings: [],
    });

    await rideOffer.save();

    // Broadcast new offer via Socket.IO
    if (io) {
      io.emit('newRideOffer', rideOffer);
      console.log('🔔 Broadcasted new ride offer:', rideOffer._id);
    }

    return res.status(201).json({
      success: true,
      rideOffer,
      message: 'Ride offer created successfully',
    });
  } catch (error) {
    console.error('❌ Error creating ride offer:', error);
    next(error);
  }
};

/**
 * Get all available ride offers
 * GET /api/ride-offers/available
 */
export const getAvailableRideOffers = async (req, res, next) => {
  try {
    const { from, to, minSeats = 1 } = req.query;

    const query = {
      status: 'waiting',
      availableSeats: { $exists: true, $ne: [] },
      departureTime: { $gte: new Date() }, // Only future rides
    };

    if (from) query.from = new RegExp(from, 'i');
    if (to) query.to = new RegExp(to, 'i');
    if (minSeats) {
      query.$expr = {
        $gte: [{ $size: '$availableSeats' }, parseInt(minSeats)],
      };
    }

    const rideOffers = await RideOffer.find(query)
      .sort({ departureTime: 1, createdAt: -1 })
      .limit(50);

    // Transform to match frontend expectations
    const formattedOffers = rideOffers.map((offer) => ({
      id: offer._id.toString(),
      clerkId: offer.clerkId,
      from: offer.from,
      to: offer.to,
      totalSeats: offer.totalSeats,
      availableSeats: offer.availableSeats,
      passengers: offer.totalSeats - offer.availableSeats.length, // Booked seats
      farePerSeat: offer.farePerSeat,
      vehicleType: offer.vehicleType,
      driverMode: offer.driverMode,
      notes: offer.notes,
      womenOnly: offer.womenOnly,
      pickupLatitude: offer.pickupLatitude,
      pickupLongitude: offer.pickupLongitude,
      pickupCity: offer.pickupCity,
      pickupCountry: offer.pickupCountry,
      departureTime: offer.departureTime,
      scheduledDeparture: offer.scheduledDeparture,
      earliestDeparture: offer.earliestDeparture,
      latestDeparture: offer.latestDeparture,
      timeFlexibilityMinutes: offer.timeFlexibilityMinutes,
      status: offer.status,
      vehicle: offer.vehicle,
      driver: offer.driver,
      bookings: offer.bookings,
      pickupStatus: offer.pickupStatus,
      dropoffStatus: offer.dropoffStatus,
      createdAt: offer.createdAt,
      kind: 'offer', // Explicitly mark as offer
    }));

    return res.status(200).json({
      success: true,
      rideOffers: formattedOffers,
      count: formattedOffers.length,
    });
  } catch (error) {
    console.error('❌ Error fetching ride offers:', error);
    next(error);
  }
};

/**
 * Get a single ride offer by ID
 * GET /api/ride-offers/:id
 */
export const getRideOfferById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({
        error: 'Ride offer not found',
        code: 'OFFER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      rideOffer: {
        ...rideOffer.toObject(),
        id: rideOffer._id.toString(),
        kind: 'offer',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching ride offer:', error);
    next(error);
  }
};

/**
 * Extend ride offer departure time
 * POST /api/ride-offers/:id/extend-time
 */
export const extendRideOfferTime = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { additionalMinutes } = req.body;

    if (!additionalMinutes || additionalMinutes < 1) {
      return res.status(400).json({
        error: 'Invalid extension',
        details: 'additionalMinutes must be at least 1',
      });
    }

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({ error: 'Ride offer not found' });
    }

    // Calculate new departure time
    const currentDeparture = new Date(rideOffer.departureTime);
    const newDeparture = new Date(
      currentDeparture.getTime() + additionalMinutes * 60000,
    );

    rideOffer.departureTime = newDeparture;
    await rideOffer.save();

    // Broadcast update
    if (io) {
      io.emit('rideOfferTimeExtended', {
        offerId: id,
        newDepartureTime: newDeparture,
        additionalMinutes,
      });
    }

    return res.status(200).json({
      success: true,
      rideOffer,
      message: `Ride offer time extended by ${additionalMinutes} minutes`,
    });
  } catch (error) {
    console.error('❌ Error extending ride offer time:', error);
    next(error);
  }
};

/**
 * Book a ride offer
 * POST /api/ride-offers/:id/book
 */
export const bookRideOffer = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    if (!clerkId) clerkId = req.body.clerkId;

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
      });
    }

    const { id } = req.params;
    const { seatNumbers, paymentMethod = 'unknown', customRequest } = req.body;

    if (
      !seatNumbers ||
      !Array.isArray(seatNumbers) ||
      seatNumbers.length === 0
    ) {
      return res.status(400).json({
        error: 'Invalid booking',
        details: 'seatNumbers array is required',
      });
    }

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({ error: 'Ride offer not found' });
    }

    // Check if seats are available
    const unavailableSeats = seatNumbers.filter(
      (seat) => !rideOffer.availableSeats.includes(seat),
    );

    if (unavailableSeats.length > 0) {
      return res.status(400).json({
        error: 'Seats not available',
        details: `Seats ${unavailableSeats.join(', ')} are already booked`,
      });
    }

    // Get passenger profile
    const passenger = await UserProfile.findOne({ clerkId });
    if (!passenger) {
      return res.status(404).json({ error: 'Passenger profile not found' });
    }

    // Calculate total amount
    const totalAmount = seatNumbers.length * rideOffer.farePerSeat;

    // Create booking
    const booking = {
      passengerId: passenger._id,
      passengerClerkId: clerkId,
      passengerName:
        `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() ||
        passenger.email,
      passengerPhone: passenger.phone || '',
      seatNumbers,
      totalAmount,
      paymentMethod,
      customRequest,
      status: 'confirmed',
      bookedAt: new Date(),
    };

    // Update available seats
    rideOffer.availableSeats = rideOffer.availableSeats.filter(
      (seat) => !seatNumbers.includes(seat),
    );

    // Add booking
    rideOffer.bookings.push(booking);

    // Update status if fully booked
    if (rideOffer.availableSeats.length === 0) {
      rideOffer.status = 'booked';
    }

    await rideOffer.save();

    // Broadcast update
    if (io) {
      io.emit('rideOfferBooked', {
        offerId: id,
        booking,
        availableSeats: rideOffer.availableSeats,
        status: rideOffer.status,
      });
    }

    return res.status(200).json({
      success: true,
      rideOffer,
      booking,
      message: 'Ride offer booked successfully',
    });
  } catch (error) {
    console.error('❌ Error booking ride offer:', error);
    next(error);
  }
};

/**
 * Cancel a ride offer
 * POST /api/ride-offers/:id/cancel
 */
export const cancelRideOffer = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    if (!clerkId) clerkId = req.body.clerkId;

    const { id } = req.params;

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({ error: 'Ride offer not found' });
    }

    // Only the creator can cancel
    if (rideOffer.clerkId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        details: 'Only the ride creator can cancel',
      });
    }

    rideOffer.status = 'cancelled';
    await rideOffer.save();

    // Broadcast cancellation
    if (io) {
      io.emit('rideOfferCancelled', { offerId: id });
    }

    return res.status(200).json({
      success: true,
      message: 'Ride offer cancelled successfully',
    });
  } catch (error) {
    console.error('❌ Error cancelling ride offer:', error);
    next(error);
  }
};

/**
 * Cleanup expired ride offers
 * POST /api/ride-offers/cleanup-expired
 */
export const cleanupExpiredRideOffers = async (req, res, next) => {
  try {
    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes

    const result = await RideOffer.updateMany(
      {
        departureTime: { $lt: new Date(now - expirationBuffer) },
        status: { $in: ['waiting', 'accepted'] },
      },
      {
        $set: { status: 'cancelled' },
      },
    );

    console.log(`🧹 Cleaned up ${result.modifiedCount} expired ride offers`);

    return res.status(200).json({
      success: true,
      expiredCount: result.modifiedCount,
      message: 'Expired ride offers cleaned up',
    });
  } catch (error) {
    console.error('❌ Error cleaning up expired ride offers:', error);
    next(error);
  }
};

/**
 * Get my ride offers (as a driver)
 * GET /api/ride-offers/my-offers
 */
export const getMyRideOffers = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    if (!clerkId) clerkId = req.query.clerkId;

    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rideOffers = await RideOffer.find({ clerkId })
      .sort({ createdAt: -1 })
      .limit(50);

    const formattedOffers = rideOffers.map((offer) => ({
      ...offer.toObject(),
      id: offer._id.toString(),
      kind: 'offer',
    }));

    return res.status(200).json({
      success: true,
      rideOffers: formattedOffers,
      count: formattedOffers.length,
    });
  } catch (error) {
    console.error('❌ Error fetching my ride offers:', error);
    next(error);
  }
};

/**
 * Check for expiring rides and send notifications
 * POST /api/ride-offers/check-expiring
 */
export const checkExpiringRides = async (req, res, next) => {
  try {
    const now = new Date();
    const warningThreshold = 10 * 60 * 1000; // 10 minutes before expiry
    const expiryThreshold = 5 * 60 * 1000; // 5 minutes after departure

    // Find rides departing in the next 10-15 minutes (warning window)
    const upcomingExpiryTime = new Date(now.getTime() + warningThreshold);
    const expiringRides = await RideOffer.find({
      status: 'waiting',
      departureTime: {
        $gte: now,
        $lte: upcomingExpiryTime,
      },
    });

    console.log(`🔍 Found ${expiringRides.length} rides expiring soon`);

    const notifications = [];

    for (const ride of expiringRides) {
      try {
        // Get user profile to fetch push token
        const user = await UserProfile.findOne({ clerkId: ride.clerkId });

        if (!user || !user.pushToken) {
          console.log(`⚠️ No push token for user ${ride.clerkId}`);
          continue;
        }

        // Check if token is valid
        if (!Expo.isExpoPushToken(user.pushToken)) {
          console.log(`❌ Invalid push token for user ${ride.clerkId}`);
          continue;
        }

        // Calculate minutes until departure
        const minutesUntilDeparture = Math.floor(
          (new Date(ride.departureTime).getTime() - now.getTime()) / 60000,
        );

        // Create notification message
        const message = {
          to: user.pushToken,
          sound: 'default',
          title: '⏰ Ride Departing Soon!',
          body: `Your ride from ${ride.from} to ${ride.to} departs in ${minutesUntilDeparture} minutes. Extend time if needed.`,
          data: {
            type: 'ride_expiring',
            rideId: ride._id.toString(),
            offerId: ride._id.toString(),
            kind: 'offer',
            from: ride.from,
            to: ride.to,
            departureTime: ride.departureTime.toISOString(),
            minutesUntilDeparture,
            // Deep link for navigation
            screen: 'ExtendTime',
          },
          priority: 'high',
          channelId: 'ride-alerts',
        };

        notifications.push(message);
      } catch (error) {
        console.error(`❌ Error processing ride ${ride._id}:`, error);
      }
    }

    if (notifications.length > 0) {
      // Send notifications in chunks
      const chunks = expo.chunkPushNotifications(notifications);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          console.log(`📤 Sent ${ticketChunk.length} expiry notifications`);
        } catch (error) {
          console.error('❌ Error sending notification chunk:', error);
        }
      }

      console.log(`✅ Sent ${tickets.length} expiry notifications total`);

      return res.status(200).json({
        success: true,
        ridesChecked: expiringRides.length,
        notificationsSent: tickets.length,
        tickets,
      });
    } else {
      return res.status(200).json({
        success: true,
        ridesChecked: expiringRides.length,
        notificationsSent: 0,
        message: 'No notifications to send',
      });
    }
  } catch (error) {
    console.error('❌ Error checking expiring rides:', error);
    next(error);
  }
};
