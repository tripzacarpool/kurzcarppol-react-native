import express from 'express';
import {
  applyRidePartner,
  getRidePartnerProfile,
  updateRidePartnerStatus,
} from '../controllers/ridePartnerController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireSelfOrRole } from '../middleware/requireSelfOrRole.js';

const router = express.Router();

router.post(
  '/apply',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['body.clerkId'] }),
  applyRidePartner,
);
router.get(
  '/:clerkId',
  requireClerkAuth,
  requireSelfOrRole({ userIdSources: ['params.clerkId'] }),
  getRidePartnerProfile,
);
router.patch(
  '/:clerkId/status',
  requireClerkAuth,
  requireRole('admin'),
  updateRidePartnerStatus,
);

export default router;
