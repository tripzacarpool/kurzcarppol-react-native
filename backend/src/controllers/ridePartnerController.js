import { UserProfile } from '../config/models.js';
import {
  checkDatabaseConnection,
  validateClerkId,
} from '../utils/validation.js';

const ridePartnerStatuses = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
];
const ridePartnerModes = ['daily', 'casual', 'professional'];
const vehicleTypes = ['personal', 'cab'];

const ensureDbConnected = async (res) => {
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    res.status(503).json({
      error: 'Database connection failed',
      code: 'DB_CONNECTION_ERROR',
    });
    return false;
  }
  return true;
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

export const applyRidePartner = async (req, res) => {
  try {
    if (!(await ensureDbConnected(res))) return;

    const {
      clerkId,
      mode,
      vehicleType,
      basicProfile,
      vehicleDetails,
      licenseDetails,
      payoutDetails,
      professionalDetails,
      declaration,
    } = req.body;

    if (!validateClerkId(clerkId)) {
      return res.status(400).json({
        error: 'Invalid Clerk ID',
        code: 'INVALID_CLERK_ID',
      });
    }

    if (!ridePartnerModes.includes(mode)) {
      return res.status(400).json({
        error: 'Invalid ride partner mode',
        details: `Mode must be one of: ${ridePartnerModes.join(', ')}`,
        code: 'INVALID_MODE',
      });
    }

    const normalizedVehicleType = vehicleType || 'personal';
    if (!vehicleTypes.includes(normalizedVehicleType)) {
      return res.status(400).json({
        error: 'Invalid vehicle type',
        details: `Vehicle type must be one of: ${vehicleTypes.join(', ')}`,
        code: 'INVALID_VEHICLE_TYPE',
      });
    }

    if (!basicProfile?.fullName || !basicProfile?.phone) {
      return res.status(400).json({
        error: 'Missing basic profile fields',
        code: 'MISSING_BASIC_PROFILE',
      });
    }

    if (!vehicleDetails?.carModel || !vehicleDetails?.vehicleNumber) {
      return res.status(400).json({
        error: 'Missing vehicle details',
        code: 'MISSING_VEHICLE_DETAILS',
      });
    }

    if (!licenseDetails?.licenseNumber) {
      return res.status(400).json({
        error: 'Missing license details',
        code: 'MISSING_LICENSE_DETAILS',
      });
    }

    if (
      !payoutDetails?.accountHolderName ||
      !payoutDetails?.accountNumber ||
      !payoutDetails?.ifscCode
    ) {
      return res.status(400).json({
        error: 'Missing payout details',
        code: 'MISSING_PAYOUT_DETAILS',
      });
    }

    const needsPermit =
      normalizedVehicleType === 'cab' || mode === 'professional';
    if (needsPermit && !professionalDetails?.commercialPermitUrl) {
      return res.status(400).json({
        error: 'Commercial permit required for professional/cab partners',
        code: 'MISSING_PERMIT',
      });
    }

    if (
      !declaration?.communityRulesAccepted ||
      !declaration?.ownershipConsent
    ) {
      return res.status(400).json({
        error: 'Declarations must be accepted',
        code: 'DECLARATION_REQUIRED',
      });
    }

    const user = await UserProfile.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
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
      basicProfile: {
        ...basicProfile,
        status: 'submitted',
        verifiedAt: null,
        rejectionReason: undefined,
      },
      vehicleDetails: {
        ...vehicleDetails,
        status: 'submitted',
      },
      licenseDetails: {
        ...licenseDetails,
        status: 'submitted',
      },
      payoutDetails: {
        ...payoutDetails,
        status: 'submitted',
      },
      professionalDetails: needsPermit
        ? {
            ...professionalDetails,
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

    return res.status(200).json({
      success: true,
      message: 'Ride partner application submitted',
      profile: user.ridePartnerProfile,
    });
  } catch (error) {
    console.error('❌ Ride partner apply error:', error.message);
    res.status(500).json({
      error: 'Failed to submit ride partner application',
      details: error.message,
      code: 'RIDE_PARTNER_APPLY_ERROR',
    });
  }
};

export const getRidePartnerProfile = async (req, res) => {
  try {
    if (!(await ensureDbConnected(res))) return;
    const { clerkId } = req.params;

    if (!validateClerkId(clerkId)) {
      return res.status(400).json({
        error: 'Invalid Clerk ID',
        code: 'INVALID_CLERK_ID',
      });
    }

    const user = await UserProfile.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      profile: user.ridePartnerProfile || null,
      role: user.role,
    });
  } catch (error) {
    console.error('❌ Ride partner fetch error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch ride partner profile',
      details: error.message,
      code: 'RIDE_PARTNER_FETCH_ERROR',
    });
  }
};

export const updateRidePartnerStatus = async (req, res) => {
  try {
    if (!(await ensureDbConnected(res))) return;
    const { clerkId } = req.params;
    const { status, note } = req.body;

    if (!validateClerkId(clerkId)) {
      return res.status(400).json({
        error: 'Invalid Clerk ID',
        code: 'INVALID_CLERK_ID',
      });
    }

    if (!ridePartnerStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status value',
        details: `Status must be one of: ${ridePartnerStatuses.join(', ')}`,
        code: 'INVALID_STATUS',
      });
    }

    const user = await UserProfile.findOne({ clerkId });
    if (!user || !user.ridePartnerProfile) {
      return res.status(404).json({
        error: 'Ride partner profile not found',
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

    res.json({
      success: true,
      message: `Ride partner status updated to ${status}`,
      profile: user.ridePartnerProfile,
    });
  } catch (error) {
    console.error('❌ Ride partner status error:', error.message);
    res.status(500).json({
      error: 'Failed to update ride partner status',
      details: error.message,
      code: 'RIDE_PARTNER_STATUS_ERROR',
    });
  }
};
