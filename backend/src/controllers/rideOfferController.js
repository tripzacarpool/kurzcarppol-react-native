import { createRideOfferForDriverFlow } from '../services/rideOfferCreationService.js';
import {
  checkRideOfferExpiryNotifications,
  extendRideOfferDepartureFlow,
  findAvailableRideOffers,
  findRideOfferById,
  findRideOffersByDriver,
  updateRideOfferForDriverFlow,
} from '../services/rideOfferReadService.js';
import {
  bookRideOfferSeatsFlow,
  cancelRideOfferByDriverFlow,
  cleanupExpiredRideOffersJob,
  requestRideOfferHoldFlow,
  respondToRideOfferHoldFlow,
} from '../services/rideOfferLifecycleService.js';
import { getClerkUserId } from '../middleware/clerkAuth.js';

/**
 * Create a new ride offer
 * POST /api/ride-offers/create
 */
export const createRideOffer = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
        code: 'NO_AUTH_USER',
        requestId: req.requestId,
      });
    }

    const rideOffer = await createRideOfferForDriverFlow(clerkId, req.body || {});

    return res.status(201).json({
      success: true,
      rideOffer,
      message: 'Ride offer created successfully',
    });
  } catch (error) {
    console.error('Error creating ride offer:', error);
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
        ...(error.extra || {}),
      });
    }
    return next(error);
  }
};

/** * Update an existing ride offer
 * PUT /api/ride-offers/:id
 */
export const updateRideOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideOffer } =
      await updateRideOfferForDriverFlow({
        offerId: id,
        clerkId,
        payload: req.body || {},
      });

    return res.status(200).json({
      success: true,
      message: 'Ride offer updated successfully',
      rideOffer,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

export const getAvailableRideOffers = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.query.clerkId;
    const result = await findAvailableRideOffers({
      queryParams: req.query || {},
      clerkId,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getRideOfferById = async (req, res, next) => {
  try {
    const rideOffer = await findRideOfferById(req.params.id);
    return res.status(200).json({
      success: true,
      rideOffer,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code,
        details: error.details,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

export const extendRideOfferTime = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { additionalMinutes } = req.body;
    const { rideOffer } = await extendRideOfferDepartureFlow({
      offerId: id,
      additionalMinutes,
    });

    return res.status(200).json({
      success: true,
      rideOffer,
      message: 'Ride offer time extended by ' + additionalMinutes + ' minutes',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

export const requestRideOfferHold = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { id } = req.params;
    const { holdRequest } =
      await requestRideOfferHoldFlow({
        offerId: id,
        passengerClerkId: clerkId,
        minutes: req.body.minutes,
      });

    return res.status(201).json({
      success: true,
      holdRequest,
      message: 'Hold request sent to driver',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

export const respondRideOfferHold = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { id, requestId } = req.params;
    const { action } = req.body;
    const { holdRequest, rideOffer } = await respondToRideOfferHoldFlow({
      offerId: id,
      requestId,
      driverClerkId: clerkId,
      action,
    });

    return res.status(200).json({
      success: true,
      rideOffer,
      holdRequest,
      message:
        action === 'approve'
          ? `Ride held by ${holdRequest.minutes} minutes`
          : 'Hold request rejected',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

/**
 * Book a ride offer
 * POST /api/ride-offers/:id/book
 */
export const bookRideOffer = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { id } = req.params;
    const { seatNumbers, paymentMethod = 'unknown', customRequest } = req.body;
    const { booking, rideOffer } = await bookRideOfferSeatsFlow({
      offerId: id,
      passengerClerkId: clerkId,
      seatNumbers,
      paymentMethod,
      customRequest,
    });

    return res.status(200).json({
      success: true,
      rideOffer,
      booking,
      message: 'Ride offer booked successfully',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

/**
 * Cancel a ride offer
 * POST /api/ride-offers/:id/cancel
 */
export const cancelRideOffer = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { id } = req.params;
    const result = await cancelRideOfferByDriverFlow({
      offerId: id,
      driverClerkId: clerkId,
    });

    if (result.isLocal) {
      return res.status(200).json({
        success: true,
        message: 'Local ride offer cancelled (no server action needed)',
        rideOffer: result.rideOffer,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ride offer cancelled successfully',
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

/**
 * Cleanup expired ride offers
 * POST /api/ride-offers/cleanup-expired
 */
export const cleanupExpiredRideOffers = async (req, res, next) => {
  try {
    const { cancelledCount, completedCount } =
      await cleanupExpiredRideOffersJob();
    return res.status(200).json({
      success: true,
      cancelledCount,
      completedCount,
      message: 'Expired ride offers cleaned up and ongoing rides completed',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get my ride offers (as a driver)
 * GET /api/ride-offers/my-offers
 */
export const getMyRideOffers = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.query.clerkId;
    const result = await findRideOffersByDriver(clerkId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

export const checkExpiringRides = async (req, res, next) => {
  try {
    const result = await checkRideOfferExpiryNotifications();
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
};
