import {
  formatRideRequestResponse,
  getRideRequestsForPassenger,
  createRideRequestForPassengerFlow,
} from '../services/rideRequestService.js';
import { createDriverRideOfferFlow } from '../services/rideOfferCreationService.js';
import { getAvailableRideRequests } from '../services/rideDiscoveryService.js';
import {
  acceptRideRequestFlow,
  cancelRideRequestFlow,
  cleanupExpiredRideRequestsFlow,
  completePassengerRideFlow,
  confirmRideRequestBookingFlow,
  confirmDriverPickupFlow,
  confirmDriverStartFlow,
  confirmPassengerPickupFlow,
  extendRideRequestDepartureFlow,
  joinRideRequestByPassengerFlow,
  requestRideStartFlow,
} from '../services/rideLifecycleService.js';
import {
  activateSosAlertFlow,
  dispatchEmergencyServiceFlow,
  getActiveSosAlerts,
  getSosHistory,
  resolveSosAlertFlow,
} from '../services/safetySosService.js';
import { getClerkUserId } from '../middleware/clerkAuth.js';

/**
 * Create a new ride request
 * POST /api/rides/create
 * Requires Clerk authentication
 */
export const createRideRequest = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
        requestId: req.requestId,
      });
    }

    const rideRequest = await createRideRequestForPassengerFlow(
      clerkId,
      req.body || {},
    );

    return res.status(201).json({
      success: true,
      message: 'Ride request created successfully',
      ride: formatRideRequestResponse(rideRequest),
    });
  } catch (error) {
    console.error('Create ride error:', error.message);
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
 * Get ride requests for a user (passenger's own rides)
 * GET /api/rides/requests
 * Requires Clerk authentication
 */
export const getUserRideRequests = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);

    if (!clerkId) {
      clerkId = req.body.clerkId || req.query.clerkId;
      console.log('Using clerkId from request (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth, body, or query)',
        code: 'NO_AUTH_USER',
        requestId: req.requestId,
      });
    }

    const rides = await getRideRequestsForPassenger(clerkId);

    return res.status(200).json({
      success: true,
      rides,
      message: 'Ride requests retrieved successfully',
    });
  } catch (error) {
    console.error('Get rides error:', error.message);
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
 * Get available rides for drivers (waiting rides)
 * GET /api/rides/available
 * Requires Clerk authentication
 */
export const getAvailableRides = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId || req.query.clerkId;
    const type = (req.query.type || 'requests').toString();
    const rides = await getAvailableRideRequests({
      clerkId,
      type,
      joinable: req.query.joinable === 'true',
      targetTime: req.query.targetTime,
      windowMinutes: Number.parseInt(req.query.windowMinutes, 10),
    });

    return res.status(200).json({
      success: true,
      rides,
      message:
        rides.length === 0
          ? '0 rides found'
          : 'Available rides retrieved successfully',
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
 * Accept a ride request
 * POST /api/rides/:rideId/accept
 * Requires Clerk authentication
 */
export const acceptRide = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;

    const ride = await acceptRideRequestFlow({
      rideId,
      driverClerkId: clerkId,
    });

    return res.status(200).json({
      success: true,
      message: 'Ride accepted successfully',
      ride: {
        id: ride._id,
        status: ride.status,
        acceptedBy: ride.acceptedBy,
        driverGuaranteedFare: ride.driverGuaranteedFare,
        fareSplit: ride.fareSplit,
      },
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
 * Passenger confirms booking after payment
 * POST /api/rides/:rideId/booking
 */
export const confirmRideBooking = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;

    const { ride } = await confirmRideRequestBookingFlow({
      rideId,
      passengerClerkId: clerkId,
      payload: req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Booking confirmed',
      ride: {
        id: ride._id,
        status: ride.status,
        bookingDetails: ride.bookingDetails,
        fareSplit: ride.fareSplit,
      },
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
 * Join an accepted passenger ride request and split the original fare.
 * POST /api/rides/:rideId/join
 */
export const joinRideRequest = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;
    const {
      fareSplit,
      passengerShare,
      ride,
    } = await joinRideRequestByPassengerFlow({
      rideId,
      passengerClerkId: clerkId,
      payload: req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Joined ride and fare split updated',
      ride: {
        id: ride._id,
        status: ride.status,
        fareSplit,
        driverGuaranteedFare: ride.driverGuaranteedFare,
        passengerShare,
      },
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
 * Driver confirms that passenger has been picked up
 * POST /api/rides/:rideId/pickup/driver
 */
export const driverConfirmPickup = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;

    const ride = await confirmDriverPickupFlow({
      rideId,
      driverClerkId: clerkId,
    });

    return res.status(200).json({
      success: true,
      message: 'Pickup confirmed by driver',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
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
 * Passenger confirms they have boarded the vehicle
 * POST /api/rides/:rideId/pickup/passenger
 * Handles both RideRequest and RideOffer
 */
export const passengerConfirmPickup = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;

    const result = await confirmPassengerPickupFlow({
      rideId,
      passengerClerkId: clerkId,
    });
    const { ride, rideType } = result;

    return res.status(200).json({
      success: true,
      message: 'Pickup confirmed by passenger',
      ride: {
        id: ride._id,
        rideType,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
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
 * Passenger confirms drop-off and completes the ride
 * POST /api/rides/:rideId/complete
 * Handles both RideRequest and RideOffer
 */
export const completeRide = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;
    const result = await completePassengerRideFlow({
      rideId,
      passengerClerkId: clerkId,
    });
    const {
      allPassengersConfirmed,
      ride,
      rideType,
    } = result;

    return res.status(200).json({
      success: true,
      message:
        rideType === 'offer' && !allPassengersConfirmed
          ? 'Drop-off confirmed'
          : 'Ride marked as completed and payment processed',
      ride: {
        id: ride._id,
        rideType,
        status: ride.status,
        dropoffStatus: ride.dropoffStatus,
      },
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
 * Start ride (passenger initiates)
 * POST /api/rides/:rideId/start
 */
export const startRide = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;

    const ride = await requestRideStartFlow({
      rideId,
      passengerClerkId: clerkId,
    });

    return res.status(200).json({
      success: true,
      message: 'Driver notified to confirm seating',
      ride: {
        id: ride._id,
        status: ride.status,
      },
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
 * Driver confirms seating and starts ride
 * POST /api/rides/:rideId/confirm-start
 */
export const driverConfirmStart = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;

    const ride = await confirmDriverStartFlow({
      rideId,
      driverClerkId: clerkId,
    });

    return res.status(200).json({
      success: true,
      message: 'Ride started successfully',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
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
 * Activate SOS alert for passenger safety
 * POST /api/rides/:rideId/sos
 * Sends emergency notifications to driver and emergency contacts
 */
export const activateSOS = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;
    const activatedBy = getClerkUserId(req) || req.body.clerkId;

    const { context, sosAlert } = await activateSosAlertFlow({
      rideId,
      activatedBy,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: 'SOS alert activated successfully',
      data: {
        ...sosAlert,
        sosActivated: true,
        adminNotified: true,
        driverNotified: !!context.driver,
      },
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

export const getActiveSOSAlerts = async (req, res, next) => {
  try {
    const alerts = await getActiveSosAlerts();
    return res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    return next(error);
  }
};

export const resolveSOSAlert = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { resolution, notes, responseTime } = req.body;
    const { context } = await resolveSosAlertFlow({
      rideId,
      resolution,
      notes,
      responseTime,
    });

    return res.status(200).json({
      success: true,
      message: 'SOS alert resolved',
      data: {
        rideId,
        sosActivated: false,
        sosResolvedAt: context.ride.sosResolvedAt,
        resolution: context.ride.sosResolution,
      },
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

export const dispatchEmergencyServices = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { serviceType, notes } = req.body;
    const { dispatchRecord } =
      await dispatchEmergencyServiceFlow({
        rideId,
        serviceType,
        notes,
        dispatchedBy: getClerkUserId(req) || 'system',
      });

    const serviceNames = {
      police: 'Police',
      ambulance: 'Ambulance',
      fire: 'Fire Department',
      disaster: 'Disaster Management',
    };

    return res.status(200).json({
      success: true,
      message: `${serviceNames[serviceType] || 'Emergency service'} dispatched successfully`,
      data: dispatchRecord,
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

export const getSOSHistory = async (req, res, next) => {
  try {
    const records = await getSosHistory(req.query);

    return res.status(200).json({
      success: true,
      total: records.length,
      count: records.length,
      records,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Create a new driver ride offer (driver offering a ride)
 * POST /api/rides/driver-offer
 * Requires Clerk authentication
 */
export const createDriverRideOffer = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
        requestId: req.requestId,
      });
    }

    const rideOffer = await createDriverRideOfferFlow(clerkId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Ride offer created successfully',
      ride: {
        id: rideOffer._id,
        from: rideOffer.from,
        to: rideOffer.to,
        totalSeats: rideOffer.totalSeats,
        availableSeats: rideOffer.availableSeats,
        farePerSeat: rideOffer.farePerSeat,
        notes: rideOffer.notes,
        womenOnly: rideOffer.womenOnly,
        vehicleType: rideOffer.vehicleType,
        status: rideOffer.status,
        approvalMode: rideOffer.approvalMode,
        requiresManualApproval: rideOffer.requiresManualApproval,
        departureTime: rideOffer.departureTime,
        createdAt: rideOffer.createdAt,
        scheduledDeparture: rideOffer.scheduledDeparture,
        earliestDeparture: rideOffer.earliestDeparture,
        latestDeparture: rideOffer.latestDeparture,
        timeFlexibilityMinutes: rideOffer.timeFlexibilityMinutes,
        driver: rideOffer.driver,
      },
    });
  } catch (error) {
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

/**
 * Cancel a ride request
 * DELETE /api/rides/:rideId/cancel
 * Requires Clerk authentication
 */
export const cancelRide = async (req, res, next) => {
  try {
    const clerkId = getClerkUserId(req) || req.body.clerkId;
    const { rideId } = req.params;
    const result = await cancelRideRequestFlow({ rideId, clerkId });

    if (result.isLocal) {
      return res.status(200).json({
        success: true,
        message: 'Local ride cancelled (no server action needed)',
        ride: result.ride,
      });
    }

    const { ride } = result;

    return res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
      ride: {
        id: ride._id,
        status: ride.status,
      },
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
 * Extend ride departure time
 * PATCH /api/rides/:rideId/extend
 * Requires Clerk authentication
 */
export const extendRideTime = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { newDepartureTime, extensionMinutes } = req.body;
    const clerkId = getClerkUserId(req) || req.body.clerkId;

    const { ride, updatedDepartureTime } = await extendRideRequestDepartureFlow({
      rideId,
      clerkId,
      newDepartureTime,
      extensionMinutes,
    });

    return res.status(200).json({
      success: true,
      message: 'Ride time extended successfully',
      ride: {
        id: ride._id,
        departureTime: updatedDepartureTime,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        details: error.details,
        code: error.code,
        requestId: req.requestId,
      });
    }
    return next(error);
  }
};

/**
 * Get expired rides and auto-remove them
 * GET /api/rides/cleanup-expired
 * Cron job or manual trigger
 */
export const cleanupExpiredRides = async (req, res, next) => {
  try {
    const { cancelledCount, completedCount } =
      await cleanupExpiredRideRequestsFlow();

    return res.status(200).json({
      success: true,
      message: `Cleaned up ${cancelledCount} expired rides and auto-completed ${completedCount} ongoing rides`,
      cancelledCount,
      completedCount,
    });
  } catch (error) {
    return next(error);
  }
};
