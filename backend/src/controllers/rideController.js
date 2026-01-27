import { UserProfile, RideRequest } from '../config/models.js';

// Socket.io instance will be injected
let io = null;

export function setSocketIO(socketInstance) {
  io = socketInstance;
}

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
      passengers,
      notes,
      womenOnly,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
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

    // Find user
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
      passengers,
      notes: notes || '',
      womenOnly: womenOnly || false,
      pickupLatitude: pickupLatitude || null,
      pickupLongitude: pickupLongitude || null,
      pickupCity: pickupCity || null,
      pickupCountry: pickupCountry || null,
      status: 'waiting',
    });

    await rideRequest.save();

    console.log('✅ Ride request saved to database:', {
      rideId: rideRequest._id,
      from,
      to,
      passengers,
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
        womenOnly: rideRequest.womenOnly,
        notes: rideRequest.notes,
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
        status: rideRequest.status,
        createdAt: rideRequest.createdAt,
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
      rides: rides.map((ride) => ({
        id: ride._id,
        from: ride.from,
        to: ride.to,
        passengers: ride.passengers,
        notes: ride.notes,
        womenOnly: ride.womenOnly,
        status: ride.status,
        createdAt: ride.createdAt,
        acceptedBy: ride.acceptedBy,
      })),
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
        const base = {
          id: ride._id,
          clerkId: ride.clerkId,
          from: ride.from,
          to: ride.to,
          passengers: ride.passengers,
          notes: ride.notes,
          womenOnly: ride.womenOnly,
          status: ride.status,
          createdAt: ride.createdAt,
          pickupLatitude: ride.pickupLatitude,
          pickupLongitude: ride.pickupLongitude,
          pickupCity: ride.pickupCity,
          pickupCountry: ride.pickupCountry,
        };

        if (type === 'offers') {
          // Driver offers for passengers
          return {
            ...base,
            kind: 'offer',
            driverMode: ride.driverMode || 'commuter',
            farePerSeat: ride.farePerSeat || ride.fare || 100,
            departureTime: ride.departureTime || new Date().toISOString(),
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
          departureTime: ride.departureTime || new Date().toISOString(),
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

    // Emit socket event for ride acceptance
    if (io) {
      io.emit('ride:accepted', {
        id: ride._id,
        status: ride.status,
        acceptedBy: ride.acceptedBy,
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
      notes,
      womenOnly,
      fare,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
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
    const rideOffer = new RideRequest({
      userId: driver._id,
      clerkId,
      from,
      to,
      passengers,
      notes: notes || '',
      womenOnly: womenOnly || false,
      fare: fare || 0,
      pickupLatitude: pickupLatitude || null,
      pickupLongitude: pickupLongitude || null,
      pickupCity: pickupCity || null,
      pickupCountry: pickupCountry || null,
      offeredByDriver: true,
      status: 'waiting',
    });

    await rideOffer.save();

    console.log('✅ Driver ride offer saved to database:', {
      rideId: rideOffer._id,
      driverName: `${driver.firstName} ${driver.lastName}`.trim(),
      from,
      to,
      passengers,
      fare,
    });

    // Emit socket event for new driver ride offer
    if (io) {
      // Notify all passengers
      io.emit('new_driver_offer', {
        offerId: rideOffer._id,
        from: rideOffer.from,
        to: rideOffer.to,
        passengers: rideOffer.passengers,
        womenOnly: rideOffer.womenOnly,
        fare: rideOffer.fare,
        notes: rideOffer.notes,
        status: rideOffer.status,
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
        passengers: rideOffer.passengers,
        notes: rideOffer.notes,
        womenOnly: rideOffer.womenOnly,
        fare: rideOffer.fare,
        offeredByDriver: rideOffer.offeredByDriver,
        status: rideOffer.status,
        createdAt: rideOffer.createdAt,
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
