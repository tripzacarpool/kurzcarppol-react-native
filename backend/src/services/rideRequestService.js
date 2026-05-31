import { UserProfile } from '../models/userProfile.model.js';
import { RideRequest } from '../models/rideRequest.model.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';
import {
  getDefaultSharedSeatLimit,
  getRequesterParticipant,
  normalizeVehicleType,
  recalculateRideRequestFareSplit,
  roundMoney,
} from './rideFareService.js';
import {
  buildRideNotification,
  notifyRidePartners,
} from './rideNotificationService.js';

class RideRequestError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function createRideRequestForPassenger(clerkId, payload = {}) {
  const {
    from,
    to,
    passengers = 1,
    vehicleType,
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
    scheduledDeparture,
    timeFlexibilityMinutes,
    requestedTotalFare,
    maxSharedSeats,
  } = payload;

  if (!from || !to) {
    throw new RideRequestError('Invalid ride request', {
      code: 'MISSING_FIELDS',
      details: '`from` and `to` are required',
    });
  }

  const parsedPassengers = Number.parseInt(passengers, 10);
  const sanitizedPassengers = Number.isFinite(parsedPassengers)
    ? Math.max(1, parsedPassengers)
    : 1;

  const sanitizedVehicleType = normalizeVehicleType(vehicleType);
  const sanitizedRequestedFare = roundMoney(requestedTotalFare);
  if (requestedTotalFare !== undefined && sanitizedRequestedFare <= 0) {
    throw new RideRequestError('Invalid booking price', {
      code: 'INVALID_REQUESTED_FARE',
      details: 'requestedTotalFare must be greater than 0',
    });
  }

  const requestedMaxSharedSeats = Number.parseInt(maxSharedSeats, 10);
  const sanitizedMaxSharedSeats = Number.isFinite(requestedMaxSharedSeats)
    ? Math.min(Math.max(requestedMaxSharedSeats, sanitizedPassengers), 6)
    : Math.max(
        sanitizedPassengers,
        getDefaultSharedSeatLimit(sanitizedVehicleType),
      );

  const now = Date.now();
  const requestedDeparture = scheduledDeparture || now;
  const departureDate = new Date(requestedDeparture);

  if (Number.isNaN(departureDate.getTime())) {
    throw new RideRequestError('Invalid departure time', {
      code: 'INVALID_DEPARTURE_TIME',
      details: 'scheduledDeparture must be a valid ISO date string or timestamp',
    });
  }

  if (departureDate.getTime() < now - 5 * 60 * 1000) {
    throw new RideRequestError('Departure time must be in the future', {
      code: 'DEPARTURE_IN_PAST',
      details: 'Please select a future time for the ride',
    });
  }

  const flexInput =
    timeFlexibilityMinutes === undefined || timeFlexibilityMinutes === null
      ? 60
      : Number(timeFlexibilityMinutes);
  const clampedFlex = Number.isFinite(flexInput)
    ? Math.min(Math.max(Math.round(flexInput), 0), 720)
    : 60;

  const earliestDeparture = new Date(
    departureDate.getTime() - clampedFlex * 60 * 1000,
  );
  const latestDeparture = new Date(
    departureDate.getTime() + clampedFlex * 60 * 1000,
  );

  const user = await UserProfile.findOne({ clerkId });
  if (!user) {
    throw new RideRequestError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: 'User profile does not exist',
    });
  }

  const rideRequest = new RideRequest({
    userId: user._id,
    clerkId,
    from,
    to,
    passengers: sanitizedPassengers,
    vehicleType: sanitizedVehicleType,
    notes: notes || '',
    womenOnly: womenOnly || false,
    pickupLatitude: pickupLatitude || null,
    pickupLongitude: pickupLongitude || null,
    pickupCity: pickupCity || null,
    pickupCountry: pickupCountry || null,
    dropoffLatitude: dropoffLatitude || null,
    dropoffLongitude: dropoffLongitude || null,
    dropoffCity: dropoffCity || null,
    dropoffCountry: dropoffCountry || null,
    fare: sanitizedRequestedFare,
    requestedTotalFare: sanitizedRequestedFare,
    driverGuaranteedFare: sanitizedRequestedFare,
    maxSharedSeats: sanitizedMaxSharedSeats,
    fareSplit: {
      totalFare: sanitizedRequestedFare,
      totalSeats: sanitizedPassengers,
      perSeatEstimate: sanitizedPassengers
        ? Math.ceil(sanitizedRequestedFare / sanitizedPassengers)
        : 0,
      driverGuaranteedFare: sanitizedRequestedFare,
      updatedAt: new Date(),
      participants: [
        getRequesterParticipant(
          {
            clerkId,
            passengers: sanitizedPassengers,
          },
          user,
        ),
      ],
    },
    scheduledDeparture: departureDate,
    earliestDeparture,
    latestDeparture,
    timeFlexibilityMinutes: clampedFlex,
    status: 'waiting',
  });

  recalculateRideRequestFareSplit(rideRequest);
  await rideRequest.save();

  await publishEvent(EventTypes.RideRequestCreated, {
    rideId: rideRequest._id.toString(),
    clerkId,
    from: rideRequest.from,
    to: rideRequest.to,
    passengers: rideRequest.passengers,
    vehicleType: rideRequest.vehicleType,
    scheduledDeparture: rideRequest.scheduledDeparture,
    status: rideRequest.status,
  });

  return rideRequest;
}

export async function createRideRequestForPassengerFlow(clerkId, payload = {}) {
  const rideRequest = await createRideRequestForPassenger(clerkId, payload);

  const io = getRealtimeServer();
  if (io) {
    io.emit('new_ride_request', {
      rideId: rideRequest._id,
      from: rideRequest.from,
      to: rideRequest.to,
      passengers: rideRequest.passengers,
      vehicleType: rideRequest.vehicleType,
      womenOnly: rideRequest.womenOnly,
      notes: rideRequest.notes,
      scheduledDeparture: rideRequest.scheduledDeparture,
      earliestDeparture: rideRequest.earliestDeparture,
      latestDeparture: rideRequest.latestDeparture,
      timeFlexibilityMinutes: rideRequest.timeFlexibilityMinutes,
      requestedTotalFare: rideRequest.requestedTotalFare,
      driverGuaranteedFare: rideRequest.driverGuaranteedFare,
      fareSplit: rideRequest.fareSplit,
      maxSharedSeats: rideRequest.maxSharedSeats,
      status: rideRequest.status,
      createdAt: rideRequest.createdAt,
      createdBy: clerkId,
    });
  }

  notifyRidePartners(
    buildRideNotification('ride_created', rideRequest, {
      action: 'view_request',
      data: {
        passengers: rideRequest.passengers,
        vehicleType: rideRequest.vehicleType,
        driverGuaranteedFare: rideRequest.driverGuaranteedFare,
      },
    }),
    { excludeClerkId: clerkId },
  ).catch((error) =>
    console.error('Ride request notification error:', error.message),
  );

  return rideRequest;
}

export function formatRideRequestResponse(rideRequest) {
  return {
    id: rideRequest._id,
    from: rideRequest.from,
    to: rideRequest.to,
    passengers: rideRequest.passengers,
    notes: rideRequest.notes,
    womenOnly: rideRequest.womenOnly,
    vehicleType: rideRequest.vehicleType,
    status: rideRequest.status,
    createdAt: rideRequest.createdAt,
    scheduledDeparture: rideRequest.scheduledDeparture,
    earliestDeparture: rideRequest.earliestDeparture,
    latestDeparture: rideRequest.latestDeparture,
    timeFlexibilityMinutes: rideRequest.timeFlexibilityMinutes,
    requestedTotalFare: rideRequest.requestedTotalFare,
    driverGuaranteedFare: rideRequest.driverGuaranteedFare,
    fareSplit: rideRequest.fareSplit,
    maxSharedSeats: rideRequest.maxSharedSeats,
  };
}

export async function getRideRequestsForPassenger(clerkId) {
  const user = await UserProfile.findOne({ clerkId });
  if (!user) {
    throw new RideRequestError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: 'User profile does not exist',
    });
  }

  const rides = await RideRequest.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(50);

  return rides.map((ride) => {
    const scheduledDeparture = ride.scheduledDeparture
      ? new Date(ride.scheduledDeparture).toISOString()
      : null;
    const earliestDeparture = ride.earliestDeparture
      ? new Date(ride.earliestDeparture).toISOString()
      : null;
    const latestDeparture = ride.latestDeparture
      ? new Date(ride.latestDeparture).toISOString()
      : null;

    return {
      id: ride._id,
      from: ride.from,
      to: ride.to,
      passengers: ride.passengers,
      notes: ride.notes,
      womenOnly: ride.womenOnly,
      vehicleType: ride.vehicleType,
      status: ride.status,
      createdAt: ride.createdAt,
      acceptedBy: ride.acceptedBy,
      requestedTotalFare: ride.requestedTotalFare || ride.fare || 0,
      driverGuaranteedFare: ride.driverGuaranteedFare || ride.fare || 0,
      maxSharedSeats:
        ride.maxSharedSeats || getDefaultSharedSeatLimit(ride.vehicleType),
      fareSplit: ride.fareSplit,
      scheduledDeparture,
      earliestDeparture,
      latestDeparture,
      timeFlexibilityMinutes:
        typeof ride.timeFlexibilityMinutes === 'number'
          ? ride.timeFlexibilityMinutes
          : ride.offeredByDriver
            ? 0
            : 60,
    };
  });
}
