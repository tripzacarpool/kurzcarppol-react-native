import { UserProfile } from '../models/userProfile.model.js';
import {
  checkDatabaseConnection,
  validateEmail,
  validateClerkId,
  sanitizeUser,
  formatUserResponse,
} from '../utils/validation.js';

const VALID_ROLES = ['passenger', 'ride_partner', 'admin'];
const LEGACY_ROLE_ALIASES = {
  driver: 'ride_partner',
  ride_partne: 'ride_partner',
};

export const normalizeRole = (role) => {
  const normalizedRole = LEGACY_ROLE_ALIASES[role] || role;
  return VALID_ROLES.includes(normalizedRole) ? normalizedRole : 'passenger';
};

class UserProfileError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function syncClerkUser(clerkId, payload = {}) {
  const { email, firstName, lastName, profileImage, role } = payload;

  if (!clerkId) {
    throw new UserProfileError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'Valid Clerk authentication required',
    });
  }

  if (!email) {
    throw new UserProfileError('Missing required fields', {
      code: 'MISSING_FIELDS',
      details: 'email is required',
    });
  }

  if (!validateEmail(email)) {
    throw new UserProfileError('Invalid email format', {
      code: 'INVALID_EMAIL',
      details: 'Please provide a valid email address',
    });
  }

  const sanitized = sanitizeUser({
    clerkId,
    email,
    firstName,
    lastName,
    profileImage,
  });

  const existingEmailUser = await UserProfile.findOne({
    email: sanitized.email,
    clerkId: { $ne: sanitized.clerkId },
  });

  if (existingEmailUser) {
    throw new UserProfileError('Email already in use', {
      code: 'EMAIL_ALREADY_EXISTS',
      details: 'This email is associated with another user',
    });
  }

  let user = await UserProfile.findOne({ clerkId: sanitized.clerkId });
  const isNewUser = !user;

  if (!user) {
    user = await UserProfile.create({
      clerkId: sanitized.clerkId,
      email: sanitized.email,
      firstName: sanitized.firstName,
      lastName: sanitized.lastName,
      profileImage: sanitized.profileImage || null,
      role: normalizeRole(role),
      isActive: true,
    });
  } else {
    user = await UserProfile.findOneAndUpdate(
      { clerkId: sanitized.clerkId },
      {
        email: sanitized.email,
        firstName: sanitized.firstName || user.firstName,
        lastName: sanitized.lastName || user.lastName,
        profileImage: sanitized.profileImage || user.profileImage,
        role: normalizeRole(role || user.role),
        isActive: true,
      },
      { new: true, runValidators: true },
    );
  }

  return {
    isNewUser,
    user: formatUserResponse(user),
  };
}

export async function getFullUserProfile(clerkId) {
  if (!validateClerkId(clerkId)) {
    throw new UserProfileError('Invalid Clerk ID format', {
      code: 'INVALID_CLERK_ID',
    });
  }

  const user = await UserProfile.findOne({ clerkId });
  if (!user) {
    throw new UserProfileError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: `No user found with Clerk ID: ${clerkId}`,
    });
  }

  return {
    id: user._id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
    profileImage: user.profileImage,
    role: user.role,
    rating: user.rating || 4.8,
    total_trips: user.totalTrips || 0,
    walletBalance: user.walletBalance || 0,
    phone: user.phone,
    isWomenOnly: user.isWomenOnly,
    ip_address: user.ipAddress,
    ipUpdatedAt: user.ipUpdatedAt,
    location: user.location || null,
    last_location_update: user.location?.updatedAt,
    vehicleInfo: user.vehicleInfo || null,
    driverVerified: user.driverVerified || false,
    verificationStatus: user.verificationStatus,
    ridePartnerProfile: user.ridePartnerProfile || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function updateUserRoleByClerkId(clerkId, role) {
  const acceptedRoles = [...VALID_ROLES, ...Object.keys(LEGACY_ROLE_ALIASES)];
  if (!validateClerkId(clerkId)) {
    throw new UserProfileError('Invalid Clerk ID format', {
      code: 'INVALID_CLERK_ID',
    });
  }
  if (!role || !acceptedRoles.includes(role)) {
    throw new UserProfileError('Invalid role', {
      code: 'INVALID_ROLE',
      details: `Role must be one of: ${VALID_ROLES.join(', ')}`,
    });
  }

  const user = await UserProfile.findOneAndUpdate(
    { clerkId },
    { role: normalizeRole(role) },
    { new: true, runValidators: true },
  );

  if (!user) {
    throw new UserProfileError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  }

  return formatUserResponse(user);
}

export async function updateUserLocationById({
  userId,
  latitude,
  longitude,
  city,
  country,
}) {
  if (!userId || latitude === undefined || longitude === undefined) {
    throw new UserProfileError('Missing required fields', {
      code: 'MISSING_FIELDS',
      details: 'userId, latitude, and longitude are required',
    });
  }

  const user = await UserProfile.findOneAndUpdate(
    { clerkId: userId },
    {
      location: {
        latitude,
        longitude,
        city: city || null,
        country: country || null,
        updatedAt: new Date(),
      },
    },
    { new: true },
  );

  if (!user) {
    throw new UserProfileError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  }

  return formatUserResponse(user);
}

export async function updateUserIpById({ userId, ipAddress }) {
  if (!userId || !ipAddress) {
    throw new UserProfileError('Missing required fields', {
      code: 'MISSING_FIELDS',
      details: 'userId and ipAddress are required',
    });
  }

  const user = await UserProfile.findOneAndUpdate(
    { clerkId: userId },
    {
      ipAddress,
      ipUpdatedAt: new Date(),
    },
    { new: true },
  );

  if (!user) {
    throw new UserProfileError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  }

  return formatUserResponse(user);
}

export async function getCurrentUserProfile(clerkId) {
  if (!clerkId) {
    throw new UserProfileError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'Valid Clerk authentication required',
    });
  }

  const user = await UserProfile.findOne({ clerkId });
  if (!user) {
    throw new UserProfileError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: 'User profile does not exist',
    });
  }

  return formatUserResponse(user);
}

export async function emailExists(email) {
  if (!email) {
    throw new UserProfileError('Email is required', {
      code: 'MISSING_EMAIL',
    });
  }

  const sanitizedEmail = String(email).trim().toLowerCase();
  const existingUser = await UserProfile.findOne({ email: sanitizedEmail });

  return {
    exists: Boolean(existingUser),
    email: sanitizedEmail,
  };
}

export async function updateDriverVerificationForUser(clerkId, payload = {}) {
  if (!clerkId) {
    throw new UserProfileError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH_USER',
      details: 'Valid Clerk authentication required',
    });
  }

  const {
    verificationStatus,
    verificationScore,
    verificationData,
    licenseNumber,
  } = payload;

  if (!verificationStatus || verificationScore === undefined) {
    throw new UserProfileError('Missing required fields', {
      code: 'MISSING_FIELDS',
      details: 'verificationStatus and verificationScore are required',
    });
  }

  const validStatuses = [
    'pending',
    'auto_approved',
    'manual_review',
    'rejected',
  ];

  if (!validStatuses.includes(verificationStatus)) {
    throw new UserProfileError('Invalid verification status', {
      code: 'INVALID_STATUS',
      details: `Status must be one of: ${validStatuses.join(', ')}`,
    });
  }

  const user = await UserProfile.findOne({ clerkId });
  if (!user) {
    throw new UserProfileError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
      details: 'No user profile found for this clerkId',
    });
  }

  const shouldVerify =
    verificationStatus === 'auto_approved' ||
    (verificationStatus === 'manual_review' && verificationScore >= 85);

  let verificationBatch = user.verificationBatch;
  if (shouldVerify && !user.driverVerified) {
    const year = new Date().getFullYear();
    const verifiedCount = await UserProfile.countDocuments({
      driverVerified: true,
    });
    verificationBatch = `BATCH-${year}-${String(verifiedCount + 1).padStart(4, '0')}`;
  }

  const updateData = {
    verificationStatus,
    verificationScore,
    verificationData: verificationData || user.verificationData,
    licenseNumber: licenseNumber || user.licenseNumber,
  };

  if (shouldVerify) {
    updateData.driverVerified = true;
    updateData.verificationBatch = verificationBatch;
    updateData.verificationCompletedAt = new Date();
  }

  const updatedUser = await UserProfile.findOneAndUpdate(
    { clerkId },
    updateData,
    { new: true, runValidators: true },
  );

  return {
    user: formatUserResponse(updatedUser),
    verificationBatch: verificationBatch || null,
  };
}

export async function markUserLoggedOut(clerkId) {
  if (!clerkId) {
    throw new UserProfileError('Missing required field', {
      code: 'MISSING_CLERK_ID',
      details: 'clerkId is required',
    });
  }

  if (!validateClerkId(clerkId)) {
    throw new UserProfileError('Invalid Clerk ID format', {
      code: 'INVALID_CLERK_ID',
      details: 'Clerk ID must be a non-empty string',
    });
  }

  const user = await UserProfile.findOne({ clerkId });
  if (!user) {
    return {
      clerkId,
      found: false,
      timestamp: new Date(),
    };
  }

  user.lastLogout = new Date();
  await user.save();

  return {
    clerkId,
    found: true,
    timestamp: user.lastLogout,
  };
}

export async function getUserRoleStats() {
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    throw new UserProfileError('Database connection failed', {
      status: 503,
      code: 'DB_CONNECTION_ERROR',
    });
  }

  const [byRole, total, activeUsers] = await Promise.all([
    UserProfile.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]),
    UserProfile.countDocuments(),
    UserProfile.countDocuments({ isActive: true }),
  ]);

  return {
    total,
    byRole,
    activeUsers,
  };
}
