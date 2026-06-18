import mongoose from 'mongoose';
import { RideOffer } from '../models/rideOffer.model.js';
import { RideBooking } from '../models/rideBooking.model.js';
import { UserProfile } from '../models/userProfile.model.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';
import { sendPushToToken, sendPushToUsers } from './pushNotificationService.js';

class RideOfferLifecycleError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const assertClerkId = (clerkId) => {
  if (!clerkId) {
    throw new RideOfferLifecycleError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'clerkId is required',
    });
  }
};

const assertOfferId = (id) => {
  if (id?.startsWith('local-')) {
    throw new RideOfferLifecycleError('Cannot use local ride offer', {
      code: 'LOCAL_OFFER_NOT_SYNCED',
      details: 'This ride offer has not been synced to the server yet',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new RideOfferLifecycleError('Invalid ride offer ID format', {
      code: 'INVALID_OFFER_ID',
      details: `Ride offer ID "${id}" is not a valid format`,
    });
  }
};

const normalizeOfferForSave = (rideOffer) => {
  if (!rideOffer.driverId && rideOffer.clerkId) {
    rideOffer.driverId = rideOffer.clerkId;
  }
  if (rideOffer.festivalConfig && rideOffer.festivalConfig.tier === '') {
    rideOffer.festivalConfig.tier = null;
  }
};

const isVersionConflict = (error) =>
  error?.name === 'VersionError' ||
  /No matching document found.*modifiedPaths/i.test(error?.message || '');

const seatUnavailableError = (seatNumbers) =>
  new RideOfferLifecycleError('Seats not available', {
    status: 409,
    code: 'SEATS_UNAVAILABLE',
    details: `Seats ${seatNumbers.join(', ')} are already booked`,
  });

const getBookingPassengerClerkId = (booking) =>
  booking?.passengerClerkId || booking?.passengerId;

const getBookingDisplayName = (booking, fallback = 'Passenger') =>
  booking?.userDetails?.name || booking?.passengerName || fallback;

async function findRideOfferBooking({ ride, offerId, bookingId }) {
  if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
    const booking = await RideBooking.findById(bookingId);
    if (booking?.rideId?.toString() === offerId) {
      return {
        booking,
        source: 'document',
      };
    }
  }

  const embeddedBooking = bookingId
    ? ride.bookings.id(bookingId)
    : null;

  if (embeddedBooking) {
    return {
      booking: embeddedBooking,
      source: 'embedded',
    };
  }

  return {
    booking: null,
    source: null,
  };
}

export async function bookRideOfferSeats({
  offerId,
  passengerClerkId,
  seatNumbers,
  paymentMethod = 'unknown',
  customRequest,
}) {
  assertClerkId(passengerClerkId);
  assertOfferId(offerId);

  if (!seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    throw new RideOfferLifecycleError('Invalid booking', {
      code: 'MISSING_SEATS',
      details: 'seatNumbers array is required',
    });
  }

  const passenger = await UserProfile.findOne({ clerkId: passengerClerkId });
  if (!passenger) {
    throw new RideOfferLifecycleError('Passenger profile not found', {
      status: 404,
      code: 'PASSENGER_NOT_FOUND',
    });
  }

  const maxSaveAttempts = 5;
  let lastVersionConflict = null;

  for (let attempt = 1; attempt <= maxSaveAttempts; attempt += 1) {
    const rideOffer = await RideOffer.findById(offerId);
    if (!rideOffer) {
      throw new RideOfferLifecycleError('Ride offer not found', {
        status: 404,
        code: 'RIDE_OFFER_NOT_FOUND',
      });
    }

    if (
      rideOffer.clerkId === passengerClerkId ||
      rideOffer.driverId === passengerClerkId
    ) {
      throw new RideOfferLifecycleError('Drivers cannot book their own ride', {
        status: 403,
        code: 'DRIVER_CANNOT_BOOK_OWN_RIDE',
      });
    }

    const unavailableSeats = seatNumbers.filter(
      (seat) => !rideOffer.availableSeats.includes(seat),
    );
    if (unavailableSeats.length > 0) {
      throw seatUnavailableError(unavailableSeats);
    }

    const totalAmount = seatNumbers.length * rideOffer.farePerSeat;
    const booking = {
      passengerId: passenger._id,
      passengerClerkId,
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

    rideOffer.availableSeats = rideOffer.availableSeats.filter(
      (seat) => !seatNumbers.includes(seat),
    );
    rideOffer.bookings.push(booking);
    if (rideOffer.availableSeats.length === 0) {
      rideOffer.status = 'booked';
    }
    normalizeOfferForSave(rideOffer);

    try {
      await rideOffer.save();

      await publishEvent(EventTypes.RideOfferBooked, {
        offerId: rideOffer._id.toString(),
        passengerId: passengerClerkId,
        driverId: rideOffer.driverId || rideOffer.clerkId,
        seatNumbers,
        totalAmount,
        status: rideOffer.status,
      });

      return {
        booking,
        rideOffer,
      };
    } catch (error) {
      if (isVersionConflict(error)) {
        lastVersionConflict = error;
        continue;
      }
      throw error;
    }
  }

  throw new RideOfferLifecycleError('Booking conflict, please retry', {
    status: 409,
    code: 'BOOKING_CONFLICT',
    details:
      lastVersionConflict?.message ||
      'The ride was updated while booking seats',
  });
}

export async function bookRideOfferSeatsFlow({
  offerId,
  passengerClerkId,
  seatNumbers,
  paymentMethod = 'unknown',
  customRequest,
}) {
  const result = await bookRideOfferSeats({
    offerId,
    passengerClerkId,
    seatNumbers,
    paymentMethod,
    customRequest,
  });
  const { booking, rideOffer } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:offer:booked', {
      offerId,
      booking,
      availableSeats: rideOffer.availableSeats,
      status: rideOffer.status,
    });
  }

  return result;
}

export async function cancelRideOfferByDriver({ offerId, driverClerkId }) {
  assertClerkId(driverClerkId);

  if (offerId?.startsWith('local-')) {
    return {
      isLocal: true,
      rideOffer: {
        id: offerId,
        status: 'cancelled',
        isLocal: true,
      },
    };
  }

  assertOfferId(offerId);
  const rideOffer = await RideOffer.findById(offerId);
  if (!rideOffer) {
    throw new RideOfferLifecycleError('Ride offer not found', {
      status: 404,
      code: 'RIDE_OFFER_NOT_FOUND',
    });
  }

  if (rideOffer.clerkId !== driverClerkId) {
    throw new RideOfferLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_RIDE_CREATOR',
      details: 'Only the ride creator can cancel',
    });
  }

  normalizeOfferForSave(rideOffer);
  rideOffer.status = 'cancelled';
  await rideOffer.save();

  await publishEvent(EventTypes.RideOfferCancelled, {
    offerId: rideOffer._id.toString(),
    driverId: driverClerkId,
    status: rideOffer.status,
  });

  return {
    isLocal: false,
    rideOffer,
  };
}

export async function cancelRideOfferByDriverFlow({ offerId, driverClerkId }) {
  const result = await cancelRideOfferByDriver({ offerId, driverClerkId });
  if (result.isLocal) {
    return result;
  }

  const io = getRealtimeServer();
  if (io) {
    io.emit('rideOfferCancelled', { offerId });
  }

  return result;
}

export async function requestRideOfferHoldForPassenger({
  offerId,
  passengerClerkId,
  minutes,
}) {
  assertClerkId(passengerClerkId);
  assertOfferId(offerId);

  const parsedMinutes = Number.parseInt(minutes, 10);
  if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 60) {
    throw new RideOfferLifecycleError('Invalid hold request', {
      code: 'INVALID_HOLD_MINUTES',
      details: 'minutes must be between 1 and 60',
    });
  }

  const rideOffer = await RideOffer.findById(offerId);
  if (!rideOffer) {
    throw new RideOfferLifecycleError('Ride offer not found', {
      status: 404,
      code: 'RIDE_OFFER_NOT_FOUND',
    });
  }

  if (rideOffer.clerkId === passengerClerkId) {
    throw new RideOfferLifecycleError('Drivers cannot hold their own ride', {
      code: 'DRIVER_CANNOT_HOLD_OWN_RIDE',
    });
  }

  if (!['waiting', 'ongoing'].includes(rideOffer.status)) {
    throw new RideOfferLifecycleError('Ride is not available for hold requests', {
      code: 'RIDE_NOT_HOLDABLE',
    });
  }

  const passenger = await UserProfile.findOne({ clerkId: passengerClerkId });
  const pendingRequest = rideOffer.holdRequests?.find(
    (request) =>
      request.passengerClerkId === passengerClerkId &&
      request.status === 'pending',
  );

  if (pendingRequest) {
    pendingRequest.minutes = parsedMinutes;
    pendingRequest.requestedAt = new Date();
  } else {
    rideOffer.holdRequests.push({
      passengerClerkId,
      passengerName:
        passenger?.fullName ||
        passenger?.firstName ||
        passenger?.email ||
        'Passenger',
      minutes: parsedMinutes,
    });
  }

  await rideOffer.save();
  const holdRequest =
    pendingRequest || rideOffer.holdRequests[rideOffer.holdRequests.length - 1];

  await publishEvent(EventTypes.RideOfferHoldRequested, {
    rideId: rideOffer._id.toString(),
    passengerClerkId,
    driverId: rideOffer.driverId || rideOffer.clerkId,
    minutes: parsedMinutes,
    status: rideOffer.status,
    requestedAt: new Date().toISOString(),
  });

  return {
    holdRequest,
    minutes: parsedMinutes,
    rideOffer,
  };
}

export async function respondToRideOfferHold({
  offerId,
  requestId,
  driverClerkId,
  action,
}) {
  assertClerkId(driverClerkId);
  assertOfferId(offerId);

  if (!['approve', 'reject'].includes(action)) {
    throw new RideOfferLifecycleError('Invalid hold response', {
      code: 'INVALID_HOLD_ACTION',
      details: 'action must be approve or reject',
    });
  }

  const rideOffer = await RideOffer.findById(offerId);
  if (!rideOffer) {
    throw new RideOfferLifecycleError('Ride offer not found', {
      status: 404,
      code: 'RIDE_OFFER_NOT_FOUND',
    });
  }

  if (rideOffer.clerkId !== driverClerkId) {
    throw new RideOfferLifecycleError('Only the driver can respond', {
      status: 403,
      code: 'NOT_RIDE_DRIVER',
    });
  }

  const holdRequest = rideOffer.holdRequests.id(requestId);
  if (!holdRequest) {
    throw new RideOfferLifecycleError('Hold request not found', {
      status: 404,
      code: 'HOLD_REQUEST_NOT_FOUND',
    });
  }

  if (holdRequest.status !== 'pending') {
    throw new RideOfferLifecycleError('Hold request already handled', {
      code: 'HOLD_REQUEST_ALREADY_HANDLED',
    });
  }

  holdRequest.status = action === 'approve' ? 'approved' : 'rejected';
  holdRequest.respondedAt = new Date();

  if (action === 'approve') {
    const currentDeparture = new Date(rideOffer.departureTime);
    rideOffer.departureTime = new Date(
      currentDeparture.getTime() + holdRequest.minutes * 60000,
    );
    rideOffer.departureNotificationSent = false;
  }

  await rideOffer.save();

  await publishEvent(EventTypes.RideOfferHoldResponded, {
    rideId: rideOffer._id.toString(),
    requestId,
    passengerClerkId: holdRequest.passengerClerkId,
    driverId: driverClerkId,
    action,
    departureTime: rideOffer.departureTime,
  });

  return {
    holdRequest,
    rideOffer,
  };
}

export async function requestRideOfferHoldFlow({
  offerId,
  passengerClerkId,
  minutes,
}) {
  const result = await requestRideOfferHoldForPassenger({
    offerId,
    passengerClerkId,
    minutes,
  });
  const { holdRequest, rideOffer } = result;

  await sendPushToUsers({
    userIds: [rideOffer.clerkId],
    title: 'Hold request for your ride',
    body: `${holdRequest.passengerName || 'A passenger'} wants you to wait ${result.minutes} min for ${rideOffer.from} to ${rideOffer.to}.`,
    data: {
      type: 'ride_hold_request',
      rideId: rideOffer._id.toString(),
      offerId: rideOffer._id.toString(),
      requestId: holdRequest._id.toString(),
      minutes: result.minutes,
    },
  });

  const io = getRealtimeServer();
  if (io) {
    const holdPayload = {
      rideId: rideOffer._id.toString(),
      offerId: rideOffer._id.toString(),
      requestId: holdRequest._id.toString(),
      minutes: result.minutes,
      passengerName: holdRequest.passengerName,
      from: rideOffer.from,
      to: rideOffer.to,
    };
    io.to(`user:${rideOffer.clerkId}`).emit(
      `driver:hold-request:${rideOffer.clerkId}`,
      holdPayload,
    );
    io.emit(`driver:hold-request:${rideOffer.clerkId}`, holdPayload);
  }

  return result;
}

export async function respondToRideOfferHoldFlow({
  offerId,
  requestId,
  driverClerkId,
  action,
}) {
  const result = await respondToRideOfferHold({
    offerId,
    requestId,
    driverClerkId,
    action,
  });
  const { holdRequest, rideOffer } = result;

  await sendPushToUsers({
    userIds: [holdRequest.passengerClerkId],
    title:
      action === 'approve'
        ? 'Driver accepted your hold'
        : 'Driver declined hold request',
    body:
      action === 'approve'
        ? `The driver will wait ${holdRequest.minutes} min. New departure is ${new Date(rideOffer.departureTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}.`
        : `The driver cannot hold this ride from ${rideOffer.from}.`,
    data: {
      type: 'ride_hold_response',
      rideId: rideOffer._id.toString(),
      offerId: rideOffer._id.toString(),
      requestId,
      action,
      departureTime: rideOffer.departureTime.toISOString(),
    },
  });

  const io = getRealtimeServer();
  if (io) {
    io.emit('rideOfferUpdated', rideOffer);
    const holdResponsePayload = {
      rideId: rideOffer._id.toString(),
      offerId: rideOffer._id.toString(),
      requestId,
      action,
      departureTime: rideOffer.departureTime,
    };
    io.to(`user:${holdRequest.passengerClerkId}`).emit(
      `passenger:hold-response:${holdRequest.passengerClerkId}`,
      holdResponsePayload,
    );
    io.emit(
      `passenger:hold-response:${holdRequest.passengerClerkId}`,
      holdResponsePayload,
    );
  }

  return result;
}

export async function initiateRideOfferPickup({
  offerId,
  bookingId,
  passengerClerkId,
  driverClerkId,
}) {
  assertClerkId(driverClerkId);
  assertOfferId(offerId);

  const ride = await RideOffer.findById(offerId);
  if (!ride) {
    throw new RideOfferLifecycleError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  const isDriver = ride.driverId === driverClerkId || ride.clerkId === driverClerkId;
  if (!isDriver) {
    throw new RideOfferLifecycleError('Forbidden - not the ride driver', {
      status: 403,
      code: 'NOT_DRIVER',
    });
  }

  const { booking, source } = await findRideOfferBooking({
    ride,
    offerId,
    bookingId,
  });
  if (!booking) {
    throw new RideOfferLifecycleError('Booking not found', {
      status: 404,
      code: 'BOOKING_NOT_FOUND',
    });
  }

  const bookingPassengerClerkId = getBookingPassengerClerkId(booking);
  if (passengerClerkId && bookingPassengerClerkId !== passengerClerkId) {
    throw new RideOfferLifecycleError('Forbidden - not the booking passenger', {
      status: 403,
      code: 'NOT_PASSENGER',
    });
  }

  const isConfirmed =
    source === 'document'
      ? booking.approvalStatus === 'confirmed'
      : booking.status === 'confirmed';
  if (!isConfirmed) {
    throw new RideOfferLifecycleError('Booking not confirmed', {
      code: 'BOOKING_NOT_CONFIRMED',
    });
  }

  ride.pickupStatus = ride.pickupStatus || {
    driverConfirmedAt: null,
    confirmedPassengers: [],
  };
  if (!ride.pickupStatus.driverConfirmedAt) {
    ride.pickupStatus.driverConfirmedAt = new Date();
  }
  if (ride.status === 'waiting') {
    ride.status = 'ongoing';
  }
  normalizeOfferForSave(ride);
  await ride.save();

  await publishEvent(EventTypes.RideOfferPickupInitiated, {
    offerId: ride._id.toString(),
    bookingId: booking._id.toString(),
    passengerId: bookingPassengerClerkId,
    driverId: ride.driverId || ride.clerkId,
    status: ride.status,
  });

  const passenger = await UserProfile.findOne({
    clerkId: bookingPassengerClerkId,
  }).select('pushToken');

  return {
    booking,
    passengerPushToken: passenger?.pushToken,
    ride,
  };
}

export async function confirmRideOfferPassengerPickup({
  offerId,
  bookingId,
  passengerClerkId,
}) {
  assertClerkId(passengerClerkId);
  assertOfferId(offerId);

  const ride = await RideOffer.findById(offerId);
  if (!ride) {
    throw new RideOfferLifecycleError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  const { booking } = await findRideOfferBooking({
    ride,
    offerId,
    bookingId,
  });
  if (!booking) {
    throw new RideOfferLifecycleError('Booking not found', {
      status: 404,
      code: 'BOOKING_NOT_FOUND',
    });
  }

  const bookingPassengerClerkId = getBookingPassengerClerkId(booking);
  if (bookingPassengerClerkId !== passengerClerkId) {
    throw new RideOfferLifecycleError('Forbidden - not the booking passenger', {
      status: 403,
      code: 'NOT_PASSENGER',
    });
  }

  ride.pickupStatus = ride.pickupStatus || {
    driverConfirmedAt: null,
    confirmedPassengers: [],
  };
  ride.pickupStatus.confirmedPassengers =
    ride.pickupStatus.confirmedPassengers || [];
  if (!ride.pickupStatus.confirmedPassengers.includes(passengerClerkId)) {
    ride.pickupStatus.confirmedPassengers.push(passengerClerkId);
  }
  normalizeOfferForSave(ride);
  await ride.save();

  await publishEvent(EventTypes.RideOfferPickupPassengerConfirmed, {
    offerId: ride._id.toString(),
    bookingId: booking._id.toString(),
    passengerId: passengerClerkId,
    driverId: ride.driverId,
    confirmedCount: ride.pickupStatus.confirmedPassengers.length,
  });

  const driver = await UserProfile.findOne({ clerkId: ride.driverId }).select(
    'pushToken',
  );

  return {
    booking,
    driverPushToken: driver?.pushToken,
    ride,
  };
}

export async function initiateRideOfferPickupFlow({
  offerId,
  bookingId,
  passengerClerkId,
  driverClerkId,
}) {
  const { booking, passengerPushToken, ride } = await initiateRideOfferPickup({
    offerId,
    bookingId,
    passengerClerkId,
    driverClerkId,
  });

  const io = getRealtimeServer();
  if (io) {
    io.emit(`passenger:pickup-initiated:${passengerClerkId}`, {
      rideId: ride._id,
      bookingId: booking._id,
      driverName: ride.driver?.name || 'Driver',
      message: 'Driver is ready for pickup. Please confirm when you board.',
    });
  }

  if (passengerPushToken) {
    await sendPushToToken({
      pushToken: passengerPushToken,
      title: 'Ready for Pickup',
      body: 'Your driver is ready. Please confirm once you board the vehicle.',
      data: {
        type: 'pickup_initiated',
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
      },
    });
  }

  return { booking, ride };
}

export async function confirmRideOfferPassengerPickupFlow({
  offerId,
  bookingId,
  passengerClerkId,
}) {
  const { booking, driverPushToken, ride } =
    await confirmRideOfferPassengerPickup({
      offerId,
      bookingId,
      passengerClerkId,
    });
  const confirmedCount = ride.pickupStatus.confirmedPassengers.length;
  const totalBookings = ride.bookings.filter((entry) => entry.status === 'confirmed')
    .length;

  const io = getRealtimeServer();
  if (io) {
    io.emit(`driver:pickup-confirmed:${ride.driverId}`, {
      rideId: ride._id,
      bookingId: booking._id,
      passengerClerkId,
      passengerName: getBookingDisplayName(booking),
      message: `${getBookingDisplayName(booking)} has confirmed boarding.`,
      confirmedCount,
      totalBookings,
    });
  }

  if (driverPushToken) {
    await sendPushToToken({
      pushToken: driverPushToken,
      title: 'Passenger Boarded',
      body: `${getBookingDisplayName(booking)} has confirmed boarding. ${confirmedCount}/${totalBookings} passengers confirmed.`,
      data: {
        type: 'pickup_confirmed',
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
      },
    });
  }

  return { booking, ride };
}

export async function cleanupExpiredRideOffersJob() {
  const now = new Date();
  const expirationBuffer = 5 * 60 * 1000;
  const recentUpdateThreshold = 2 * 60 * 1000;
  const estimatedTripDuration = 3 * 60 * 60 * 1000;

  const ridesForCompletion = await RideOffer.find({
    departureTime: { $lt: new Date(now - estimatedTripDuration) },
    status: { $in: ['ongoing', 'booked'] },
  });

  let completedCount = 0;
  for (const ride of ridesForCompletion) {
    normalizeOfferForSave(ride);
    ride.status = 'completed';
    ride.completedAt = now;
    await ride.save();
    completedCount++;
  }

  const expiredRides = await RideOffer.find({
    departureTime: { $lt: new Date(now - expirationBuffer) },
    status: { $in: ['waiting', 'accepted'] },
    updatedAt: { $lt: new Date(now - recentUpdateThreshold) },
  });

  let cancelledCount = 0;
  for (const ride of expiredRides) {
    const hasActiveBookings = ride.bookings?.some(
      (booking) => booking.status === 'confirmed',
    );
    if (!hasActiveBookings) {
      normalizeOfferForSave(ride);
      ride.status = 'cancelled';
      await ride.save();
      cancelledCount++;
    }
  }

  return {
    cancelledCount,
    completedCount,
  };
}
