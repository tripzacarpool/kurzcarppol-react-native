/**
 * Real-time Location Tracking Service
 * Uses in-memory storage for live driver locations
 * Pushes updates to riders via WebSocket
 */

// In-memory storage for active driver locations
// Structure: { rideId: { driverId, latitude, longitude, timestamp } }
const activeRideLocations = new Map();

// Track which drivers are live
// Structure: { driverId: { rideId, isLive } }
const liveDrivers = new Map();

// Track subscribed riders
// Structure: { rideId: Set of socket ids }
const rideSubscribers = new Map();

export const locationService = {
  /**
   * Update driver location for a ride
   * Called every 2-3 seconds by driver app
   */
  updateDriverLocation: (rideId, driverId, latitude, longitude) => {
    const timestamp = Date.now();

    activeRideLocations.set(rideId, {
      driverId,
      latitude,
      longitude,
      timestamp,
    });

    // Mark driver as live
    liveDrivers.set(driverId, { rideId, isLive: true });

    return {
      rideId,
      driverId,
      latitude,
      longitude,
      timestamp,
    };
  },

  /**
   * Get current location for a ride
   */
  getLocationForRide: (rideId) => {
    return activeRideLocations.get(rideId) || null;
  },

  /**
   * Register rider subscription to a ride
   */
  subscribeRider: (rideId, socketId) => {
    if (!rideSubscribers.has(rideId)) {
      rideSubscribers.set(rideId, new Set());
    }
    rideSubscribers.get(rideId).add(socketId);
    console.log(`👤 Rider subscribed to ride ${rideId}`);
  },

  /**
   * Unsubscribe rider from a ride
   */
  unsubscribeRider: (rideId, socketId) => {
    if (rideSubscribers.has(rideId)) {
      rideSubscribers.get(rideId).delete(socketId);
      if (rideSubscribers.get(rideId).size === 0) {
        rideSubscribers.delete(rideId);
        console.log(`👤 No more subscribers for ride ${rideId}`);
      }
    }
  },

  /**
   * Get all socket IDs subscribed to a ride
   */
  getSubscribersForRide: (rideId) => {
    return rideSubscribers.get(rideId) || new Set();
  },

  /**
   * End ride and cleanup
   */
  endRide: (rideId, driverId) => {
    activeRideLocations.delete(rideId);
    liveDrivers.delete(driverId);
    rideSubscribers.delete(rideId);
    console.log(`🏁 Ride ${rideId} ended - location tracking stopped`);
  },

  /**
   * Driver goes offline
   */
  driverOffline: (driverId) => {
    const driverData = liveDrivers.get(driverId);
    if (driverData) {
      const rideId = driverData.rideId;
      activeRideLocations.delete(rideId);
      liveDrivers.delete(driverId);
      console.log(`🔴 Driver ${driverId} went offline`);
      return rideId;
    }
    return null;
  },

  /**
   * Get driver's live status
   */
  isDriverLive: (driverId) => {
    return liveDrivers.has(driverId);
  },
};
