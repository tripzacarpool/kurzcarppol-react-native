import { RideRequest } from '../models/rideRequest.model.js';
import { UserProfile } from '../models/userProfile.model.js';
import { getDefaultSharedSeatLimit } from './rideFareService.js';

class RideDiscoveryError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const assertClerkId = (clerkId) => {
  if (!clerkId) {
    throw new RideDiscoveryError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'clerkId is required',
    });
  }
};

const DEFAULT_DRIVER_PICKUP_RADIUS_KM = 12;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toRadians = (degrees) => degrees * (Math.PI / 180);

const getDistanceKm = (from, to) => {
  const fromLat = toNumber(from?.latitude);
  const fromLng = toNumber(from?.longitude);
  const toLat = toNumber(to?.latitude);
  const toLng = toNumber(to?.longitude);

  if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const withinDriverPickupArea = (ride, driverLocation, radiusKm) => {
  if (!driverLocation) return false;

  const pickupDistanceKm = getDistanceKm(
    {
      latitude: ride.pickupLatitude,
      longitude: ride.pickupLongitude,
    },
    driverLocation,
  );

  if (pickupDistanceKm !== null) {
    return pickupDistanceKm <= radiusKm;
  }

  const rideCity = (ride.pickupCity || '').trim().toLowerCase();
  const driverCity = (driverLocation.city || '').trim().toLowerCase();
  return Boolean(rideCity && driverCity && rideCity === driverCity);
};

const toAvailableRideResponse = (ride, type) => {
  const fallbackNow = new Date();
  const scheduledDepartureDate = ride.scheduledDeparture
    ? new Date(ride.scheduledDeparture)
    : ride.departureTime
      ? new Date(ride.departureTime)
      : null;
  const earliestDepartureDate = ride.earliestDeparture
    ? new Date(ride.earliestDeparture)
    : scheduledDepartureDate;
  const latestDepartureDate = ride.latestDeparture
    ? new Date(ride.latestDeparture)
    : scheduledDepartureDate;
  const timeFlexibilityMinutes =
    typeof ride.timeFlexibilityMinutes === 'number'
      ? ride.timeFlexibilityMinutes
      : ride.offeredByDriver
        ? 0
        : 60;

  const base = {
    id: ride._id,
    clerkId: ride.clerkId,
    from: ride.from,
    to: ride.to,
    passengers: ride.passengers,
    notes: ride.notes,
    womenOnly: ride.womenOnly,
    vehicleType: ride.vehicleType,
    status: ride.status,
    createdAt: ride.createdAt,
    pickupLatitude: ride.pickupLatitude,
    pickupLongitude: ride.pickupLongitude,
    pickupCity: ride.pickupCity,
    pickupCountry: ride.pickupCountry,
    dropoffLatitude: ride.dropoffLatitude,
    dropoffLongitude: ride.dropoffLongitude,
    dropoffCity: ride.dropoffCity,
    dropoffCountry: ride.dropoffCountry,
    bookingDetails: ride.bookingDetails,
    requestedTotalFare: ride.requestedTotalFare || ride.fare || 0,
    driverGuaranteedFare: ride.driverGuaranteedFare || ride.fare || 0,
    maxSharedSeats:
      ride.maxSharedSeats || getDefaultSharedSeatLimit(ride.vehicleType),
    fareSplit: ride.fareSplit,
    pickupStatus: ride.pickupStatus,
    dropoffStatus: ride.dropoffStatus,
    scheduledDeparture: scheduledDepartureDate
      ? scheduledDepartureDate.toISOString()
      : null,
    earliestDeparture: earliestDepartureDate
      ? earliestDepartureDate.toISOString()
      : null,
    latestDeparture: latestDepartureDate
      ? latestDepartureDate.toISOString()
      : null,
    timeFlexibilityMinutes,
  };

  if (type === 'offers') {
    return {
      ...base,
      kind: 'offer',
      driverId: ride.clerkId,
      driverMode: ride.driverMode || 'commuter',
      farePerSeat: ride.farePerSeat || ride.fare || 100,
      departureTime: (scheduledDepartureDate || fallbackNow).toISOString(),
      vehicle: {
        model: ride.vehicleModel || 'Vehicle',
        number: ride.vehicleNumber || 'N/A',
        color: ride.vehicleColor || 'Unknown',
      },
      driver: {
        name: `${ride.userId?.firstName || 'Unknown'} ${ride.userId?.lastName || ''}`.trim(),
        rating: ride.userId?.rating || 5,
        gender: ride.userId?.gender || 'other',
        ridesCompleted: ride.userId?.ridesCompleted || 0,
        profileImage: ride.userId?.profileImage,
      },
      availableSeats: Array.from(
        { length: Math.max(0, ride.passengers - (ride.bookedSeats || 0)) },
        (_, i) => i + 1,
      ),
      totalSeats: ride.passengers || 4,
    };
  }

  return {
    ...base,
    kind: 'request',
    driverMode: ride.driverMode || 'commuter',
    departureTime: (scheduledDepartureDate || fallbackNow).toISOString(),
    vehicle: {
      model: ride.vehicleModel || 'Vehicle',
      number: ride.vehicleNumber || 'N/A',
      color: ride.vehicleColor || 'Unknown',
    },
    passenger: {
      name: `${ride.userId?.firstName || 'Unknown'} ${ride.userId?.lastName || ''}`.trim(),
      rating: ride.userId?.rating || 5,
      gender: ride.userId?.gender || 'other',
      ridesCompleted: ride.userId?.ridesCompleted || 0,
      profileImage: ride.userId?.profileImage,
    },
    farePerSeat:
      ride.fareSplit?.perSeatEstimate ||
      Math.ceil(
        (ride.requestedTotalFare || ride.fare || 0) /
          Math.max(1, ride.passengers || 1),
      ),
    fare: ride.requestedTotalFare || ride.fare || 0,
    requestedTotalFare: ride.requestedTotalFare || ride.fare || 0,
    driverGuaranteedFare: ride.driverGuaranteedFare || ride.fare || 0,
    availableSeats: Array.from(
      {
        length: Math.max(
          0,
          (ride.maxSharedSeats || getDefaultSharedSeatLimit(ride.vehicleType)) -
            (ride.fareSplit?.totalSeats || ride.passengers || 0),
        ),
      },
      (_, i) => i + 1,
    ),
    totalSeats: ride.maxSharedSeats || getDefaultSharedSeatLimit(ride.vehicleType),
  };
};

export async function getAvailableRideRequests({
  clerkId,
  type = 'requests',
  joinable = false,
  targetTime,
  windowMinutes = 60,
  pickupRadiusKm = DEFAULT_DRIVER_PICKUP_RADIUS_KM,
}) {
  assertClerkId(clerkId);

  const query = joinable
    ? { status: { $in: ['accepted', 'booked'] } }
    : { status: 'waiting' };
  const andConditions = [];

  if (!joinable) {
    andConditions.push({
      $or: [
        { latestDeparture: { $exists: false } },
        { latestDeparture: { $gte: new Date() } },
      ],
    });
  }

  if (targetTime) {
    const parsedTargetTime = new Date(targetTime);
    if (!Number.isNaN(parsedTargetTime.getTime())) {
      const boundedWindow = Math.min(Math.max(Number(windowMinutes) || 60, 0), 720);
      const windowMs = boundedWindow * 60 * 1000;
      andConditions.push({
        latestDeparture: {
          $gte: new Date(parsedTargetTime.getTime() - windowMs),
        },
      });
      andConditions.push({
        earliestDeparture: {
          $lte: new Date(parsedTargetTime.getTime() + windowMs),
        },
      });
    }
  }

  if (type === 'offers') {
    query.offeredByDriver = true;
  } else {
    query.$or = [
      { offeredByDriver: { $exists: false } },
      { offeredByDriver: false },
    ];
    if (joinable) {
      andConditions.push({ acceptedBy: { $exists: true } });
      andConditions.push({
        $expr: {
          $lt: [
            { $ifNull: ['$fareSplit.totalSeats', '$passengers'] },
            {
              $ifNull: [
                '$maxSharedSeats',
                getDefaultSharedSeatLimit(query.vehicleType),
              ],
            },
          ],
        },
      });
    }
  }

  query.clerkId = { $ne: clerkId };
  if (andConditions.length) {
    query.$and = [...(query.$and || []), ...andConditions];
  }

  const availableRides = await RideRequest.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('userId', 'firstName lastName profileImage rating gender ridesCompleted');

  if (type === 'requests' && !joinable) {
    const driver = await UserProfile.findOne({ clerkId })
      .select('location city country role')
      .lean();
    const driverLocation = driver?.location;
    const boundedRadius = Math.min(
      Math.max(Number(pickupRadiusKm) || DEFAULT_DRIVER_PICKUP_RADIUS_KM, 1),
      50,
    );

    return availableRides
      .filter((ride) => withinDriverPickupArea(ride, driverLocation, boundedRadius))
      .map((ride) => toAvailableRideResponse(ride, type));
  }

  return availableRides.map((ride) => toAvailableRideResponse(ride, type));
}
