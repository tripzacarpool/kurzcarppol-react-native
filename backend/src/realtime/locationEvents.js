import { locationService } from '../services/locationService.js';

export const setupLocationEvents = (io, socket) => {
  socket.on('driver:location', (data) => {
    try {
      const { rideId, latitude, longitude } = data;
      const driverId = socket.data.driverId;

      if (!rideId || latitude === undefined || longitude === undefined) {
        console.error('Invalid location data:', data);
        return;
      }

      const locationData = locationService.updateDriverLocation(
        rideId,
        driverId,
        latitude,
        longitude,
      );

      const subscribers = locationService.getSubscribersForRide(rideId);
      subscribers.forEach((subscriberId) => {
        io.to(subscriberId).emit('ride:location-update', {
          rideId,
          latitude,
          longitude,
          timestamp: locationData.timestamp,
        });
      });
    } catch (error) {
      console.error('Error updating location:', error.message);
    }
  });

  socket.on('rider:subscribe', (data) => {
    try {
      const { rideId } = data;

      if (!rideId) {
        console.error('Missing rideId for subscription');
        return;
      }

      locationService.subscribeRider(rideId, socket.id);

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
      console.error('Error subscribing to ride:', error.message);
    }
  });

  socket.on('rider:unsubscribe', (data) => {
    try {
      const { rideId } = data;
      locationService.unsubscribeRider(rideId, socket.id);
      socket.emit('ride:unsubscribed', {
        rideId,
        message: 'Unsubscribed from location',
      });
    } catch (error) {
      console.error('Error unsubscribing from ride:', error.message);
    }
  });

  socket.on('driver:online', (data) => {
    try {
      const { driverId } = data;
      socket.data.driverId = driverId;
      socket.emit('driver:status', { status: 'online' });
    } catch (error) {
      console.error('Error marking driver online:', error.message);
    }
  });

  socket.on('driver:offline', () => {
    try {
      const driverId = socket.data.driverId;
      const rideId = locationService.driverOffline(driverId);

      if (rideId) {
        const subscribers = locationService.getSubscribersForRide(rideId);
        subscribers.forEach((subscriberId) => {
          io.to(subscriberId).emit('ride:driver-offline', { rideId });
        });
      }
    } catch (error) {
      console.error('Error marking driver offline:', error.message);
    }
  });

  socket.on('disconnect', () => {
    try {
      const driverId = socket.data.driverId;
      if (driverId) {
        locationService.driverOffline(driverId);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error.message);
    }
  });
};
