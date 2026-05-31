import mongoose from 'mongoose';
import { RideOffer, RideRequest, UserProfile } from '../config/models.js';
import { getRealtimeServer } from '../realtime/realtimeBus.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';
import { sendPushToToken } from './pushNotificationService.js';

class SafetySosError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const getPersonName = (user, fallback = 'User') =>
  user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.fullName ||
      user.email ||
      fallback
    : fallback;

const getRideLocation = (ride, prefix) => ({
  name: prefix === 'pickup' ? ride.from || 'Pickup' : ride.to || 'Dropoff',
  latitude: prefix === 'pickup' ? ride.pickupLatitude : ride.dropoffLatitude,
  longitude: prefix === 'pickup' ? ride.pickupLongitude : ride.dropoffLongitude,
});

export const isSOSAllowedForRide = (ride) =>
  ['accepted', 'booked', 'ongoing', 'in_progress', 'awaiting_driver_confirmation'].includes(
    ride.status,
  );

const assertRideId = (rideId) => {
  if (rideId?.startsWith('local-')) {
    throw new SafetySosError('Cannot perform operation on local ride', {
      code: 'LOCAL_RIDE_ID',
      details: 'This ride has not been synced to the server yet',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(rideId)) {
    throw new SafetySosError('Invalid ride ID format', {
      code: 'INVALID_RIDE_ID',
      details: `Ride ID "${rideId}" is not a valid format`,
    });
  }
};

export async function getSOSRideContext(rideId, activatedBy) {
  assertRideId(rideId);

  let ride = await RideRequest.findById(rideId);
  let rideType = 'request';

  if (!ride) {
    ride = await RideOffer.findById(rideId);
    rideType = 'offer';
  }

  if (!ride) return null;

  const effectiveActivatedBy = activatedBy || ride.sosActivatedBy;
  const driverClerkId =
    rideType === 'offer' ? ride.clerkId : ride.acceptedBy?.clerkId;
  const passengerClerkIds =
    rideType === 'offer'
      ? (ride.bookings || [])
          .filter((booking) => booking.status === 'confirmed')
          .map((booking) => booking.passengerClerkId)
          .filter(Boolean)
      : [
          ride.clerkId,
          ...(ride.fareSplit?.participants || [])
            .map((participant) => participant.clerkId)
            .filter(Boolean),
        ];
  const uniquePassengerClerkIds = [...new Set(passengerClerkIds)];
  const clerkIds = [
    ...uniquePassengerClerkIds,
    driverClerkId,
    effectiveActivatedBy,
  ].filter(Boolean);
  const people = clerkIds.length
    ? await UserProfile.find({ clerkId: { $in: clerkIds } })
    : [];
  const peopleByClerkId = new Map(
    people.map((person) => [person.clerkId, person]),
  );
  const driver = driverClerkId ? peopleByClerkId.get(driverClerkId) : null;
  const activatingUser = effectiveActivatedBy
    ? peopleByClerkId.get(effectiveActivatedBy)
    : null;
  const primaryPassengerClerkId = uniquePassengerClerkIds.includes(
    effectiveActivatedBy,
  )
    ? effectiveActivatedBy
    : uniquePassengerClerkIds[0];
  const passenger = primaryPassengerClerkId
    ? peopleByClerkId.get(primaryPassengerClerkId)
    : null;

  return {
    ride,
    rideType,
    driverClerkId,
    activatedBy: effectiveActivatedBy,
    passengerClerkIds: uniquePassengerClerkIds,
    driver,
    passenger,
    activatingUser,
    peopleByClerkId,
    pickupLocation: getRideLocation(ride, 'pickup'),
    dropoffLocation: getRideLocation(ride, 'dropoff'),
  };
}

export function toSOSAlert(context) {
  const {
    ride,
    rideType,
    driverClerkId,
    passengerClerkIds,
    driver,
    passenger,
    activatingUser,
  } = context;
  const currentLocation = {
    latitude: ride.currentLocation?.latitude || context.pickupLocation.latitude,
    longitude:
      ride.currentLocation?.longitude || context.pickupLocation.longitude,
  };

  return {
    rideId: ride._id.toString(),
    rideType,
    activatedBy: context.activatedBy || activatingUser?.clerkId,
    activatedByName: getPersonName(activatingUser, 'User'),
    passengerId: passenger?.clerkId || passengerClerkIds[0],
    passengerName: getPersonName(passenger, 'Passenger'),
    passengerPhone: passenger?.phone,
    driverId: driverClerkId,
    driverName: getPersonName(driver, ride.acceptedBy?.driverName || 'Driver'),
    driverPhone: driver?.phone,
    pickupLocation: context.pickupLocation,
    dropoffLocation: context.dropoffLocation,
    currentLocation,
    reason: ride.sosReason,
    sosActivatedAt: ride.sosActivatedAt,
    timestamp: ride.sosActivatedAt || new Date(),
    status: ride.sosActivated ? 'active' : 'resolved',
    priority: 'critical',
    emergencyServices: {
      police: '100',
      ambulance: '102',
      fire: '101',
      disasterManagement: '108',
      womensHelpline: '1091',
      allIndiaEmergency: '112',
    },
  };
}

export async function activateSosAlert({ rideId, activatedBy, reason }) {
  if (!activatedBy) {
    throw new SafetySosError('Unauthorized', {
      status: 401,
      code: 'NO_AUTH',
    });
  }

  const context = await getSOSRideContext(rideId, activatedBy);
  if (!context) {
    throw new SafetySosError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  if (!isSOSAllowedForRide(context.ride)) {
    throw new SafetySosError('SOS is available only after a ride is accepted or booked', {
      code: 'RIDE_NOT_ACTIVE_FOR_SOS',
      details: context.ride.status,
    });
  }

  context.ride.sosActivated = true;
  context.ride.sosActivatedAt = new Date();
  context.ride.sosActivatedBy = activatedBy;
  context.ride.sosReason = reason || 'User activated SOS alert';
  context.ride.sosResolvedAt = undefined;
  context.ride.sosResolution = undefined;
  context.ride.sosAdminNotes = undefined;
  context.ride.sosResponseTime = undefined;
  await context.ride.save();

  const refreshedContext = await getSOSRideContext(rideId, activatedBy);
  const sosAlert = toSOSAlert(refreshedContext);
  const admins = await UserProfile.find({ role: 'admin' });

  await publishEvent(EventTypes.SosActivated, {
    rideId: sosAlert.rideId,
    rideType: sosAlert.rideType,
    activatedBy: sosAlert.activatedBy,
    passengerId: sosAlert.passengerId,
    driverId: sosAlert.driverId,
    reason: sosAlert.reason,
    priority: sosAlert.priority,
    sosActivatedAt: sosAlert.sosActivatedAt,
  });

  return {
    context: refreshedContext,
    sosAlert,
    pushTargets: [
      refreshedContext.driver,
      ...admins,
      ...refreshedContext.passengerClerkIds
        .filter((clerkId) => clerkId !== activatedBy)
        .map((clerkId) => refreshedContext.peopleByClerkId.get(clerkId)),
    ].filter(Boolean),
  };
}

export async function getActiveSosAlerts() {
  const [requestRides, offerRides] = await Promise.all([
    RideRequest.find({ sosActivated: true }).sort({ sosActivatedAt: -1 }),
    RideOffer.find({ sosActivated: true }).sort({ sosActivatedAt: -1 }),
  ]);
  const contexts = await Promise.all(
    [...requestRides, ...offerRides].map((ride) =>
      getSOSRideContext(ride._id.toString()),
    ),
  );

  return contexts.filter(Boolean).map((context) => ({
    ...toSOSAlert(context),
    timeElapsed: Math.round(
      (Date.now() - new Date(context.ride.sosActivatedAt).getTime()) / 1000,
    ),
  }));
}

export async function resolveSosAlert({ rideId, resolution, notes, responseTime }) {
  const context = await getSOSRideContext(rideId);
  if (!context || !context.ride.sosActivated) {
    throw new SafetySosError('Active SOS alert not found', {
      status: 404,
      code: 'SOS_NOT_FOUND',
    });
  }

  context.ride.sosActivated = false;
  context.ride.sosResolvedAt = new Date();
  context.ride.sosResolution = resolution || 'resolved_by_admin';
  context.ride.sosAdminNotes = notes || '';
  context.ride.sosResponseTime =
    responseTime ||
    Math.max(
      0,
      new Date(context.ride.sosResolvedAt).getTime() -
        new Date(context.ride.sosActivatedAt).getTime(),
    );
  await context.ride.save();

  return {
    context,
    sosAlert: toSOSAlert(context),
  };
}

export async function dispatchEmergencyService({
  rideId,
  serviceType,
  notes,
  dispatchedBy = 'system',
}) {
  const context = await getSOSRideContext(rideId);
  if (!context) {
    throw new SafetySosError('Ride not found', {
      status: 404,
      code: 'RIDE_NOT_FOUND',
    });
  }

  const sosAlert = toSOSAlert(context);
  const passengerTargets = context.passengerClerkIds
    .map((clerkId) => context.peopleByClerkId.get(clerkId))
    .filter(Boolean);
  const dispatchRecord = {
    rideId: context.ride._id,
    serviceType,
    location: sosAlert.currentLocation,
    passengerDetails: {
      name: sosAlert.passengerName,
      phone: sosAlert.passengerPhone,
    },
    driverDetails: {
      name: sosAlert.driverName,
      phone: sosAlert.driverPhone,
    },
    notes,
    dispatchedAt: new Date(),
    dispatchedBy,
  };

  return {
    context,
    dispatchRecord,
    sosAlert,
    pushTargets: [context.driver, ...passengerTargets].filter(Boolean),
  };
}

export async function getSosHistory({ limit = 50, skip = 0, status = 'resolved' } = {}) {
  const query =
    status === 'active'
      ? { sosActivated: true }
      : { sosActivated: false, sosResolvedAt: { $exists: true } };
  const parsedLimit = Number.parseInt(limit, 10);
  const parsedSkip = Number.parseInt(skip, 10);

  const [requestRides, offerRides] = await Promise.all([
    RideRequest.find(query)
      .limit(parsedLimit)
      .skip(parsedSkip)
      .sort({ sosActivatedAt: -1 }),
    RideOffer.find(query)
      .limit(parsedLimit)
      .skip(parsedSkip)
      .sort({ sosActivatedAt: -1 }),
  ]);
  const contexts = await Promise.all(
    [...requestRides, ...offerRides].map((ride) =>
      getSOSRideContext(ride._id.toString()),
    ),
  );

  return contexts.filter(Boolean).map((context) => ({
    ...toSOSAlert(context),
    sosResolvedAt: context.ride.sosResolvedAt,
    resolution: context.ride.sosResolution,
    responseTime: context.ride.sosResponseTime,
    notes: context.ride.sosAdminNotes,
  }));
}

export async function activateSosAlertFlow({ rideId, activatedBy, reason }) {
  const result = await activateSosAlert({ rideId, activatedBy, reason });
  const { context, pushTargets, sosAlert } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('sos_alert', sosAlert);
    io.emit('admin_sos_alert', sosAlert);
    io.to('admin_room').emit('admin_sos_alert', sosAlert);
    if (sosAlert.driverId) {
      io.to(`driver_${sosAlert.driverId}`).emit('sos_alert', sosAlert);
    }
    context.passengerClerkIds.forEach((passengerClerkId) => {
      io.to(`passenger_${passengerClerkId}`).emit('sos_alert', sosAlert);
    });
  }

  for (const target of pushTargets) {
    if (target?.pushToken) {
      await sendPushToToken({
        pushToken: target.pushToken,
        title: 'Emergency SOS alert',
        body: `${sosAlert.activatedByName} activated SOS on ${context.ride.from || 'the ride'} to ${context.ride.to || 'destination'}.`,
        data: {
          rideId,
          type: 'sos_alert',
          reason: context.ride.sosReason,
          priority: 'critical',
          channelId: 'sos-alerts',
        },
      });
    }
  }

  return result;
}

export async function resolveSosAlertFlow({
  rideId,
  resolution,
  notes,
  responseTime,
}) {
  const result = await resolveSosAlert({
    rideId,
    resolution,
    notes,
    responseTime,
  });
  const { context, sosAlert } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('sos_resolved', sosAlert);
    if (context.driverClerkId) {
      io.to(`driver_${context.driverClerkId}`).emit('sos_resolved', sosAlert);
    }
    context.passengerClerkIds.forEach((passengerClerkId) => {
      io.to(`passenger_${passengerClerkId}`).emit('sos_resolved', sosAlert);
    });
  }

  return result;
}

export async function dispatchEmergencyServiceFlow({
  rideId,
  serviceType,
  notes,
  dispatchedBy,
}) {
  const result = await dispatchEmergencyService({
    rideId,
    serviceType,
    notes,
    dispatchedBy,
  });
  const { dispatchRecord, pushTargets, sosAlert } = result;

  const io = getRealtimeServer();
  if (io) {
    io.emit('emergency_services_dispatched', {
      ...sosAlert,
      serviceType,
      dispatchedAt: dispatchRecord.dispatchedAt,
    });
  }

  const serviceNames = {
    police: 'Police',
    ambulance: 'Ambulance',
    fire: 'Fire Department',
    disaster: 'Disaster Management',
  };

  for (const target of pushTargets) {
    if (target?.pushToken) {
      await sendPushToToken({
        pushToken: target.pushToken,
        title: `${serviceNames[serviceType] || 'Emergency service'} dispatched`,
        body: 'Help is on the way. Your ride location has been shared.',
        data: {
          rideId,
          serviceType,
          type: 'emergency_services_dispatched',
          channelId: 'sos-alerts',
          priority: 'critical',
        },
      });
    }
  }

  return result;
}
