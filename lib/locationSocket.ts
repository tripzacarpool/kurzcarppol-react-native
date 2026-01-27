import { io } from 'socket.io-client';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.102:5000';

let socket: any = null;

/**
 * Initialize Socket.io connection for real-time location tracking
 * React Native only supports WebSocket transport
 */
export function initializeLocationSocket() {
  if (socket) return socket;

  socket = io(BACKEND_URL, {
    transports: ['websocket'], // Only use WebSocket for React Native
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
  });

  socket.on('connect_error', (error: any) => {
    console.error('❌ WebSocket connection error:', error.message);
  });

  return socket;
}

/**
 * Get Socket.io instance
 */
export function getLocationSocket() {
  if (!socket) {
    return initializeLocationSocket();
  }
  return socket;
}

/**
 * Driver sends location update every 2-3 seconds
 */
export function emitDriverLocation(
  rideId: string,
  latitude: number,
  longitude: number,
) {
  const sock = getLocationSocket();
  sock.emit('driver:location', {
    rideId,
    latitude,
    longitude,
  });
}

/**
 * Driver comes online
 */
export function driverGoesOnline(driverId: string) {
  const sock = getLocationSocket();
  sock.emit('driver:online', { driverId });
}

/**
 * Driver goes offline
 */
export function driverGoesOffline() {
  const sock = getLocationSocket();
  sock.emit('driver:offline');
}

/**
 * Rider subscribes to live location updates
 */
export function subscribeToRideLocation(
  rideId: string,
  onLocationUpdate: (location: any) => void,
) {
  const sock = getLocationSocket();

  // Subscribe to this ride
  sock.emit('rider:subscribe', { rideId });

  // Listen for location updates
  sock.on('ride:location-update', (data: any) => {
    if (data.rideId === rideId) {
      console.log(`📍 Location update:`, data.latitude, data.longitude);
      onLocationUpdate(data);
    }
  });

  // Listen for driver offline
  sock.on('ride:driver-offline', (data: any) => {
    if (data.rideId === rideId) {
      console.log(`🔴 Driver went offline for ride ${rideId}`);
      onLocationUpdate({ rideId, offline: true });
    }
  });
}

/**
 * Rider unsubscribes from location updates
 */
export function unsubscribeFromRideLocation(rideId: string) {
  const sock = getLocationSocket();
  sock.emit('rider:unsubscribe', { rideId });
  sock.off('ride:location-update');
  sock.off('ride:driver-offline');
}

/**
 * Disconnect socket
 */
export function disconnectLocationSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to new ride requests (for drivers/home screen)
 */
export function subscribeToNewRides(onNewRide: (ride: any) => void) {
  const sock = getLocationSocket();

  // Listen to new ride requests from passengers (for drivers)
  sock.on('new_ride_request', (ride: any) => {
    console.log('📨 New ride request received:', ride);
    onNewRide(ride);
  });

  // Listen to new driver offers (for passengers)
  sock.on('new_driver_offer', (ride: any) => {
    console.log('📨 New driver offer received:', ride);
    onNewRide(ride);
  });

  // Legacy support for old 'ride:new' event
  sock.on('ride:new', (ride: any) => {
    console.log('📨 New ride received (legacy):', ride);
    onNewRide(ride);
  });
}

/**
 * Subscribe to ride acceptance updates (for passengers)
 */
export function subscribeToRideAcceptance(onRideAccepted: (data: any) => void) {
  const sock = getLocationSocket();
  sock.on('ride:accepted', (data: any) => {
    console.log('✅ Ride accepted:', data);
    onRideAccepted(data);
  });
  // Also listen to new event name
  sock.on('ride_accepted', (data: any) => {
    console.log('✅ Ride accepted:', data);
    onRideAccepted(data);
  });
}

/**
 * Unsubscribe from ride events
 */
export function unsubscribeFromRideEvents() {
  const sock = getLocationSocket();
  sock.off('ride:new');
  sock.off('new_ride_request');
  sock.off('new_driver_offer');
  sock.off('ride:accepted');
  sock.off('ride_accepted');
}
