import express from 'express';
import {
  createBooking,
  getPendingApprovals,
  getAllDriverPendingApprovals,
  approveBooking,
  rejectBooking,
  confirmBookingPayment,
  getBookingApprovalStatus,
  updateRideApprovalSettings,
  handleExpiredApprovals,
  getApprovalAnalytics,
  getPassengerBookings,
} from '../controllers/approvalController.js';

const router = express.Router();

/**
 * Booking creation with auto-approval logic
 * POST /api/rides/:rideId/book
 */
router.post('/rides/:rideId/book', createBooking);

/**
 * Get pending approval requests for a driver
 * GET /api/rides/:rideId/pending-approvals
 */
router.get('/rides/:rideId/pending-approvals', getPendingApprovals);

/**
 * Get ALL pending approval requests for a driver (batch endpoint)
 * Replaces multiple per-ride calls with a single batched query
 * GET /api/approvals/driver/pending
 */
router.get('/approvals/driver/pending', getAllDriverPendingApprovals);

/**
 * Approve a booking
 * POST /api/bookings/:bookingId/approve
 */
router.post('/bookings/:bookingId/approve', approveBooking);

/**
 * Reject a booking
 * POST /api/bookings/:bookingId/reject
 */
router.post('/bookings/:bookingId/reject', rejectBooking);

/**
 * Confirm payment after driver approval
 * POST /api/bookings/:bookingId/confirm-payment
 */
router.post('/bookings/:bookingId/confirm-payment', confirmBookingPayment);

/**
 * Get booking approval status
 * GET /api/bookings/:bookingId/approval-status
 */
router.get('/bookings/:bookingId/approval-status', getBookingApprovalStatus);

/**
 * Update ride approval settings
 * PUT /api/rides/:rideId/approval-settings
 */
router.put('/rides/:rideId/approval-settings', updateRideApprovalSettings);

/**
 * Handle expired approvals (auto-reject)
 * POST /api/approvals/handle-expired
 */
router.post('/approvals/handle-expired', handleExpiredApprovals);

/**
 * Get approval analytics for driver
 * GET /api/drivers/:driverId/approval-analytics
 */
router.get('/drivers/:driverId/approval-analytics', getApprovalAnalytics);

/**
 * Get passenger's bookings
 * GET /api/bookings/passenger/me
 */
router.get('/bookings/passenger/me', getPassengerBookings);

export default router;
