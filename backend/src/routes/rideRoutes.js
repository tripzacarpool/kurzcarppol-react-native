import express from 'express';
import {
  createRideRequest,
  getUserRideRequests,
  getAvailableRides,
  acceptRide,
  createDriverRideOffer,
  cancelRide,
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

// DELETE /api/rides/:rideId/cancel - Cancel a ride
router.delete('/:rideId/cancel', cancelRide);

export default router;
