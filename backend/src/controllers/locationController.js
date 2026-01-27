import { locationService } from '../services/locationService.js';

/**
 * Handle real-time location events via WebSocket
 */
export const setupLocationEvents = (io, socket) => {
  /**
   * Driver emits location update every 2-3 seconds during ride
   * Event: driver:location
   * Data: { rideId, latitude, longitude }
   */
  socket.on('driver:location', (data) => {
    try {
      const { rideId, latitude, longitude } = data;
      const driverId = socket.data.driverId; // Set when driver connects

      if (!rideId || latitude === undefined || longitude === undefined) {
        console.error('❌ Invalid location data:', data);
        return;
      }

      // Update location in memory
      const locationData = locationService.updateDriverLocation(
        rideId,
        driverId,
        latitude,
        longitude,
      );

      // Push to all riders subscribed to this ride
      const subscribers = locationService.getSubscribersForRide(rideId);
      subscribers.forEach((subscriberId) => {
        io.to(subscriberId).emit('ride:location-update', {
          rideId,
          latitude,
          longitude,
          timestamp: locationData.timestamp,
        });
      });

      console.log(
        `📍 Location updated for ride ${rideId}: ${latitude}, ${longitude}`,
      );
    } catch (error) {
      console.error('❌ Error updating location:', error.message);
    }
  });

  /**
   * Rider subscribes to live location updates for a ride
   * Event: rider:subscribe
   * Data: { rideId }
   */
  socket.on('rider:subscribe', (data) => {
    try {
      const { rideId } = data;

      if (!rideId) {
        console.error('❌ Missing rideId for subscription');
        return;
      }

      // Register subscription
      locationService.subscribeRider(rideId, socket.id);

      // Send current location if available
      const currentLocation = locationService.getLocationForRide(rideId);
      if (currentLocation) {
        socket.emit('ride:location-update', {
          rideId,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          timestamp: currentLocation.timestamp,
        });
      }

      socket.emit('ride:subscribed', {
        rideId,
        message: 'Subscribed to live location',
      });
    } catch (error) {
      console.error('❌ Error subscribing to ride:', error.message);
    }
  });

  /**
   * Rider unsubscribes from location updates
   * Event: rider:unsubscribe
   * Data: { rideId }
   */
  socket.on('rider:unsubscribe', (data) => {
    try {
      const { rideId } = data;
      locationService.unsubscribeRider(rideId, socket.id);
      socket.emit('ride:unsubscribed', {
        rideId,
        message: 'Unsubscribed from location',
      });
    } catch (error) {
      console.error('❌ Error unsubscribing from ride:', error.message);
    }
  });

  /**
   * Driver goes online
   * Event: driver:online
   * Data: { driverId }
   */
  socket.on('driver:online', (data) => {
    try {
      const { driverId } = data;
      socket.data.driverId = driverId;
      console.log(`🟢 Driver ${driverId} came online`);
      socket.emit('driver:status', { status: 'online' });
    } catch (error) {
      console.error('❌ Error marking driver online:', error.message);
    }
  });

  /**
   * Driver goes offline
   * Event: driver:offline
   */
  socket.on('driver:offline', () => {
    try {
      const driverId = socket.data.driverId;
      const rideId = locationService.driverOffline(driverId);

      // Notify all subscribers that driver went offline
      if (rideId) {
        const subscribers = locationService.getSubscribersForRide(rideId);
        subscribers.forEach((subscriberId) => {
          io.to(subscriberId).emit('ride:driver-offline', { rideId });
        });
      }

      console.log(`🔴 Driver ${driverId} went offline`);
    } catch (error) {
      console.error('❌ Error marking driver offline:', error.message);
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', () => {
    try {
      const driverId = socket.data.driverId;
      if (driverId) {
        locationService.driverOffline(driverId);
        console.log(`🔴 Driver ${driverId} disconnected`);
      }
    } catch (error) {
      console.error('❌ Error handling disconnect:', error.message);
    }
  });
};
