import mongoose from 'mongoose';
import { UserProfile, RideRequest, RideOffer } from '../config/models.js';
import { locationService } from '../services/locationService.js';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

// Socket.io instance will be injected
let io = null;

export function setSocketIO(socketInstance) {
  io = socketInstance;
}

const VEHICLE_TYPES = ['two_wheeler', 'three_wheeler', 'four_wheeler'];

const normalizeVehicleType = (value) =>
  VEHICLE_TYPES.includes(value) ? value : 'four_wheeler';

/**
 * Helper to get userId from Clerk auth (works with both old and new API)
 */
const getClerkUserId = (req) => {
  try {
    // Try new API first (function)
    if (typeof req.auth === 'function') {
      return req.auth()?.userId;
    }
    // Fall back to old API (property)
    return req.auth?.userId;
  } catch (error) {
    console.error('❌ Error getting Clerk userId:', error);
    return null;
  }
};

/**
 * Helper to send push notification
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !expo.isExpoPushToken(pushToken)) {
    console.warn('⚠️ Invalid push token:', pushToken);
    return null;
  }

  try {
    const response = await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        badge: 1,
        priority: 'high',
      },
    ]);
    console.log('✅ Push notification sent:', { title, body });
    return response;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return null;
  }
};

/**
 * Helper to validate ride ID before database queries
 * Returns an error response object if invalid, null if valid
 */
const validateRideId = (rideId, res) => {
  // Check for local/temporary ride IDs
  if (rideId && rideId.startsWith('local-')) {
    console.log('ℹ️ Local ride ID detected:', rideId);
    return res.status(400).json({
      error: 'Cannot perform operation on local ride',
      code: 'LOCAL_RIDE_ID',
      details: 'This ride has not been synced to the server yet',
    });
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    console.error('❌ Invalid ride ID format:', rideId);
    return res.status(400).json({
      error: 'Invalid ride ID format',
      code: 'INVALID_RIDE_ID',
      details: `Ride ID "${rideId}" is not a valid format`,
    });
  }

  return null; // Valid ID
};

/**
 * Create a new ride request
 * POST /api/rides/create
 * Requires Clerk authentication
 */
export const createRideRequest = async (req, res, next) => {
  try {
    // Try to get clerkId from auth, fallback to request body
    let clerkId = getClerkUserId(req);

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      console.error('❌ No Clerk ID found in request or body');
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    const {
      from,
      to,
      passengers = 1,
      vehicleType,
      notes = '',
      womenOnly = false,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
      dropoffLatitude,
      dropoffLongitude,
      dropoffCity,
      dropoffCountry,
      scheduledDeparture,
      timeFlexibilityMinutes,
    } = req.body || {};

    if (!from || !to) {
      return res.status(400).json({
        error: 'Invalid ride request',
        details: '`from` and `to` are required',
        code: 'MISSING_FIELDS',
      });
    }

    const parsedPassengers = Number.parseInt(passengers, 10);
    const sanitizedPassengers = Number.isFinite(parsedPassengers)
      ? Math.max(1, parsedPassengers)
      : 1;

    const sanitizedVehicleType = normalizeVehicleType(vehicleType);

    const now = Date.now();
    const requestedDeparture = scheduledDeparture || now;
    const departureDate = new Date(requestedDeparture);

    if (Number.isNaN(departureDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid departure time',
        details:
          'scheduledDeparture must be a valid ISO date string or timestamp',
        code: 'INVALID_DEPARTURE_TIME',
      });
    }

    if (departureDate.getTime() < now - 5 * 60 * 1000) {
      return res.status(400).json({
        error: 'Departure time must be in the future',
        details: 'Please select a future time for the ride',
        code: 'DEPARTURE_IN_PAST',
      });
    }

    const flexInput =
      timeFlexibilityMinutes === undefined || timeFlexibilityMinutes === null
        ? 60
        : Number(timeFlexibilityMinutes);
    const clampedFlex = Number.isFinite(flexInput)
      ? Math.min(Math.max(Math.round(flexInput), 0), 720)
      : 60;
    const earliestDeparture = new Date(
      departureDate.getTime() - clampedFlex * 60 * 1000,
    );
    const latestDeparture = new Date(
      departureDate.getTime() + clampedFlex * 60 * 1000,
    );

    const user = await UserProfile.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'User profile does not exist',
        code: 'USER_NOT_FOUND',
      });
    }

    // Create and save ride request to database
    const rideRequest = new RideRequest({
      userId: user._id,
      clerkId,
      from,
      to,
      passengers: sanitizedPassengers,
      vehicleType: sanitizedVehicleType,
      notes: notes || '',
      womenOnly: womenOnly || false,
      pickupLatitude: pickupLatitude || null,
      pickupLongitude: pickupLongitude || null,
      pickupCity: pickupCity || null,
      pickupCountry: pickupCountry || null,
      dropoffLatitude: dropoffLatitude || null,
      dropoffLongitude: dropoffLongitude || null,
      dropoffCity: dropoffCity || null,
      dropoffCountry: dropoffCountry || null,
      scheduledDeparture: departureDate,
      earliestDeparture,
      latestDeparture,
      timeFlexibilityMinutes: clampedFlex,
      status: 'waiting',
    });

    await rideRequest.save();

    console.log('✅ Ride request saved to database:', {
      rideId: rideRequest._id,
      from,
      to,
      passengers: sanitizedPassengers,
      vehicleType: sanitizedVehicleType,
      womenOnly,
    });

    // Emit socket event for new ride request
    if (io) {
      // Notify all drivers
      io.emit('new_ride_request', {
        rideId: rideRequest._id,
        from: rideRequest.from,
        to: rideRequest.to,
        passengers: rideRequest.passengers,
        vehicleType: rideRequest.vehicleType,
        womenOnly: rideRequest.womenOnly,
        notes: rideRequest.notes,
        scheduledDeparture: rideRequest.scheduledDeparture,
        earliestDeparture: rideRequest.earliestDeparture,
        latestDeparture: rideRequest.latestDeparture,
        timeFlexibilityMinutes: rideRequest.timeFlexibilityMinutes,
        status: rideRequest.status,
        createdAt: rideRequest.createdAt,
        createdBy: clerkId,
      });
      console.log('📡 New ride request broadcasted to all drivers');
    }

    res.status(201).json({
      success: true,
      message: 'Ride request created successfully',
      ride: {
        id: rideRequest._id,
        from: rideRequest.from,
        to: rideRequest.to,
        passengers: rideRequest.passengers,
        notes: rideRequest.notes,
        womenOnly: rideRequest.womenOnly,
        vehicleType: rideRequest.vehicleType,
        status: rideRequest.status,
        createdAt: rideRequest.createdAt,
        scheduledDeparture: rideRequest.scheduledDeparture,
        earliestDeparture: rideRequest.earliestDeparture,
        latestDeparture: rideRequest.latestDeparture,
        timeFlexibilityMinutes: rideRequest.timeFlexibilityMinutes,
      },
    });
  } catch (error) {
    console.error('❌ Create ride error:', error.message);
    next(error);
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
      console.log('⚠️ Using clerkId from request (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth, body, or query)',
        code: 'NO_AUTH_USER',
      });
    }

    const user = await UserProfile.findOne({ clerkId });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: 'User profile does not exist',
        code: 'USER_NOT_FOUND',
      });
    }

    // Get user's ride requests
    const rides = await RideRequest.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(
      `📋 Retrieved ${rides.length} ride requests for user: ${clerkId}`,
    );
    res.status(200).json({
      success: true,
      rides: rides.map((ride) => {
        const scheduledDeparture = ride.scheduledDeparture
          ? new Date(ride.scheduledDeparture).toISOString()
          : null;
        const earliestDeparture = ride.earliestDeparture
          ? new Date(ride.earliestDeparture).toISOString()
          : null;
        const latestDeparture = ride.latestDeparture
          ? new Date(ride.latestDeparture).toISOString()
          : null;
        return {
          id: ride._id,
          from: ride.from,
          to: ride.to,
          passengers: ride.passengers,
          notes: ride.notes,
          womenOnly: ride.womenOnly,
          vehicleType: ride.vehicleType,
          status: ride.status,
          createdAt: ride.createdAt,
          acceptedBy: ride.acceptedBy,
          scheduledDeparture,
          earliestDeparture,
          latestDeparture,
          timeFlexibilityMinutes:
            typeof ride.timeFlexibilityMinutes === 'number'
              ? ride.timeFlexibilityMinutes
              : ride.offeredByDriver
                ? 0
                : 60,
        };
      }),
      message: 'Ride requests retrieved successfully',
    });
  } catch (error) {
    console.error('❌ Get rides error:', error.message);
    next(error);
  }
};

/**
 * Get available rides for drivers (waiting rides)
 * GET /api/rides/available
 * Requires Clerk authentication
 */
export const getAvailableRides = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const type = (req.query.type || 'requests').toString(); // 'requests' | 'offers'

    if (!clerkId) {
      clerkId = req.body.clerkId || req.query.clerkId;
      console.log('⚠️ Using clerkId from request (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth, body, or query)',
        code: 'NO_AUTH_USER',
      });
    }

    // Build query based on type
    const query = { status: 'waiting' };
    const andConditions = [];

    const targetTimeRaw = req.query.targetTime;
    let targetTime = null;
    if (targetTimeRaw) {
      const parsed = new Date(targetTimeRaw);
      if (!Number.isNaN(parsed.getTime())) {
        targetTime = parsed;
      }
    }

    const windowParam = Number.parseInt(req.query.windowMinutes, 10);
    const windowMinutes = Number.isFinite(windowParam)
      ? Math.min(Math.max(windowParam, 0), 720)
      : 60;

    if (targetTime) {
      const windowMs = windowMinutes * 60 * 1000;
      const lowerBound = new Date(targetTime.getTime() - windowMs);
      const upperBound = new Date(targetTime.getTime() + windowMs);
      andConditions.push({ latestDeparture: { $gte: lowerBound } });
      andConditions.push({ earliestDeparture: { $lte: upperBound } });
    }

    if (type === 'offers') {
      // Rides offered by drivers (for passengers to see)
      query.offeredByDriver = true;
    } else {
      // Passenger ride requests (for drivers to see)
      query.$or = [
        { offeredByDriver: { $exists: false } },
        { offeredByDriver: false },
      ];
    }

    // Exclude rides created by the requesting user
    query.clerkId = { $ne: clerkId };

    if (andConditions.length) {
      query.$and = [...(query.$and || []), ...andConditions];
    }

    const availableRides = await RideRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate(
        'userId',
        'firstName lastName profileImage rating gender ridesCompleted',
      );

    // Log 0 rides found as info, not error
    if (availableRides.length === 0) {
      console.log(`📭 0 rides found`);
    } else {
      console.log(
        `🚗 Retrieved ${availableRides.length} ${type} for user: ${clerkId}`,
      );
    }

    res.status(200).json({
      success: true,
      rides: availableRides.map((ride) => {
        const fallbackNow = new Date();
        const scheduledDepartureDate = ride.scheduledDeparture
          ? new Date(ride.scheduledDeparture)
          : ride.departureTime
            ? new Date(ride.departureTime)
            : null;
        const earliestDepartureDate = ride.earliestDeparture
          ? new Date(ride.earliestDeparture)
          : scheduledDepartureDate;
        const latestDepartureDate = ride.latestDeparture
          ? new Date(ride.latestDeparture)
          : scheduledDepartureDate;

        const timeFlexibilityMinutes =
          typeof ride.timeFlexibilityMinutes === 'number'
            ? ride.timeFlexibilityMinutes
            : ride.offeredByDriver
              ? 0
              : 60;

        const base = {
          id: ride._id,
          clerkId: ride.clerkId,
          from: ride.from,
          to: ride.to,
          passengers: ride.passengers,
          notes: ride.notes,
          womenOnly: ride.womenOnly,
          vehicleType: ride.vehicleType,
          status: ride.status,
          createdAt: ride.createdAt,
          pickupLatitude: ride.pickupLatitude,
          pickupLongitude: ride.pickupLongitude,
          pickupCity: ride.pickupCity,
          pickupCountry: ride.pickupCountry,
          dropoffLatitude: ride.dropoffLatitude,
          dropoffLongitude: ride.dropoffLongitude,
          dropoffCity: ride.dropoffCity,
          dropoffCountry: ride.dropoffCountry,
          bookingDetails: ride.bookingDetails,
          pickupStatus: ride.pickupStatus,
          dropoffStatus: ride.dropoffStatus,
          scheduledDeparture: scheduledDepartureDate
            ? scheduledDepartureDate.toISOString()
            : null,
          earliestDeparture: earliestDepartureDate
            ? earliestDepartureDate.toISOString()
            : null,
          latestDeparture: latestDepartureDate
            ? latestDepartureDate.toISOString()
            : null,
          timeFlexibilityMinutes,
        };

        if (type === 'offers') {
          // Driver offers for passengers
          return {
            ...base,
            kind: 'offer',
            driverId: ride.clerkId, // Driver's Clerk user ID for chat functionality
            driverMode: ride.driverMode || 'commuter',
            farePerSeat: ride.farePerSeat || ride.fare || 100,
            departureTime: (
              scheduledDepartureDate || fallbackNow
            ).toISOString(),
            vehicle: {
              model: ride.vehicleModel || 'Vehicle',
              number: ride.vehicleNumber || 'N/A',
              color: ride.vehicleColor || 'Unknown',
            },
            driver: {
              name: `${ride.userId?.firstName || 'Unknown'} ${ride.userId?.lastName || ''}`.trim(),
              rating: ride.userId?.rating || 5,
              gender: ride.userId?.gender || 'other',
              ridesCompleted: ride.userId?.ridesCompleted || 0,
              profileImage: ride.userId?.profileImage,
            },
            availableSeats: Array.from(
              {
                length: Math.max(0, ride.passengers - (ride.bookedSeats || 0)),
              },
              (_, i) => i + 1,
            ),
            totalSeats: ride.passengers || 4,
          };
        }

        // Passenger requests for drivers
        return {
          ...base,
          kind: 'request',
          driverMode: ride.driverMode || 'commuter',
          departureTime: (scheduledDepartureDate || fallbackNow).toISOString(),
          vehicle: {
            model: ride.vehicleModel || 'Vehicle',
            number: ride.vehicleNumber || 'N/A',
            color: ride.vehicleColor || 'Unknown',
          },
          passenger: {
            name: `${ride.userId?.firstName || 'Unknown'} ${ride.userId?.lastName || ''}`.trim(),
            rating: ride.userId?.rating || 5,
            gender: ride.userId?.gender || 'other',
            ridesCompleted: ride.userId?.ridesCompleted || 0,
            profileImage: ride.userId?.profileImage,
          },
          farePerSeat: ride.farePerSeat || ride.fare || 100,
          availableSeats: Array.from(
            { length: Math.max(0, ride.passengers - (ride.bookedSeats || 0)) },
            (_, i) => i + 1,
          ),
          totalSeats: ride.passengers || 4,
        };
      }),
      message:
        availableRides.length === 0
          ? '0 rides found'
          : 'Available rides retrieved successfully',
    });
  } catch (error) {
    console.error('❌ Get available rides error:', error.message);
    next(error);
  }
};

/**
 * Accept a ride request
 * POST /api/rides/:rideId/accept
 * Requires Clerk authentication
 */
export const acceptRide = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    // Validate ride ID
    const validationError = validateRideId(rideId, res);
    if (validationError) return validationError;

    const driver = await UserProfile.findOne({ clerkId });
    if (!driver) {
      return res.status(404).json({
        error: 'Driver not found',
        code: 'DRIVER_NOT_FOUND',
      });
    }

    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    if (ride.status !== 'waiting') {
      return res.status(400).json({
        error: 'Ride is no longer available',
        code: 'RIDE_NOT_AVAILABLE',
      });
    }

    // Update ride with driver info
    ride.status = 'accepted';
    ride.acceptedBy = {
      userId: driver._id,
      clerkId,
      driverName: `${driver.firstName} ${driver.lastName}`.trim(),
      driverRating: driver.rating,
    };
    await ride.save();

    console.log(`✅ Ride ${rideId} accepted by driver ${clerkId}`);
    if (io) {
      io.emit('ride:accepted', {
        rideId: ride._id,
        status: ride.status,
        acceptedBy: ride.acceptedBy,
        driverClerkId: clerkId,
        passengerClerkId: ride.clerkId,
        from: ride.from,
        to: ride.to,
        pickup: {
          latitude: ride.pickupLatitude,
          longitude: ride.pickupLongitude,
          address: ride.from,
        },
        dropoff: {
          latitude: ride.dropoffLatitude,
          longitude: ride.dropoffLongitude,
          address: ride.to,
        },
      });
      console.log('📡 Broadcasted ride acceptance to all clients');
    }

    res.status(200).json({
      success: true,
      message: 'Ride accepted successfully',
      ride: {
        id: ride._id,
        status: ride.status,
        acceptedBy: ride.acceptedBy,
      },
    });
  } catch (error) {
    console.error('❌ Accept ride error:', error.message);
    next(error);
  }
};

/**
 * Passenger confirms booking after payment
 * POST /api/rides/:rideId/booking
 */
export const confirmRideBooking = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    console.log('🔍 Booking confirmation request:', { rideId, clerkId });

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    // Validate ride ID
    const validationError = validateRideId(rideId, res);
    if (validationError) return validationError;

    const ride = await RideRequest.findById(rideId).populate(
      'userId',
      'firstName lastName phone',
    );

    if (!ride) {
      console.error('❌ Ride not found for booking confirmation:', rideId);
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
        details: `No ride found with ID ${rideId}`,
      });
    }

    if (ride.clerkId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        details: 'Only the passenger can confirm this booking',
        code: 'NOT_RIDE_OWNER',
      });
    }

    if (!ride.acceptedBy?.clerkId) {
      return res.status(400).json({
        error: 'Ride has not been accepted by a driver yet',
        code: 'RIDE_NOT_ACCEPTED',
      });
    }

    const {
      seatNumbers = [],
      totalAmount = 0,
      paymentMethod = 'unknown',
      customRequest = '',
      pickupEta,
      passengerPhone,
    } = req.body;

    ride.bookingDetails = {
      confirmedAt: new Date(),
      seatNumbers,
      totalAmount,
      paymentMethod,
      customRequest,
      passengerName:
        `${ride.userId?.firstName || ''} ${ride.userId?.lastName || ''}`.trim() ||
        'Passenger',
      passengerPhone: passengerPhone || ride.userId?.phone || null,
      pickupEta: pickupEta ? new Date(pickupEta) : null,
    };
    ride.status = 'booked';
    ride.updatedAt = new Date();
    await ride.save();

    if (io) {
      io.emit('ride:booked', {
        rideId: ride._id,
        driverClerkId: ride.acceptedBy?.clerkId,
        passengerClerkId: ride.clerkId,
        status: ride.status,
        bookingDetails: ride.bookingDetails,
        from: ride.from,
        to: ride.to,
        pickup: {
          latitude: ride.pickupLatitude,
          longitude: ride.pickupLongitude,
          address: ride.from,
        },
        dropoff: {
          latitude: ride.dropoffLatitude,
          longitude: ride.dropoffLongitude,
          address: ride.to,
        },
      });
      console.log('📡 Broadcasted ride booking confirmation');
    }

    res.status(200).json({
      success: true,
      message: 'Booking confirmed',
      ride: {
        id: ride._id,
        status: ride.status,
        bookingDetails: ride.bookingDetails,
      },
    });
  } catch (error) {
    console.error('❌ Confirm booking error:', error.message);
    next(error);
  }
};

/**
 * Driver confirms that passenger has been picked up
 * POST /api/rides/:rideId/pickup/driver
 */
export const driverConfirmPickup = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    console.log('🔍 Driver pickup confirmation request:', { rideId, clerkId });

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    // Validate ride ID
    const validationError = validateRideId(rideId, res);
    if (validationError) return validationError;

    const ride = await RideRequest.findById(rideId);

    if (!ride) {
      console.error('❌ Ride not found for driver pickup:', rideId);
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
        details: `No ride found with ID ${rideId}`,
      });
    }

    if (ride.acceptedBy?.clerkId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        details: 'Only the assigned driver can confirm pickup',
        code: 'NOT_ASSIGNED_DRIVER',
      });
    }

    ride.pickupStatus = {
      ...ride.pickupStatus,
      driverConfirmedAt: new Date(),
    };
    ride.status = 'ongoing';
    ride.updatedAt = new Date();
    await ride.save();

    if (io) {
      io.emit('ride:pickup-driver', {
        rideId: ride._id,
        driverClerkId: ride.acceptedBy?.clerkId,
        passengerClerkId: ride.clerkId,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
        pickup: {
          latitude: ride.pickupLatitude,
          longitude: ride.pickupLongitude,
          address: ride.from,
        },
        dropoff: {
          latitude: ride.dropoffLatitude,
          longitude: ride.dropoffLongitude,
          address: ride.to,
        },
      });
      console.log('📡 Broadcasted driver pickup confirmation');
    }

    res.status(200).json({
      success: true,
      message: 'Pickup confirmed by driver',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
    });
  } catch (error) {
    console.error('❌ Driver pickup confirmation error:', error.message);
    next(error);
  }
};

/**
 * Passenger confirms they have boarded the vehicle
 * POST /api/rides/:rideId/pickup/passenger
 * Handles both RideRequest and RideOffer
 */
export const passengerConfirmPickup = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    console.log('🔍 Passenger pickup confirmation request:', {
      rideId,
      clerkId,
    });

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      console.error('❌ Invalid ride ID format:', rideId);
      return res.status(400).json({
        error: 'Invalid ride ID format',
        code: 'INVALID_RIDE_ID',
        details: `Ride ID "${rideId}" is not a valid MongoDB ObjectId`,
      });
    }

    // Try to find in RideRequest collection first
    let ride = await RideRequest.findById(rideId);
    let isRideOffer = false;

    // If not found, try RideOffer collection
    if (!ride) {
      ride = await RideOffer.findById(rideId);
      isRideOffer = true;
      console.log('🔄 Checking RideOffer collection...');
    }

    if (!ride) {
      console.error('❌ Ride not found in both collections:', rideId);
      // Log recent rides for debugging
      const recentRequests = await RideRequest.find({ clerkId })
        .select('_id status')
        .limit(3);
      const recentOffers = await RideOffer.find({
        'bookings.passengerClerkId': clerkId,
      })
        .select('_id status')
        .limit(3);
      console.log('📋 Recent requests:', recentRequests);
      console.log('📋 Recent offer bookings:', recentOffers);
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
        details: `No ride found with ID ${rideId}`,
      });
    }

    if (isRideOffer) {
      console.log('✅ Found ride offer, confirming passenger pickup');

      // Check if passenger has a booking for this ride
      const hasBooking = ride.bookings?.some(
        (booking) => booking.passengerClerkId === clerkId,
      );

      if (!hasBooking) {
        return res.status(403).json({
          error: 'Forbidden',
          details: 'You do not have a booking for this ride',
          code: 'NO_BOOKING',
        });
      }

      // Add passenger to confirmedPassengers array if not already confirmed
      if (!ride.pickupStatus) {
        ride.pickupStatus = { confirmedPassengers: [] };
      }
      if (!ride.pickupStatus.confirmedPassengers) {
        ride.pickupStatus.confirmedPassengers = [];
      }

      if (!ride.pickupStatus.confirmedPassengers.includes(clerkId)) {
        ride.pickupStatus.confirmedPassengers.push(clerkId);
      }

      // Update ride status to 'ongoing' if it's still 'waiting'
      if (ride.status === 'waiting') {
        ride.status = 'ongoing';
      }

      ride.updatedAt = new Date();
      await ride.save();

      // Send push notification to driver
      try {
        const driver = await UserProfile.findOne({ clerkId: ride.clerkId });
        if (driver?.pushToken) {
          await sendPushNotification(
            driver.pushToken,
            '✅ Passenger Confirmed Pickup',
            'Your passenger has confirmed pickup. Start the ride now!',
            {
              type: 'passenger_pickup_confirmed',
              rideId: ride._id.toString(),
              rideType: 'offer',
            },
          );
        }
      } catch (error) {
        console.error('❌ Error sending driver notification:', error);
      }

      if (io) {
        io.emit('ride:pickup-passenger', {
          rideId: ride._id,
          rideType: 'offer',
          driverClerkId: ride.clerkId,
          passengerClerkId: clerkId,
          status: ride.status,
          pickupStatus: ride.pickupStatus,
        });
        console.log('📡 Broadcasted passenger pickup confirmation (offer)');
      }

      res.status(200).json({
        success: true,
        message: 'Pickup confirmed by passenger',
        ride: {
          id: ride._id,
          rideType: 'offer',
          status: ride.status,
          pickupStatus: ride.pickupStatus,
        },
      });
    } else {
      console.log('✅ Found ride request, confirming passenger pickup');

      // For ride requests, the passenger is the creator
      if (ride.clerkId !== clerkId) {
        return res.status(403).json({
          error: 'Forbidden',
          details: 'Only the passenger can confirm pickup',
          code: 'NOT_RIDE_OWNER',
        });
      }

      ride.pickupStatus = {
        ...ride.pickupStatus,
        passengerConfirmedAt: new Date(),
      };
      if (ride.status !== 'ongoing') {
        ride.status = 'ongoing';
      }
      ride.updatedAt = new Date();
      await ride.save();

      // Send push notification to driver
      try {
        const driverId = ride.acceptedBy?.clerkId;
        if (driverId) {
          const driver = await UserProfile.findOne({ clerkId: driverId });
          if (driver?.pushToken) {
            await sendPushNotification(
              driver.pushToken,
              '✅ Passenger Confirmed Pickup',
              'Your passenger has confirmed pickup. Start the ride now!',
              {
                type: 'passenger_pickup_confirmed',
                rideId: ride._id.toString(),
                rideType: 'request',
              },
            );
          }
        }
      } catch (error) {
        console.error('❌ Error sending driver notification:', error);
      }

      if (io) {
        io.emit('ride:pickup-passenger', {
          rideId: ride._id,
          rideType: 'request',
          driverClerkId: ride.acceptedBy?.clerkId,
          passengerClerkId: ride.clerkId,
          status: ride.status,
          pickupStatus: ride.pickupStatus,
        });
        console.log('📡 Broadcasted passenger pickup confirmation (request)');
      }

      res.status(200).json({
        success: true,
        message: 'Pickup confirmed by passenger',
        ride: {
          id: ride._id,
          rideType: 'request',
          status: ride.status,
          pickupStatus: ride.pickupStatus,
        },
      });
    }
  } catch (error) {
    console.error('❌ Passenger pickup confirmation error:', error.message);
    next(error);
  }
};

/**
 * Passenger confirms drop-off and completes the ride
 * POST /api/rides/:rideId/complete
 * Handles both RideRequest and RideOffer
 */
export const completeRide = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    console.log('🔍 Ride completion request:', { rideId, clerkId });

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      console.error('❌ Invalid ride ID format:', rideId);
      return res.status(400).json({
        error: 'Invalid ride ID format',
        code: 'INVALID_RIDE_ID',
        details: `Ride ID "${rideId}" is not a valid MongoDB ObjectId`,
      });
    }

    // Try to find in RideRequest collection first
    let ride = await RideRequest.findById(rideId);
    let isRideOffer = false;

    // If not found, try RideOffer collection
    if (!ride) {
      ride = await RideOffer.findById(rideId);
      isRideOffer = true;
      console.log('🔄 Checking RideOffer collection for completion...');
    }

    if (!ride) {
      console.error('❌ Ride not found in both collections:', rideId);
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
        details: `No ride found with ID ${rideId}`,
      });
    }

    if (isRideOffer) {
      console.log('✅ Completing ride offer');

      // Check if passenger has a booking for this ride
      const hasBooking = ride.bookings?.some(
        (booking) => booking.passengerClerkId === clerkId,
      );

      if (!hasBooking) {
        return res.status(403).json({
          error: 'Forbidden',
          details: 'You do not have a booking for this ride',
          code: 'NO_BOOKING',
        });
      }

      // Add passenger to confirmedPassengers in dropoffStatus
      if (!ride.dropoffStatus) {
        ride.dropoffStatus = { confirmedPassengers: [] };
      }
      if (!ride.dropoffStatus.confirmedPassengers) {
        ride.dropoffStatus.confirmedPassengers = [];
      }

      if (!ride.dropoffStatus.confirmedPassengers.includes(clerkId)) {
        ride.dropoffStatus.confirmedPassengers.push(clerkId);
      }

      ride.dropoffStatus.completedAt = new Date();

      // Check if all passengers have confirmed dropoff
      const allPassengersConfirmed = ride.bookings.every((booking) =>
        ride.dropoffStatus.confirmedPassengers.includes(
          booking.passengerClerkId,
        ),
      );

      if (allPassengersConfirmed) {
        ride.status = 'completed';
        ride.completedAt = new Date();
        console.log('✅ All passengers confirmed, ride completed');

        // Process payment to driver
        const totalEarnings = ride.bookings.reduce(
          (sum, booking) => sum + (booking.totalAmount || 0),
          0,
        );
        if (totalEarnings > 0 && ride.clerkId) {
          const platformFee = totalEarnings * 0.07; // 7% platform fee
          const driverEarnings = totalEarnings - platformFee;

          try {
            const driver = await UserProfile.findOne({ clerkId: ride.clerkId });
            if (driver) {
              driver.walletBalance =
                (driver.walletBalance || 0) + driverEarnings;

              if (!driver.walletTransactions) {
                driver.walletTransactions = [];
              }

              driver.walletTransactions.push({
                type: 'credit',
                amount: driverEarnings,
                balance: driver.walletBalance,
                description: `Ride earnings (₹${totalEarnings} - 7% fee)`,
                rideDetails: {
                  rideId: ride._id,
                  from: ride.from,
                  to: ride.to,
                  platformFee,
                },
                timestamp: new Date(),
                transactionId: `txn_${Date.now()}`,
              });

              await driver.save();
              console.log(
                `✅ Transferred ₹${driverEarnings} to driver (fee: ₹${platformFee})`,
              );
            }
          } catch (paymentError) {
            console.error(
              '❌ Error transferring payment to driver:',
              paymentError,
            );
          }
        }

        // End ride tracking
        if (ride.clerkId) {
          locationService.endRide(ride._id.toString(), ride.clerkId);
        }
      }

      ride.updatedAt = new Date();
      await ride.save();

      if (io) {
        io.emit('ride:completed', {
          rideId: ride._id,
          rideType: 'offer',
          driverClerkId: ride.clerkId,
          passengerClerkId: clerkId,
          status: ride.status,
          dropoffStatus: ride.dropoffStatus,
        });
        console.log('📡 Broadcasted ride completion (offer)');
      }

      res.status(200).json({
        success: true,
        message: allPassengersConfirmed
          ? 'Ride completed and payment processed'
          : 'Drop-off confirmed',
        ride: {
          id: ride._id,
          rideType: 'offer',
          status: ride.status,
          dropoffStatus: ride.dropoffStatus,
        },
      });
    } else {
      console.log('✅ Completing ride request');

      // For ride requests, the passenger is the creator
      if (ride.clerkId !== clerkId) {
        return res.status(403).json({
          error: 'Forbidden',
          details: 'Only the passenger can complete the ride',
          code: 'NOT_RIDE_OWNER',
        });
      }

      // Calculate and transfer payment to driver (93% after platform fee)
      if (ride.fare && ride.acceptedBy?.clerkId) {
        const platformFee = ride.fare * 0.07; // 7% platform fee
        const driverEarnings = ride.fare - platformFee;

        try {
          const driver = await UserProfile.findOne({
            clerkId: ride.acceptedBy.clerkId,
          });
          if (driver) {
            driver.walletBalance = (driver.walletBalance || 0) + driverEarnings;

            if (!driver.walletTransactions) {
              driver.walletTransactions = [];
            }

            driver.walletTransactions.push({
              type: 'credit',
              amount: driverEarnings,
              balance: driver.walletBalance,
              description: `Ride earnings (₹${ride.fare} - 7% fee)`,
              rideDetails: {
                rideId: ride._id,
                from: ride.from,
                to: ride.to,
                platformFee,
              },
              timestamp: new Date(),
              transactionId: `txn_${Date.now()}`,
            });

            await driver.save();
            console.log(
              `✅ Transferred ₹${driverEarnings} to driver (fee: ₹${platformFee})`,
            );
          }
        } catch (paymentError) {
          console.error(
            '❌ Error transferring payment to driver:',
            paymentError,
          );
          // Continue with ride completion even if payment fails
        }
      }

      ride.dropoffStatus = {
        ...ride.dropoffStatus,
        passengerConfirmedAt: new Date(),
        completedAt: new Date(),
      };
      ride.status = 'completed';
      ride.completedAt = new Date();
      ride.updatedAt = new Date();
      await ride.save();

      if (ride.acceptedBy?.clerkId) {
        locationService.endRide(ride._id.toString(), ride.acceptedBy.clerkId);
      }

      if (io) {
        io.emit('ride:completed', {
          rideId: ride._id,
          rideType: 'request',
          driverClerkId: ride.acceptedBy?.clerkId,
          passengerClerkId: ride.clerkId,
          status: ride.status,
          dropoffStatus: ride.dropoffStatus,
        });
        console.log('📡 Broadcasted ride completion (request)');
      }

      res.status(200).json({
        success: true,
        message: 'Ride marked as completed and payment processed',
        ride: {
          id: ride._id,
          rideType: 'request',
          status: ride.status,
          dropoffStatus: ride.dropoffStatus,
        },
      });
    }
  } catch (error) {
    console.error('❌ Complete ride error:', error.message);
    next(error);
  }
};

/**
 * Start ride (passenger initiates)
 * POST /api/rides/:rideId/start
 */
export const startRide = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    if (!clerkId) {
      clerkId = req.body.clerkId;
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
        code: 'NO_AUTH_USER',
      });
    }

    const ride = await RideRequest.findById(rideId);

    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    if (ride.clerkId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        details: 'Only the passenger can start the ride',
        code: 'NOT_RIDE_OWNER',
      });
    }

    if (!ride.acceptedBy?.clerkId) {
      return res.status(400).json({
        error: 'Bad Request',
        details: 'Ride must be accepted by a driver first',
        code: 'NO_DRIVER',
      });
    }

    // Update ride status
    ride.status = 'awaiting_driver_confirmation';
    ride.updatedAt = new Date();
    await ride.save();

    // Notify driver to confirm seating
    if (io) {
      io.emit('ride:start_requested', {
        rideId: ride._id,
        driverClerkId: ride.acceptedBy.clerkId,
        passengerClerkId: ride.clerkId,
        passengerName: ride.passenger,
      });
      console.log('📡 Notified driver to confirm seating');
    }

    res.status(200).json({
      success: true,
      message: 'Driver notified to confirm seating',
      ride: {
        id: ride._id,
        status: ride.status,
      },
    });
  } catch (error) {
    console.error('❌ Start ride error:', error.message);
    next(error);
  }
};

/**
 * Driver confirms seating and starts ride
 * POST /api/rides/:rideId/confirm-start
 */
export const driverConfirmStart = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    if (!clerkId) {
      clerkId = req.body.clerkId;
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
        code: 'NO_AUTH_USER',
      });
    }

    const ride = await RideRequest.findById(rideId);

    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    if (ride.acceptedBy?.clerkId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        details: 'Only the assigned driver can confirm start',
        code: 'NOT_ASSIGNED_DRIVER',
      });
    }

    // Update ride to in progress
    ride.status = 'in_progress';
    ride.pickupStatus = {
      ...ride.pickupStatus,
      driverConfirmedAt: new Date(),
    };
    ride.updatedAt = new Date();
    await ride.save();

    // Notify passenger that ride has started
    if (io) {
      io.emit('ride:started', {
        rideId: ride._id,
        driverClerkId: ride.acceptedBy.clerkId,
        passengerClerkId: ride.clerkId,
        status: 'in_progress',
      });
      console.log('📡 Broadcasted ride started');
    }

    res.status(200).json({
      success: true,
      message: 'Ride started successfully',
      ride: {
        id: ride._id,
        status: ride.status,
        pickupStatus: ride.pickupStatus,
      },
    });
  } catch (error) {
    console.error('❌ Driver confirm start error:', error.message);
    next(error);
  }
};

/**
 * Create a new driver ride offer (driver offering a ride)
 * POST /api/rides/driver-offer
 * Requires Clerk authentication
 */
export const createDriverRideOffer = async (req, res, next) => {
  try {
    console.log('📨 createDriverRideOffer - Request received');
    console.log('📨 Request headers:', {
      hasAuth: !!req.headers.authorization,
      hasClerk: !!req.headers['x-clerk-auth'],
    });
    console.log('📨 Request user from Clerk middleware:', req.user);

    let clerkId = getClerkUserId(req);
    console.log('🔍 clerkId from getClerkUserId:', clerkId);

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log(
        '⚠️ Using clerkId from request body (auth not available):',
        clerkId,
      );
    }

    if (!clerkId) {
      console.log('❌ No clerkId found - returning 401');
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    console.log('✅ clerkId authenticated:', clerkId);
    const {
      from,
      to,
      passengers,
      vehicleType,
      notes,
      womenOnly,
      fare,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
      scheduledDeparture,
      timeFlexibilityMinutes,
    } = req.body;

    // Validation
    if (!from || !to) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'from and to locations are required',
        code: 'MISSING_FIELDS',
      });
    }

    if (!passengers || passengers < 1 || passengers > 4) {
      return res.status(400).json({
        error: 'Invalid passenger count',
        details: 'Passenger count must be between 1 and 4',
        code: 'INVALID_PASSENGERS',
      });
    }

    const sanitizedVehicleType = normalizeVehicleType(vehicleType);

    const now = Date.now();
    const departureSource = scheduledDeparture || now;
    const departureDate = new Date(departureSource);

    if (Number.isNaN(departureDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid departure time',
        details:
          'scheduledDeparture must be a valid ISO date string or timestamp',
        code: 'INVALID_DEPARTURE_TIME',
      });
    }

    if (departureDate.getTime() < now - 5 * 60 * 1000) {
      return res.status(400).json({
        error: 'Departure time must be in the future',
        details: 'Please select a future departure time',
        code: 'DEPARTURE_IN_PAST',
      });
    }

    const flexMinutesInput =
      timeFlexibilityMinutes === undefined || timeFlexibilityMinutes === null
        ? 0
        : Number(timeFlexibilityMinutes);
    const flexMinutes = Number.isFinite(flexMinutesInput)
      ? Math.min(Math.max(Math.round(flexMinutesInput), 0), 720)
      : 0;
    const earliestDeparture = new Date(
      departureDate.getTime() - flexMinutes * 60 * 1000,
    );
    const latestDeparture = new Date(
      departureDate.getTime() + flexMinutes * 60 * 1000,
    );

    // Find driver
    const driver = await UserProfile.findOne({ clerkId });
    if (!driver) {
      return res.status(404).json({
        error: 'User not found',
        details: 'User profile does not exist',
        code: 'USER_NOT_FOUND',
      });
    }

    // Create and save driver ride offer to database
    const rideOffer = new RideOffer({
      userId: driver._id,
      clerkId,
      driverId: clerkId,
      from,
      to,
      totalSeats: passengers + 1, // +1 for driver
      availableSeats: Array.from({ length: passengers }, (_, i) => i + 2), // Seats 2, 3, 4, etc. (1 is driver)
      farePerSeat: fare || 0,
      vehicleType: sanitizedVehicleType,
      notes: notes || '',
      womenOnly: womenOnly || false,
      pickupLatitude: pickupLatitude || null,
      pickupLongitude: pickupLongitude || null,
      pickupCity: pickupCity || null,
      pickupCountry: pickupCountry || null,
      departureTime: departureDate,
      scheduledDeparture: departureDate,
      earliestDeparture,
      latestDeparture,
      timeFlexibilityMinutes: flexMinutes,
      status: 'waiting',
      approvalMode: 'manual',
      requiresManualApproval: true,
      seatLocks: [],
      driver: {
        name: `${driver.firstName} ${driver.lastName}`.trim(),
        profileImage: driver.profileImage,
        rating: driver.rating || 5,
        ridesCompleted: driver.totalTrips || 0,
        gender: driver.gender || 'other',
      },
      vehicle: driver.vehicle || {},
    });

    await rideOffer.save();

    console.log('✅ Driver ride offer saved to database:', {
      rideId: rideOffer._id,
      driverName: `${driver.firstName} ${driver.lastName}`.trim(),
      from,
      to,
      totalSeats: passengers + 1,
      availableSeats: rideOffer.availableSeats,
      farePerSeat: fare,
      approvalMode: rideOffer.approvalMode,
      requiresManualApproval: rideOffer.requiresManualApproval,
    });

    // Emit socket event for new driver ride offer
    if (io) {
      // Notify all passengers
      io.emit('new_driver_offer', {
        offerId: rideOffer._id,
        from: rideOffer.from,
        to: rideOffer.to,
        totalSeats: rideOffer.totalSeats,
        availableSeats: rideOffer.availableSeats,
        farePerSeat: rideOffer.farePerSeat,
        womenOnly: rideOffer.womenOnly,
        vehicleType: rideOffer.vehicleType,
        notes: rideOffer.notes,
        departureTime: rideOffer.departureTime,
        scheduledDeparture: rideOffer.scheduledDeparture,
        earliestDeparture: rideOffer.earliestDeparture,
        latestDeparture: rideOffer.latestDeparture,
        timeFlexibilityMinutes: rideOffer.timeFlexibilityMinutes,
        status: rideOffer.status,
        approvalMode: rideOffer.approvalMode,
        requiresManualApproval: rideOffer.requiresManualApproval,
        createdAt: rideOffer.createdAt,
        driver: {
          clerkId: clerkId,
          name: `${driver.firstName} ${driver.lastName}`.trim(),
          rating: driver.rating,
          profileImage: driver.profileImage,
        },
      });
      console.log('📡 New driver ride offer broadcasted to all passengers');
    }

    res.status(201).json({
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
        driver: {
          name: `${driver.firstName} ${driver.lastName}`.trim(),
          rating: driver.rating,
        },
      },
    });
  } catch (error) {
    console.error('❌ Create driver ride offer error:', error.message);
    next(error);
  }
};

/**
 * Cancel a ride request
 * DELETE /api/rides/:rideId/cancel
 * Requires Clerk authentication
 */
export const cancelRide = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    const { rideId } = req.params;

    console.log('🔍 Cancel ride request:', {
      rideId,
      clerkId,
      type: typeof rideId,
    });

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required (via auth or body)',
        code: 'NO_AUTH_USER',
      });
    }

    // Check for local/temporary ride IDs (created on frontend before server sync)
    if (rideId && rideId.startsWith('local-')) {
      console.log(
        '✅ Local ride ID detected, returning success without DB operation',
      );
      return res.status(200).json({
        success: true,
        message: 'Local ride cancelled (no server action needed)',
        ride: {
          id: rideId,
          status: 'cancelled',
          isLocal: true,
        },
      });
    }

    // Validate ObjectId format for database queries
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      console.error('❌ Invalid ride ID format:', rideId);
      return res.status(400).json({
        error: 'Invalid ride ID format',
        code: 'INVALID_RIDE_ID',
        details: `Ride ID "${rideId}" is not a valid format`,
      });
    }

    console.log('🔍 Valid ObjectId, proceeding with DB query');
    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND',
      });
    }

    // Check if user is the owner of the ride
    if (ride.clerkId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        details: 'You can only cancel your own rides',
        code: 'NOT_RIDE_OWNER',
      });
    }

    // Can only cancel rides that are waiting or accepted
    if (!['waiting', 'accepted'].includes(ride.status)) {
      return res.status(400).json({
        error: 'Cannot cancel ride',
        details: `Ride cannot be cancelled when status is ${ride.status}`,
        code: 'INVALID_RIDE_STATUS',
      });
    }

    // Update ride status to cancelled
    ride.status = 'cancelled';
    await ride.save();

    console.log(`✅ Ride ${rideId} cancelled by ${clerkId}`);

    // Emit socket event for ride cancellation
    if (io) {
      io.emit('ride:cancelled', {
        id: ride._id,
        status: ride.status,
        cancelledBy: clerkId,
      });
      console.log('📡 Broadcasted ride cancellation to all clients');
    }

    res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
      ride: {
        id: ride._id,
        status: ride.status,
      },
    });
  } catch (error) {
    console.error('❌ Cancel ride error:', error.message);
    next(error);
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

    let clerkId = getClerkUserId(req);
    if (!clerkId) {
      clerkId = req.body.clerkId;
    }

    if (!clerkId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!newDepartureTime && !extensionMinutes) {
      return res.status(400).json({
        success: false,
        message: 'Either newDepartureTime or extensionMinutes is required',
      });
    }

    // Find the ride
    const ride = await RideRequest.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user is the owner
    if (ride.clerkId !== clerkId) {
      return res.status(403).json({
        success: false,
        message: 'Only the ride creator can extend the time',
      });
    }

    // Calculate new departure time
    let updatedDepartureTime;
    if (newDepartureTime) {
      updatedDepartureTime = new Date(newDepartureTime);
    } else {
      const currentTime = new Date(ride.departureTime);
      updatedDepartureTime = new Date(
        currentTime.getTime() + extensionMinutes * 60000,
      );
    }

    // Update the ride
    ride.departureTime = updatedDepartureTime;
    await ride.save();

    console.log(
      `⏰ Extended ride ${rideId} departure time to ${updatedDepartureTime}`,
    );

    // Notify all connected clients about the time extension
    if (io) {
      io.emit('ride:time-extended', {
        rideId: ride._id,
        newDepartureTime: updatedDepartureTime,
        from: ride.from,
        to: ride.to,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ride time extended successfully',
      ride: {
        id: ride._id,
        departureTime: updatedDepartureTime,
      },
    });
  } catch (error) {
    console.error('❌ Extend ride time error:', error.message);
    next(error);
  }
};

/**
 * Get expired rides and auto-remove them
 * GET /api/rides/cleanup-expired
 * Cron job or manual trigger
 */
export const cleanupExpiredRides = async (req, res, next) => {
  try {
    const now = new Date();
    // Remove rides that are 5 minutes past their scheduled departure time
    const expirationTime = new Date(now.getTime() - 5 * 60000);
    const estimatedTripDuration = 3 * 60 * 60 * 1000; // 3 hours estimated trip duration

    // 1. AUTO-COMPLETE: Find ongoing/booked rides that should be completed
    // (scheduledDeparture + 3 hours has passed)
    const ridesForCompletion = await RideRequest.find({
      $or: [
        { scheduledDeparture: { $lt: new Date(now - estimatedTripDuration) } },
        { earliestDeparture: { $lt: new Date(now - estimatedTripDuration) } },
      ],
      status: { $in: ['ongoing', 'booked'] },
    });

    let completedCount = 0;
    for (const ride of ridesForCompletion) {
      ride.status = 'completed';
      ride.completedAt = now;
      await ride.save();
      completedCount++;
      console.log(`✅ Auto-completed ride request: ${ride._id}`);
    }

    // 2. AUTO-CANCEL: Find expired ride requests that never got accepted
    const expiredRides = await RideRequest.find({
      $or: [
        { scheduledDeparture: { $lt: expirationTime } },
        { earliestDeparture: { $lt: expirationTime } },
      ],
      status: { $in: ['waiting', 'accepted'] },
    });

    let cancelledCount = 0;
    for (const ride of expiredRides) {
      ride.status = 'cancelled';
      await ride.save();
      cancelledCount++;
      console.log(`🗑️ Auto-cancelled expired ride request: ${ride._id}`);

      // Notify client about expired ride
      if (io) {
        io.emit('ride:expired', {
          rideId: ride._id,
          from: ride.from,
          to: ride.to,
        });
      }
    }

    console.log(
      `🧹 Cleanup complete: ${cancelledCount} cancelled, ${completedCount} auto-completed`,
    );

    res.status(200).json({
      success: true,
      message: `Cleaned up ${cancelledCount} expired rides and auto-completed ${completedCount} ongoing rides`,
      cancelledCount,
      completedCount,
    });
  } catch (error) {
    console.error('❌ Cleanup expired rides error:', error.message);
    next(error);
  }
};
