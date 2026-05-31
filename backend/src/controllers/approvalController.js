import {
  approveBookingRequestFlow,
  cancelPendingApprovalRequestFlow,
  confirmApprovedBookingPaymentFlow,
  createBookingRequestFlow,
  expirePendingApprovals,
  getAllPendingApprovalsForDriver,
  getApprovalAnalyticsForDriver,
  getBookingApprovalStatusForUser,
  getPassengerBookingsWithRideDetails,
  getPendingApprovalsForRide,
  rejectBookingRequestFlow,
  updateRideApprovalSettingsForDriver,
} from '../services/approvalService.js';
import { getClerkUserId } from '../middleware/clerkAuth.js';

const sendServiceError = (req, res, error, fallbackCode) =>
  res.status(error.status || 500).json({
    error: error.message,
    details: error.details,
    code: error.code || fallbackCode,
    requestId: req.requestId,
  });

/**
 * Create a booking with automatic approval info
 * POST /api/rides/:rideId/book
 * Called by passenger when trying to book a ride
 */
export const createBooking = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const clerkId = getClerkUserId(req);
    const { seatNumbers = [], customRequest = '' } = req.body;

    const { approvalMode, booking } = await createBookingRequestFlow({
      rideId,
      passengerClerkId: clerkId,
      seatNumbers,
      customRequest,
    });

    if (approvalMode === 'auto') {
      return res.status(201).json({
        success: true,
        message: 'Booking auto-confirmed',
        booking: booking.toObject(),
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Booking created - awaiting approval',
      booking: booking.toObject(),
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'CREATE_BOOKING_ERROR');
    }
    return next(error);
  }
};

/**
 * Get pending approval requests for a driver
 * GET /api/rides/:rideId/pending-approvals
 */
export const getPendingApprovals = async (req, res, next) => {
  try {
    const pendingBookings = await getPendingApprovalsForRide({
      rideId: req.params.rideId,
      driverClerkId: getClerkUserId(req),
    });

    return res.status(200).json({
      success: true,
      pendingBookings,
      count: pendingBookings.length,
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'GET_PENDING_APPROVALS_ERROR');
    }
    return next(error);
  }
};

/**
 * Get ALL pending approvals for a driver across all their rides
 * GET /api/approvals/driver/pending
 * This batches all pending approvals into a single query, replacing N individual calls
 */
export const getAllDriverPendingApprovals = async (req, res, next) => {
  try {
    const pendingBookings = await getAllPendingApprovalsForDriver(
      getClerkUserId(req),
    );

    return res.status(200).json({
      success: true,
      pendingBookings,
      count: pendingBookings.length,
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'GET_DRIVER_PENDING_ERROR');
    }
    return next(error);
  }
};

/**
 * Approve a booking
 * POST /api/bookings/:bookingId/approve
 */
export const approveBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const clerkId = getClerkUserId(req);
    const { notes = '' } = req.body;

    const { booking } = await approveBookingRequestFlow({
      bookingId,
      driverClerkId: clerkId,
      notes,
    });

    return res.status(200).json({
      success: true,
      message: 'Booking confirmed - payment after ride completion',
      booking: booking.toObject(),
      requiresPayment: false,
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'APPROVE_BOOKING_ERROR');
    }
    return next(error);
  }
};

/**
 * Reject a booking
 * POST /api/bookings/:bookingId/reject
 */
export const rejectBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const clerkId = getClerkUserId(req);
    const { rejectionReason = 'Driver cancelled booking' } = req.body;

    const { booking } = await rejectBookingRequestFlow({
      bookingId,
      driverClerkId: clerkId,
      rejectionReason,
    });

    return res.status(200).json({
      success: true,
      message: 'Booking rejected',
      booking: booking.toObject(),
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'REJECT_BOOKING_ERROR');
    }
    return next(error);
  }
};

/**
 * Get booking approval status
 * GET /api/bookings/:bookingId/approval-status
 */
export const getBookingApprovalStatus = async (req, res, next) => {
  try {
    const booking = await getBookingApprovalStatusForUser({
      bookingId: req.params.bookingId,
      clerkId: getClerkUserId(req),
    });

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'GET_APPROVAL_STATUS_ERROR');
    }
    return next(error);
  }
};

/**
 * Update ride approval settings
 * PUT /api/rides/:rideId/approval-settings
 */
export const updateRideApprovalSettings = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const clerkId = getClerkUserId(req);
    const { requiresManualApproval, autoApproveThreshold } = req.body;

    const ride = await updateRideApprovalSettingsForDriver({
      rideId,
      driverClerkId: clerkId,
      requiresManualApproval,
      autoApproveThreshold,
    });

    return res.status(200).json({
      success: true,
      message: 'Approval settings updated',
      ride: ride.toObject(),
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'UPDATE_APPROVAL_SETTINGS_ERROR');
    }
    return next(error);
  }
};

/**
 * Handle expired approvals (auto-reject)
 * POST /api/approvals/handle-expired
 */
export const handleExpiredApprovals = async (req, res, next) => {
  try {
    const result = await expirePendingApprovals({ rideId: req.body.rideId });
    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to handle expired approvals',
        details: result.error,
        code: 'EXPIRE_APPROVALS_ERROR',
        requestId: req.requestId,
      });
    }

    return res.status(200).json({
      success: true,
      expiredCount: result.expiredCount || result.processedCount || 0,
      results: result.results || [],
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get approval analytics for driver
 * GET /api/drivers/:driverId/approval-analytics
 */
export const getApprovalAnalytics = async (req, res, next) => {
  try {
    const analytics = await getApprovalAnalyticsForDriver({
      driverId: req.params.driverId,
      clerkId: getClerkUserId(req),
    });

    return res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'GET_APPROVAL_ANALYTICS_ERROR');
    }
    return next(error);
  }
};

/**
 * Confirm payment after driver approval
 * POST /api/bookings/:bookingId/confirm-payment
 */
export const confirmBookingPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const clerkId = getClerkUserId(req);
    const {
      paymentId,
      paymentMethod = 'razorpay',
      paymentStatus = 'paid',
    } = req.body;

    const { booking } = await confirmApprovedBookingPaymentFlow({
      bookingId,
      passengerClerkId: clerkId,
      paymentId,
      paymentMethod,
      paymentStatus,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed - ride complete',
      booking: booking.toObject(),
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'CONFIRM_PAYMENT_ERROR');
    }
    return next(error);
  }
};

/**
 * Get passenger's ride offer bookings
 * Returns all bookings made by the passenger
 */
export const getPassengerBookings = async (req, res, next) => {
  try {
    const bookings = await getPassengerBookingsWithRideDetails(
      getClerkUserId(req),
    );

    return res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'GET_PASSENGER_BOOKINGS_ERROR');
    }
    return next(error);
  }
};

/**
 * Cancel a pending approval request (passenger-initiated)
 * DELETE /api/bookings/:bookingId/cancel-approval
 * Allows passengers to cancel their booking request while it's still pending approval
 */
export const cancelPendingApproval = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const clerkId = getClerkUserId(req);

    const { booking } = await cancelPendingApprovalRequestFlow({
      bookingId,
      passengerClerkId: clerkId,
    });

    return res.status(200).json({
      success: true,
      message: 'Booking request cancelled successfully',
      booking: {
        _id: booking._id,
        approvalStatus: booking.approvalStatus,
        cancelledAt: booking.cancelledAt,
      },
    });
  } catch (error) {
    if (error.status) {
      return sendServiceError(req, res, error, 'CANCEL_APPROVAL_ERROR');
    }
    return next(error);
  }
};

export default {
  createBooking,
  getPendingApprovals,
  approveBooking,
  rejectBooking,
  confirmBookingPayment,
  getBookingApprovalStatus,
  updateRideApprovalSettings,
  handleExpiredApprovals,
  getApprovalAnalytics,
  getPassengerBookings,
  cancelPendingApproval,
};
