import { UserProfile } from '../models/userProfile.model.js';
import { RideOffer } from '../models/rideOffer.model.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';
import {
  buildRideNotification,
  notifyPassengers,
} from './rideNotificationService.js';

const VEHICLE_TYPES = ['two_wheeler', 'three_wheeler', 'four_wheeler'];
const DRIVER_PRIVACY_TYPES = ['full_detail', 'private_vehicle'];

const normalizeVehicleType = (value) =>
  VEHICLE_TYPES.includes(value) ? value : 'four_wheeler';

const normalizeDriverPrivacyType = (value, fallback = 'private_vehicle') =>
  DRIVER_PRIVACY_TYPES.includes(value) ? value : fallback;

const maskVehicleNumber = (value = '') => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized || normalized === 'N/A') return 'Private vehicle';
  const compact = normalized.replace(/\s+/g, '');
  const suffix = compact.slice(-4);
  return suffix ? `**** ${suffix}` : 'Private vehicle';
};

const firstNameOnly = (profile) => {
  const first =
    profile?.firstName ||
    profile?.ridePartnerProfile?.basicProfile?.fullName?.split(' ')?.[0];
  return first || 'Private Driver';
};

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

const calculateTrustMeta = (userProfile, privacyType) => {
  const profile = userProfile.ridePartnerProfile || {};
  if (profile.trustBatch) {
    return {
      trustBatch: profile.trustBatch,
      trustScore: profile.trustScore ?? 50,
      publicityScore: profile.publicityScore ?? 40,
    };
  }

  const ratingScore = Math.min(
    50,
    Math.max(0, (Number(userProfile.rating) || 0) * 10),
  );
  const tripScore = Math.min(
    30,
    Math.floor((Number(userProfile.totalTrips) || 0) / 2),
  );
  const disclosureScore = privacyType === 'full_detail' ? 20 : 8;
  const trustScore = Math.min(100, ratingScore + tripScore + disclosureScore);
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

  return { trustBatch, trustScore, publicityScore };
};

const buildPublicDriverSnapshot = (
  userProfile,
  incomingDriver,
  privacyType,
  publicDisclosure,
) => {
  const profile = userProfile.ridePartnerProfile;
  const fullName =
    incomingDriver?.name ||
    profile?.basicProfile?.fullName ||
    `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
    userProfile.email;
  const trustMeta = calculateTrustMeta(userProfile, privacyType);

  return {
    name: publicDisclosure.showFullName ? fullName : firstNameOnly(userProfile),
    profileImage: publicDisclosure.showProfilePhoto
      ? incomingDriver?.profileImage ||
        userProfile.profileImage ||
        profile?.basicProfile?.profilePhotoUrl ||
        'https://www.gravatar.com/avatar?d=mp'
      : 'https://www.gravatar.com/avatar?d=mp',
    rating: userProfile.rating || incomingDriver?.rating || 5,
    ridesCompleted: userProfile.totalTrips || incomingDriver?.ridesCompleted || 0,
    gender: userProfile.gender || incomingDriver?.gender || 'other',
    driverVerified: userProfile.driverVerified || profile?.status === 'approved',
    verificationBatch: userProfile.verificationBatch,
    trustBatch: trustMeta.trustBatch,
    trustScore: trustMeta.trustScore,
    publicityScore: trustMeta.publicityScore,
    privacyLabel:
      privacyType === 'full_detail'
        ? 'Full detail driver'
        : 'Private vehicle driver',
  };
};

const buildPublicVehicleSnapshot = (
  userProfile,
  incomingVehicle,
  privacyType,
  publicDisclosure,
) => {
  const profileVehicle = userProfile.ridePartnerProfile?.vehicleDetails;
  const model =
    incomingVehicle?.model ||
    profileVehicle?.carModel ||
    userProfile.vehicleInfo?.model ||
    'Vehicle';
  const color = incomingVehicle?.color || userProfile.vehicleInfo?.color || 'Private';
  const number =
    incomingVehicle?.number ||
    profileVehicle?.vehicleNumber ||
    userProfile.vehicleInfo?.licensePlate ||
    '';

  return {
    model,
    color,
    number: publicDisclosure.showFullVehicleNumber
      ? number || 'N/A'
      : maskVehicleNumber(number),
  };
};

class RideOfferError extends Error {
  constructor(message, { status = 400, code, details, extra } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.extra = extra;
  }
}

export async function createRideOfferForDriver(clerkId, payload = {}) {
  const {
    from,
    to,
    totalSeats = 4,
    availableSeats: requestAvailableSeats,
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
    driverPrivacyType,
    publicDisclosure: requestedPublicDisclosure = {},
    festivalType = null,
    festivalConfig = {},
    requiresManualApproval = false,
  } = payload;

  if (!from || !to) {
    throw new RideOfferError('Invalid ride offer', {
      code: 'MISSING_FIELDS',
      details: '`from` and `to` are required',
    });
  }

  if (!departureTime) {
    throw new RideOfferError('Invalid ride offer', {
      code: 'MISSING_DEPARTURE_TIME',
      details: '`departureTime` is required',
    });
  }

  const userProfile = await UserProfile.findOne({ clerkId });
  if (!userProfile) {
    throw new RideOfferError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: 'No user profile found for this clerkId',
    });
  }

  const departureDate = new Date(departureTime);
  const timeWindow = 15 * 60 * 1000;
  const existingRide = await RideOffer.findOne({
    clerkId,
    from: from.trim(),
    to: to.trim(),
    status: { $in: ['waiting', 'accepted', 'booked'] },
    departureTime: {
      $gte: new Date(departureDate.getTime() - timeWindow),
      $lte: new Date(departureDate.getTime() + timeWindow),
    },
  });

  if (existingRide) {
    throw new RideOfferError('Duplicate ride detected', {
      status: 409,
      code: 'DUPLICATE_RIDE',
      details: `You already have an active ride from ${from} to ${to} at a similar time. Please edit that ride or cancel it first.`,
      extra: { existingRideId: existingRide._id },
    });
  }

  let availableSeats =
    requestAvailableSeats &&
    Array.isArray(requestAvailableSeats) &&
    requestAvailableSeats.length > 0
      ? requestAvailableSeats.filter((seat) => seat !== 1)
      : Array.from({ length: totalSeats - 1 }, (_, i) => i + 2);
  availableSeats = availableSeats.filter((seat) => seat !== 1);

  const sanitizedFestivalType =
    festivalType && festivalType.trim() !== '' ? festivalType : null;
  const sanitizedFestivalConfig = { ...(festivalConfig || {}) };
  const validFestivalTiers = ['Tier 1', 'Tier 2', 'Tier 3'];
  if (
    sanitizedFestivalConfig.tier === '' ||
    !validFestivalTiers.includes(sanitizedFestivalConfig.tier)
  ) {
    sanitizedFestivalConfig.tier = null;
  }

  const profilePrivacyType =
    userProfile.ridePartnerProfile?.driverPrivacyType ||
    (userProfile.ridePartnerProfile?.vehicleType === 'cab' ||
    userProfile.ridePartnerProfile?.mode === 'professional'
      ? 'full_detail'
      : 'private_vehicle');
  const sanitizedDriverPrivacyType = normalizeDriverPrivacyType(
    driverPrivacyType,
    profilePrivacyType,
  );
  const sanitizedPublicDisclosure = disclosureForPrivacy(
    sanitizedDriverPrivacyType,
    requestedPublicDisclosure,
  );
  const trustMeta = calculateTrustMeta(userProfile, sanitizedDriverPrivacyType);

  const rideOffer = new RideOffer({
    userId: userProfile._id,
    clerkId,
    driverId: clerkId,
    from,
    to,
    totalSeats,
    availableSeats,
    farePerSeat,
    vehicleType: normalizeVehicleType(vehicleType),
    driverMode,
    driverPrivacyType: sanitizedDriverPrivacyType,
    publicDisclosure: sanitizedPublicDisclosure,
    ...trustMeta,
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
    departureTime: departureDate,
    scheduledDeparture: scheduledDeparture ? new Date(scheduledDeparture) : null,
    timeFlexibilityMinutes: timeFlexibilityMinutes || 60,
    status: 'waiting',
    approvalMode: requiresManualApproval === true ? 'manual' : 'auto',
    requiresManualApproval: requiresManualApproval === true,
    seatLocks: [],
    festivalType: sanitizedFestivalType,
    festivalConfig: sanitizedFestivalConfig,
    vehicle: buildPublicVehicleSnapshot(
      userProfile,
      vehicle,
      sanitizedDriverPrivacyType,
      sanitizedPublicDisclosure,
    ),
    driver: buildPublicDriverSnapshot(
      userProfile,
      driver,
      sanitizedDriverPrivacyType,
      sanitizedPublicDisclosure,
    ),
    bookings: [],
  });

  await rideOffer.save();

  await publishEvent(EventTypes.RideOfferCreated, {
    rideId: rideOffer._id.toString(),
    clerkId,
    driverId: rideOffer.driverId,
    from: rideOffer.from,
    to: rideOffer.to,
    totalSeats: rideOffer.totalSeats,
    availableSeats: rideOffer.availableSeats,
    farePerSeat: rideOffer.farePerSeat,
    vehicleType: rideOffer.vehicleType,
    departureTime: rideOffer.departureTime,
    status: rideOffer.status,
  });

  return rideOffer;
}

export async function createRideOfferForDriverFlow(clerkId, payload = {}) {
  const rideOffer = await createRideOfferForDriver(clerkId, payload);

  const io = getRealtimeServer();
  if (io) {
    io.emit('newRideOffer', rideOffer);
    console.log('Broadcasted new ride offer:', rideOffer._id);
  }

  return rideOffer;
}

export async function createDriverRideOfferFlow(clerkId, body = {}) {
  const {
    passengers,
    fare,
    scheduledDeparture,
    departureTime,
    ...payload
  } = body;

  const rideOffer = await createRideOfferForDriver(clerkId, {
    ...payload,
    totalSeats: passengers
      ? Number(passengers) + 1
      : Number(payload.totalSeats || 4),
    farePerSeat: fare ?? payload.farePerSeat ?? 0,
    departureTime: departureTime || scheduledDeparture,
    scheduledDeparture: scheduledDeparture || departureTime,
    requiresManualApproval: true,
  });

  const io = getRealtimeServer();
  if (io) {
    io.emit('new_driver_offer', {
      offerId: rideOffer._id,
      from: rideOffer.from,
      to: rideOffer.to,
      totalSeats: rideOffer.totalSeats,
      availableSeats: rideOffer.availableSeats,
      farePerSeat: rideOffer.farePerSeat,
      womenOnly: rideOffer.womenOnly,
      vehicleType: rideOffer.vehicleType,
      notes: rideOffer.notes,
      departureTime: rideOffer.departureTime,
      scheduledDeparture: rideOffer.scheduledDeparture,
      earliestDeparture: rideOffer.earliestDeparture,
      latestDeparture: rideOffer.latestDeparture,
      timeFlexibilityMinutes: rideOffer.timeFlexibilityMinutes,
      status: rideOffer.status,
      approvalMode: rideOffer.approvalMode,
      requiresManualApproval: rideOffer.requiresManualApproval,
      createdAt: rideOffer.createdAt,
      driver: {
        clerkId,
        ...rideOffer.driver,
      },
    });
  }

  notifyPassengers(
    buildRideNotification('offer_created', rideOffer, {
      rideType: 'offer',
      action: 'view_offer',
      data: {
        offerId: rideOffer._id.toString(),
        driverClerkId: clerkId,
        farePerSeat: rideOffer.farePerSeat,
        availableSeats: rideOffer.availableSeats,
        departureTime: rideOffer.departureTime,
      },
    }),
    { excludeClerkId: clerkId },
  ).catch((error) =>
    console.error('Driver offer notification error:', error.message),
  );

  return rideOffer;
}
