import { UserProfile } from '../models/userProfile.model.js';
import { validateClerkId } from '../utils/validation.js';
import {
  uploadImageToCloudinary,
  uploadPdfToCloudinary,
  uploadToCloudinaryfile,
} from '../utils/cloudinary.js';
import { env, isProduction } from '../config/env.js';

const ridePartnerStatuses = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
];
const ridePartnerModes = ['daily', 'casual', 'professional'];
const vehicleTypes = ['personal', 'cab'];
const driverPrivacyTypes = ['full_detail', 'private_vehicle'];
const DATA_URI_REGEX = /^data:(.+);base64,(.*)$/i;

const isCloudinaryConfigured = () =>
  Boolean(
    env.cloudinaryCloudName &&
      env.cloudinaryApiKey &&
      env.cloudinaryApiSecret,
  );

class RidePartnerError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const assertClerkId = (clerkId) => {
  if (!validateClerkId(clerkId)) {
    throw new RidePartnerError('Invalid Clerk ID', {
      code: 'INVALID_CLERK_ID',
    });
  }
};

const trimString = (value) =>
  typeof value === 'string' ? value.trim() : undefined;

const normalizeRequired = (value) => {
  const trimmed = trimString(value);
  return typeof trimmed === 'string' && trimmed.length > 0 ? trimmed : value;
};

const parseDataUri = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(DATA_URI_REGEX);
  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2].replace(/\s/g, '');

  if (!base64Payload) {
    return null;
  }

  return {
    mimeType,
    buffer: Buffer.from(base64Payload, 'base64'),
  };
};

const uploadDataAsset = async (value, { folder, label }) => {
  const trimmed = trimString(value);
  if (!trimmed) {
    return undefined;
  }

  const parsed = parseDataUri(trimmed);
  if (!parsed) {
    return trimmed;
  }

  const { mimeType, buffer } = parsed;

  if (!isCloudinaryConfigured() && !isProduction) {
    return trimmed;
  }

  try {
    if (mimeType.startsWith('image/')) {
      const result = await uploadImageToCloudinary(buffer, folder);
      return result.secure_url;
    }

    if (mimeType.includes('pdf')) {
      const result = await uploadPdfToCloudinary(buffer, folder);
      return result.secure_url;
    }

    if (mimeType.includes('zip')) {
      const result = await uploadToCloudinaryfile(buffer, 'raw', folder);
      return result.secure_url;
    }

    const resourceType = mimeType.startsWith('video/')
      ? 'video'
      : mimeType.startsWith('audio/')
        ? 'video'
        : 'auto';

    const result = await uploadToCloudinaryfile(buffer, resourceType, folder);
    return result.secure_url;
  } catch {
    throw new RidePartnerError(
      label
        ? `Failed to upload ${label}. Please try again.`
        : 'Failed to upload file. Please try again.',
      {
        status: 500,
        code: 'UPLOAD_FAILED',
      },
    );
  }
};

const calculateTrustBatch = ({
  status,
  rating = 5,
  totalTrips = 0,
  driverPrivacyType,
}) => {
  if (status !== 'approved') {
    return { trustBatch: 'new', trustScore: 50, publicityScore: 40 };
  }
  const ratingScore = Math.min(50, Math.max(0, (Number(rating) || 0) * 10));
  const tripScore = Math.min(30, Math.floor((Number(totalTrips) || 0) / 2));
  const disclosureScore = driverPrivacyType === 'full_detail' ? 20 : 8;
  const trustScore = Math.min(100, ratingScore + tripScore + disclosureScore);
  const publicityScore = Math.min(
    100,
    trustScore + (driverPrivacyType === 'full_detail' ? 10 : -5),
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

const markSection = (section, status, note) => {
  if (!section) return section;
  return {
    ...section,
    status,
    verifiedAt: status === 'approved' ? new Date() : section.verifiedAt,
    rejectionReason:
      status === 'rejected' ? note || 'Rejected during review' : undefined,
  };
};

export async function getRidePartnerProfileByClerkId(clerkId) {
  assertClerkId(clerkId);

  const user = await UserProfile.findOne({ clerkId });
  if (!user) {
    throw new RidePartnerError('User not found', {
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  }

  return {
    profile: user.ridePartnerProfile || null,
    role: user.role,
  };
}

export async function submitRidePartnerApplication(payload = {}) {
  const {
    clerkId,
    mode,
    vehicleType,
    driverPrivacyType,
    publicDisclosure,
    basicProfile,
    vehicleDetails,
    licenseDetails,
    payoutDetails,
    professionalDetails,
    declaration,
    kycDetails,
  } = payload;

  assertClerkId(clerkId);

  if (!ridePartnerModes.includes(mode)) {
    throw new RidePartnerError('Invalid ride partner mode', {
      code: 'INVALID_MODE',
      details: `Mode must be one of: ${ridePartnerModes.join(', ')}`,
    });
  }

  const normalizedVehicleType = vehicleType || 'personal';
  if (!vehicleTypes.includes(normalizedVehicleType)) {
    throw new RidePartnerError('Invalid vehicle type', {
      code: 'INVALID_VEHICLE_TYPE',
      details: `Vehicle type must be one of: ${vehicleTypes.join(', ')}`,
    });
  }

  const normalizedPrivacyType = driverPrivacyTypes.includes(driverPrivacyType)
    ? driverPrivacyType
    : normalizedVehicleType === 'cab' || mode === 'professional'
      ? 'full_detail'
      : 'private_vehicle';

  let user = await UserProfile.findOne({ clerkId });
  const normalizedDisclosure =
    normalizedPrivacyType === 'full_detail'
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
  const trustMeta = calculateTrustBatch({
    status: 'under_review',
    rating: user?.rating,
    totalTrips: user?.totalTrips,
    driverPrivacyType: normalizedPrivacyType,
  });

  if (!basicProfile?.fullName || !basicProfile?.phone) {
    throw new RidePartnerError('Missing basic profile fields', {
      code: 'MISSING_BASIC_PROFILE',
    });
  }
  if (!vehicleDetails?.carModel || !vehicleDetails?.vehicleNumber) {
    throw new RidePartnerError('Missing vehicle details', {
      code: 'MISSING_VEHICLE_DETAILS',
    });
  }
  if (!licenseDetails?.licenseNumber) {
    throw new RidePartnerError('Missing license details', {
      code: 'MISSING_LICENSE_DETAILS',
    });
  }
  if (
    !payoutDetails?.accountHolderName ||
    !payoutDetails?.accountNumber ||
    !payoutDetails?.ifscCode
  ) {
    throw new RidePartnerError('Missing payout details', {
      code: 'MISSING_PAYOUT_DETAILS',
    });
  }

  const needsPermit = normalizedVehicleType === 'cab' || mode === 'professional';
  if (needsPermit && !professionalDetails?.commercialPermitUrl) {
    throw new RidePartnerError(
      'Commercial permit required for professional/cab partners',
      {
        code: 'MISSING_PERMIT',
      },
    );
  }

  if (!declaration?.communityRulesAccepted || !declaration?.ownershipConsent) {
    throw new RidePartnerError('Declarations must be accepted', {
      code: 'DECLARATION_REQUIRED',
    });
  }

  if (!kycDetails?.selfiePhoto) {
    throw new RidePartnerError('Live selfie verification is required', {
      code: 'MISSING_SELFIE',
    });
  }

  const allowedKycStatuses = ['pending', 'in_progress', 'verified'];
  const normalizedKycStatus = allowedKycStatuses.includes(
    kycDetails?.digilockerStatus,
  )
    ? kycDetails.digilockerStatus
    : 'pending';

  const cloudinaryBaseFolder = `ride-partners/${clerkId}`;
  const [
    profilePhotoUrl,
    vehiclePhotoUrl,
    licensePhotoUrl,
    selfiePhotoUrl,
    digilockerDocumentUrl,
    permitUrl,
  ] = await Promise.all([
    uploadDataAsset(basicProfile?.profilePhotoUrl, {
      folder: `${cloudinaryBaseFolder}/profile`,
      label: 'profile photo',
    }),
    uploadDataAsset(vehicleDetails?.vehiclePhotoUrl, {
      folder: `${cloudinaryBaseFolder}/vehicle`,
      label: 'vehicle photo',
    }),
    uploadDataAsset(licenseDetails?.licensePhotoUrl, {
      folder: `${cloudinaryBaseFolder}/license`,
      label: 'license photo',
    }),
    uploadDataAsset(kycDetails?.selfiePhoto, {
      folder: `${cloudinaryBaseFolder}/selfie`,
      label: 'selfie photo',
    }),
    uploadDataAsset(kycDetails?.digilockerDocument, {
      folder: `${cloudinaryBaseFolder}/documents`,
      label: 'DigiLocker document',
    }),
    uploadDataAsset(professionalDetails?.commercialPermitUrl, {
      folder: `${cloudinaryBaseFolder}/permits`,
      label: 'commercial permit',
    }),
  ]);

  const sanitizedBasicProfile = {
    fullName: normalizeRequired(basicProfile.fullName),
    phone: normalizeRequired(basicProfile.phone),
    ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
  };
  const sanitizedVehicleDetails = {
    vehicleType: normalizeRequired(vehicleDetails.vehicleType),
    carModel: normalizeRequired(vehicleDetails.carModel),
    vehicleNumber: normalizeRequired(vehicleDetails.vehicleNumber)?.toUpperCase(),
    maxPassengers: Number(vehicleDetails.maxPassengers),
    ...(vehiclePhotoUrl ? { vehiclePhotoUrl } : {}),
  };
  const sanitizedLicenseDetails = {
    licenseNumber: normalizeRequired(licenseDetails.licenseNumber)?.toUpperCase(),
    ...(licensePhotoUrl ? { licensePhotoUrl } : {}),
  };
  const sanitizedPayoutDetails = {
    accountHolderName: normalizeRequired(payoutDetails.accountHolderName),
    accountNumber: normalizeRequired(payoutDetails.accountNumber),
    ifscCode: normalizeRequired(payoutDetails.ifscCode)?.toUpperCase(),
  };
  const sanitizedProfessionalDetails = needsPermit
    ? {
        ...(permitUrl ? { commercialPermitUrl: permitUrl } : {}),
      }
    : undefined;

  if (!selfiePhotoUrl) {
    throw new RidePartnerError('Failed to process selfie upload', {
      code: 'SELFIE_UPLOAD_FAILED',
    });
  }

  const sanitizedKycDetails = {
    selfiePhoto: selfiePhotoUrl,
    ...(digilockerDocumentUrl
      ? { digilockerDocument: digilockerDocumentUrl }
      : {}),
    digilockerStatus: normalizedKycStatus,
  };

  if (!user) {
    const fallbackEmail =
      trimString(payload.contactEmail) || trimString(payload.email);
    if (!fallbackEmail) {
      throw new RidePartnerError('User not found', {
        status: 404,
        code: 'USER_NOT_FOUND',
      });
    }

    const fullNameForProfile =
      sanitizedBasicProfile.fullName || basicProfile.fullName || 'Driver';
    const nameParts = fullNameForProfile.split(' ').filter(Boolean);
    const firstName = nameParts[0] || fullNameForProfile;
    const lastName = nameParts.slice(1).join(' ') || undefined;

    try {
      user = await UserProfile.create({
        clerkId,
        email: fallbackEmail,
        firstName,
        lastName,
        profileImage: profilePhotoUrl || null,
        role: 'ride_partner',
        phone: sanitizedBasicProfile.phone,
        isActive: true,
      });
    } catch (error) {
      throw new RidePartnerError('Failed to create user profile for ride partner', {
        status: 500,
        code: 'USER_CREATE_FAILED',
        details: error.message,
      });
    }
  }

  const submissionTimestamp = new Date();
  const timeline = [
    ...(user.ridePartnerProfile?.timeline || []),
    {
      status: 'under_review',
      note: 'Ride partner application submitted from mobile app',
      timestamp: submissionTimestamp,
    },
  ];

  user.role = 'ride_partner';
  user.ridePartnerProfile = {
    status: 'under_review',
    mode,
    vehicleType: normalizedVehicleType,
    driverPrivacyType: normalizedPrivacyType,
    publicDisclosure: normalizedDisclosure,
    ...trustMeta,
    basicProfile: {
      ...sanitizedBasicProfile,
      status: 'submitted',
      verifiedAt: null,
      rejectionReason: undefined,
    },
    vehicleDetails: {
      ...sanitizedVehicleDetails,
      status: 'submitted',
    },
    licenseDetails: {
      ...sanitizedLicenseDetails,
      status: 'submitted',
    },
    kycDetails: {
      ...sanitizedKycDetails,
      status: 'submitted',
    },
    payoutDetails: {
      ...sanitizedPayoutDetails,
      status: 'submitted',
    },
    professionalDetails: needsPermit
      ? {
          ...(sanitizedProfessionalDetails || {}),
          status: 'submitted',
        }
      : undefined,
    declaration: {
      communityRulesAccepted: !!declaration.communityRulesAccepted,
      ownershipConsent: !!declaration.ownershipConsent,
      acceptedAt: declaration.acceptedAt || submissionTimestamp,
    },
    timeline,
    lastSubmittedAt: submissionTimestamp,
    reviewerNotes: null,
  };

  await user.save();
  return user.ridePartnerProfile;
}

export async function updateRidePartnerProfileStatus(clerkId, { status, note }) {
  assertClerkId(clerkId);

  if (!ridePartnerStatuses.includes(status)) {
    throw new RidePartnerError('Invalid status value', {
      code: 'INVALID_STATUS',
      details: `Status must be one of: ${ridePartnerStatuses.join(', ')}`,
    });
  }

  const user = await UserProfile.findOne({ clerkId });
  if (!user || !user.ridePartnerProfile) {
    throw new RidePartnerError('Ride partner profile not found', {
      status: 404,
      code: 'PROFILE_NOT_FOUND',
    });
  }

  user.ridePartnerProfile.status = status;
  user.ridePartnerProfile.timeline = [
    ...(user.ridePartnerProfile.timeline || []),
    {
      status,
      note: note || `Status updated to ${status}`,
      timestamp: new Date(),
    },
  ];

  if (status === 'approved') {
    const trustMeta = calculateTrustBatch({
      status,
      rating: user.rating,
      totalTrips: user.totalTrips,
      driverPrivacyType:
        user.ridePartnerProfile.driverPrivacyType || 'private_vehicle',
    });
    user.ridePartnerProfile.trustBatch = trustMeta.trustBatch;
    user.ridePartnerProfile.trustScore = trustMeta.trustScore;
    user.ridePartnerProfile.publicityScore = trustMeta.publicityScore;
    user.ridePartnerProfile.basicProfile = markSection(
      user.ridePartnerProfile.basicProfile,
      'approved',
    );
    user.ridePartnerProfile.vehicleDetails = markSection(
      user.ridePartnerProfile.vehicleDetails,
      'approved',
    );
    user.ridePartnerProfile.licenseDetails = markSection(
      user.ridePartnerProfile.licenseDetails,
      'approved',
    );
    user.ridePartnerProfile.payoutDetails = markSection(
      user.ridePartnerProfile.payoutDetails,
      'approved',
    );
    if (user.ridePartnerProfile.professionalDetails) {
      user.ridePartnerProfile.professionalDetails = markSection(
        user.ridePartnerProfile.professionalDetails,
        'approved',
      );
    }
    user.driverVerified = true;
    user.verificationStatus = 'auto_approved';
  }

  if (status === 'rejected') {
    user.ridePartnerProfile.basicProfile = markSection(
      user.ridePartnerProfile.basicProfile,
      'rejected',
      note,
    );
    user.ridePartnerProfile.vehicleDetails = markSection(
      user.ridePartnerProfile.vehicleDetails,
      'rejected',
      note,
    );
    user.ridePartnerProfile.licenseDetails = markSection(
      user.ridePartnerProfile.licenseDetails,
      'rejected',
      note,
    );
    user.ridePartnerProfile.payoutDetails = markSection(
      user.ridePartnerProfile.payoutDetails,
      'rejected',
      note,
    );
    if (user.ridePartnerProfile.professionalDetails) {
      user.ridePartnerProfile.professionalDetails = markSection(
        user.ridePartnerProfile.professionalDetails,
        'rejected',
        note,
      );
    }
    user.ridePartnerProfile.reviewerNotes = note || 'Application rejected';
  }

  await user.save();
  return user.ridePartnerProfile;
}
