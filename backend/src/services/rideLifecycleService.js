import mongoose from 'mongoose';
import { RideRequest } from '../models/rideRequest.model.js';
import { RideOffer } from '../models/rideOffer.model.js';
import { RideBooking } from '../models/rideBooking.model.js';
import { UserProfile } from '../models/userProfile.model.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';
import { locationService } from './locationService.js';
import { sendPushToToken } from './pushNotificationService.js';
import {
  buildRideNotification,
  notifyUsersByClerkId,
} from './rideNotificationService.js';
import {
  getDefaultSharedSeatLimit,
  getRequesterParticipant,
  recalculateRideRequestFareSplit,
  roundMoney,
} from './rideFareService.js';

class RideLifecycleError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const assertClerkId = (clerkId) => {
  if (!clerkId) {
    throw new RideLifecycleError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'clerkId is required',
    });
  }
};

const assertRideId = (rideId) => {
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new RideLifecycleError('Invalid ride ID format', {
      code: 'INVALID_RIDE_ID',
      details: `Ride ID "${rideId}" is not a valid format`,
    });
  }
};

const findRideRequest = async (rideId) => {
  assertRideId(rideId);

  const ride = await RideRequest.findById(rideId);
  if (!ride) {
    throw new RideLifecycleError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  return ride;
};

const findRequestOrOffer = async (rideId) => {
  assertRideId(rideId);

  let ride = await RideRequest.findById(rideId);
  if (ride) return { ride, rideType: 'request' };

  ride = await RideOffer.findById(rideId);
  if (ride) return { ride, rideType: 'offer' };

  throw new RideLifecycleError('Ride not found', {
    status: 404,
    code: 'RIDE_NOT_FOUND',
    details: `No ride found with ID ${rideId}`,
  });
};

export async function cancelRideRequest({ rideId, clerkId }) {
  assertClerkId(clerkId);

  if (rideId?.startsWith('local-')) {
    return {
      isLocal: true,
      ride: {
        id: rideId,
        status: 'cancelled',
        isLocal: true,
      },
    };
  }

  const ride = await findRideRequest(rideId);

  if (ride.clerkId !== clerkId) {
    throw new RideLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_RIDE_OWNER',
      details: 'You can only cancel your own rides',
    });
  }

  if (!['waiting', 'accepted'].includes(ride.status)) {
    throw new RideLifecycleError('Cannot cancel ride', {
      code: 'INVALID_RIDE_STATUS',
      details: `Ride cannot be cancelled when status is ${ride.status}`,
    });
  }

  ride.status = 'cancelled';
  await ride.save();

  await publishEvent(EventTypes.RideRequestCancelled, {
    rideId: ride._id.toString(),
    cancelledBy: clerkId,
    status: ride.status,
  });

  return {
    isLocal: false,
    ride,
  };
}

export async function acceptRideRequest({ rideId, driverClerkId }) {
  assertClerkId(driverClerkId);
  const [ride, driver] = await Promise.all([
    findRideRequest(rideId),
    UserProfile.findOne({ clerkId: driverClerkId }),
  ]);

  if (!driver) {
    throw new RideLifecycleError('Driver not found', {
      status: 404,
      code: 'DRIVER_NOT_FOUND',
    });
  }

  if (ride.status !== 'waiting') {
    throw new RideLifecycleError('Ride is no longer available', {
      code: 'RIDE_NOT_AVAILABLE',
    });
  }

  if (ride.clerkId === driverClerkId) {
    throw new RideLifecycleError('Drivers cannot accept their own ride request', {
      status: 403,
      code: 'DRIVER_CANNOT_ACCEPT_OWN_RIDE',
    });
  }

  ride.status = 'accepted';
  ride.driverGuaranteedFare = roundMoney(
    ride.driverGuaranteedFare || ride.requestedTotalFare || ride.fare,
  );
  ride.requestedTotalFare = ride.driverGuaranteedFare;
  ride.fare = ride.driverGuaranteedFare;
  recalculateRideRequestFareSplit(ride);
  ride.acceptedBy = {
    userId: driver._id,
    clerkId: driverClerkId,
    driverName: `${driver.firstName} ${driver.lastName}`.trim(),
    driverRating: driver.rating,
  };
  await ride.save();

  await publishEvent(EventTypes.RideRequestAccepted, {
    rideId: ride._id.toString(),
    driverId: driverClerkId,
    passengerId: ride.clerkId,
    driverGuaranteedFare: ride.driverGuaranteedFare,
    status: ride.status,
  });

  return ride;
}

export async function confirmRideRequestBooking({
  rideId,
  passengerClerkId,
  payload = {},
}) {
  assertClerkId(passengerClerkId);

  assertRideId(rideId);
  const ride = await RideRequest.findById(rideId).populate(
    'userId',
    'firstName lastName phone',
  );
  if (!ride) {
    throw new RideLifecycleError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
      details: `No ride found with ID ${rideId}`,
    });
  }

  if (ride.clerkId !== passengerClerkId) {
    throw new RideLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_RIDE_OWNER',
      details: 'Only the passenger can confirm this booking',
    });
  }

  if (!ride.acceptedBy?.clerkId) {
    throw new RideLifecycleError('Ride has not been accepted by a driver yet', {
      code: 'RIDE_NOT_ACCEPTED',
    });
  }

  const {
    seatNumbers = [],
    totalAmount = 0,
    paymentMethod = 'unknown',
    customRequest = '',
    pickupEta,
    passengerPhone,
  } = payload;

  const existingParticipants = ride.fareSplit?.participants || [];
  if (
    !existingParticipants.some(
      (participant) => participant.clerkId === passengerClerkId,
    )
  ) {
    ride.fareSplit = {
      ...(ride.fareSplit?.toObject?.() || ride.fareSplit || {}),
      participants: [
        ...existingParticipants,
        getRequesterParticipant(ride, ride.userId, {
          passengerPhone,
          paymentMethod,
        }),
      ],
    };
  } else {
    ride.fareSplit.participants = existingParticipants.map((participant) =>
      participant.clerkId === passengerClerkId
        ? {
            ...(participant.toObject?.() || participant),
            paymentMethod,
            phone: passengerPhone || participant.phone,
            status: 'confirmed',
          }
        : participant,
    );
  }

  const fareSplit = recalculateRideRequestFareSplit(ride);
  const requesterShare =
    fareSplit.participants.find(
      (participant) => participant.clerkId === passengerClerkId,
    )?.shareAmount || totalAmount;

  ride.bookingDetails = {
    confirmedAt: new Date(),
    seatNumbers,
    totalAmount: requesterShare,
    paymentMethod,
    customRequest,
    passengerName:
      `${ride.userId?.firstName || ''} ${ride.userId?.lastName || ''}`.trim() ||
      'Passenger',
    passengerPhone: passengerPhone || ride.userId?.phone || null,
    pickupEta: pickupEta ? new Date(pickupEta) : null,
  };
  ride.status = 'booked';
  ride.updatedAt = new Date();
  await ride.save();

  await publishEvent(EventTypes.RideRequestBooked, {
    rideId: ride._id.toString(),
    passengerId: passengerClerkId,
    driverId: ride.acceptedBy?.clerkId,
    status: ride.status,
    fareSplit,
  });

  return {
    ride,
    requesterShare,
  };
}

export async function joinRideRequestByPassenger({
  rideId,
  passengerClerkId,
  payload = {},
}) {
  assertClerkId(passengerClerkId);

  const { seatCount = 1, passengerPhone, paymentMethod = 'unknown' } = payload;
  const sanitizedSeatCount = Math.max(1, Math.min(Number(seatCount) || 1, 4));
  const [ride, passenger] = await Promise.all([
    findRideRequest(rideId),
    UserProfile.findOne({ clerkId: passengerClerkId }),
  ]);

  if (!passenger) {
    throw new RideLifecycleError('Passenger profile not found', {
      status: 404,
      code: 'PASSENGER_NOT_FOUND',
    });
  }

  if (!['accepted', 'booked'].includes(ride.status)) {
    throw new RideLifecycleError('Ride is not joinable yet', {
      code: 'RIDE_NOT_JOINABLE',
      details: 'A driver must accept the ride before other passengers can join',
    });
  }

  if (ride.clerkId === passengerClerkId) {
    throw new RideLifecycleError('Requester is already in this ride', {
      code: 'REQUESTER_ALREADY_JOINED',
    });
  }

  const participants = ride.fareSplit?.participants || [];
  if (
    participants.some(
      (participant) =>
        participant.clerkId === passengerClerkId &&
        participant.status !== 'cancelled',
    )
  ) {
    throw new RideLifecycleError('Passenger already joined', {
      status: 409,
      code: 'ALREADY_JOINED',
    });
  }

  const currentSeats = participants
    .filter((participant) => participant.status !== 'cancelled')
    .reduce((sum, participant) => sum + (Number(participant.seatCount) || 1), 0);
  const maxSharedSeats =
    ride.maxSharedSeats || getDefaultSharedSeatLimit(ride.vehicleType);

  if (currentSeats + sanitizedSeatCount > maxSharedSeats) {
    throw new RideLifecycleError('Not enough seats available', {
      code: 'NO_SEATS_AVAILABLE',
      details: `${Math.max(0, maxSharedSeats - currentSeats)} seat(s) available`,
    });
  }

  const passengerName =
    `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() ||
    passenger.email ||
    'Passenger';
  ride.fareSplit = {
    ...(ride.fareSplit?.toObject?.() || ride.fareSplit || {}),
    participants: [
      ...participants,
      {
        clerkId: passengerClerkId,
        userId: passenger._id,
        name: passengerName,
        phone: passengerPhone || passenger.phone || '',
        seatCount: sanitizedSeatCount,
        role: 'joiner',
        paymentMethod,
        status: 'confirmed',
        joinedAt: new Date(),
      },
    ],
  };
  ride.status = 'booked';
  ride.updatedAt = new Date();
  const fareSplit = recalculateRideRequestFareSplit(ride);
  await ride.save();

  const passengerShare = fareSplit.participants.find(
    (participant) => participant.clerkId === passengerClerkId,
  )?.shareAmount;
  const availableSeats = Math.max(0, maxSharedSeats - fareSplit.totalSeats);

  await publishEvent(EventTypes.RideRequestJoined, {
    rideId: ride._id.toString(),
    passengerId: passengerClerkId,
    driverId: ride.acceptedBy?.clerkId,
    passengerShare,
    availableSeats,
  });

  return {
    availableSeats,
    fareSplit,
    passengerName,
    passengerShare,
    ride,
  };
}

export async function confirmDriverPickup({ rideId, driverClerkId }) {
  assertClerkId(driverClerkId);
  const ride = await findRideRequest(rideId);

  if (ride.acceptedBy?.clerkId !== driverClerkId) {
    throw new RideLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_ASSIGNED_DRIVER',
      details: 'Only the assigned driver can confirm pickup',
    });
  }

  ride.pickupStatus = {
    ...ride.pickupStatus,
    driverConfirmedAt: new Date(),
  };
  ride.status = 'ongoing';
  ride.updatedAt = new Date();
  await ride.save();

  await publishEvent(EventTypes.RidePickupDriverConfirmed, {
    rideId: ride._id.toString(),
    driverId: driverClerkId,
    passengerId: ride.clerkId,
    status: ride.status,
  });

  return ride;
}

export async function confirmDriverStart({ rideId, driverClerkId }) {
  assertClerkId(driverClerkId);
  const ride = await findRideRequest(rideId);

  if (ride.acceptedBy?.clerkId !== driverClerkId) {
    throw new RideLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_ASSIGNED_DRIVER',
      details: 'Only the assigned driver can confirm start',
    });
  }

  ride.status = 'in_progress';
  ride.pickupStatus = {
    ...ride.pickupStatus,
    driverConfirmedAt: new Date(),
  };
  ride.updatedAt = new Date();
  await ride.save();

  await publishEvent(EventTypes.RideStarted, {
    rideId: ride._id.toString(),
    driverId: driverClerkId,
    passengerId: ride.clerkId,
    status: ride.status,
  });

  return ride;
}

export async function requestRideStart({ rideId, passengerClerkId }) {
  assertClerkId(passengerClerkId);
  const ride = await findRideRequest(rideId);

  if (ride.clerkId !== passengerClerkId) {
    throw new RideLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_RIDE_OWNER',
      details: 'Only the passenger can start the ride',
    });
  }

  if (!ride.acceptedBy?.clerkId) {
    throw new RideLifecycleError('Bad Request', {
      code: 'NO_DRIVER',
      details: 'Ride must be accepted by a driver first',
    });
  }

  ride.status = 'awaiting_driver_confirmation';
  ride.updatedAt = new Date();
  await ride.save();

  await publishEvent(EventTypes.RideStartRequested, {
    rideId: ride._id.toString(),
    passengerId: passengerClerkId,
    driverId: ride.acceptedBy.clerkId,
    status: ride.status,
  });

  return ride;
}

export async function confirmPassengerPickup({ rideId, passengerClerkId }) {
  assertClerkId(passengerClerkId);
  const { ride, rideType } = await findRequestOrOffer(rideId);

  if (rideType === 'offer') {
    const hasBooking = ride.bookings?.some(
      (booking) => booking.passengerClerkId === passengerClerkId,
    );
    const bookingRecord = hasBooking
      ? null
      : await RideBooking.findOne({
          rideId: ride._id,
          passengerId: passengerClerkId,
          approvalStatus: {
            $in: ['auto_accepted', 'approved', 'confirmed', 'pending_passenger'],
          },
        }).sort({ createdAt: -1 });

    if (!hasBooking && !bookingRecord) {
      throw new RideLifecycleError('Forbidden', {
        status: 403,
        code: 'NO_BOOKING',
        details: 'You do not have an active booking for this ride',
      });
    }

    if (!hasBooking && bookingRecord) {
      ride.bookings = ride.bookings || [];
      ride.bookings.push({
        _id: bookingRecord._id,
        userId: bookingRecord.passengerId,
        passengerClerkId: bookingRecord.passengerId,
        passengerName: bookingRecord.userDetails?.name || 'Passenger',
        passengerPhone: bookingRecord.userDetails?.phone,
        seatNumbers: bookingRecord.seatNumbers,
        totalAmount: bookingRecord.fare,
        paymentMethod: bookingRecord.paymentMethod || 'unknown',
        status: 'confirmed',
        bookedAt: bookingRecord.createdAt || new Date(),
        customRequest: bookingRecord.customRequest,
      });
    }

    if (!ride.pickupStatus) {
      ride.pickupStatus = { confirmedPassengers: [] };
    }
    if (!ride.pickupStatus.confirmedPassengers) {
      ride.pickupStatus.confirmedPassengers = [];
    }
    if (!ride.pickupStatus.confirmedPassengers.includes(passengerClerkId)) {
      ride.pickupStatus.confirmedPassengers.push(passengerClerkId);
    }
    if (ride.status === 'waiting') {
      ride.status = 'ongoing';
    }
    ride.updatedAt = new Date();
    await ride.save();

    await publishEvent(EventTypes.RidePickupPassengerConfirmed, {
      rideId: ride._id.toString(),
      rideType,
      driverId: ride.clerkId,
      passengerId: passengerClerkId,
      status: ride.status,
    });

    const driver = await UserProfile.findOne({ clerkId: ride.clerkId }).select(
      'pushToken',
    );

    return {
      ride,
      rideType,
      driverClerkId: ride.clerkId,
      passengerClerkId,
      driverPushToken: driver?.pushToken,
    };
  }

  if (ride.clerkId !== passengerClerkId) {
    throw new RideLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_RIDE_OWNER',
      details: 'Only the passenger can confirm pickup',
    });
  }

  ride.pickupStatus = {
    ...ride.pickupStatus,
    passengerConfirmedAt: new Date(),
  };
  if (ride.status !== 'ongoing') {
    ride.status = 'ongoing';
  }
  ride.updatedAt = new Date();
  await ride.save();

  await publishEvent(EventTypes.RidePickupPassengerConfirmed, {
    rideId: ride._id.toString(),
    rideType,
    driverId: ride.acceptedBy?.clerkId,
    passengerId: passengerClerkId,
    status: ride.status,
  });

  const driver = ride.acceptedBy?.clerkId
    ? await UserProfile.findOne({ clerkId: ride.acceptedBy.clerkId }).select(
        'pushToken',
      )
    : null;

  return {
    ride,
    rideType,
    driverClerkId: ride.acceptedBy?.clerkId,
    passengerClerkId,
    driverPushToken: driver?.pushToken,
  };
}

const creditDriverEarnings = async ({ driverClerkId, ride, grossAmount }) => {
  if (!grossAmount || !driverClerkId) return null;

  const platformFee = grossAmount * 0.07;
  const driverEarnings = grossAmount - platformFee;
  const driver = await UserProfile.findOne({ clerkId: driverClerkId }).select(
    'walletBalance',
  );
  if (!driver) return null;

  const nextBalance = (driver.walletBalance || 0) + driverEarnings;
  await UserProfile.updateOne(
    { clerkId: driverClerkId },
    {
      $set: { walletBalance: nextBalance },
      $push: {
        walletTransactions: {
    type: 'credit',
    amount: driverEarnings,
            balance: nextBalance,
    description: `Ride earnings (Rs ${grossAmount} - 7% fee)`,
    rideDetails: {
      rideId: ride._id,
      from: ride.from,
      to: ride.to,
      platformFee,
    },
    timestamp: new Date(),
    transactionId: `txn_${Date.now()}`,
        },
      },
    },
  );

  return {
    driverEarnings,
    platformFee,
  };
};

export async function completePassengerRide({ rideId, passengerClerkId }) {
  assertClerkId(passengerClerkId);
  const { ride, rideType } = await findRequestOrOffer(rideId);

  if (rideType === 'offer') {
    const hasBooking = ride.bookings?.some(
      (booking) => booking.passengerClerkId === passengerClerkId,
    );

    if (!hasBooking) {
      throw new RideLifecycleError('Forbidden', {
        status: 403,
        code: 'NO_BOOKING',
        details: 'You do not have a booking for this ride',
      });
    }

    ride.dropoffStatus = ride.dropoffStatus || { confirmedPassengers: [] };
    ride.dropoffStatus.confirmedPassengers =
      ride.dropoffStatus.confirmedPassengers || [];

    if (!ride.dropoffStatus.confirmedPassengers.includes(passengerClerkId)) {
      ride.dropoffStatus.confirmedPassengers.push(passengerClerkId);
    }

    ride.dropoffStatus.completedAt = new Date();

    const allPassengersConfirmed = (ride.bookings || []).every((booking) =>
      ride.dropoffStatus.confirmedPassengers.includes(booking.passengerClerkId),
    );

    let earnings = null;
    if (allPassengersConfirmed) {
      ride.status = 'completed';
      ride.completedAt = new Date();
      const totalEarnings = (ride.bookings || []).reduce(
        (sum, booking) => sum + (booking.totalAmount || 0),
        0,
      );
      earnings = await creditDriverEarnings({
        driverClerkId: ride.clerkId,
        ride,
        grossAmount: totalEarnings,
      });
    }

    ride.updatedAt = new Date();
    await ride.save();

    await publishEvent(EventTypes.RideCompleted, {
      rideId: ride._id.toString(),
      rideType,
      passengerId: passengerClerkId,
      driverId: ride.clerkId,
      status: ride.status,
      allPassengersConfirmed,
    });

    return {
      ride,
      rideType,
      allPassengersConfirmed,
      driverClerkId: ride.clerkId,
      passengerClerkId,
      trackingDriverId: allPassengersConfirmed ? ride.clerkId : null,
      earnings,
    };
  }

  if (ride.clerkId !== passengerClerkId) {
    throw new RideLifecycleError('Forbidden', {
      status: 403,
      code: 'NOT_RIDE_OWNER',
      details: 'Only the passenger can complete the ride',
    });
  }

  const earnings = await creditDriverEarnings({
    driverClerkId: ride.acceptedBy?.clerkId,
    ride,
    grossAmount: ride.fare,
  });

  ride.dropoffStatus = {
    ...ride.dropoffStatus,
    passengerConfirmedAt: new Date(),
    completedAt: new Date(),
  };
  ride.status = 'completed';
  ride.completedAt = new Date();
  ride.updatedAt = new Date();
  await ride.save();

  await publishEvent(EventTypes.RideCompleted, {
    rideId: ride._id.toString(),
    rideType,
    passengerId: passengerClerkId,
    driverId: ride.acceptedBy?.clerkId,
    status: ride.status,
    allPassengersConfirmed: true,
  });

  return {
    ride,
    rideType,
    allPassengersConfirmed: true,
    driverClerkId: ride.acceptedBy?.clerkId,
    passengerClerkId,
    trackingDriverId: ride.acceptedBy?.clerkId,
    earnings,
  };
}

export async function extendRideRequestDeparture({
  rideId,
  clerkId,
  newDepartureTime,
  extensionMinutes,
}) {
  assertClerkId(clerkId);

  if (!newDepartureTime && !extensionMinutes) {
    throw new RideLifecycleError('Either newDepartureTime or extensionMinutes is required', {
      code: 'MISSING_EXTENSION_INPUT',
    });
  }

  const ride = await findRideRequest(rideId);
  if (ride.clerkId !== clerkId) {
    throw new RideLifecycleError('Only the ride creator can extend the time', {
      status: 403,
      code: 'NOT_RIDE_CREATOR',
    });
  }

  let updatedDepartureTime;
  if (newDepartureTime) {
    updatedDepartureTime = new Date(newDepartureTime);
  } else {
    const currentTime = new Date(ride.departureTime);
    updatedDepartureTime = new Date(
      currentTime.getTime() + Number(extensionMinutes) * 60000,
    );
  }

  if (Number.isNaN(updatedDepartureTime.getTime())) {
    throw new RideLifecycleError('Invalid departure time', {
      code: 'INVALID_DEPARTURE_TIME',
    });
  }

  ride.departureTime = updatedDepartureTime;
  await ride.save();

  return { ride, updatedDepartureTime };
}

export async function cleanupExpiredRideRequests() {
  const now = new Date();
  const expirationTime = new Date(now.getTime() - 5 * 60000);
  const estimatedTripDuration = 3 * 60 * 60 * 1000;

  const ridesForCompletion = await RideRequest.find({
    $or: [
      { scheduledDeparture: { $lt: new Date(now - estimatedTripDuration) } },
      { earliestDeparture: { $lt: new Date(now - estimatedTripDuration) } },
    ],
    status: { $in: ['ongoing', 'booked'] },
  });

  let completedCount = 0;
  for (const ride of ridesForCompletion) {
    ride.status = 'completed';
    ride.completedAt = now;
    await ride.save();
    completedCount++;
  }

  const expiredRides = await RideRequest.find({
    $or: [
      { scheduledDeparture: { $lt: expirationTime } },
      { earliestDeparture: { $lt: expirationTime } },
    ],
    status: { $in: ['waiting', 'accepted'] },
  });

  const cancelledRides = [];
  for (const ride of expiredRides) {
    ride.status = 'cancelled';
    await ride.save();
    cancelledRides.push(ride);
  }

  return {
    cancelledCount: cancelledRides.length,
    cancelledRides,
    completedCount,
  };
}

export async function acceptRideRequestFlow({ rideId, driverClerkId }) {
  const ride = await acceptRideRequest({ rideId, driverClerkId });

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:accepted', {
      rideId: ride._id,
      status: ride.status,
      acceptedBy: ride.acceptedBy,
      driverGuaranteedFare: ride.driverGuaranteedFare,
      fareSplit: ride.fareSplit,
      driverClerkId,
      passengerClerkId: ride.clerkId,
      from: ride.from,
      to: ride.to,
      pickup: {
        latitude: ride.pickupLatitude,
        longitude: ride.pickupLongitude,
        address: ride.from,
      },
      dropoff: {
        latitude: ride.dropoffLatitude,
        longitude: ride.dropoffLongitude,
        address: ride.to,
      },
    });
  }

  notifyUsersByClerkId(
    [ride.clerkId],
    buildRideNotification('ride_accepted', ride, {
      driverName: ride.acceptedBy.driverName,
      action: 'confirm_booking',
      data: {
        driverClerkId,
        driverGuaranteedFare: ride.driverGuaranteedFare,
        fareSplit: ride.fareSplit,
      },
    }),
  ).catch((error) =>
    console.error('Ride accepted notification error:', error.message),
  );

  return ride;
}

export async function confirmRideRequestBookingFlow({
  rideId,
  passengerClerkId,
  payload,
}) {
  const result = await confirmRideRequestBooking({
    rideId,
    passengerClerkId,
    payload,
  });
  const { requesterShare, ride } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:booked', {
      rideId: ride._id,
      driverClerkId: ride.acceptedBy?.clerkId,
      passengerClerkId: ride.clerkId,
      status: ride.status,
      bookingDetails: ride.bookingDetails,
      from: ride.from,
      to: ride.to,
      pickup: {
        latitude: ride.pickupLatitude,
        longitude: ride.pickupLongitude,
        address: ride.from,
      },
      dropoff: {
        latitude: ride.dropoffLatitude,
        longitude: ride.dropoffLongitude,
        address: ride.to,
      },
    });
  }

  notifyUsersByClerkId(
    [ride.acceptedBy?.clerkId],
    buildRideNotification('ride_booked', ride, {
      passengerName: ride.bookingDetails.passengerName,
      shareAmount: requesterShare,
      action: 'view_booking',
      data: {
        passengerClerkId: ride.clerkId,
        bookingDetails: ride.bookingDetails,
        fareSplit: ride.fareSplit,
      },
    }),
  ).catch((error) =>
    console.error('Ride booking notification error:', error.message),
  );

  return result;
}

export async function joinRideRequestByPassengerFlow({
  rideId,
  passengerClerkId,
  payload,
}) {
  const result = await joinRideRequestByPassenger({
    rideId,
    passengerClerkId,
    payload,
  });
  const { availableSeats, fareSplit, passengerName, passengerShare, ride } =
    result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:fare-split-updated', {
      rideId: ride._id,
      status: ride.status,
      fareSplit,
      driverGuaranteedFare: ride.driverGuaranteedFare,
      availableSeats,
      driverClerkId: ride.acceptedBy?.clerkId,
      passengerClerkIds: fareSplit.participants
        .map((participant) => participant.clerkId)
        .filter(Boolean),
    });
  }

  notifyUsersByClerkId(
    [ride.clerkId, ride.acceptedBy?.clerkId, passengerClerkId],
    buildRideNotification('ride_joined', ride, {
      passengerName,
      perSeatEstimate: fareSplit.perSeatEstimate,
      action: 'view_fare_split',
      data: {
        joinedPassengerClerkId: passengerClerkId,
        passengerShare,
        fareSplit,
        availableSeats,
      },
    }),
  ).catch((error) =>
    console.error('Fare split notification error:', error.message),
  );

  return result;
}

export async function confirmDriverPickupFlow({ rideId, driverClerkId }) {
  const ride = await confirmDriverPickup({ rideId, driverClerkId });

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:pickup-driver', {
      rideId: ride._id,
      driverClerkId: ride.acceptedBy?.clerkId,
      passengerClerkId: ride.clerkId,
      status: ride.status,
      pickupStatus: ride.pickupStatus,
      pickup: {
        latitude: ride.pickupLatitude,
        longitude: ride.pickupLongitude,
        address: ride.from,
      },
      dropoff: {
        latitude: ride.dropoffLatitude,
        longitude: ride.dropoffLongitude,
        address: ride.to,
      },
    });
  }

  notifyUsersByClerkId(
    [ride.clerkId],
    buildRideNotification('pickup_driver_confirmed', ride, {
      driverName: ride.acceptedBy?.driverName,
      data: {
        driverClerkId: ride.acceptedBy?.clerkId,
        pickupStatus: ride.pickupStatus,
      },
    }),
  ).catch((error) =>
    console.error('Driver pickup notification error:', error.message),
  );

  return ride;
}

export async function confirmPassengerPickupFlow({ rideId, passengerClerkId }) {
  const result = await confirmPassengerPickup({ rideId, passengerClerkId });
  const { ride, rideType, driverClerkId, driverPushToken } = result;

  if (driverPushToken) {
    await sendPushToToken({
      pushToken: driverPushToken,
      title: 'Passenger Confirmed Pickup',
      body: 'Your passenger has confirmed pickup. Start the ride now!',
      data: {
        type: 'passenger_pickup_confirmed',
        rideId: ride._id.toString(),
        rideType,
      },
    });
  }

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:pickup-passenger', {
      rideId: ride._id,
      rideType,
      driverClerkId,
      passengerClerkId,
      status: ride.status,
      pickupStatus: ride.pickupStatus,
    });
  }

  return result;
}

export async function completePassengerRideFlow({ rideId, passengerClerkId }) {
  const result = await completePassengerRide({ rideId, passengerClerkId });
  const {
    allPassengersConfirmed,
    driverClerkId,
    ride,
    rideType,
    trackingDriverId,
  } = result;

  if (trackingDriverId) {
    locationService.endRide(ride._id.toString(), trackingDriverId);
  }

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:completed', {
      rideId: ride._id,
      rideType,
      driverClerkId,
      passengerClerkId,
      status: ride.status,
      dropoffStatus: ride.dropoffStatus,
    });
  }

  notifyUsersByClerkId(
    [driverClerkId, passengerClerkId].filter(Boolean),
    buildRideNotification('ride_completed', ride, {
      rideType,
      data: {
        driverClerkId,
        passengerClerkId,
        allPassengersConfirmed,
      },
    }),
  ).catch((error) =>
    console.error('Ride completion notification error:', error.message),
  );

  return result;
}

export async function requestRideStartFlow({ rideId, passengerClerkId }) {
  const ride = await requestRideStart({ rideId, passengerClerkId });

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:start_requested', {
      rideId: ride._id,
      driverClerkId: ride.acceptedBy.clerkId,
      passengerClerkId: ride.clerkId,
      passengerName: ride.passenger,
    });
  }

  notifyUsersByClerkId(
    [ride.acceptedBy.clerkId],
    buildRideNotification('ride_start_requested', ride, {
      passengerName: ride.passenger || 'Passenger',
      action: 'confirm_start',
      data: {
        passengerClerkId: ride.clerkId,
      },
    }),
  ).catch((error) =>
    console.error('Ride start request notification error:', error.message),
  );

  return ride;
}

export async function confirmDriverStartFlow({ rideId, driverClerkId }) {
  const ride = await confirmDriverStart({ rideId, driverClerkId });

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:started', {
      rideId: ride._id,
      driverClerkId: ride.acceptedBy.clerkId,
      passengerClerkId: ride.clerkId,
      status: 'in_progress',
    });
  }

  notifyUsersByClerkId(
    [ride.clerkId],
    buildRideNotification('ride_started', ride, {
      data: {
        driverClerkId: ride.acceptedBy.clerkId,
      },
    }),
  ).catch((error) =>
    console.error('Ride started notification error:', error.message),
  );

  return ride;
}

export async function cancelRideRequestFlow({ rideId, clerkId }) {
  const result = await cancelRideRequest({ rideId, clerkId });
  if (result.isLocal) {
    return result;
  }

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:cancelled', {
      id: result.ride._id,
      status: result.ride.status,
      cancelledBy: clerkId,
    });
  }

  return result;
}

export async function extendRideRequestDepartureFlow({
  rideId,
  clerkId,
  newDepartureTime,
  extensionMinutes,
}) {
  const result = await extendRideRequestDeparture({
    rideId,
    clerkId,
    newDepartureTime,
    extensionMinutes,
  });
  const { ride, updatedDepartureTime } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('ride:time-extended', {
      rideId: ride._id,
      newDepartureTime: updatedDepartureTime,
      from: ride.from,
      to: ride.to,
    });
  }

  return result;
}

export async function cleanupExpiredRideRequestsFlow() {
  const result = await cleanupExpiredRideRequests();

  const io = getRealtimeServer();
  if (io) {
    result.cancelledRides.forEach((ride) => {
      io.emit('ride:expired', {
        rideId: ride._id,
        from: ride.from,
        to: ride.to,
      });
    });
  }

  return result;
}
