import express from 'express';
import {
  createRideOffer,
  getAvailableRideOffers,
  getRideOfferById,
  extendRideOfferTime,
  bookRideOffer,
  cancelRideOffer,
  cleanupExpiredRideOffers,
  getMyRideOffers,
  checkExpiringRides,
} from '../controllers/rideOfferController.js';

const router = express.Router();

// Create a new ride offer
router.post('/create', createRideOffer);

// Get all available ride offers
router.get('/available', getAvailableRideOffers);

// Get my ride offers (as driver)
router.get('/my-offers', getMyRideOffers);

// Get a specific ride offer
router.get('/:id', getRideOfferById);

// Extend ride offer departure time
router.post('/:id/extend-time', extendRideOfferTime);

// Book a ride offer
router.post('/:id/book', bookRideOffer);

// Cancel a ride offer
router.post('/:id/cancel', cancelRideOffer);

// Cleanup expired ride offers
router.post('/cleanup-expired', cleanupExpiredRideOffers);

// Check for expiring rides and send notifications
router.post('/check-expiring', checkExpiringRides);

export default router;
