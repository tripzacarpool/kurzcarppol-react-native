import { checkDatabaseConnection } from '../utils/validation.js';
import {
  getRidePartnerProfileByClerkId,
  submitRidePartnerApplication,
  updateRidePartnerProfileStatus,
} from '../services/ridePartnerService.js';

const ensureDbConnected = async (req, res) => {
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    res.status(503).json({
      error: 'Database connection failed',
      code: 'DB_CONNECTION_ERROR',
      requestId: req.requestId,
    });
    return false;
  }
  return true;
};

const sendRidePartnerError = (req, res, error, fallbackCode) =>
  res.status(error.status || 500).json({
    error: error.message,
    details: error.details,
    code: error.code || fallbackCode,
    requestId: req.requestId,
  });

export const applyRidePartner = async (req, res) => {
  try {
    if (!(await ensureDbConnected(req, res))) return;
    const profile = await submitRidePartnerApplication(req.body);
    return res.status(200).json({
      success: true,
      message: 'Ride partner application submitted',
      profile,
    });
  } catch (error) {
    return sendRidePartnerError(req, res, error, 'RIDE_PARTNER_APPLY_ERROR');
  }
};

export const getRidePartnerProfile = async (req, res) => {
  try {
    if (!(await ensureDbConnected(req, res))) return;
    const result = await getRidePartnerProfileByClerkId(req.params.clerkId);
    return res.json({
      success: true,
      profile: result.profile,
      role: result.role,
    });
  } catch (error) {
    return sendRidePartnerError(req, res, error, 'RIDE_PARTNER_FETCH_ERROR');
  }
};

export const updateRidePartnerStatus = async (req, res) => {
  try {
    if (!(await ensureDbConnected(req, res))) return;
    const profile = await updateRidePartnerProfileStatus(req.params.clerkId, {
      status: req.body.status,
      note: req.body.note,
    });

    return res.json({
      success: true,
      message: `Ride partner status updated to ${req.body.status}`,
      profile,
    });
  } catch (error) {
    return sendRidePartnerError(req, res, error, 'RIDE_PARTNER_STATUS_ERROR');
  }
};
