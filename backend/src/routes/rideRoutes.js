import express from 'express';
import {
  createRideRequest,
  getUserRideRequests,
  getAvailableRides,
  acceptRide,
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
} from '../controllers/rideController.js';

const router = express.Router();

// POST /api/rides/create - Create a new ride request (passenger)
router.post('/create', createRideRequest);

// POST /api/rides/driver-offer - Create a driver ride offer (PROTECTED)
// Note: clerkAuth middleware is applied globally in server.js
router.post('/driver-offer', createDriverRideOffer);

// GET /api/rides/requests - Get user's ride requests
router.get('/requests', getUserRideRequests);

// GET /api/rides/available - Get available rides for drivers
router.get('/available', getAvailableRides);

// POST /api/rides/:rideId/accept - Accept a ride
router.post('/:rideId/accept', acceptRide);

// POST /api/rides/:rideId/booking - Passenger confirms booking
router.post('/:rideId/booking', confirmRideBooking);

// POST /api/rides/:rideId/pickup/driver - Driver confirms pickup
router.post('/:rideId/pickup/driver', driverConfirmPickup);

// POST /api/rides/:rideId/pickup/passenger - Passenger confirms boarding
router.post('/:rideId/pickup/passenger', passengerConfirmPickup);

// POST /api/rides/:rideId/start - Passenger initiates ride start
router.post('/:rideId/start', startRide);

// POST /api/rides/:rideId/confirm-start - Driver confirms seating and starts ride
router.post('/:rideId/confirm-start', driverConfirmStart);

// POST /api/rides/:rideId/complete - Passenger completes ride
router.post('/:rideId/complete', completeRide);

// PATCH /api/rides/:rideId/extend - Extend ride departure time
router.patch('/:rideId/extend', extendRideTime);

// GET /api/rides/cleanup-expired - Cleanup expired rides (cron job)
router.get('/cleanup-expired', cleanupExpiredRides);

// DELETE /api/rides/:rideId/cancel - Cancel a ride
router.delete('/:rideId/cancel', cancelRide);

export default router;
