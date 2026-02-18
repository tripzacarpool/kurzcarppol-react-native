import { io } from 'socket.io-client';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Automatically detects if running on emulator or physical device
const getBackendUrl = () => {
  // Try environment variable first (for development)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Fallback to app.json extra config (for production builds)
  const apiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (apiUrl) {
    return apiUrl;
  }

  throw new Error(
    'API URL not configured. Set EXPO_PUBLIC_API_URL environment variable or configure extra.apiUrl in app.json',
  );
  // Android emulator uses 10.0.2.2 to access host's localhost
  // if (Platform.OS === 'android' && __DEV__) {
  //   return 'http://10.0.2.2:5000'; // Android emulator
  // }
  // return 'http://10.238.194.123:5000'; // Local development
};

const BACKEND_URL = getBackendUrl();
console.log('🔌 Socket Backend URL:', BACKEND_URL);

let socket: any = null;

/**
 * Initialize Socket.io connection for real-time location tracking
 * React Native only supports WebSocket transport
 * SKIP on web platform - causes connection errors
 */
export function initializeLocationSocket() {
  if (Platform.OS === 'web') {
    console.log('⚠️ Skipping WebSocket on web platform');
    return null;
  }

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
  if (Platform.OS === 'web') {
    return null;
  }

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
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

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
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

  sock.emit('driver:online', { driverId });
}

/**
 * Driver goes offline
 */
export function driverGoesOffline() {
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

  sock.emit('driver:offline');
}

/**
 * Rider subscribes to live location updates
 */
export function subscribeToRideLocation(
  rideId: string,
  onLocationUpdate: (location: any) => void,
) {
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

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
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

  sock.emit('rider:unsubscribe', { rideId });
  sock.off('ride:location-update');
  sock.off('ride:driver-offline');
}

/**
 * Disconnect socket
 */
export function disconnectLocationSocket() {
  if (Platform.OS === 'web') return;

  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to new ride requests (for drivers/home screen)
 */
export function subscribeToNewRides(onNewRide: (ride: any) => void) {
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

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
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

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
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

  sock.off('ride:new');
  sock.off('new_ride_request');
  sock.off('new_driver_offer');
  sock.off('ride:accepted');
  sock.off('ride_accepted');
}

/**
 * Subscribe to pickup initiation (for passengers)
 * Driver has initiated pickup and is waiting for passenger confirmation
 */
export function subscribeToPickupInitiated(
  passengerClerkId: string,
  onPickupInitiated: (data: any) => void,
) {
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

  const eventName = `passenger:pickup-initiated:${passengerClerkId}`;

  sock.on(eventName, (data: any) => {
    console.log('🚗 Pickup initiated by driver:', data);
    onPickupInitiated(data);
  });
}

/**
 * Subscribe to pickup confirmation (for drivers)
 * Passenger has confirmed they've boarded
 */
export function subscribeToPickupConfirmed(
  driverId: string,
  onPickupConfirmed: (data: any) => void,
) {
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

  const eventName = `driver:pickup-confirmed:${driverId}`;

  sock.on(eventName, (data: any) => {
    console.log('✅ Pickup confirmed by passenger:', data);
    onPickupConfirmed(data);
  });
}

/**
 * Unsubscribe from pickup events
 */
export function unsubscribeFromPickupEvents(userId: string, isDriver: boolean) {
  if (Platform.OS === 'web') return;

  const sock = getLocationSocket();
  if (!sock) return;

  if (isDriver) {
    sock.off(`driver:pickup-confirmed:${userId}`);
  } else {
    sock.off(`passenger:pickup-initiated:${userId}`);
  }
}

/**
 * Export socket instance (ensures initialization)
 */
export { socket, getLocationSocket as getSocket };
