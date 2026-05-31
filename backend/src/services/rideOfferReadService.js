import mongoose from 'mongoose';
import { RideOffer } from '../models/rideOffer.model.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { sendPushToUsers } from './pushNotificationService.js';

const VEHICLE_TYPES = ['two_wheeler', 'three_wheeler', 'four_wheeler'];
const DRIVER_PRIVACY_TYPES = ['full_detail', 'private_vehicle'];

class RideOfferReadError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const normalizeVehicleType = (value) =>
  VEHICLE_TYPES.includes(value) ? value : 'four_wheeler';

const normalizeDriverPrivacyType = (value, fallback = 'private_vehicle') =>
  DRIVER_PRIVACY_TYPES.includes(value) ? value : fallback;

const disclosureForPrivacy = (privacyType, incoming = {}) =>
  privacyType === 'full_detail'
    ? {
        showFullName: true,
        showPhone: true,
        showFullVehicleNumber: true,
        showProfilePhoto: true,
      }
    : {
        showFullName: !!incoming.showFullName,
        showPhone: !!incoming.showPhone,
        showFullVehicleNumber: !!incoming.showFullVehicleNumber,
        showProfilePhoto: !!incoming.showProfilePhoto,
      };

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertClerkId = (clerkId) => {
  if (!clerkId) {
    throw new RideOfferReadError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'clerkId is required',
    });
  }
};

const assertOfferId = (id, { rejectTemporary = false } = {}) => {
  if (rejectTemporary && (id?.startsWith('local-') || id?.length !== 24)) {
    throw new RideOfferReadError('Invalid ride offer ID', {
      code: 'INVALID_TEMP_ID',
      details:
        'Cannot update local/temporary ride offers. Please create a new offer instead.',
    });
  }

  if (id?.startsWith('local-')) {
    throw new RideOfferReadError('Local ride offer not found on server', {
      status: 404,
      code: 'LOCAL_OFFER_NOT_SYNCED',
      details: 'This ride offer only exists on your device',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new RideOfferReadError('Invalid ride offer ID format', {
      code: 'INVALID_OFFER_ID',
      details: `Ride offer ID "${id}" is not a valid format`,
    });
  }
};

const buildOfferUpdateData = (payload = {}) => {
  const {
    from,
    to,
    totalSeats,
    availableSeats,
    farePerSeat,
    vehicleType,
    driverMode,
    driverPrivacyType,
    publicDisclosure,
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
    departureTime,
    scheduledDeparture,
    timeFlexibilityMinutes,
    vehicle,
  } = payload;

  const updateData = {};
  if (from !== undefined) updateData.from = from;
  if (to !== undefined) updateData.to = to;
  if (totalSeats !== undefined) updateData.totalSeats = totalSeats;
  if (availableSeats !== undefined) updateData.availableSeats = availableSeats;
  if (farePerSeat !== undefined) updateData.farePerSeat = farePerSeat;
  if (vehicleType !== undefined) {
    updateData.vehicleType = normalizeVehicleType(vehicleType);
  }
  if (driverMode !== undefined) updateData.driverMode = driverMode;
  if (driverPrivacyType !== undefined) {
    const sanitizedDriverPrivacyType =
      normalizeDriverPrivacyType(driverPrivacyType);
    updateData.driverPrivacyType = sanitizedDriverPrivacyType;
    updateData.publicDisclosure = disclosureForPrivacy(
      sanitizedDriverPrivacyType,
      publicDisclosure,
    );
  }
  if (notes !== undefined) updateData.notes = notes;
  if (womenOnly !== undefined) updateData.womenOnly = womenOnly;
  if (departureTime !== undefined) {
    updateData.departureTime = new Date(departureTime);
  }
  if (scheduledDeparture !== undefined) {
    updateData.scheduledDeparture = scheduledDeparture;
  }
  if (timeFlexibilityMinutes !== undefined) {
    updateData.timeFlexibilityMinutes = timeFlexibilityMinutes;
  }

  if (pickupLatitude !== undefined && pickupLongitude !== undefined) {
    updateData.pickupLocation = {
      type: 'Point',
      coordinates: [pickupLongitude, pickupLatitude],
    };
    if (pickupCity) updateData.pickupCity = pickupCity;
    if (pickupCountry) updateData.pickupCountry = pickupCountry;
  }

  if (dropoffLatitude !== undefined && dropoffLongitude !== undefined) {
    updateData.dropoffLocation = {
      type: 'Point',
      coordinates: [dropoffLongitude, dropoffLatitude],
    };
    if (dropoffCity) updateData.dropoffCity = dropoffCity;
    if (dropoffCountry) updateData.dropoffCountry = dropoffCountry;
  }

  if (vehicle !== undefined) updateData.vehicle = vehicle;

  return updateData;
};

const buildAvailableOfferView = (offer) => ({
  id: offer._id.toString(),
  clerkId: offer.clerkId,
  from: offer.from,
  to: offer.to,
  totalSeats: offer.totalSeats,
  availableSeats: offer.availableSeats,
  passengers: offer.totalSeats - offer.availableSeats.length,
  farePerSeat: offer.farePerSeat,
  vehicleType: offer.vehicleType,
  driverMode: offer.driverMode,
  driverPrivacyType: offer.driverPrivacyType || 'private_vehicle',
  publicDisclosure: offer.publicDisclosure,
  trustBatch: offer.trustBatch || offer.driver?.trustBatch || 'new',
  trustScore: offer.trustScore ?? offer.driver?.trustScore ?? 50,
  publicityScore: offer.publicityScore ?? offer.driver?.publicityScore ?? 40,
  notes: offer.notes,
  womenOnly: offer.womenOnly,
  pickupLatitude: offer.pickupLatitude,
  pickupLongitude: offer.pickupLongitude,
  pickupDistanceKm:
    typeof offer.pickupDistanceKm === 'number'
      ? Number(offer.pickupDistanceKm.toFixed(2))
      : null,
  pickupCity: offer.pickupCity,
  pickupCountry: offer.pickupCountry,
  dropoffLatitude: offer.dropoffLatitude,
  dropoffLongitude: offer.dropoffLongitude,
  dropoffDistanceKm:
    typeof offer.dropoffDistanceKm === 'number'
      ? Number(offer.dropoffDistanceKm.toFixed(2))
      : null,
  dropoffCity: offer.dropoffCity,
  dropoffCountry: offer.dropoffCountry,
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
  kind: 'offer',
});

const buildDistanceExpression = (userLatitude, userLongitude) => (
  latitudeField,
  longitudeField,
) => ({
  $cond: [
    {
      $and: [{ $ne: [latitudeField, null] }, { $ne: [longitudeField, null] }],
    },
    {
      $multiply: [
        6371,
        {
          $acos: {
            $min: [
              1,
              {
                $max: [
                  -1,
                  {
                    $add: [
                      {
                        $multiply: [
                          { $sin: { $degreesToRadians: userLatitude } },
                          { $sin: { $degreesToRadians: latitudeField } },
                        ],
                      },
                      {
                        $multiply: [
                          { $cos: { $degreesToRadians: userLatitude } },
                          { $cos: { $degreesToRadians: latitudeField } },
                          {
                            $cos: {
                              $subtract: [
                                { $degreesToRadians: longitudeField },
                                { $degreesToRadians: userLongitude },
                              ],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    null,
  ],
});

export async function updateRideOfferForDriver({
  offerId,
  clerkId,
  payload = {},
}) {
  assertClerkId(clerkId);
  assertOfferId(offerId, { rejectTemporary: true });

  const existingOffer = await RideOffer.findById(offerId);
  if (!existingOffer) {
    throw new RideOfferReadError('Ride offer not found', {
      status: 404,
      code: 'OFFER_NOT_FOUND',
    });
  }

  if (existingOffer.clerkId !== clerkId) {
    throw new RideOfferReadError('Forbidden', {
      status: 403,
      code: 'NOT_OWNER',
      details: 'You can only update your own ride offers',
    });
  }

  const updateData = buildOfferUpdateData(payload);
  if (!existingOffer.driverId && existingOffer.clerkId) {
    updateData.driverId = existingOffer.clerkId;
  }

  const rideOffer = await RideOffer.findByIdAndUpdate(
    offerId,
    { $set: updateData },
    { new: true, runValidators: true },
  );

  return {
    rideOffer,
    updateData,
    shouldBroadcast: Array.isArray(existingOffer.bookings)
      ? existingOffer.bookings.length > 0
      : false,
  };
}

export async function updateRideOfferForDriverFlow({
  offerId,
  clerkId,
  payload = {},
}) {
  const result = await updateRideOfferForDriver({ offerId, clerkId, payload });
  const { rideOffer, updateData, shouldBroadcast } = result;

  const io = getRealtimeServer();
  if (io && shouldBroadcast) {
    io.emit('rideOfferUpdated', {
      rideOfferId: rideOffer._id,
      updatedData: updateData,
      timestamp: new Date(),
    });
  }

  return result;
}

export async function findAvailableRideOffers({ queryParams = {}, clerkId }) {
  const {
    from,
    to,
    q,
    minSeats = 1,
    includeOwn,
    page = 1,
    limit = 20,
    lat,
    lng,
    distanceTo = 'pickup',
  } = queryParams;

  const now = new Date();
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
  const skip = (pageNumber - 1) * pageSize;
  const userLatitude = Number.parseFloat(lat);
  const userLongitude = Number.parseFloat(lng);
  const hasUserLocation =
    Number.isFinite(userLatitude) && Number.isFinite(userLongitude);

  const query = {
    status: { $in: ['waiting', 'ongoing'] },
    availableSeats: { $exists: true, $ne: [] },
    departureTime: { $gte: now },
  };

  if (clerkId && includeOwn !== 'true') {
    query.clerkId = { $ne: clerkId };
  }
  if (from) query.from = new RegExp(escapeRegex(from), 'i');
  if (to) query.to = new RegExp(escapeRegex(to), 'i');
  if (q) {
    const searchRegex = new RegExp(escapeRegex(q).trim(), 'i');
    query.$or = [
      { from: searchRegex },
      { to: searchRegex },
      { pickupCity: searchRegex },
      { pickupCountry: searchRegex },
      { dropoffCity: searchRegex },
      { dropoffCountry: searchRegex },
      { 'driver.name': searchRegex },
      { 'vehicle.model': searchRegex },
      { 'vehicle.number': searchRegex },
    ];
  }
  const minSeatCount = Math.max(parseInt(minSeats, 10) || 1, 1);
  if (minSeatCount) {
    query.$expr = {
      $gte: [{ $size: '$availableSeats' }, minSeatCount],
    };
  }

  const distanceTarget = distanceTo === 'dropoff' ? 'dropoff' : 'pickup';
  const primaryDistanceField =
    distanceTarget === 'dropoff' ? 'dropoffDistanceKm' : 'pickupDistanceKm';
  const primaryLocationField =
    distanceTarget === 'dropoff' ? 'hasDropoffLocation' : 'hasPickupLocation';
  const distanceExpression = buildDistanceExpression(
    userLatitude,
    userLongitude,
  );

  const distanceFields = hasUserLocation
    ? [
        {
          $addFields: {
            hasPickupLocation: {
              $and: [
                { $ne: ['$pickupLatitude', null] },
                { $ne: ['$pickupLongitude', null] },
              ],
            },
            hasDropoffLocation: {
              $and: [
                { $ne: ['$dropoffLatitude', null] },
                { $ne: ['$dropoffLongitude', null] },
              ],
            },
            pickupDistanceKm: distanceExpression(
              '$pickupLatitude',
              '$pickupLongitude',
            ),
            dropoffDistanceKm: distanceExpression(
              '$dropoffLatitude',
              '$dropoffLongitude',
            ),
          },
        },
      ]
    : [];

  const sortStage = hasUserLocation
    ? {
        [primaryLocationField]: -1,
        [primaryDistanceField]: 1,
        departureTime: 1,
        createdAt: -1,
      }
    : { departureTime: 1, createdAt: -1 };

  const [rideOffers, totalCount] = await Promise.all([
    RideOffer.aggregate([
      { $match: query },
      ...distanceFields,
      { $sort: sortStage },
      { $skip: skip },
      { $limit: pageSize },
    ]),
    RideOffer.countDocuments(query),
  ]);

  const formattedOffers = rideOffers.map(buildAvailableOfferView);

  return {
    rideOffers: formattedOffers,
    count: formattedOffers.length,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total: totalCount,
      hasMore: skip + formattedOffers.length < totalCount,
    },
  };
}

export async function findRideOfferById(offerId) {
  assertOfferId(offerId);

  const rideOffer = await RideOffer.findById(offerId);
  if (!rideOffer) {
    throw new RideOfferReadError('Ride offer not found', {
      status: 404,
      code: 'OFFER_NOT_FOUND',
    });
  }

  return {
    ...rideOffer.toObject(),
    id: rideOffer._id.toString(),
    driverId: rideOffer.clerkId,
    kind: 'offer',
  };
}

export async function extendRideOfferDeparture({
  offerId,
  additionalMinutes,
}) {
  assertOfferId(offerId);

  const extensionMinutes = Number(additionalMinutes);
  if (!Number.isFinite(extensionMinutes) || extensionMinutes < 1) {
    throw new RideOfferReadError('Invalid extension', {
      details: 'additionalMinutes must be at least 1',
    });
  }

  const rideOffer = await RideOffer.findById(offerId);
  if (!rideOffer) {
    throw new RideOfferReadError('Ride offer not found', { status: 404 });
  }

  const currentDeparture = new Date(rideOffer.departureTime);
  const newDeparture = new Date(
    currentDeparture.getTime() + extensionMinutes * 60000,
  );

  rideOffer.departureTime = newDeparture;
  rideOffer.departureNotificationSent = false;

  if (rideOffer.status === 'cancelled' && rideOffer.availableSeats.length > 0) {
    rideOffer.status = 'waiting';
  }

  if (!rideOffer.driverId && rideOffer.clerkId) {
    rideOffer.driverId = rideOffer.clerkId;
  }
  if (rideOffer.festivalConfig && rideOffer.festivalConfig.tier === '') {
    rideOffer.festivalConfig.tier = null;
  }

  await rideOffer.save();

  return { rideOffer, newDeparture };
}

export async function extendRideOfferDepartureFlow({
  offerId,
  additionalMinutes,
}) {
  const result = await extendRideOfferDeparture({ offerId, additionalMinutes });
  const { rideOffer, newDeparture } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('rideOfferTimeExtended', {
      offerId,
      newDepartureTime: newDeparture,
      additionalMinutes,
      status: rideOffer.status,
    });
    io.emit('rideOfferUpdated', rideOffer);
  }

  return result;
}

export async function findRideOffersByDriver(clerkId) {
  assertClerkId(clerkId);

  const rideOffers = await RideOffer.find({ clerkId })
    .sort({ departureTime: -1, createdAt: -1 })
    .limit(50);

  const now = Date.now();
  const formattedOffers = rideOffers.map((offer) => {
    const departureMs = offer.departureTime
      ? new Date(offer.departureTime).getTime()
      : Number.NaN;
    const isPastDeparture = Number.isFinite(departureMs) && departureMs < now;
    const lifecycleStatus =
      offer.status === 'completed'
        ? 'completed'
        : offer.status === 'cancelled'
          ? 'cancelled'
          : isPastDeparture
            ? 'expired'
            : offer.status === 'ongoing'
              ? 'live'
              : 'upcoming';

    return {
      ...offer.toObject(),
      id: offer._id.toString(),
      lifecycleStatus,
      isBookable:
        !isPastDeparture &&
        ['waiting', 'ongoing'].includes(offer.status) &&
        offer.availableSeats?.length > 0,
      kind: 'offer',
    };
  });

  return {
    rideOffers: formattedOffers,
    count: formattedOffers.length,
  };
}

export async function checkRideOfferExpiryNotifications() {
  const now = new Date();
  const warningThreshold = 10 * 60 * 1000;
  const upcomingExpiryTime = new Date(now.getTime() + warningThreshold);
  const expiringRides = await RideOffer.find({
    status: 'waiting',
    departureTime: {
      $gte: now,
      $lte: upcomingExpiryTime,
    },
  });

  let notificationsSent = 0;
  const tickets = [];

  for (const ride of expiringRides) {
    try {
      const minutesUntilDeparture = Math.floor(
        (new Date(ride.departureTime).getTime() - now.getTime()) / 60000,
      );

      const sentTickets = await sendPushToUsers({
        userIds: [ride.clerkId],
        title: 'Ride Departing Soon!',
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
          screen: 'ExtendTime',
          channelId: 'ride-alerts',
        },
      });
      tickets.push(...sentTickets);
      notificationsSent += sentTickets.length;
    } catch (error) {
      console.error(`Error processing expiring ride ${ride._id}:`, error);
    }
  }

  if (notificationsSent === 0) {
    return {
      ridesChecked: expiringRides.length,
      notificationsSent: 0,
      message: 'No notifications to send',
    };
  }

  return {
    ridesChecked: expiringRides.length,
    notificationsSent,
    tickets,
  };
}
