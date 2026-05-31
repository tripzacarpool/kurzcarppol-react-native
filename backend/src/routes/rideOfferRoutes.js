import express from 'express';
import {
  createRideOffer,
  updateRideOffer,
  getAvailableRideOffers,
  getRideOfferById,
  extendRideOfferTime,
  requestRideOfferHold,
  respondRideOfferHold,
  bookRideOffer,
  cancelRideOffer,
  cleanupExpiredRideOffers,
  getMyRideOffers,
  checkExpiringRides,
} from '../controllers/rideOfferController.js';
import {
  driverInitiatePickup,
  passengerConfirmPickup,
} from '../controllers/rideOfferPickupController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

// Create a new ride offer
router.post('/create', requireClerkAuth, createRideOffer);

// Update an existing ride offer
router.put('/:id', requireClerkAuth, updateRideOffer);

// Get all available ride offers
router.get('/available', getAvailableRideOffers);

// Get my ride offers (as driver)
router.get('/my-offers', requireClerkAuth, getMyRideOffers);

// Get a specific ride offer
router.get('/:id', getRideOfferById);

// Extend ride offer departure time
router.post('/:id/extend-time', requireClerkAuth, extendRideOfferTime);

// Passenger asks driver to wait before departure
router.post('/:id/hold-requests', requireClerkAuth, requestRideOfferHold);
router.post(
  '/:id/hold-requests/:requestId/respond',
  requireClerkAuth,
  respondRideOfferHold,
);

// Book a ride offer
router.post('/:id/book', requireClerkAuth, bookRideOffer);

// Cancel a ride offer
router.post('/:id/cancel', requireClerkAuth, cancelRideOffer);

// Cleanup expired ride offers
router.post('/cleanup-expired', requireClerkAuth, requireRole('admin'), cleanupExpiredRideOffers);

// Check for expiring rides and send notifications
router.post('/check-expiring', requireClerkAuth, requireRole('admin'), checkExpiringRides);

// Pickup confirmation endpoints
router.post('/:rideId/pickup/initiate', requireClerkAuth, driverInitiatePickup);
router.post('/:rideId/pickup/confirm', requireClerkAuth, passengerConfirmPickup);

export default router;
