import { RideOffer, RideBooking, UserProfile } from '../config/models.js';
import { Expo } from 'expo-server-sdk';

// Socket.io instance will be injected
let io = null;

// Expo notification client
const expo = new Expo();

export function setSocketIO(socketInstance) {
  io = socketInstance;
}

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
 * Send push notification to user
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !expo.isExpoPushToken(pushToken)) {
    console.log('⚠️ Invalid push token:', pushToken);
    return null;
  }

  try {
    const response = await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        badge: 1,
        priority: 'high',
      },
    ]);

    console.log('✅ Push notification sent:', response);
    return response[0];
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return null;
  }
};

/**
 * Driver initiates pickup for a specific passenger/booking
 * POST /api/ride-offers/:rideId/pickup/initiate
 */
export const driverInitiatePickup = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { bookingId, passengerClerkId } = req.body;
    const clerkId = getClerkUserId(req);

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Get ride offer
    const ride = await RideOffer.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Verify driver ownership
    const isDriver = ride.driverId === clerkId || ride.clerkId === clerkId;
    if (!isDriver) {
      return res.status(403).json({
        error: 'Forbidden - not the ride driver',
        code: 'NOT_DRIVER',
      });
    }

    // Get booking
    const booking = await RideBooking.findById(bookingId);
    if (!booking || booking.rideId.toString() !== rideId) {
      return res.status(404).json({
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    // Check if booking is confirmed
    if (booking.approvalStatus !== 'confirmed') {
      return res.status(400).json({
        error: 'Booking not confirmed',
        code: 'BOOKING_NOT_CONFIRMED',
      });
    }

    // Initialize pickupStatus if not exists
    if (!ride.pickupStatus) {
      ride.pickupStatus = {
        driverConfirmedAt: null,
        confirmedPassengers: [],
      };
    }

    // Mark driver as ready for this pickup
    if (!ride.pickupStatus.driverConfirmedAt) {
      ride.pickupStatus.driverConfirmedAt = new Date();
    }

    // Update ride status to ongoing if not already
    if (ride.status === 'waiting') {
      ride.status = 'ongoing';
    }

    // Ensure driverId is populated (for backward compatibility with old rides)
    if (!ride.driverId && ride.clerkId) {
      ride.driverId = ride.clerkId;
    }

    // Sanitize festivalConfig.tier (for backward compatibility)
    if (ride.festivalConfig && ride.festivalConfig.tier === '') {
      ride.festivalConfig.tier = null;
    }

    await ride.save();

    // Get passenger for notification
    const passenger = await UserProfile.findOne({ clerkId: passengerClerkId });

    // Send socket event to passenger
    if (io) {
      io.emit(`passenger:pickup-initiated:${passengerClerkId}`, {
        rideId: ride._id,
        bookingId: booking._id,
        driverName: booking.userDetails?.name || 'Driver',
        message: 'Driver is ready for pickup. Please confirm when you board.',
      });
    }

    // Send push notification to passenger
    if (passenger?.pushToken) {
      await sendPushNotification(
        passenger.pushToken,
        '🚗 Ready for Pickup',
        'Your driver is ready. Please confirm once you board the vehicle.',
        {
          type: 'pickup_initiated',
          rideId: ride._id.toString(),
          bookingId: booking._id.toString(),
        },
      );
    }

    console.log(
      `✅ [PICKUP] Driver initiated pickup for passenger ${passengerClerkId}`,
    );

    res.status(200).json({
      success: true,
      message: 'Pickup initiated, waiting for passenger confirmation',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
    });
  } catch (error) {
    console.error('❌ Error initiating pickup:', error);
    next(error);
  }
};

/**
 * Passenger confirms they have boarded
 * POST /api/ride-offers/:rideId/pickup/confirm
 */
export const passengerConfirmPickup = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { bookingId } = req.body;
    const clerkId = getClerkUserId(req);

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Get ride offer
    const ride = await RideOffer.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Get booking
    const booking = await RideBooking.findById(bookingId);
    if (!booking || booking.rideId.toString() !== rideId) {
      return res.status(404).json({
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    // Verify passenger ownership
    if (booking.passengerId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden - not the booking passenger',
        code: 'NOT_PASSENGER',
      });
    }

    // Initialize pickupStatus if not exists
    if (!ride.pickupStatus) {
      ride.pickupStatus = {
        driverConfirmedAt: null,
        confirmedPassengers: [],
      };
    }

    // Add passenger to confirmed list if not already there
    if (!ride.pickupStatus.confirmedPassengers.includes(clerkId)) {
      ride.pickupStatus.confirmedPassengers.push(clerkId);
    }

    // Ensure driverId is populated (for backward compatibility with old rides)
    if (!ride.driverId && ride.clerkId) {
      ride.driverId = ride.clerkId;
    }

    // Sanitize festivalConfig.tier (for backward compatibility)
    if (ride.festivalConfig && ride.festivalConfig.tier === '') {
      ride.festivalConfig.tier = null;
    }

    await ride.save();

    // Get driver for notification
    const driver = await UserProfile.findOne({ clerkId: ride.driverId });

    // Send socket event to driver
    if (io) {
      io.emit(`driver:pickup-confirmed:${ride.driverId}`, {
        rideId: ride._id,
        bookingId: booking._id,
        passengerClerkId: clerkId,
        passengerName: booking.userDetails?.name || 'Passenger',
        message: `${booking.userDetails?.name || 'Passenger'} has confirmed boarding.`,
        confirmedCount: ride.pickupStatus.confirmedPassengers.length,
        totalBookings: ride.bookings.filter((b) => b.status === 'confirmed')
          .length,
      });
    }

    // Send push notification to driver
    if (driver?.pushToken) {
      await sendPushNotification(
        driver.pushToken,
        '✅ Passenger Boarded',
        `${booking.userDetails?.name || 'Passenger'} has confirmed boarding. ${ride.pickupStatus.confirmedPassengers.length}/${ride.bookings.filter((b) => b.status === 'confirmed').length} passengers confirmed.`,
        {
          type: 'pickup_confirmed',
          rideId: ride._id.toString(),
          bookingId: booking._id.toString(),
        },
      );
    }

    console.log(
      `✅ [PICKUP] Passenger ${clerkId} confirmed boarding for ride ${rideId}`,
    );

    res.status(200).json({
      success: true,
      message: 'Pickup confirmed',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
    });
  } catch (error) {
    console.error('❌ Error confirming pickup:', error);
    next(error);
  }
};
