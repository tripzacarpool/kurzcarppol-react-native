import {
  confirmRideOfferPassengerPickupFlow,
  initiateRideOfferPickupFlow,
} from '../services/rideOfferLifecycleService.js';
import { getClerkUserId } from '../middleware/clerkAuth.js';

const sendPickupError = (req, res, error, fallbackCode) =>
  res.status(error.status || 500).json({
    error: error.message,
    details: error.details,
    code: error.code || fallbackCode,
    requestId: req.requestId,
  });

export const driverInitiatePickup = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { bookingId, passengerClerkId } = req.body;
    const clerkId = getClerkUserId(req);
    const { ride } = await initiateRideOfferPickupFlow({
      offerId: rideId,
      bookingId,
      passengerClerkId,
      driverClerkId: clerkId,
    });

    return res.status(200).json({
      success: true,
      message: 'Pickup initiated, waiting for passenger confirmation',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
    });
  } catch (error) {
    if (error.status) {
      return sendPickupError(req, res, error, 'PICKUP_INITIATE_ERROR');
    }
    return next(error);
  }
};

export const passengerConfirmPickup = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { bookingId } = req.body;
    const clerkId = getClerkUserId(req);
    const { ride } =
      await confirmRideOfferPassengerPickupFlow({
        offerId: rideId,
        bookingId,
        passengerClerkId: clerkId,
      });

    return res.status(200).json({
      success: true,
      message: 'Pickup confirmed',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
    });
  } catch (error) {
    if (error.status) {
      return sendPickupError(req, res, error, 'PICKUP_CONFIRM_ERROR');
    }
    return next(error);
  }
};
