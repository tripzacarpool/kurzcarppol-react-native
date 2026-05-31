import { RideBooking, RideOffer, UserProfile } from '../config/models.js';

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const toAdminDriver = (user) => {
  const profile = user.ridePartnerProfile || {};
  const basic = profile.basicProfile || {};
  const vehicle = profile.vehicleDetails || {};
  const publicDisclosure = profile.publicDisclosure || {};

  return {
    id: user._id,
    clerkId: user.clerkId,
    name:
      basic.fullName ||
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.email,
    email: user.email,
    phone: basic.phone || user.phone,
    role: user.role,
    status: profile.status || 'draft',
    active: user.isActive !== false,
    mode: profile.mode || 'casual',
    vehicleType: profile.vehicleType || 'personal',
    driverPrivacyType: profile.driverPrivacyType || 'private_vehicle',
    publicDisclosure: {
      showFullName: !!publicDisclosure.showFullName,
      showPhone: !!publicDisclosure.showPhone,
      showFullVehicleNumber: !!publicDisclosure.showFullVehicleNumber,
      showProfilePhoto: !!publicDisclosure.showProfilePhoto,
    },
    trustBatch: profile.trustBatch || 'new',
    trustScore: profile.trustScore ?? 50,
    publicityScore: profile.publicityScore ?? 40,
    vehicle: {
      model: vehicle.carModel || user.vehicleInfo?.model || 'Vehicle',
      number: vehicle.vehicleNumber || user.vehicleInfo?.licensePlate || '',
    },
    rating: user.rating || 5,
    totalTrips: user.totalTrips || 0,
    driverVerified: user.driverVerified || profile.status === 'approved',
    verificationStatus: user.verificationStatus,
    verificationBatch: user.verificationBatch,
    createdAt: user.createdAt,
    lastSubmittedAt: profile.lastSubmittedAt,
  };
};

export async function getAdminPlatformOverview() {
  const [
    totalUsers,
    passengers,
    drivers,
    activeDrivers,
    pendingDrivers,
    privateDrivers,
    fullDetailDrivers,
    activeRideOffers,
    completedRideOffers,
    bookings,
  ] = await Promise.all([
    UserProfile.countDocuments(),
    UserProfile.countDocuments({ role: 'passenger' }),
    UserProfile.countDocuments({ role: 'ride_partner' }),
    UserProfile.countDocuments({ role: 'ride_partner', isActive: { $ne: false } }),
    UserProfile.countDocuments({
      role: 'ride_partner',
      'ridePartnerProfile.status': { $in: ['submitted', 'under_review'] },
    }),
    UserProfile.countDocuments({
      role: 'ride_partner',
      'ridePartnerProfile.driverPrivacyType': 'private_vehicle',
    }),
    UserProfile.countDocuments({
      role: 'ride_partner',
      'ridePartnerProfile.driverPrivacyType': 'full_detail',
    }),
    RideOffer.countDocuments({ status: { $in: ['waiting', 'ongoing', 'booked'] } }),
    RideOffer.countDocuments({ status: 'completed' }),
    RideBooking.find({}).select('fare paymentStatus approvalStatus').lean(),
  ]);

  const totalRevenue = bookings.reduce((sum, booking) => {
    if (booking.paymentStatus === 'paid' || booking.approvalStatus === 'confirmed') {
      return sum + (Number(booking.fare) || 0);
    }
    return sum;
  }, 0);

  return {
    totalUsers,
    passengers,
    drivers,
    activeDrivers,
    pendingDrivers,
    privateDrivers,
    fullDetailDrivers,
    activeRideOffers,
    completedRideOffers,
    totalBookings: bookings.length,
    totalRevenue,
  };
}

export async function getAdminDriverList({ status, privacyType, q } = {}) {
  const query = { role: 'ride_partner' };
  if (status) query['ridePartnerProfile.status'] = status;
  if (privacyType) query['ridePartnerProfile.driverPrivacyType'] = privacyType;
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { email: regex },
      { 'ridePartnerProfile.basicProfile.fullName': regex },
      { 'ridePartnerProfile.vehicleDetails.vehicleNumber': regex },
    ];
  }

  const users = await UserProfile.find(query).sort({ updatedAt: -1 }).limit(100);
  return users.map(toAdminDriver);
}

export async function updateAdminDriverProfile(clerkId, payload = {}) {
  const {
    status,
    isActive,
    driverPrivacyType,
    publicDisclosure,
    trustBatch,
    trustScore,
    publicityScore,
    note,
  } = payload;
  const update = {};
  const push = {};

  if (typeof isActive === 'boolean') update.isActive = isActive;
  if (driverPrivacyType && ['full_detail', 'private_vehicle'].includes(driverPrivacyType)) {
    update['ridePartnerProfile.driverPrivacyType'] = driverPrivacyType;
    update['ridePartnerProfile.publicDisclosure'] =
      driverPrivacyType === 'full_detail'
        ? {
            showFullName: true,
            showPhone: true,
            showFullVehicleNumber: true,
            showProfilePhoto: true,
          }
        : {
            showFullName: !!publicDisclosure?.showFullName,
            showPhone: !!publicDisclosure?.showPhone,
            showFullVehicleNumber: !!publicDisclosure?.showFullVehicleNumber,
            showProfilePhoto: !!publicDisclosure?.showProfilePhoto,
          };
  }

  if (trustBatch && ['new', 'community', 'trusted', 'featured'].includes(trustBatch)) {
    update['ridePartnerProfile.trustBatch'] = trustBatch;
  }
  if (typeof trustScore === 'number') {
    update['ridePartnerProfile.trustScore'] = Math.max(0, Math.min(100, trustScore));
  }
  if (typeof publicityScore === 'number') {
    update['ridePartnerProfile.publicityScore'] = Math.max(0, Math.min(100, publicityScore));
  }

  if (status && ['draft', 'submitted', 'under_review', 'approved', 'rejected'].includes(status)) {
    update['ridePartnerProfile.status'] = status;
    push['ridePartnerProfile.timeline'] = {
      status,
      note: note || `Admin updated status to ${status}`,
      timestamp: new Date(),
    };
    if (status === 'approved') {
      update.driverVerified = true;
      update.verificationStatus = 'auto_approved';
    }
  }

  const updateOperation = { $set: update };
  if (Object.keys(push).length > 0) {
    updateOperation.$push = push;
  }

  const updated = await UserProfile.findOneAndUpdate(
    { clerkId, role: 'ride_partner' },
    updateOperation,
    { new: true, runValidators: true },
  );

  if (!updated) {
    const error = new Error('Driver not found');
    error.status = 404;
    error.code = 'DRIVER_NOT_FOUND';
    throw error;
  }

  return toAdminDriver(updated);
}
