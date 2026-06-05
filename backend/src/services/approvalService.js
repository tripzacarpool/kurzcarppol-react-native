import { RideBooking, RideOffer, UserProfile } from '../config/models.js';
import { env } from '../config/env.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { sendPushToToken } from './pushNotificationService.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';

const approvalTaskIntervals = new Set();

class ApprovalError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const assertClerkId = (clerkId) => {
  if (!clerkId) {
    throw new ApprovalError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH',
    });
  }
};

const isRideDriver = (ride, clerkId) =>
  ride?.driverId === clerkId || ride?.clerkId === clerkId;

const findBookingAndRide = async (bookingId) => {
  const booking = await RideBooking.findById(bookingId);
  if (!booking) {
    throw new ApprovalError('Booking not found', {
      status: 404,
      code: 'BOOKING_NOT_FOUND',
    });
  }

  const ride = await RideOffer.findById(booking.rideId);
  if (!ride) {
    throw new ApprovalError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  return { booking, ride };
};

const determineApprovalMode = (
  approvalMode,
  requiresManualApproval,
  passengerRating,
  passengerTrips,
) => {
  if (requiresManualApproval === true || approvalMode === 'manual') {
    return 'manual';
  }

  if (approvalMode === 'auto' || requiresManualApproval === false) {
    return 'auto';
  }

  return 'manual';
};

export async function createBookingRequest({
  rideId,
  passengerClerkId,
  seatNumbers = [],
  customRequest = '',
}) {
  assertClerkId(passengerClerkId);

  if (!seatNumbers || seatNumbers.length === 0) {
    throw new ApprovalError('Invalid booking', {
      code: 'MISSING_SEATS',
      details: 'seatNumbers is required',
    });
  }

  const ride = await RideOffer.findById(rideId);
  if (!ride) {
    throw new ApprovalError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  if (!ride.driverId && ride.clerkId) {
    ride.driverId = ride.clerkId;
    await ride.save();
  }

  const passenger = await UserProfile.findOne({ clerkId: passengerClerkId });
  if (!passenger) {
    throw new ApprovalError('Passenger profile not found', {
      status: 404,
      code: 'PASSENGER_NOT_FOUND',
    });
  }

  const targetDriverId = ride.driverId || ride.clerkId;
  const driver = await UserProfile.findOne({ clerkId: targetDriverId });
  if (!driver) {
    throw new ApprovalError('Driver not found', {
      status: 404,
      code: 'DRIVER_NOT_FOUND',
      details: `No driver profile found for clerkId: ${targetDriverId}`,
    });
  }

  const lockedSeats = ride.seatLocks || [];
  const availableRequestedSeats = seatNumbers.filter((seatNum) => {
    const lock = lockedSeats.find((entry) => entry.seatNumber === seatNum);
    if (!lock) return true;
    return new Date() > new Date(lock.expiresAt);
  });

  if (availableRequestedSeats.length !== seatNumbers.length) {
    throw new ApprovalError('Some seats are unavailable', {
      status: 409,
      code: 'SEATS_UNAVAILABLE',
      details: availableRequestedSeats,
    });
  }

  const approvalMode = determineApprovalMode(
    ride.approvalMode || 'auto',
    ride.requiresManualApproval || false,
    passenger.rating || 5,
    passenger.totalTrips || 0,
  );

  const approvalStatus =
    approvalMode === 'manual' ? 'pending_approval' : 'auto_accepted';

  const booking = new RideBooking({
    rideId: ride._id,
    passengerId: passengerClerkId,
    driverId: targetDriverId,
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

  const lockExpiry = new Date(
    Date.now() + (approvalMode === 'manual' ? 2 : 5) * 60 * 1000,
  );
  const seatLocks = seatNumbers.map((seatNum) => ({
    seatNumber: seatNum,
    status: 'locked',
    userId: passengerClerkId,
    bookingId: booking._id,
    lockedAt: new Date(),
    expiresAt: lockExpiry,
  }));

  ride.seatLocks = [...(ride.seatLocks || []), ...seatLocks];
  await ride.save();

  await publishEvent(EventTypes.BookingRequested, {
    bookingId: booking._id.toString(),
    rideId: ride._id.toString(),
    passengerId: passengerClerkId,
    driverId: targetDriverId,
    seatNumbers,
    approvalStatus: booking.approvalStatus,
    fare: booking.fare,
  });

  if (approvalMode === 'auto') {
    booking.approvalStatus = 'auto_accepted';
    booking.approvedAt = new Date();
    booking.approvedBy = 'system';
    await booking.save();

    ride.bookings = ride.bookings || [];
    const alreadyAdded = ride.bookings.some(
      (rideBooking) => rideBooking.passengerClerkId === passengerClerkId,
    );

    if (!alreadyAdded) {
      ride.bookings.push({
        _id: booking._id,
        userId: booking.passengerId,
        passengerClerkId: booking.passengerId,
        passengerName: booking.userDetails.name,
        passengerPhone: booking.userDetails.phone,
        seatNumbers: booking.seatNumbers,
        totalAmount: booking.fare,
        paymentMethod: booking.paymentMethod || 'unknown',
        status: 'confirmed',
        bookedAt: new Date(),
        customRequest: booking.customRequest,
      });
    }

    ride.availableSeats = ride.availableSeats.filter(
      (seatNum) => !booking.seatNumbers.includes(seatNum),
    );
    ride.seatLocks = (ride.seatLocks || []).filter(
      (lock) => !booking.seatNumbers.includes(lock.seatNumber),
    );
    await ride.save();

    await publishEvent(EventTypes.BookingApproved, {
      bookingId: booking._id.toString(),
      rideId: ride._id.toString(),
      passengerId: passengerClerkId,
      driverId: targetDriverId,
      approvalStatus: booking.approvalStatus,
      approvedBy: booking.approvedBy,
    });
  }

  return {
    booking,
    ride,
    passenger,
    driverPushToken: driver.pushToken,
    targetDriverId,
    approvalMode,
  };
}

export async function approveBookingRequest({ bookingId, driverClerkId, notes = '' }) {
  assertClerkId(driverClerkId);

  const { booking, ride } = await findBookingAndRide(bookingId);

  if (!isRideDriver(ride, driverClerkId)) {
    throw new ApprovalError('Forbidden - not the booking driver', {
      status: 403,
      code: 'NOT_DRIVER',
    });
  }

  booking.approvalStatus = 'confirmed';
  booking.approvedAt = new Date();
  booking.approvedBy = driverClerkId;
  if (notes) {
    booking.approvalNotes = notes;
  }
  await booking.save();

  ride.bookings = ride.bookings || [];
  const alreadyBooked = ride.bookings.some((rideBooking) => {
    const entrySeats = rideBooking.seatNumbers || rideBooking.seatNumber || [];
    return (
      rideBooking.passengerClerkId === booking.passengerId &&
      entrySeats.some((seat) => booking.seatNumbers.includes(seat))
    );
  });

  if (!alreadyBooked) {
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
  }

  ride.availableSeats = ride.availableSeats.filter(
    (seatNum) => !booking.seatNumbers.includes(seatNum),
  );
  ride.seatLocks = (ride.seatLocks || []).filter(
    (lock) => !booking.seatNumbers.includes(lock.seatNumber),
  );
  await ride.save();

  await publishEvent(EventTypes.BookingApproved, {
    bookingId: booking._id.toString(),
    rideId: booking.rideId.toString(),
    passengerId: booking.passengerId,
    driverId: driverClerkId,
    approvalStatus: booking.approvalStatus,
    approvedBy: booking.approvedBy,
  });

  const passenger = await UserProfile.findOne({
    clerkId: booking.passengerId,
  }).select('pushToken');

  return {
    booking,
    ride,
    passengerPushToken: passenger?.pushToken,
  };
}

export async function rejectBookingRequest({
  bookingId,
  driverClerkId,
  rejectionReason = 'Driver cancelled booking',
}) {
  assertClerkId(driverClerkId);

  const { booking, ride } = await findBookingAndRide(bookingId);

  if (!isRideDriver(ride, driverClerkId)) {
    throw new ApprovalError('Forbidden - not the booking driver', {
      status: 403,
      code: 'NOT_DRIVER',
    });
  }

  booking.approvalStatus = 'rejected';
  booking.rejectedAt = new Date();
  booking.rejectionReason = rejectionReason;
  await booking.save();

  ride.seatLocks = (ride.seatLocks || []).filter(
    (lock) => !booking.seatNumbers.includes(lock.seatNumber),
  );
  await ride.save();

  await publishEvent(EventTypes.BookingRejected, {
    bookingId: booking._id.toString(),
    rideId: booking.rideId.toString(),
    passengerId: booking.passengerId,
    driverId: driverClerkId,
    rejectionReason,
  });

  const passenger = await UserProfile.findOne({
    clerkId: booking.passengerId,
  }).select('pushToken');

  return {
    booking,
    ride,
    rejectionReason,
    passengerPushToken: passenger?.pushToken,
  };
}

export async function confirmApprovedBookingPayment({
  bookingId,
  passengerClerkId,
  paymentId,
  paymentMethod = 'razorpay',
  paymentStatus = 'paid',
}) {
  assertClerkId(passengerClerkId);

  const { booking, ride } = await findBookingAndRide(bookingId);

  if (booking.passengerId !== passengerClerkId) {
    throw new ApprovalError('Forbidden - not the booking passenger', {
      status: 403,
      code: 'NOT_PASSENGER',
    });
  }

  if (booking.approvalStatus !== 'confirmed') {
    throw new ApprovalError('Booking is not in confirmed state', {
      code: 'INVALID_STATUS',
      details: booking.approvalStatus,
    });
  }

  if (booking.paymentStatus === 'paid') {
    throw new ApprovalError('Payment already completed', {
      code: 'ALREADY_PAID',
    });
  }

  booking.paymentId = paymentId;
  booking.paymentMethod = paymentMethod;
  booking.paymentStatus = paymentStatus;
  booking.paymentCompletedAt = new Date();
  await booking.save();

  const rideBooking = (ride.bookings || []).find((entry) => {
    const entrySeats = entry.seatNumbers || entry.seatNumber || [];
    return (
      entry.userId === booking.passengerId &&
      entrySeats.some((seat) => booking.seatNumbers.includes(seat))
    );
  });

  if (rideBooking) {
    rideBooking.paymentStatus = 'paid';
    await ride.save();
  }

  await publishEvent(EventTypes.BookingPaymentConfirmed, {
    bookingId: booking._id.toString(),
    rideId: booking.rideId.toString(),
    passengerId: booking.passengerId,
    driverId: booking.driverId,
    paymentId,
    paymentMethod,
    paymentStatus,
    fare: booking.fare,
  });

  const driver = await UserProfile.findOne({
    clerkId: booking.driverId,
  }).select('pushToken');

  return {
    booking,
    ride,
    driverPushToken: driver?.pushToken,
  };
}

export async function cancelPendingApprovalRequest({ bookingId, passengerClerkId }) {
  assertClerkId(passengerClerkId);

  const booking = await RideBooking.findById(bookingId);
  if (!booking) {
    throw new ApprovalError('Booking not found', {
      status: 404,
      code: 'BOOKING_NOT_FOUND',
    });
  }

  const bookingPassengerId = booking.passengerClerkId || booking.passengerId;
  if (bookingPassengerId !== passengerClerkId) {
    throw new ApprovalError('You can only cancel your own bookings', {
      status: 403,
      code: 'NOT_PASSENGER',
    });
  }

  if (booking.approvalStatus !== 'pending_approval') {
    throw new ApprovalError(
      `Cannot cancel booking with status: ${booking.approvalStatus}`,
      {
        code: 'INVALID_STATUS',
        details: 'Only pending bookings can be cancelled',
      },
    );
  }

  booking.approvalStatus = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = 'passenger';
  await booking.save();

  const ride = await RideOffer.findById(booking.rideId);
  if (ride) {
    const seatsToRelease = booking.seatNumbers || [];
    ride.availableSeats = [
      ...new Set([...(ride.availableSeats || []), ...seatsToRelease]),
    ].sort((a, b) => a - b);
    ride.seatLocks = (ride.seatLocks || []).filter(
      (lock) => !seatsToRelease.includes(lock.seatNumber),
    );
    await ride.save();
  }

  await publishEvent(EventTypes.BookingCancelled, {
    bookingId: booking._id.toString(),
    rideId: booking.rideId.toString(),
    passengerId: passengerClerkId,
    cancelledBy: booking.cancelledBy,
  });

  return {
    booking,
    ride,
  };
}

export async function createBookingRequestFlow({
  rideId,
  passengerClerkId,
  seatNumbers = [],
  customRequest = '',
}) {
  const result = await createBookingRequest({
    rideId,
    passengerClerkId,
    seatNumbers,
    customRequest,
  });

  if (result.approvalMode === 'auto') {
    return result;
  }

  const { booking, driverPushToken, passenger, ride, targetDriverId } = result;
  const io = getRealtimeServer();
  if (io) {
    io.emit(`driver:booking-approval-request:${targetDriverId}`, {
      driverId: targetDriverId,
      booking: booking.toObject(),
      passenger: {
        name: `${passenger.firstName} ${passenger.lastName}`,
        rating: passenger.rating,
        totalTrips: passenger.totalTrips,
        phone: passenger.phone,
      },
      rideId: ride._id,
      seats: seatNumbers,
    });
  }

  if (driverPushToken) {
    await sendPushToToken({
      pushToken: driverPushToken,
      title: 'New Booking Request',
      body: `${passenger.firstName} wants to book ${seatNumbers.length} seat(s) for ${ride.from} -> ${ride.to}`,
      data: {
        type: 'booking_approval_request',
        bookingId: booking._id.toString(),
        rideId: ride._id.toString(),
      },
    });
  }

  return result;
}

export async function approveBookingRequestFlow({ bookingId, driverClerkId, notes = '' }) {
  const result = await approveBookingRequest({ bookingId, driverClerkId, notes });
  const { booking, passengerPushToken } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit(`passenger:booking-approved:${booking.passengerId}`, {
      bookingId: booking._id,
      rideId: booking.rideId,
      message: 'Your booking is confirmed! Get ready for pickup.',
      requiresPayment: false,
      fare: booking.fare,
    });
  }

  if (passengerPushToken) {
    await sendPushToToken({
      pushToken: passengerPushToken,
      title: 'Booking Confirmed',
      body: `Driver accepted! Get ready for pickup. ${booking.from} -> ${booking.to}. Payment after ride.`,
      data: {
        type: 'booking_confirmed',
        bookingId: booking._id.toString(),
        rideId: booking.rideId.toString(),
        fare: booking.fare,
      },
    });
  }

  return result;
}

export async function rejectBookingRequestFlow({
  bookingId,
  driverClerkId,
  rejectionReason = 'Driver cancelled booking',
}) {
  const result = await rejectBookingRequest({
    bookingId,
    driverClerkId,
    rejectionReason,
  });
  const { booking, passengerPushToken } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit(`passenger:booking-rejected:${booking.passengerId}`, {
      bookingId: booking._id,
      rideId: booking.rideId,
      reason: rejectionReason,
    });
  }

  if (passengerPushToken) {
    await sendPushToToken({
      pushToken: passengerPushToken,
      title: 'Booking Rejected',
      body: `Driver declined your booking. Reason: ${rejectionReason}`,
      data: {
        type: 'booking_rejected',
        bookingId: booking._id.toString(),
        rideId: booking.rideId.toString(),
      },
    });
  }

  return result;
}

export async function confirmApprovedBookingPaymentFlow({
  bookingId,
  passengerClerkId,
  paymentId,
  paymentMethod = 'razorpay',
  paymentStatus = 'paid',
}) {
  const result = await confirmApprovedBookingPayment({
    bookingId,
    passengerClerkId,
    paymentId,
    paymentMethod,
    paymentStatus,
  });
  const { booking, driverPushToken } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit(`driver:payment-received:${booking.driverId}`, {
      bookingId: booking._id,
      rideId: booking.rideId,
      passengerName: booking.userDetails.name,
      fare: booking.fare,
      seats: booking.seatNumbers,
    });
  }

  if (driverPushToken) {
    await sendPushToToken({
      pushToken: driverPushToken,
      title: 'Payment Received',
      body: `${booking.userDetails.name} completed payment of Rs ${booking.fare}. Ride complete!`,
      data: {
        type: 'payment_received',
        bookingId: booking._id.toString(),
        rideId: booking.rideId.toString(),
      },
    });
  }

  return result;
}

export async function cancelPendingApprovalRequestFlow({
  bookingId,
  passengerClerkId,
}) {
  const result = await cancelPendingApprovalRequest({
    bookingId,
    passengerClerkId,
  });
  const { ride } = result;

  const io = getRealtimeServer();
  if (io && ride) {
    io.emit('ride:offer:booked', {
      offerId: ride._id.toString(),
      availableSeats: ride.availableSeats,
      status: ride.status,
    });
  }

  return result;
}

export async function getPendingApprovalsForRide({ rideId, driverClerkId }) {
  assertClerkId(driverClerkId);

  const ride = await RideOffer.findById(rideId);
  if (!ride) {
    throw new ApprovalError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  if (!isRideDriver(ride, driverClerkId)) {
    throw new ApprovalError('Forbidden - not the ride driver', {
      status: 403,
      code: 'NOT_DRIVER',
    });
  }

  const timeWindow = env.approvalPendingWindowMinutes;
  const pendingBookings = await RideBooking.find({
    rideId,
    approvalStatus: 'pending_approval',
    approvalRequestedAt: {
      $gt: new Date(Date.now() - timeWindow * 60 * 1000),
    },
  });

  return pendingBookings.map((booking) => booking.toObject());
}

export async function getAllPendingApprovalsForDriver(driverClerkId) {
  assertClerkId(driverClerkId);

  const driverRides = await RideOffer.find({
    $or: [{ driverId: driverClerkId }, { clerkId: driverClerkId }],
  }).select('_id');

  const rideIds = driverRides.map((ride) => ride._id);
  if (rideIds.length === 0) {
    return [];
  }

  const timeWindow = env.approvalPendingWindowMinutes;
  const pendingBookings = await RideBooking.find({
    rideId: { $in: rideIds },
    approvalStatus: 'pending_approval',
    approvalRequestedAt: {
      $gt: new Date(Date.now() - timeWindow * 60 * 1000),
    },
  });

  return pendingBookings.map((booking) => booking.toObject());
}

export async function getBookingApprovalStatusForUser({ bookingId, clerkId }) {
  assertClerkId(clerkId);

  const booking = await RideBooking.findById(bookingId);
  if (!booking) {
    throw new ApprovalError('Booking not found', {
      status: 404,
      code: 'BOOKING_NOT_FOUND',
    });
  }

  const isParticipant =
    booking.passengerId === clerkId ||
    booking.passengerClerkId === clerkId ||
    booking.driverId === clerkId;

  if (!isParticipant) {
    const user = await UserProfile.findOne({ clerkId }).select('role');
    if (user?.role !== 'admin') {
      throw new ApprovalError('Forbidden', {
        status: 403,
        code: 'NOT_BOOKING_PARTICIPANT',
      });
    }
  }

  return booking.toObject();
}

export async function getApprovalAnalyticsForDriver({ driverId, clerkId }) {
  assertClerkId(clerkId);

  if (driverId !== clerkId) {
    throw new ApprovalError('Forbidden', {
      status: 403,
      code: 'NOT_AUTHORIZED',
    });
  }

  const bookings = await RideBooking.find({ driverId });
  const analytics = {
    total: bookings.length,
    auto_confirmed: bookings.filter(
      (booking) => booking.approvalStatus === 'auto_accepted',
    ).length,
    approved: bookings.filter((booking) => booking.approvalStatus === 'approved')
      .length,
    rejected: bookings.filter((booking) => booking.approvalStatus === 'rejected')
      .length,
    expired: bookings.filter((booking) => booking.approvalStatus === 'expired')
      .length,
    cancelled: bookings.filter(
      (booking) => booking.approvalStatus === 'cancelled',
    ).length,
    pending: bookings.filter(
      (booking) => booking.approvalStatus === 'pending_approval',
    ).length,
  };

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

  return analytics;
}

export async function updateRideApprovalSettingsForDriver({
  rideId,
  driverClerkId,
  requiresManualApproval,
  autoApproveThreshold,
}) {
  assertClerkId(driverClerkId);

  const ride = await RideOffer.findById(rideId);
  if (!ride) {
    throw new ApprovalError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  if (!isRideDriver(ride, driverClerkId)) {
    throw new ApprovalError('Forbidden - not the ride driver', {
      status: 403,
      code: 'NOT_DRIVER',
    });
  }

  if (ride.isFestivalRide && requiresManualApproval) {
    throw new ApprovalError('Invalid approval mode', {
      code: 'FESTIVAL_FORCED_AUTO',
      details: 'Festival rides must auto-confirm',
    });
  }

  ride.approvalMode = requiresManualApproval ? 'manual' : 'auto';
  ride.requiresManualApproval = requiresManualApproval || false;

  if (autoApproveThreshold) {
    ride.approvalSettings = {
      autoApproveThreshold,
    };
  }

  await ride.save();
  return ride;
}

export async function getPassengerBookingsWithRideDetails(clerkId) {
  assertClerkId(clerkId);

  const bookings = await RideBooking.find({
    $or: [{ passengerClerkId: clerkId }, { passengerId: clerkId }],
  })
    .sort({ createdAt: -1 })
    .lean();

  return Promise.all(
    bookings.map(async (booking) => {
      try {
        const rideOffer = await RideOffer.findById(booking.rideId).lean();

        let driverInfo = null;
        if (rideOffer?.clerkId) {
          driverInfo = await UserProfile.findOne({
            clerkId: rideOffer.clerkId,
          }).lean();
        }

        const hasConfirmedPickup =
          rideOffer?.pickupStatus?.confirmedPassengers?.includes(clerkId) ||
          false;
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
      } catch {
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
}

/**
 * Auto-reject approvals that have expired (5 minutes)
 * Runs every 1 minute
 */
export async function expirePendingApprovals({ rideId } = {}) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const query = {
      approvalStatus: 'pending_approval',
      approvalRequestedAt: { $lt: fiveMinutesAgo },
    };

    if (rideId) {
      query.rideId = rideId;
    }

    const expiredBookings = await RideBooking.find(query);

    if (expiredBookings.length === 0) {
      return { success: true, processedCount: 0 };
    }

    console.log(
      `⏱️ [AUTO-REJECT] Processing ${expiredBookings.length} expired approvals`,
    );

    const results = [];

    for (const booking of expiredBookings) {
      try {
        // Update booking status
        booking.approvalStatus = 'expired';
        booking.rejectionReason = 'Driver did not respond within 5 minutes';
        booking.rejectedAt = new Date();
        await booking.save();

        // Release seat locks
        const ride = await RideOffer.findById(booking.rideId);
        if (ride && ride.seatLocks) {
          ride.seatLocks = ride.seatLocks.filter(
            (lock) => !booking.seatNumbers.includes(lock.seatNumber),
          );
          await ride.save();
          console.log(`✅ Released seats for booking: ${booking._id}`);
        }

        // Send notification to passenger
        const passenger = await UserProfile.findOne({
          clerkId: booking.passengerId,
        });
        if (passenger?.pushToken) {
          await sendPushToToken({
            pushToken: passenger.pushToken,
            title: 'Booking Request Expired',
            body: 'Driver did not respond in time. Try another ride!',
            data: {
              type: 'booking_expired',
              bookingId: booking._id.toString(),
            },
          });
        }

        results.push({
          bookingId: booking._id,
          status: 'auto-rejected',
        });
      } catch (error) {
        console.error(
          `❌ Error processing expired booking ${booking._id}:`,
          error,
        );
        results.push({
          bookingId: booking._id,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(
      `✅ [AUTO-REJECT] Completed: ${results.length} bookings processed`,
    );

    return {
      success: true,
      processedCount: results.length,
      expiredCount: expiredBookings.length,
      results,
    };
  } catch (error) {
    console.error('❌ Error in autoRejectExpiredApprovals:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function autoRejectExpiredApprovals() {
  return expirePendingApprovals();
}

/**
 * Clean up expired seat locks
 * Runs every 5 minutes
 */
export async function cleanupExpiredSeatLocks() {
  try {
    const now = new Date();
    const updatedRides = await RideOffer.updateMany(
      { 'seatLocks.expiresAt': { $lt: now } },
      {
        $pull: {
          seatLocks: { expiresAt: { $lt: now } },
        },
      },
    );

    if (updatedRides.modifiedCount > 0) {
      console.log(
        `✅ [CLEANUP] Cleared expired seat locks from ${updatedRides.modifiedCount} rides`,
      );
    }

    return {
      success: true,
      cleanedUpCount: updatedRides.modifiedCount,
    };
  } catch (error) {
    console.error('❌ Error in cleanupExpiredSeatLocks:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sync passenger cancellation rates and ratings
 * Used for trusted passenger determination
 * Runs every 1 hour
 */
export async function syncPassengerMetrics() {
  try {
    const passengers = await UserProfile.find();
    let updatedCount = 0;

    for (const passenger of passengers) {
      const bookings = await RideBooking.find({
        passengerId: passenger.clerkId,
      });
      const cancelledCount = bookings.filter(
        (b) => b.approvalStatus === 'cancelled',
      ).length;

      const cancellationRate =
        bookings.length > 0 ? cancelledCount / bookings.length : 0;

      // Update passenger metrics if needed
      if (passenger.totalTrips !== bookings.length) {
        passenger.totalTrips = bookings.length;
        await passenger.save();
        updatedCount++;
      }
    }

    console.log(`✅ [SYNC] Updated metrics for ${updatedCount} passengers`);

    return {
      success: true,
      updatedCount,
    };
  } catch (error) {
    console.error('❌ Error in syncPassengerMetrics:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Start all background approval tasks
 */
export function startApprovalBackgroundTasks() {
  if (approvalTaskIntervals.size > 0) {
    return [...approvalTaskIntervals];
  }

  try {
    console.log('🚀 Starting approval background tasks...');

    // Auto-reject expired approvals every 1 minute
    approvalTaskIntervals.add(
      setInterval(autoRejectExpiredApprovals, 60 * 1000),
    );
    console.log('⏱️ Auto-reject expired approvals job: every 1 minute');

    // Cleanup expired seat locks every 5 minutes
    approvalTaskIntervals.add(
      setInterval(cleanupExpiredSeatLocks, 5 * 60 * 1000),
    );
    console.log('🧹 Cleanup expired seat locks job: every 5 minutes');

    // Sync passenger metrics every 1 hour
    approvalTaskIntervals.add(
      setInterval(syncPassengerMetrics, 60 * 60 * 1000),
    );
    console.log('📊 Sync passenger metrics job: every 1 hour');

    console.log('✅ Approval background tasks started');
  } catch (error) {
    console.error('❌ Error starting approval background tasks:', error);
  }
}

export function stopApprovalBackgroundTasks() {
  for (const interval of approvalTaskIntervals) {
    clearInterval(interval);
  }
  approvalTaskIntervals.clear();
}

export default {
  autoRejectExpiredApprovals,
  expirePendingApprovals,
  cleanupExpiredSeatLocks,
  syncPassengerMetrics,
  startApprovalBackgroundTasks,
  stopApprovalBackgroundTasks,
};
