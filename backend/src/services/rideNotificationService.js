import {
  sendPushToUsers,
  sendPushToUsersByRole,
} from './pushNotificationService.js';

const compactRoute = (from, to) => `${from || 'Pickup'} to ${to || 'dropoff'}`;

export const buildRideNotification = (type, ride, overrides = {}) => {
  const route = compactRoute(ride.from, ride.to);
  const data = {
    type,
    rideId: ride._id?.toString(),
    rideType: overrides.rideType || 'request',
    from: ride.from,
    to: ride.to,
    status: ride.status,
    action: overrides.action || 'open_ride',
    channelId: overrides.channelId || 'ride-updates',
    priority: overrides.priority || 'normal',
    ...overrides.data,
  };

  const messages = {
    ride_created: {
      title: 'New passenger request',
      body: `${route}. Driver payout: Rs ${ride.driverGuaranteedFare || ride.requestedTotalFare || ride.fare || 0}.`,
    },
    offer_created: {
      title: 'New ride available',
      body: `${route}. Seat price: Rs ${ride.farePerSeat || 0}.`,
    },
    ride_accepted: {
      title: 'Driver accepted your ride',
      body: `${overrides.driverName || 'Your driver'} accepted ${route}. Booking price is locked.`,
    },
    ride_booked: {
      title: 'Booking confirmed',
      body: `${overrides.passengerName || 'Passenger'} confirmed ${route}. Fare share: Rs ${overrides.shareAmount || ride.fare || 0}.`,
    },
    ride_joined: {
      title: 'Fare split updated',
      body: `${overrides.passengerName || 'A passenger'} joined ${route}. New share: Rs ${overrides.perSeatEstimate || ride.fareSplit?.perSeatEstimate || 0}.`,
    },
    pickup_driver_confirmed: {
      title: 'Driver is at pickup',
      body: `${overrides.driverName || 'Your driver'} marked pickup for ${ride.from || 'your pickup point'}. Confirm when onboard.`,
    },
    pickup_passenger_confirmed: {
      title: 'Passenger onboard',
      body: `${overrides.passengerName || 'Passenger'} confirmed pickup. You can start or continue the ride.`,
    },
    ride_start_requested: {
      title: 'Confirm ride start',
      body: `${overrides.passengerName || 'Passenger'} is ready. Confirm seating to start ${route}.`,
    },
    ride_started: {
      title: 'Ride started',
      body: `${route} is now in progress. SOS and live trip updates stay active.`,
    },
    ride_completed: {
      title: 'Ride completed',
      body: `${route} is complete. Payment and rating can be handled now.`,
    },
    ride_cancelled: {
      title: 'Ride cancelled',
      body: `${route} was cancelled. Check the app for details.`,
    },
    ride_time_extended: {
      title: 'Ride time updated',
      body: `${route} has a new departure time. Open the trip for the latest schedule.`,
    },
  };

  return {
    ...(messages[type] || {
      title: 'Ride update',
      body: `${route} has a new update.`,
    }),
    data,
  };
};

export const notifyUsersByClerkId = async (clerkIds, notification) => {
  const uniqueClerkIds = [...new Set((clerkIds || []).filter(Boolean))];
  if (!uniqueClerkIds.length) return 0;

  const tickets = await sendPushToUsers({
    userIds: uniqueClerkIds,
    title: notification.title,
    body: notification.body,
    data: notification.data,
  });
  return tickets.length;
};

export const notifyRidePartners = async (notification, filters = {}) => {
  const tickets = await sendPushToUsersByRole({
    role: 'ride_partner',
    title: notification.title,
    body: notification.body,
    data: notification.data,
    excludeClerkId: filters.excludeClerkId,
    limit: filters.limit || 75,
  });
  return tickets.length;
};

export const notifyPassengers = async (notification, filters = {}) => {
  const tickets = await sendPushToUsersByRole({
    role: 'passenger',
    title: notification.title,
    body: notification.body,
    data: notification.data,
    excludeClerkId: filters.excludeClerkId,
    limit: filters.limit || 100,
  });
  return tickets.length;
};
