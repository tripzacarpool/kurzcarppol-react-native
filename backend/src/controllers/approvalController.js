import mongoose from 'mongoose';
import { UserProfile, RideOffer, RideBooking } from '../config/models.js';
import { Expo } from 'expo-server-sdk';

// Socket.io instance will be injected
let io = null;

// Expo notification client
const expo = new Expo();

export function setApprovalSocketIO(socketInstance) {
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

    console.log('✅ Push notification sent:', title);
    return response;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return null;
  }
};

/**
 * Create a booking with automatic approval info
 * POST /api/rides/:rideId/book
 * Called by passenger when trying to book a ride
 */
export const createBooking = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const clerkId = getClerkUserId(req);

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    const { seatNumbers = [], customRequest = '' } = req.body;

    if (!seatNumbers || seatNumbers.length === 0) {
      return res.status(400).json({
        error: 'Invalid booking',
        details: 'seatNumbers is required',
        code: 'MISSING_SEATS',
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

    // Get passenger profile
    const passenger = await UserProfile.findOne({ clerkId });
    if (!passenger) {
      return res.status(404).json({
        error: 'Passenger profile not found',
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    // Get driver profile
    const driver = await UserProfile.findOne({ clerkId: ride.driverId });
    if (!driver) {
      return res.status(404).json({
        error: 'Driver not found',
        code: 'DRIVER_NOT_FOUND',
      });
    }

    // Check if seats are available and not locked by others
    const lockedSeats = ride.seatLocks || [];
    const availableSeats = seatNumbers.filter((seatNum) => {
      const lock = lockedSeats.find((l) => l.seatNumber === seatNum);
      if (!lock) return true;
      // Check if lock is expired
      if (new Date() > new Date(lock.expiresAt)) {
        return true;
      }
      return false;
    });

    if (availableSeats.length !== seatNumbers.length) {
      return res.status(409).json({
        error: 'Some seats are unavailable',
        code: 'SEATS_UNAVAILABLE',
        availableSeats: availableSeats,
      });
    }

    // Determine approval mode based on driver settings and passenger reputation
    const approvalMode = determineApprovalMode(
      ride.approvalMode || 'auto',
      ride.requiresManualApproval || false,
      passenger.rating || 5,
      passenger.totalTrips || 0,
    );

    const approvalStatus =
      approvalMode === 'manual' ? 'pending_approval' : 'auto_accepted';

    // Create booking
    const booking = new RideBooking({
      rideId: ride._id,
      passengerId: clerkId,
      driverId: ride.driverId,
      seatNumbers,
      customRequest,
      approvalStatus,
      approvalRequestedAt: new Date(),
      userDetails: {
        name: `${passenger.firstName} ${passenger.lastName}`,
        phone: passenger.phone,
        rating: passenger.rating,
        avatar: passenger.profileImage,
      },
      from: ride.from,
      to: ride.to,
      fare: (ride.farePerSeat || 0) * seatNumbers.length,
      departureTime: ride.departureTime,
    });

    await booking.save();

    // Lock seats temporarily
    const lockExpiry = new Date(
      Date.now() + (approvalMode === 'manual' ? 2 : 5) * 60 * 1000,
    );
    const seatLocks = seatNumbers.map((seatNum) => ({
      seatNumber: seatNum,
      status: 'locked',
      userId: clerkId,
      bookingId: booking._id,
      lockedAt: new Date(),
      expiresAt: lockExpiry,
    }));

    ride.seatLocks = [...(ride.seatLocks || []), ...seatLocks];
    await ride.save();

    // Auto-approve if needed
    if (approvalMode === 'auto') {
      booking.approvalStatus = 'auto_accepted';
      booking.approvedAt = new Date();
      booking.approvedBy = 'system';
      await booking.save();

      console.log('✅ Booking auto-approved:', booking._id);

      return res.status(201).json({
        success: true,
        message: 'Booking auto-confirmed',
        booking: booking.toObject(),
      });
    }

    console.log(`🎯 [APPROVAL] Approval mode: ${approvalMode}`);
    console.log(`📡 [SOCKET] Socket.io instance available: ${!!io}`);

    // MANUAL APPROVAL: Send socket event and notification to driver
    if (io && approvalMode === 'manual') {
      // Use driverId if available, fallback to clerkId for older rides
      const targetDriverId = ride.driverId || ride.clerkId;
      const eventName = `driver:booking-approval-request:${targetDriverId}`;

      console.log(
        `🔔 [APPROVAL] Sending approval request to driver ${targetDriverId}`,
      );
      console.log(`📡 [SOCKET] Emitting event: ${eventName}`);
      console.log(
        `👤 [SOCKET] Passenger: ${passenger.firstName} ${passenger.lastName}`,
      );
      console.log(`🎫 [SOCKET] Booking ID: ${booking._id}`);
      console.log(`🚗 [SOCKET] Ride ID: ${ride._id}`);
      console.log(`💺 [SOCKET] Seats: ${seatNumbers.join(', ')}`);

      // Socket event
      io.emit(eventName, {
        driverId: targetDriverId,
        booking: booking.toObject(),
        passenger: {
          name: passenger.firstName + ' ' + passenger.lastName,
          rating: passenger.rating,
          totalTrips: passenger.totalTrips,
          phone: passenger.phone,
        },
        rideId: ride._id,
        seats: seatNumbers,
      });

      console.log(`✅ [SOCKET] Event emitted successfully`);

      // Push notification to driver
      if (driver.pushToken) {
        await sendPushNotification(
          driver.pushToken,
          '👤 New Booking Request',
          `${passenger.firstName} wants to book ${seatNumbers.length} seat(s) for ${ride.from} → ${ride.to}`,
          {
            type: 'booking_approval_request',
            bookingId: booking._id.toString(),
            rideId: ride._id.toString(),
          },
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Booking created - awaiting approval',
      booking: booking.toObject(),
    });
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    next(error);
  }
};

/**
 * Get pending approval requests for a driver
 * GET /api/rides/:rideId/pending-approvals
 */
export const getPendingApprovals = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const clerkId = getClerkUserId(req);

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Get ride and verify ownership
    const ride = await RideOffer.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Check if user is the driver (support both driverId and clerkId for backwards compatibility)
    const isDriver = ride.driverId === clerkId || ride.clerkId === clerkId;

    console.log('🔍 [APPROVAL] Checking driver ownership:', {
      rideId,
      rideDriverId: ride.driverId,
      rideClerkId: ride.clerkId,
      userClerkId: clerkId,
      isDriver,
    });

    if (!isDriver) {
      return res.status(403).json({
        error: 'Forbidden - not the ride driver',
        code: 'NOT_DRIVER',
      });
    }

    // Get pending bookings (within last 30 minutes for testing, 5 mins in production)
    const timeWindow = process.env.NODE_ENV === 'production' ? 5 : 30;
    const pendingBookings = await RideBooking.find({
      rideId,
      approvalStatus: 'pending_approval',
      approvalRequestedAt: {
        $gt: new Date(Date.now() - timeWindow * 60 * 1000),
      },
    });

    console.log(
      `✅ [APPROVAL] Found ${pendingBookings.length} pending bookings for ride ${rideId}`,
    );

    res.status(200).json({
      success: true,
      pendingBookings: pendingBookings.map((b) => b.toObject()),
      count: pendingBookings.length,
    });
  } catch (error) {
    console.error('❌ Error getting pending approvals:', error);
    next(error);
  }
};

/**
 * Get ALL pending approvals for a driver across all their rides
 * GET /api/approvals/driver/pending
 * This batches all pending approvals into a single query, replacing N individual calls
 */
export const getAllDriverPendingApprovals = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req);

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Find all rides for this driver
    const driverRides = await RideOffer.find({
      $or: [{ driverId: clerkId }, { clerkId: clerkId }],
    }).select('_id');

    const rideIds = driverRides.map((ride) => ride._id);

    console.log(
      `🔍 [APPROVAL] Fetching pending approvals for driver ${clerkId}, ${rideIds.length} rides`,
    );

    if (rideIds.length === 0) {
      return res.status(200).json({
        success: true,
        pendingBookings: [],
        count: 0,
      });
    }

    // Get pending bookings for all rides (within last 30 minutes for testing, 5 mins in production)
    const timeWindow = process.env.NODE_ENV === 'production' ? 5 : 30;
    const pendingBookings = await RideBooking.find({
      rideId: { $in: rideIds },
      approvalStatus: 'pending_approval',
      approvalRequestedAt: {
        $gt: new Date(Date.now() - timeWindow * 60 * 1000),
      },
    });

    console.log(
      `✅ [APPROVAL] Found ${pendingBookings.length} pending bookings across ${rideIds.length} rides`,
    );

    res.status(200).json({
      success: true,
      pendingBookings: pendingBookings.map((b) => b.toObject()),
      count: pendingBookings.length,
    });
  } catch (error) {
    console.error('❌ Error getting driver pending approvals:', error);
    next(error);
  }
};

/**
 * Approve a booking
 * POST /api/bookings/:bookingId/approve
 */
export const approveBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const clerkId = getClerkUserId(req);
    const { notes = '' } = req.body;

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Get booking
    const booking = await RideBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    // Get ride to verify driver ownership
    const ride = await RideOffer.findById(booking.rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Verify driver ownership (support both driverId and clerkId for backwards compatibility)
    const isDriver = ride.driverId === clerkId || ride.clerkId === clerkId;
    if (!isDriver) {
      return res.status(403).json({
        error: 'Forbidden - not the booking driver',
        code: 'NOT_DRIVER',
      });
    }

    // Update booking to confirmed status
    booking.approvalStatus = 'confirmed';
    booking.approvedAt = new Date();
    booking.approvedBy = clerkId;
    if (notes) {
      booking.approvalNotes = notes;
    }

    await booking.save();

    console.log(
      `✅ [APPROVAL] Booking approved and confirmed by driver: ${bookingId}`,
    );
    console.log(`💳 [PAYMENT] Payment will be collected after ride completion`);

    // Add passenger to ride bookings array (ride already fetched above)
    ride.bookings.push({
      _id: booking._id,
      userId: booking.passengerId,
      passengerClerkId: booking.passengerId,
      passengerName: booking.userDetails.name,
      passengerPhone: booking.userDetails.phone,
      userName: booking.userDetails.name,
      seatNumber: booking.seatNumbers,
      seatNumbers: booking.seatNumbers,
      pickupPoint: booking.from,
      dropPoint: booking.to,
      status: 'confirmed',
      fare: booking.fare,
      totalAmount: booking.fare,
      paymentStatus: 'pending',
      bookedAt: new Date(),
    });

    // Update available seats - remove booked seat numbers from the array
    ride.availableSeats = ride.availableSeats.filter(
      (seatNum) => !booking.seatNumbers.includes(seatNum),
    );

    // Remove seat locks as booking is now confirmed
    if (ride.seatLocks) {
      ride.seatLocks = ride.seatLocks.filter(
        (lock) => !booking.seatNumbers.includes(lock.seatNumber),
      );
    }

    await ride.save();

    // Get passenger for notification
    const passenger = await UserProfile.findOne({
      clerkId: booking.passengerId,
    });

    // Send socket event to passenger - booking confirmed
    if (io) {
      io.emit(`passenger:booking-approved:${booking.passengerId}`, {
        bookingId: booking._id,
        rideId: booking.rideId,
        message: 'Your booking is confirmed! Get ready for pickup.',
        requiresPayment: false,
        fare: booking.fare,
      });
    }

    // Send push notification to passenger
    if (passenger?.pushToken) {
      await sendPushNotification(
        passenger.pushToken,
        '✅ Booking Confirmed',
        `Driver accepted! Get ready for pickup. ${booking.from} → ${booking.to}. Payment after ride.`,
        {
          type: 'booking_confirmed',
          bookingId: booking._id.toString(),
          rideId: booking.rideId.toString(),
          fare: booking.fare,
        },
      );
    }

    console.log(
      `✅ Booking confirmed - passenger added to ride ${booking.rideId}`,
    );

    res.status(200).json({
      success: true,
      message: 'Booking confirmed - payment after ride completion',
      booking: booking.toObject(),
      requiresPayment: false,
    });
  } catch (error) {
    console.error('❌ Error approving booking:', error);
    next(error);
  }
};

/**
 * Reject a booking
 * POST /api/bookings/:bookingId/reject
 */
export const rejectBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const clerkId = getClerkUserId(req);
    const { rejectionReason = 'Driver cancelled booking' } = req.body;

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Get booking
    const booking = await RideBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    // Get ride to verify driver ownership
    const ride = await RideOffer.findById(booking.rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Verify driver ownership (support both driverId and clerkId for backwards compatibility)
    const isDriver = ride.driverId === clerkId || ride.clerkId === clerkId;
    if (!isDriver) {
      return res.status(403).json({
        error: 'Forbidden - not the booking driver',
        code: 'NOT_DRIVER',
      });
    }

    // Update booking
    booking.approvalStatus = 'rejected';
    booking.rejectedAt = new Date();
    booking.rejectionReason = rejectionReason;

    await booking.save();

    // Release seat locks (ride already fetched above)
    ride.seatLocks = (ride.seatLocks || []).filter(
      (lock) => !booking.seatNumbers.includes(lock.seatNumber),
    );
    await ride.save();

    // Get passenger for notification
    const passenger = await UserProfile.findOne({
      clerkId: booking.passengerId,
    });

    // Send socket event to passenger
    if (io) {
      io.emit(`passenger:booking-rejected:${booking.passengerId}`, {
        bookingId: booking._id,
        rideId: booking.rideId,
        reason: rejectionReason,
      });
    }

    // Send push notification to passenger
    if (passenger?.pushToken) {
      await sendPushNotification(
        passenger.pushToken,
        '❌ Booking Rejected',
        `Driver declined your booking. Reason: ${rejectionReason}`,
        {
          type: 'booking_rejected',
          bookingId: booking._id.toString(),
          rideId: booking.rideId.toString(),
        },
      );
    }

    console.log(`❌ Booking rejected: ${bookingId}`);

    res.status(200).json({
      success: true,
      message: 'Booking rejected',
      booking: booking.toObject(),
    });
  } catch (error) {
    console.error('❌ Error rejecting booking:', error);
    next(error);
  }
};

/**
 * Get booking approval status
 * GET /api/bookings/:bookingId/approval-status
 */
export const getBookingApprovalStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await RideBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found',
        code: 'BOOKING_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      booking: booking.toObject(),
    });
  } catch (error) {
    console.error('❌ Error getting approval status:', error);
    next(error);
  }
};

/**
 * Update ride approval settings
 * PUT /api/rides/:rideId/approval-settings
 */
export const updateRideApprovalSettings = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const clerkId = getClerkUserId(req);
    const { requiresManualApproval, autoApproveThreshold } = req.body;

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Get ride
    const ride = await RideOffer.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Verify driver ownership (support both driverId and clerkId)
    const isDriver = ride.driverId === clerkId || ride.clerkId === clerkId;
    if (!isDriver) {
      return res.status(403).json({
        error: 'Forbidden - not the ride driver',
        code: 'NOT_DRIVER',
      });
    }

    // Cannot disable auto-confirm for festival rides
    if (ride.isFestivalRide && requiresManualApproval) {
      return res.status(400).json({
        error: 'Invalid approval mode',
        message: 'Festival rides must auto-confirm',
        code: 'FESTIVAL_FORCED_AUTO',
      });
    }

    // Update approval settings
    ride.approvalMode = requiresManualApproval ? 'manual' : 'auto';
    ride.requiresManualApproval = requiresManualApproval || false;

    if (autoApproveThreshold) {
      ride.approvalSettings = {
        autoApproveThreshold,
      };
    }

    await ride.save();

    console.log(`✅ Approval settings updated for ride: ${rideId}`);

    res.status(200).json({
      success: true,
      message: 'Approval settings updated',
      ride: ride.toObject(),
    });
  } catch (error) {
    console.error('❌ Error updating approval settings:', error);
    next(error);
  }
};

/**
 * Handle expired approvals (auto-reject)
 * POST /api/approvals/handle-expired
 */
export const handleExpiredApprovals = async (req, res, next) => {
  try {
    const { rideId } = req.body;

    // Get pending bookings older than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const query = {
      approvalStatus: 'pending_approval',
      approvalRequestedAt: { $lt: fiveMinutesAgo },
    };

    if (rideId) {
      query.rideId = rideId;
    }

    const expiredBookings = await RideBooking.find(query);

    const results = [];

    for (const booking of expiredBookings) {
      // Update booking
      booking.approvalStatus = 'expired';
      booking.rejectionReason = 'Driver did not approve within 5 minutes';
      await booking.save();

      // Release seat locks
      const ride = await RideOffer.findById(booking.rideId);
      if (ride) {
        ride.seatLocks = (ride.seatLocks || []).filter(
          (lock) => !booking.seatNumbers.includes(lock.seatNumber),
        );
        await ride.save();
      }

      // Notify passenger
      const passenger = await UserProfile.findOne({
        clerkId: booking.passengerId,
      });
      if (passenger?.pushToken) {
        await sendPushNotification(
          passenger.pushToken,
          '⏱️ Booking Request Expired',
          'Driver did not respond in time. Try another ride.',
          {
            type: 'booking_expired',
            bookingId: booking._id.toString(),
          },
        );
      }

      results.push({
        bookingId: booking._id,
        status: 'auto-rejected',
      });
    }

    console.log(`✅ Handled ${expiredBookings.length} expired approvals`);

    res.status(200).json({
      success: true,
      expiredCount: expiredBookings.length,
      results,
    });
  } catch (error) {
    console.error('❌ Error handling expired approvals:', error);
    next(error);
  }
};

/**
 * Get approval analytics for driver
 * GET /api/drivers/:driverId/approval-analytics
 */
export const getApprovalAnalytics = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const clerkId = getClerkUserId(req);

    if (driverId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_AUTHORIZED',
      });
    }

    // Get all bookings for this driver
    const bookings = await RideBooking.find({ driverId });

    // Calculate analytics
    const analytics = {
      total: bookings.length,
      auto_confirmed: bookings.filter(
        (b) => b.approvalStatus === 'auto_accepted',
      ).length,
      approved: bookings.filter((b) => b.approvalStatus === 'approved').length,
      rejected: bookings.filter((b) => b.approvalStatus === 'rejected').length,
      expired: bookings.filter((b) => b.approvalStatus === 'expired').length,
      cancelled: bookings.filter((b) => b.approvalStatus === 'cancelled')
        .length,
      pending: bookings.filter((b) => b.approvalStatus === 'pending_approval')
        .length,
    };

    // Calculate rates if there are manual approvals
    if (analytics.approved + analytics.rejected > 0) {
      analytics.approval_rate =
        (
          (analytics.approved / (analytics.approved + analytics.rejected)) *
          100
        ).toFixed(2) + '%';
      analytics.rejection_rate =
        (
          (analytics.rejected / (analytics.approved + analytics.rejected)) *
          100
        ).toFixed(2) + '%';
    }

    res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('❌ Error getting approval analytics:', error);
    next(error);
  }
};

/**
 * Confirm payment after driver approval
 * POST /api/bookings/:bookingId/confirm-payment
 */
export const confirmBookingPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const clerkId = getClerkUserId(req);
    const {
      paymentId,
      paymentMethod = 'razorpay',
      paymentStatus = 'paid',
    } = req.body;

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH',
      });
    }

    // Get booking
    const booking = await RideBooking.findById(bookingId);
    if (!booking) {
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

    // Check booking is already confirmed (after driver approval)
    if (booking.approvalStatus !== 'confirmed') {
      return res.status(400).json({
        error: 'Booking is not in confirmed state',
        code: 'INVALID_STATUS',
        currentStatus: booking.approvalStatus,
      });
    }

    // Check if payment already completed
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        error: 'Payment already completed',
        code: 'ALREADY_PAID',
      });
    }

    // Update booking with payment info
    booking.paymentId = paymentId;
    booking.paymentMethod = paymentMethod;
    booking.paymentStatus = paymentStatus;
    booking.paymentCompletedAt = new Date();

    await booking.save();

    // Get the ride
    const ride = await RideOffer.findById(booking.rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Update payment status in ride bookings array
    const rideBooking = ride.bookings.find(
      (b) =>
        b.userId === booking.passengerId &&
        b.seatNumber.some((seat) => booking.seatNumbers.includes(seat)),
    );
    if (rideBooking) {
      rideBooking.paymentStatus = 'paid';
      await ride.save();
    }

    console.log(`✅ [PAYMENT] Payment confirmed for booking ${bookingId}`);
    console.log(`💰 [PAYMENT] Payment ID: ${paymentId}`);
    console.log(
      `💳 [PAYMENT] Payment status updated in ride ${booking.rideId}`,
    );

    // Get driver profile
    const driver = await UserProfile.findOne({ clerkId: booking.driverId });

    // Notify driver via socket
    if (io) {
      io.emit(`driver:payment-received:${booking.driverId}`, {
        bookingId: booking._id,
        rideId: booking.rideId,
        passengerName: booking.userDetails.name,
        fare: booking.fare,
        seats: booking.seatNumbers,
      });
    }

    // Send push notification to driver
    if (driver?.pushToken) {
      await sendPushNotification(
        driver.pushToken,
        '💰 Payment Received',
        `${booking.userDetails.name} completed payment of ₹${booking.fare}. Ride complete!`,
        {
          type: 'payment_received',
          bookingId: booking._id.toString(),
          rideId: booking.rideId.toString(),
        },
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment confirmed - ride complete',
      booking: booking.toObject(),
    });
  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    next(error);
  }
};

/**
 * Helper function: Determine approval mode
 * ALWAYS requires driver approval - no auto-approval
 */
function determineApprovalMode(
  approvalMode,
  requiresManualApproval,
  passengerRating,
  passengerTrips,
) {
  // All bookings require driver approval - they go into a queue
  // Driver can then approve or reject them
  return 'manual';
}

/**
 * Get passenger's ride offer bookings
 * Returns all bookings made by the passenger
 */
export const getPassengerBookings = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req);
    if (!clerkId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - No Clerk ID found',
      });
    }

    console.log(`📚 Fetching bookings for passenger: ${clerkId}`);

    // Get all bookings for this passenger
    const bookings = await RideBooking.find({
      passengerClerkId: clerkId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Populate ride offer details for each booking
    const bookingsWithRideDetails = await Promise.all(
      bookings.map(async (booking) => {
        try {
          const rideOffer = await RideOffer.findById(booking.rideId).lean();

          // Get driver info
          let driverInfo = null;
          if (rideOffer && rideOffer.clerkId) {
            driverInfo = await UserProfile.findOne({
              clerkId: rideOffer.clerkId,
            }).lean();
          }

          // Check if passenger has confirmed pickup
          const hasConfirmedPickup =
            rideOffer?.pickupStatus?.confirmedPassengers?.includes(clerkId) ||
            false;

          // Check if driver has initiated pickup for this passenger
          const driverInitiatedPickup =
            rideOffer?.pickupStatus?.driverConfirmedAt && !hasConfirmedPickup;

          return {
            ...booking,
            rideOffer: rideOffer
              ? {
                  _id: rideOffer._id,
                  from: rideOffer.from,
                  to: rideOffer.to,
                  departureTime: rideOffer.departureTime,
                  farePerSeat: rideOffer.farePerSeat,
                  status: rideOffer.status,
                  pickupStatus: rideOffer.pickupStatus,
                }
              : null,
            driver: driverInfo
              ? {
                  name: driverInfo.name || 'Driver',
                  phone: driverInfo.phone,
                  rating: driverInfo.driverRating,
                }
              : null,
            hasConfirmedPickup,
            driverInitiatedPickup,
          };
        } catch (err) {
          console.error(
            '❌ Error fetching ride details for booking:',
            booking._id,
            err,
          );
          return {
            ...booking,
            rideOffer: null,
            driver: null,
            hasConfirmedPickup: false,
            driverInitiatedPickup: false,
          };
        }
      }),
    );

    console.log(
      `✅ Found ${bookingsWithRideDetails.length} bookings for passenger ${clerkId}`,
    );

    res.status(200).json({
      success: true,
      bookings: bookingsWithRideDetails,
    });
  } catch (error) {
    console.error('❌ Error fetching passenger bookings:', error);
    next(error);
  }
};

export default {
  createBooking,
  getPendingApprovals,
  approveBooking,
  rejectBooking,
  confirmBookingPayment,
  getBookingApprovalStatus,
  updateRideApprovalSettings,
  handleExpiredApprovals,
  getApprovalAnalytics,
  getPassengerBookings,
  setApprovalSocketIO,
};
