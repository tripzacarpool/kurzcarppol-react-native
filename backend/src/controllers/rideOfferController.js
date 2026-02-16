import mongoose from 'mongoose';
import { UserProfile, RideOffer } from '../config/models.js';
import { locationService } from '../services/locationService.js';
import { Expo } from 'expo-server-sdk';

// Socket.io instance will be injected
let io = null;

// Expo notification client
const expo = new Expo();

export function setSocketIO(socketInstance) {
  io = socketInstance;
}

const VEHICLE_TYPES = ['two_wheeler', 'three_wheeler', 'four_wheeler'];
const normalizeVehicleType = (value) =>
  VEHICLE_TYPES.includes(value) ? value : 'four_wheeler';

/**
 * Helper to get userId from Clerk auth
 */
const getClerkUserId = (req) => {
  try {
    if (typeof req.auth === 'function') {
      return req.auth()?.userId;
    }
    return req.auth?.userId;
  } catch (error) {
    console.error('❌ Error getting Clerk userId:', error);
    return null;
  }
};

/**
 * Create a new ride offer
 * POST /api/ride-offers/create
 */
export const createRideOffer = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
        code: 'NO_AUTH_USER',
      });
    }

    const {
      from,
      to,
      totalSeats = 4,
      availableSeats: requestAvailableSeats, // Seats selected by driver
      farePerSeat = 0,
      vehicleType,
      driverMode = 'commuter',
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
      departureTime,
      scheduledDeparture,
      timeFlexibilityMinutes,
      vehicle,
      driver,
      // Festival Special Pool fields
      festivalType = null,
      festivalConfig = {},
    } = req.body || {};

    if (!from || !to) {
      return res.status(400).json({
        error: 'Invalid ride offer',
        details: '`from` and `to` are required',
        code: 'MISSING_FIELDS',
      });
    }

    if (!departureTime) {
      return res.status(400).json({
        error: 'Invalid ride offer',
        details: '`departureTime` is required',
        code: 'MISSING_DEPARTURE_TIME',
      });
    }

    // Get user profile
    const userProfile = await UserProfile.findOne({ clerkId });
    if (!userProfile) {
      return res.status(404).json({
        error: 'User not found',
        details: 'No user profile found for this clerkId',
        code: 'USER_NOT_FOUND',
      });
    }

    // Check for potential duplicate rides (same route, similar time, active status)
    const departureDate = new Date(departureTime);
    const timeWindow = 15 * 60 * 1000; // 15 minutes window
    const existingRide = await RideOffer.findOne({
      clerkId,
      from: from.trim(),
      to: to.trim(),
      status: { $in: ['waiting', 'accepted', 'booked'] },
      departureTime: {
        $gte: new Date(departureDate.getTime() - timeWindow),
        $lte: new Date(departureDate.getTime() + timeWindow),
      },
    });

    if (existingRide) {
      console.log(`⚠️ Potential duplicate ride detected for user ${clerkId}`);
      return res.status(409).json({
        error: 'Duplicate ride detected',
        details: `You already have an active ride from ${from} to ${to} at a similar time. Please edit that ride or cancel it first.`,
        code: 'DUPLICATE_RIDE',
        existingRideId: existingRide._id,
      });
    }

    // Generate available seats array
    // Use driver's selection if provided, otherwise auto-generate excluding driver seat (Seat 1)
    let availableSeats;
    if (
      requestAvailableSeats &&
      Array.isArray(requestAvailableSeats) &&
      requestAvailableSeats.length > 0
    ) {
      // Filter out Seat 1 (driver) if it was somehow included
      availableSeats = requestAvailableSeats.filter((seat) => seat !== 1);
      console.log(
        `✅ Using driver-selected seats: [${availableSeats.join(', ')}]`,
      );
    } else {
      // Auto-generate: Seats 2, 3, 4, ... (never include Seat 1 - driver seat)
      availableSeats = Array.from({ length: totalSeats - 1 }, (_, i) => i + 2);
      console.log(
        `⚠️ No seats selected, auto-generating: [${availableSeats.join(', ')}]`,
      );
    }

    // Validate that Seat 1 is not in availableSeats (double-check)
    if (availableSeats.includes(1)) {
      console.error(
        '❌ ERROR: Driver seat (Seat 1) found in availableSeats! Removing it.',
      );
      availableSeats = availableSeats.filter((seat) => seat !== 1);
    }

    // Sanitize festival fields - convert empty strings to null
    const sanitizedFestivalType =
      festivalType && festivalType.trim() !== '' ? festivalType : null;
    const sanitizedFestivalConfig = festivalConfig || {};
    if (sanitizedFestivalConfig.tier === '') {
      sanitizedFestivalConfig.tier = null;
    }

    // Create ride offer
    const rideOffer = new RideOffer({
      userId: userProfile._id,
      clerkId,
      driverId: clerkId, // Driver's clerkId for approval system
      from,
      to,
      totalSeats,
      availableSeats,
      farePerSeat,
      vehicleType: normalizeVehicleType(vehicleType),
      driverMode,
      notes,
      womenOnly,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
      dropoffLatitude,
      dropoffLongitude,
      dropoffCity,
      dropoffCountry,
      departureTime: new Date(departureTime),
      scheduledDeparture: scheduledDeparture
        ? new Date(scheduledDeparture)
        : null,
      timeFlexibilityMinutes: timeFlexibilityMinutes || 60,
      status: 'waiting',
      // Approval system fields - ALL rides require driver approval
      approvalMode: 'manual',
      requiresManualApproval: true,
      seatLocks: [],
      // Festival Special Pool fields (optional - only set by admin)
      festivalType: sanitizedFestivalType,
      festivalConfig: sanitizedFestivalConfig,
      vehicle: vehicle || {
        model: userProfile.vehicleInfo?.model || 'Vehicle',
        color: userProfile.vehicleInfo?.color || 'Unknown',
        number: userProfile.vehicleInfo?.licensePlate || 'N/A',
      },
      driver: driver || {
        name:
          `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() ||
          userProfile.email,
        profileImage:
          userProfile.profileImage || 'https://www.gravatar.com/avatar?d=mp',
        rating: userProfile.rating || 5,
        ridesCompleted: userProfile.totalTrips || 0,
        gender: userProfile.gender || 'other',
      },
      bookings: [],
    });

    await rideOffer.save();

    console.log('✅ Ride offer created with manual approval:', {
      rideId: rideOffer._id,
      from: rideOffer.from,
      to: rideOffer.to,
      approvalMode: rideOffer.approvalMode,
      requiresManualApproval: rideOffer.requiresManualApproval,
      driverId: rideOffer.driverId,
    });

    // Broadcast new offer via Socket.IO
    if (io) {
      io.emit('newRideOffer', rideOffer);
      console.log('🔔 Broadcasted new ride offer:', rideOffer._id);
    }

    return res.status(201).json({
      success: true,
      rideOffer,
      message: 'Ride offer created successfully',
    });
  } catch (error) {
    console.error('❌ Error creating ride offer:', error);
    next(error);
  }
};

/** * Update an existing ride offer
 * PUT /api/ride-offers/:id
 */
export const updateRideOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    let clerkId = getClerkUserId(req);

    if (!clerkId) {
      clerkId = req.body.clerkId;
      console.log('⚠️ Using clerkId from request body (auth not available)');
    }

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
        code: 'NO_AUTH_USER',
      });
    }

    console.log('🔍 Update request for ID:', id, 'by user:', clerkId);

    // Handle local/temporary IDs (from frontend before sync with backend)
    if (id.startsWith('local-') || id.length !== 24) {
      console.log('❌ Cannot update local/temporary ride offer:', id);
      return res.status(400).json({
        error: 'Invalid ride offer ID',
        details:
          'Cannot update local/temporary ride offers. Please create a new offer instead.',
        code: 'INVALID_TEMP_ID',
      });
    }

    // Validate if the ID is a proper MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('❌ Invalid MongoDB ObjectId format:', id);
      return res.status(400).json({
        error: 'Invalid ride offer ID',
        details: 'The provided ID is not a valid MongoDB ObjectId',
        code: 'INVALID_OBJECT_ID',
      });
    }

    // Find the existing ride offer
    const existingOffer = await RideOffer.findById(id);
    if (!existingOffer) {
      return res.status(404).json({
        error: 'Ride offer not found',
        code: 'OFFER_NOT_FOUND',
      });
    }

    // Check if the user is the owner of this ride offer
    if (existingOffer.clerkId !== clerkId) {
      console.log('❌ Ownership check failed:', {
        offerClerkId: existingOffer.clerkId,
        requestClerkId: clerkId,
        offerId: id,
      });
      return res.status(403).json({
        error: 'Forbidden',
        details: 'You can only update your own ride offers',
        code: 'NOT_OWNER',
      });
    }

    const {
      from,
      to,
      totalSeats,
      availableSeats,
      farePerSeat,
      vehicleType,
      driverMode,
      notes,
      womenOnly,
      pickupLatitude,
      pickupLongitude,
      pickupCity,
      pickupCountry,
      dropoffLatitude,
      dropoffLongitude,
      dropoffCity,
      dropoffCountry,
      departureTime,
      scheduledDeparture,
      timeFlexibilityMinutes,
      vehicle,
    } = req.body || {};

    // Prepare update data
    const updateData = {};
    if (from !== undefined) updateData.from = from;
    if (to !== undefined) updateData.to = to;
    if (totalSeats !== undefined) updateData.totalSeats = totalSeats;
    if (availableSeats !== undefined)
      updateData.availableSeats = availableSeats;
    if (farePerSeat !== undefined) updateData.farePerSeat = farePerSeat;
    if (vehicleType !== undefined)
      updateData.vehicleType = normalizeVehicleType(vehicleType);
    if (driverMode !== undefined) updateData.driverMode = driverMode;
    if (notes !== undefined) updateData.notes = notes;
    if (womenOnly !== undefined) updateData.womenOnly = womenOnly;
    if (departureTime !== undefined)
      updateData.departureTime = new Date(departureTime);
    if (scheduledDeparture !== undefined)
      updateData.scheduledDeparture = scheduledDeparture;
    if (timeFlexibilityMinutes !== undefined)
      updateData.timeFlexibilityMinutes = timeFlexibilityMinutes;

    // Update location data if provided
    if (pickupLatitude !== undefined && pickupLongitude !== undefined) {
      updateData.pickupLocation = {
        type: 'Point',
        coordinates: [pickupLongitude, pickupLatitude],
      };
      if (pickupCity) updateData.pickupCity = pickupCity;
      if (pickupCountry) updateData.pickupCountry = pickupCountry;
    }

    if (dropoffLatitude !== undefined && dropoffLongitude !== undefined) {
      updateData.dropoffLocation = {
        type: 'Point',
        coordinates: [dropoffLongitude, dropoffLatitude],
      };
      if (dropoffCity) updateData.dropoffCity = dropoffCity;
      if (dropoffCountry) updateData.dropoffCountry = dropoffCountry;
    }

    if (vehicle !== undefined) updateData.vehicle = vehicle;

    // Ensure driverId is populated (for backward compatibility with old rides)
    if (!existingOffer.driverId && existingOffer.clerkId) {
      updateData.driverId = existingOffer.clerkId;
      console.log('✅ Adding driverId to update for backward compatibility');
    }

    // Update the ride offer
    const updatedOffer = await RideOffer.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    console.log('✅ Ride offer updated:', updatedOffer._id);

    // Emit socket event for real-time updates to passengers
    if (io && existingOffer.bookings && existingOffer.bookings.length > 0) {
      io.emit('rideOfferUpdated', {
        rideOfferId: updatedOffer._id,
        updatedData: updateData,
        timestamp: new Date(),
      });
      console.log('📡 Socket event emitted for ride offer update');
    }

    res.status(200).json({
      success: true,
      message: 'Ride offer updated successfully',
      rideOffer: updatedOffer,
    });
  } catch (error) {
    console.error('❌ Update ride offer error:', error);
    next(error);
  }
};

/** * Get all available ride offers
 * GET /api/ride-offers/available
 */
export const getAvailableRideOffers = async (req, res, next) => {
  try {
    const { from, to, minSeats = 1, includeOwn } = req.query;
    const now = new Date();

    // Extract clerkId from auth (preferred) or query params (fallback)
    let clerkId = getClerkUserId(req);
    if (!clerkId) {
      clerkId = req.query.clerkId;
      console.log('⚠️ Using clerkId from query params (auth not available)');
    }

    console.log('🔍 Fetching available ride offers:', {
      from,
      to,
      minSeats,
      includeOwn,
      clerkId,
      currentTime: now,
    });

    const query = {
      status: 'waiting', // Only waiting rides (available for new bookings)
      availableSeats: { $exists: true, $ne: [] }, // Must have available seats
      departureTime: { $gte: now }, // Only future rides
    };

    // Filter out user's own rides unless explicitly requested
    if (clerkId && includeOwn !== 'true') {
      query.clerkId = { $ne: clerkId };
      console.log(`🚫 Excluding rides from user: ${clerkId}`);
    }

    if (from) query.from = new RegExp(from, 'i');
    if (to) query.to = new RegExp(to, 'i');
    if (minSeats) {
      query.$expr = {
        $gte: [{ $size: '$availableSeats' }, parseInt(minSeats)],
      };
    }

    console.log('📋 Query filters:', JSON.stringify(query, null, 2));

    const rideOffers = await RideOffer.find(query)
      .sort({ departureTime: 1, createdAt: -1 })
      .limit(50);

    console.log(
      `✅ Found ${rideOffers.length} available ride offers before any filtering`,
    );

    // Log all rides for debugging
    console.log('📦 All rides found:');
    rideOffers.forEach((ride, index) => {
      console.log(`   ${index + 1}. ${ride.from} → ${ride.to}`);
      console.log(`      ID: ${ride._id}`);
      console.log(`      ClerkId: ${ride.clerkId}`);
      console.log(`      Status: ${ride.status}`);
      console.log(`      Departure: ${ride.departureTime}`);
      console.log(`      Available Seats: [${ride.availableSeats.join(', ')}]`);
      console.log(
        `      Matches requesting user: ${ride.clerkId === clerkId ? '❌ YES (filtered out)' : '✅ NO (included)'}`,
      );
    });

    console.log(
      `✅ Returning ${rideOffers.length} available ride offers to client`,
    );

    // Log sample of rides for debugging
    if (rideOffers.length > 0) {
      console.log('📦 Sample ride:', {
        id: rideOffers[0]._id,
        from: rideOffers[0].from,
        to: rideOffers[0].to,
        departureTime: rideOffers[0].departureTime,
        availableSeats: rideOffers[0].availableSeats,
        status: rideOffers[0].status,
      });
    }

    // Transform to match frontend expectations
    const formattedOffers = rideOffers.map((offer) => ({
      id: offer._id.toString(),
      clerkId: offer.clerkId,
      from: offer.from,
      to: offer.to,
      totalSeats: offer.totalSeats,
      availableSeats: offer.availableSeats,
      passengers: offer.totalSeats - offer.availableSeats.length, // Booked seats
      farePerSeat: offer.farePerSeat,
      vehicleType: offer.vehicleType,
      driverMode: offer.driverMode,
      notes: offer.notes,
      womenOnly: offer.womenOnly,
      pickupLatitude: offer.pickupLatitude,
      pickupLongitude: offer.pickupLongitude,
      pickupCity: offer.pickupCity,
      pickupCountry: offer.pickupCountry,
      departureTime: offer.departureTime,
      scheduledDeparture: offer.scheduledDeparture,
      earliestDeparture: offer.earliestDeparture,
      latestDeparture: offer.latestDeparture,
      timeFlexibilityMinutes: offer.timeFlexibilityMinutes,
      status: offer.status,
      vehicle: offer.vehicle,
      driver: offer.driver,
      bookings: offer.bookings,
      pickupStatus: offer.pickupStatus,
      dropoffStatus: offer.dropoffStatus,
      createdAt: offer.createdAt,
      kind: 'offer', // Explicitly mark as offer
    }));

    return res.status(200).json({
      success: true,
      rideOffers: formattedOffers,
      count: formattedOffers.length,
    });
  } catch (error) {
    console.error('❌ Error fetching ride offers:', error);
    next(error);
  }
};

/**
 * Get a single ride offer by ID
 * GET /api/ride-offers/:id
 */
export const getRideOfferById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Handle local/temporary IDs
    if (id.startsWith('local-')) {
      return res.status(404).json({
        error: 'Local ride offer not found on server',
        code: 'LOCAL_OFFER_NOT_SYNCED',
        details: 'This ride offer only exists on your device',
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid ride offer ID format',
        code: 'INVALID_OFFER_ID',
        details: `Ride offer ID "${id}" is not a valid format`,
      });
    }

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({
        error: 'Ride offer not found',
        code: 'OFFER_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      rideOffer: {
        ...rideOffer.toObject(),
        id: rideOffer._id.toString(),
        driverId: rideOffer.clerkId, // Driver's Clerk user ID
        kind: 'offer',
      },
    });
  } catch (error) {
    console.error('❌ Error fetching ride offer:', error);
    next(error);
  }
};

/**
 * Extend ride offer departure time
 * POST /api/ride-offers/:id/extend-time
 */
export const extendRideOfferTime = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { additionalMinutes } = req.body;

    if (!additionalMinutes || additionalMinutes < 1) {
      return res.status(400).json({
        error: 'Invalid extension',
        details: 'additionalMinutes must be at least 1',
      });
    }

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({ error: 'Ride offer not found' });
    }

    // Calculate new departure time
    const currentDeparture = new Date(rideOffer.departureTime);
    const newDeparture = new Date(
      currentDeparture.getTime() + additionalMinutes * 60000,
    );

    // Update departure time and reset notification flag
    rideOffer.departureTime = newDeparture;
    rideOffer.departureNotificationSent = false; // Reset so driver gets notifications again

    // Ensure status remains 'waiting' if it was cancelled by cleanup
    if (
      rideOffer.status === 'cancelled' &&
      rideOffer.availableSeats.length > 0
    ) {
      rideOffer.status = 'waiting';
      console.log(
        `✅ Restored ride ${id} status to 'waiting' after time extension`,
      );
    }

    // Ensure driverId is populated (for backward compatibility with old rides)
    if (!rideOffer.driverId && rideOffer.clerkId) {
      rideOffer.driverId = rideOffer.clerkId;
    }

    // Sanitize festivalConfig.tier (for backward compatibility)
    if (rideOffer.festivalConfig && rideOffer.festivalConfig.tier === '') {
      rideOffer.festivalConfig.tier = null;
    }

    await rideOffer.save();

    console.log(
      `⏰ Extended ride ${id} by ${additionalMinutes} minutes. New departure: ${newDeparture}`,
    );

    // Broadcast update to all connected clients
    if (io) {
      io.emit('rideOfferTimeExtended', {
        offerId: id,
        newDepartureTime: newDeparture,
        additionalMinutes,
        status: rideOffer.status,
      });
      io.emit('rideOfferUpdated', rideOffer); // Also broadcast general update
    }

    return res.status(200).json({
      success: true,
      rideOffer,
      message: `Ride offer time extended by ${additionalMinutes} minutes`,
    });
  } catch (error) {
    console.error('❌ Error extending ride offer time:', error);
    next(error);
  }
};

/**
 * Book a ride offer
 * POST /api/ride-offers/:id/book
 */
export const bookRideOffer = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    if (!clerkId) clerkId = req.body.clerkId;

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'clerkId is required',
      });
    }

    const { id } = req.params;
    const { seatNumbers, paymentMethod = 'unknown', customRequest } = req.body;

    console.log('🔍 Book ride offer request:', { id, clerkId, seatNumbers });

    // Handle local/temporary IDs
    if (id.startsWith('local-')) {
      return res.status(400).json({
        error: 'Cannot book local ride offer',
        code: 'LOCAL_OFFER_NOT_BOOKABLE',
        details: 'This ride offer has not been synced to the server yet',
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid ride offer ID format',
        code: 'INVALID_OFFER_ID',
        details: `Ride offer ID "${id}" is not a valid format`,
      });
    }

    if (
      !seatNumbers ||
      !Array.isArray(seatNumbers) ||
      seatNumbers.length === 0
    ) {
      return res.status(400).json({
        error: 'Invalid booking',
        details: 'seatNumbers array is required',
      });
    }

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({ error: 'Ride offer not found' });
    }

    // Check if seats are available
    const unavailableSeats = seatNumbers.filter(
      (seat) => !rideOffer.availableSeats.includes(seat),
    );

    if (unavailableSeats.length > 0) {
      return res.status(400).json({
        error: 'Seats not available',
        details: `Seats ${unavailableSeats.join(', ')} are already booked`,
      });
    }

    // Get passenger profile
    const passenger = await UserProfile.findOne({ clerkId });
    if (!passenger) {
      return res.status(404).json({ error: 'Passenger profile not found' });
    }

    // Calculate total amount
    const totalAmount = seatNumbers.length * rideOffer.farePerSeat;

    // Create booking
    const booking = {
      passengerId: passenger._id,
      passengerClerkId: clerkId,
      passengerName:
        `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() ||
        passenger.email,
      passengerPhone: passenger.phone || '',
      seatNumbers,
      totalAmount,
      paymentMethod,
      customRequest,
      status: 'confirmed',
      bookedAt: new Date(),
    };

    // Update available seats
    rideOffer.availableSeats = rideOffer.availableSeats.filter(
      (seat) => !seatNumbers.includes(seat),
    );

    // Add booking
    rideOffer.bookings.push(booking);

    // Update status if fully booked
    if (rideOffer.availableSeats.length === 0) {
      rideOffer.status = 'booked';
    }

    // Ensure driverId is populated (for backward compatibility with old rides)
    if (!rideOffer.driverId && rideOffer.clerkId) {
      rideOffer.driverId = rideOffer.clerkId;
    }

    // Sanitize festivalConfig.tier (for backward compatibility)
    if (rideOffer.festivalConfig && rideOffer.festivalConfig.tier === '') {
      rideOffer.festivalConfig.tier = null;
    }

    await rideOffer.save();

    // Broadcast seat availability update to all connected clients
    if (io) {
      io.emit('ride:offer:booked', {
        offerId: id,
        booking,
        availableSeats: rideOffer.availableSeats,
        status: rideOffer.status,
      });
      console.log(
        `📡 Emitted ride:offer:booked for ${id}, remaining seats: [${rideOffer.availableSeats.join(', ')}]`,
      );
    }

    return res.status(200).json({
      success: true,
      rideOffer,
      booking,
      message: 'Ride offer booked successfully',
    });
  } catch (error) {
    console.error('❌ Error booking ride offer:', error);
    next(error);
  }
};

/**
 * Cancel a ride offer
 * POST /api/ride-offers/:id/cancel
 */
export const cancelRideOffer = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    if (!clerkId) clerkId = req.body.clerkId;

    const { id } = req.params;

    console.log('🔍 Cancel ride offer request:', { id, clerkId });

    // Check for local/temporary ride offer IDs
    if (id.startsWith('local-')) {
      console.log(
        'ℹ️ Attempting to cancel local ride offer (not yet synced to server)',
      );
      return res.status(200).json({
        success: true,
        message: 'Local ride offer cancelled (no server action needed)',
        rideOffer: {
          id,
          status: 'cancelled',
          isLocal: true,
        },
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error('❌ Invalid ride offer ID format:', id);
      return res.status(400).json({
        error: 'Invalid ride offer ID format',
        code: 'INVALID_OFFER_ID',
        details: `Ride offer ID "${id}" is not a valid format`,
      });
    }

    const rideOffer = await RideOffer.findById(id);

    if (!rideOffer) {
      return res.status(404).json({ error: 'Ride offer not found' });
    }

    // Only the creator can cancel
    if (rideOffer.clerkId !== clerkId) {
      return res.status(403).json({
        error: 'Forbidden',
        details: 'Only the ride creator can cancel',
      });
    }

    // Ensure driverId is populated (for backward compatibility with old rides)
    if (!rideOffer.driverId && rideOffer.clerkId) {
      rideOffer.driverId = rideOffer.clerkId;
    }

    // Sanitize festivalConfig.tier (for backward compatibility)
    if (rideOffer.festivalConfig && rideOffer.festivalConfig.tier === '') {
      rideOffer.festivalConfig.tier = null;
    }

    rideOffer.status = 'cancelled';
    await rideOffer.save();

    // Broadcast cancellation
    if (io) {
      io.emit('rideOfferCancelled', { offerId: id });
    }

    return res.status(200).json({
      success: true,
      message: 'Ride offer cancelled successfully',
    });
  } catch (error) {
    console.error('❌ Error cancelling ride offer:', error);
    next(error);
  }
};

/**
 * Cleanup expired ride offers
 * POST /api/ride-offers/cleanup-expired
 */
export const cleanupExpiredRideOffers = async (req, res, next) => {
  try {
    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes
    const recentUpdateThreshold = 2 * 60 * 1000; // Don't cleanup rides updated in last 2 minutes
    const estimatedTripDuration = 3 * 60 * 60 * 1000; // 3 hours estimated trip duration

    // 1. AUTO-COMPLETE: Find ongoing/booked rides that should be completed
    // (departureTime + 3 hours has passed)
    const ridesForCompletion = await RideOffer.find({
      departureTime: { $lt: new Date(now - estimatedTripDuration) },
      status: { $in: ['ongoing', 'booked'] },
    });

    let completedCount = 0;
    for (const ride of ridesForCompletion) {
      try {
        // Ensure driverId is populated (for backward compatibility with old rides)
        if (!ride.driverId && ride.clerkId) {
          ride.driverId = ride.clerkId;
        }

        // Sanitize festivalConfig.tier (for backward compatibility with old rides)
        if (ride.festivalConfig && ride.festivalConfig.tier === '') {
          ride.festivalConfig.tier = null;
        }

        ride.status = 'completed';
        ride.completedAt = now;
        await ride.save();
        completedCount++;
        console.log(
          `✅ Auto-completed ride: ${ride._id} (departed: ${ride.departureTime})`,
        );
      } catch (error) {
        console.error(`❌ Error completing ride ${ride._id}:`, error.message);
        // Continue with next ride instead of breaking the entire cleanup
      }
    }

    // 2. AUTO-CANCEL: Find expired rides that never got bookings
    const expiredRides = await RideOffer.find({
      departureTime: { $lt: new Date(now - expirationBuffer) },
      status: { $in: ['waiting', 'accepted'] },
      updatedAt: { $lt: new Date(now - recentUpdateThreshold) }, // Skip recently updated rides
    });

    let cancelledCount = 0;
    for (const ride of expiredRides) {
      try {
        // Don't cancel if ride has confirmed bookings
        const hasActiveBookings = ride.bookings?.some(
          (b) => b.status === 'confirmed',
        );

        if (!hasActiveBookings) {
          // Ensure driverId is populated (for backward compatibility with old rides)
          if (!ride.driverId && ride.clerkId) {
            ride.driverId = ride.clerkId;
          }

          // Sanitize festivalConfig.tier (for backward compatibility with old rides)
          if (ride.festivalConfig && ride.festivalConfig.tier === '') {
            ride.festivalConfig.tier = null;
          }

          ride.status = 'cancelled';
          await ride.save();
          cancelledCount++;
          console.log(`🗑️ Auto-cancelled expired ride: ${ride._id}`);
        } else {
          console.log(`⏭️ Skipped ride ${ride._id} - has active bookings`);
        }
      } catch (error) {
        console.error(`❌ Error cancelling ride ${ride._id}:`, error.message);
        // Continue with next ride instead of breaking the entire cleanup
      }
    }

    console.log(
      `🧹 Cleanup complete: ${cancelledCount} cancelled, ${completedCount} auto-completed`,
    );

    return res.status(200).json({
      success: true,
      cancelledCount,
      completedCount,
      message: 'Expired ride offers cleaned up and ongoing rides completed',
    });
  } catch (error) {
    console.error('❌ Error cleaning up expired ride offers:', error);
    next(error);
  }
};

/**
 * Get my ride offers (as a driver)
 * GET /api/ride-offers/my-offers
 */
export const getMyRideOffers = async (req, res, next) => {
  try {
    let clerkId = getClerkUserId(req);
    if (!clerkId) clerkId = req.query.clerkId;

    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rideOffers = await RideOffer.find({ clerkId })
      .sort({ departureTime: -1, createdAt: -1 }) // Sort by departure time first, then creation time
      .limit(50);

    console.log(
      `📋 Found ${rideOffers.length} ride offers for driver ${clerkId}`,
    );

    // Check for potential duplicates and log them
    const rideGroupsMap = new Map();
    rideOffers.forEach((offer) => {
      const key = `${offer.from}_${offer.to}_${new Date(offer.departureTime).toISOString().split('T')[0]}`;
      if (!rideGroupsMap.has(key)) {
        rideGroupsMap.set(key, []);
      }
      rideGroupsMap.get(key).push(offer._id);
    });

    // Log potential duplicates
    rideGroupsMap.forEach((ids, key) => {
      if (ids.length > 1) {
        console.log(
          `⚠️ Potential duplicate rides detected: ${key} - IDs: ${ids.join(', ')}`,
        );
      }
    });

    const formattedOffers = rideOffers.map((offer) => ({
      ...offer.toObject(),
      id: offer._id.toString(),
      kind: 'offer',
    }));

    return res.status(200).json({
      success: true,
      rideOffers: formattedOffers,
      count: formattedOffers.length,
    });
  } catch (error) {
    console.error('❌ Error fetching my ride offers:', error);
    next(error);
  }
};

/**
 * Check for expiring rides and send notifications
 * POST /api/ride-offers/check-expiring
 */
export const checkExpiringRides = async (req, res, next) => {
  try {
    const now = new Date();
    const warningThreshold = 10 * 60 * 1000; // 10 minutes before expiry
    const expiryThreshold = 5 * 60 * 1000; // 5 minutes after departure

    // Find rides departing in the next 10-15 minutes (warning window)
    const upcomingExpiryTime = new Date(now.getTime() + warningThreshold);
    const expiringRides = await RideOffer.find({
      status: 'waiting',
      departureTime: {
        $gte: now,
        $lte: upcomingExpiryTime,
      },
    });

    console.log(`🔍 Found ${expiringRides.length} rides expiring soon`);

    const notifications = [];

    for (const ride of expiringRides) {
      try {
        // Get user profile to fetch push token
        const user = await UserProfile.findOne({ clerkId: ride.clerkId });

        if (!user || !user.pushToken) {
          console.log(`⚠️ No push token for user ${ride.clerkId}`);
          continue;
        }

        // Check if token is valid
        if (!Expo.isExpoPushToken(user.pushToken)) {
          console.log(`❌ Invalid push token for user ${ride.clerkId}`);
          continue;
        }

        // Calculate minutes until departure
        const minutesUntilDeparture = Math.floor(
          (new Date(ride.departureTime).getTime() - now.getTime()) / 60000,
        );

        // Create notification message
        const message = {
          to: user.pushToken,
          sound: 'default',
          title: '⏰ Ride Departing Soon!',
          body: `Your ride from ${ride.from} to ${ride.to} departs in ${minutesUntilDeparture} minutes. Extend time if needed.`,
          data: {
            type: 'ride_expiring',
            rideId: ride._id.toString(),
            offerId: ride._id.toString(),
            kind: 'offer',
            from: ride.from,
            to: ride.to,
            departureTime: ride.departureTime.toISOString(),
            minutesUntilDeparture,
            // Deep link for navigation
            screen: 'ExtendTime',
          },
          priority: 'high',
          channelId: 'ride-alerts',
        };

        notifications.push(message);
      } catch (error) {
        console.error(`❌ Error processing ride ${ride._id}:`, error);
      }
    }

    if (notifications.length > 0) {
      // Send notifications in chunks
      const chunks = expo.chunkPushNotifications(notifications);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          console.log(`📤 Sent ${ticketChunk.length} expiry notifications`);
        } catch (error) {
          console.error('❌ Error sending notification chunk:', error);
        }
      }

      console.log(`✅ Sent ${tickets.length} expiry notifications total`);

      return res.status(200).json({
        success: true,
        ridesChecked: expiringRides.length,
        notificationsSent: tickets.length,
        tickets,
      });
    } else {
      return res.status(200).json({
        success: true,
        ridesChecked: expiringRides.length,
        notificationsSent: 0,
        message: 'No notifications to send',
      });
    }
  } catch (error) {
    console.error('❌ Error checking expiring rides:', error);
    next(error);
  }
};
