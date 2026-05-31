import {
  emailExists,
  getCurrentUserProfile,
  getFullUserProfile,
  getUserRoleStats,
  markUserLoggedOut,
  syncClerkUser,
  updateDriverVerificationForUser,
  updateUserIpById,
  updateUserLocationById,
  updateUserRoleByClerkId,
} from '../services/userProfileService.js';
import {
  registerPushTokenForUser,
  sendUserTestPush,
} from '../services/userNotificationService.js';
import {
  getAdminDriverList,
  getAdminPlatformOverview,
  updateAdminDriverProfile,
} from '../services/adminService.js';

const sendServiceError = (req, res, error, fallbackCode = 'USER_PROFILE_ERROR') => {
  if (error.status) {
    return res.status(error.status).json({
      error: error.message,
      details: error.details,
      code: error.code || fallbackCode,
      debug: error.debug,
      requestId: req.requestId,
    });
  }

  return res.status(500).json({
    error: 'User profile request failed',
    details: error.message,
    code: fallbackCode,
    requestId: req.requestId,
  });
};

export const syncUser = async (req, res) => {
  try {
    const result = await syncClerkUser(req.auth?.userId, req.body);
    return res.status(result.isNewUser ? 201 : 200).json({
      success: true,
      message: result.isNewUser
        ? 'User created successfully'
        : 'User updated successfully',
      action: result.isNewUser ? 'created' : 'updated',
      user: result.user,
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'SYNC_ERROR');
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await getFullUserProfile(req.params.clerkId);
    return res.json({ success: true, user });
  } catch (error) {
    return sendServiceError(req, res, error, 'FETCH_ERROR');
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const user = await updateUserRoleByClerkId(req.params.clerkId, req.body.role);
    return res.json({
      success: true,
      message: 'Role updated successfully',
      user,
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'UPDATE_ERROR');
  }
};

export const updateUserLocation = async (req, res) => {
  try {
    const user = await updateUserLocationById(req.body);
    return res.json({
      success: true,
      message: 'Location updated successfully',
      user,
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'LOCATION_UPDATE_ERROR');
  }
};

export const updateUserIP = async (req, res) => {
  try {
    const user = await updateUserIpById(req.body);
    return res.json({
      success: true,
      message: 'IP address updated successfully',
      user,
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'IP_UPDATE_ERROR');
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await getCurrentUserProfile(req.auth?.userId);
    return res.status(200).json(user);
  } catch (error) {
    return sendServiceError(req, res, error, 'PROFILE_FETCH_ERROR');
  }
};

export const checkEmailExists = async (req, res) => {
  try {
    const result = await emailExists(req.query.email);
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendServiceError(req, res, error, 'CHECK_EMAIL_ERROR');
  }
};

export const updatePushToken = async (req, res) => {
  try {
    const result = await registerPushTokenForUser({
      clerkId: req.auth?.userId || req.body.clerkId,
      pushToken: req.body.pushToken,
    });

    return res.status(200).json({
      success: true,
      message: 'Push token updated successfully',
      clerkId: result.clerkId,
      pushTokenUpdatedAt: result.pushTokenUpdatedAt,
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'PUSH_TOKEN_UPDATE_ERROR');
  }
};

export const testPushNotification = async (req, res) => {
  try {
    const result = await sendUserTestPush(req.body.clerkId);
    return res.status(200).json({
      success: true,
      message: 'Test push notification sent',
      results: result.results,
      debug: result.debug,
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'TEST_PUSH_ERROR');
  }
};

export const updateDriverVerification = async (req, res) => {
  try {
    const result = await updateDriverVerificationForUser(
      req.auth?.userId,
      req.body,
    );

    return res.json({
      success: true,
      message: 'Driver verification updated successfully',
      user: result.user,
      verificationBatch: result.verificationBatch,
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'UPDATE_ERROR');
  }
};

export const logoutUser = async (req, res) => {
  try {
    const result = await markUserLoggedOut(req.body.clerkId);
    return res.status(200).json({
      success: true,
      message: result.found
        ? 'User logged out successfully'
        : 'User not found, but logout processed',
      clerkId: result.clerkId,
      timestamp: result.timestamp,
      code: result.found ? undefined : 'USER_NOT_FOUND',
    });
  } catch (error) {
    return sendServiceError(req, res, error, 'LOGOUT_ERROR');
  }
};

/**
 * Sync user from Clerk to MongoDB
 * POST /api/users/sync
 * Requires Clerk authentication
 */
/**
 * Get user profile by Clerk ID
 * GET /api/users/:clerkId
 */
/**
 * Update user role (admin/ride_partner/passenger)
 * PATCH /api/users/:clerkId/role
 */
/**
 * Get user stats (total users by role)
 * GET /api/users/stats
 */
export const getUserStats = async (req, res, next) => {
  try {
    const stats = await getUserRoleStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: status === 503 ? error.message : 'Failed to fetch stats',
      details: status === 503 ? undefined : error.message,
      code: error.code || 'STATS_ERROR',
      requestId: req.requestId,
    });
  }
};

/**
 * Update user location
 * PUT /api/users/location
 */
/**
 * Update user IP address
 * PUT /api/users/ip
 */
/**
 * Get current user profile
 * GET /api/users/profile
 * Requires Clerk authentication
 */
/**
 * Logout user - Invalidate session on backend
 * POST /api/users/logout
 */
/**
 * Update user push notification token
 * POST /api/users/push-token
 */
/**
 * Test push notification
 * POST /api/users/test-push
 */
/**
 * Update driver verification status and assign batch
 * POST /api/users/driver-verification
 * Requires Clerk authentication
 */
// Check if email exists in database
export const getAdminOverview = async (req, res) => {
  try {
    const overview = await getAdminPlatformOverview();
    return res.json({
      success: true,
      overview,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch admin overview',
      details: error.message,
      code: 'ADMIN_OVERVIEW_ERROR',
      requestId: req.requestId,
    });
  }
};

export const getAdminDrivers = async (req, res) => {
  try {
    const drivers = await getAdminDriverList(req.query);
    return res.json({
      success: true,
      drivers,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch admin drivers',
      details: error.message,
      code: 'ADMIN_DRIVERS_ERROR',
      requestId: req.requestId,
    });
  }
};

export const updateAdminDriver = async (req, res) => {
  try {
    const driver = await updateAdminDriverProfile(req.params.clerkId, req.body);
    return res.json({
      success: true,
      driver,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status === 404 ? error.message : 'Failed to update driver',
      details: error.status === 404 ? undefined : error.message,
      code: error.code || 'ADMIN_DRIVER_UPDATE_ERROR',
      requestId: req.requestId,
    });
  }
};
