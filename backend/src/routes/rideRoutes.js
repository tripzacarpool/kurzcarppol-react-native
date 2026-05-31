import express from 'express';
import {
  createRideRequest,
  getUserRideRequests,
  getAvailableRides,
  acceptRide,
  joinRideRequest,
  createDriverRideOffer,
  cancelRide,
  confirmRideBooking,
  driverConfirmPickup,
  passengerConfirmPickup,
  completeRide,
  extendRideTime,
  cleanupExpiredRides,
  startRide,
  driverConfirmStart,
  activateSOS,
  getActiveSOSAlerts,
  resolveSOSAlert,
  dispatchEmergencyServices,
  getSOSHistory,
} from '../controllers/rideController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

// POST /api/rides/create - Create a new ride request (passenger)
router.post('/create', requireClerkAuth, createRideRequest);

// POST /api/rides/driver-offer - Create a driver ride offer (PROTECTED)
// Note: clerkAuth middleware is applied globally in server.js
router.post('/driver-offer', requireClerkAuth, createDriverRideOffer);

// GET /api/rides/requests - Get user's ride requests
router.get('/requests', requireClerkAuth, getUserRideRequests);

// GET /api/rides/available - Get available rides for drivers
router.get('/available', getAvailableRides);

// POST /api/rides/:rideId/accept - Accept a ride
router.post('/:rideId/accept', requireClerkAuth, acceptRide);

// POST /api/rides/:rideId/join - Join an accepted passenger request and split fare
router.post('/:rideId/join', requireClerkAuth, joinRideRequest);

// POST /api/rides/:rideId/booking - Passenger confirms booking
router.post('/:rideId/booking', requireClerkAuth, confirmRideBooking);

// POST /api/rides/:rideId/pickup/driver - Driver confirms pickup
router.post('/:rideId/pickup/driver', requireClerkAuth, driverConfirmPickup);

// POST /api/rides/:rideId/pickup/passenger - Passenger confirms boarding
router.post('/:rideId/pickup/passenger', requireClerkAuth, passengerConfirmPickup);

// POST /api/rides/:rideId/start - Passenger initiates ride start
router.post('/:rideId/start', requireClerkAuth, startRide);

// POST /api/rides/:rideId/confirm-start - Driver confirms seating and starts ride
router.post('/:rideId/confirm-start', requireClerkAuth, driverConfirmStart);

// POST /api/rides/:rideId/complete - Passenger completes ride
router.post('/:rideId/complete', requireClerkAuth, completeRide);

// POST /api/rides/:rideId/sos - Activate SOS alert for safety
router.post('/:rideId/sos', requireClerkAuth, activateSOS);

// Admin SOS Management Routes
// GET /api/rides/sos/alerts/active - Get all active SOS alerts (Admin)
router.get('/sos/alerts/active', requireClerkAuth, requireRole('admin'), getActiveSOSAlerts);

// POST /api/rides/:rideId/sos/resolve - Resolve SOS alert (Admin)
router.post('/:rideId/sos/resolve', requireClerkAuth, requireRole('admin'), resolveSOSAlert);

// POST /api/rides/:rideId/sos/dispatch-emergency - Dispatch emergency services (Admin)
router.post(
  '/:rideId/sos/dispatch-emergency',
  requireClerkAuth,
  requireRole('admin'),
  dispatchEmergencyServices,
);

// GET /api/rides/sos/history - Get SOS history and analytics (Admin)
router.get('/sos/history', requireClerkAuth, requireRole('admin'), getSOSHistory);

// PATCH /api/rides/:rideId/extend - Extend ride departure time
router.patch('/:rideId/extend', requireClerkAuth, extendRideTime);

// GET /api/rides/cleanup-expired - Cleanup expired rides (cron job)
router.get('/cleanup-expired', requireClerkAuth, requireRole('admin'), cleanupExpiredRides);

// DELETE /api/rides/:rideId/cancel - Cancel a ride
router.delete('/:rideId/cancel', requireClerkAuth, cancelRide);

export default router;
