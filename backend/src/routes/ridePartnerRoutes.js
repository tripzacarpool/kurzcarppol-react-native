import express from 'express';
import {
  applyRidePartner,
  getRidePartnerProfile,
  updateRidePartnerStatus,
} from '../controllers/ridePartnerController.js';

const router = express.Router();

router.post('/apply', applyRidePartner);
router.get('/:clerkId', getRidePartnerProfile);
router.patch('/:clerkId/status', updateRidePartnerStatus);

export default router;
