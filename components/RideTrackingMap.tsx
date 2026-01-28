import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { MapView, Marker, Polyline, PROVIDER_GOOGLE, checkMapAvailability, MapPlaceholder } from './ConditionalMap';
import { MapPin, Phone, MessageCircle, X, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { MAP_CONFIG } from '@/config/googleMaps';
import {
  fetchRouteFromGoogle,
  calculateDistance,
  estimateETA,
  type RouteCoordinate,
} from '@/lib/routeService';
import {
  subscribeToRideLocation,
  unsubscribeFromRideLocation,
} from '@/lib/locationSocket';

interface RideTrackingMapProps {
  rideId: string;
  driverName: string;
  driverRating: number;
  onClose: () => void;
  pickupLocation: { latitude: number; longitude: number };
  dropoffLocation: { latitude: number; longitude: number };
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

const { width, height } = Dimensions.get('window');

export default function RideTrackingMap({
  rideId,
  driverName,
  driverRating,
  onClose,
  pickupLocation,
  dropoffLocation,
}: RideTrackingMapProps) {
  const mapRef = useRef<any>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [routePath, setRoutePath] = useState<DriverLocation[]>([]);
  const [plannedRoute, setPlannedRoute] = useState<RouteCoordinate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eta, setEta] = useState<string>('Calculating...');
  const [distanceRemaining, setDistanceRemaining] = useState<string>('--');

  // Fetch planned route from Google Directions API - ONLY ONCE!
  useEffect(() => {
    console.log('🗺️ Fetching initial route from Google Directions API (ONE-TIME)');
    
    fetchRouteFromGoogle(pickupLocation, dropoffLocation).then((result) => {
      if (result.success && result.routes.length > 0) {
        setPlannedRoute(result.routes);
        console.log('✅ Initial route loaded from Google');
      } else {
        console.error('❌ Failed to fetch route:', result.error);
        // Fallback: draw straight line
        setPlannedRoute([pickupLocation, dropoffLocation]);
      }
    });
  }, []);

  useEffect(() => {
    console.log('🗺️ Subscribing to ride location via WebSocket (NOT Google API)');

    // Subscribe to driver location updates from BACKEND (not Google!)
    const unsubscribe = subscribeToRideLocation(
      rideId,
      (location: DriverLocation) => {
        console.log('📍 Driver location from WebSocket:', location);
        setDriverLocation(location);
        setIsLoading(false);

        // Calculate ETA and distance remaining (without Google API calls)
        const distance = calculateDistance(
          { latitude: location.latitude, longitude: location.longitude },
          dropoffLocation
        );
        setDistanceRemaining(`${distance.toFixed(1)} km`);
        setEta(estimateETA(distance));

        // Add to route path (keep last 50 points for performance)
        setRoutePath((prev) => [...prev.slice(-49), location]);

        // Animate map camera to follow driver
        if (mapRef.current) {
          mapRef.current.animateCamera({
            center: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
            zoom: 15,
          }, { duration: MAP_CONFIG.MAP_ANIMATION_DURATION });
        }
      }
    );

    return () => {
      console.log('🛑 Unsubscribing from ride location WebSocket');
      unsubscribeFromRideLocation(rideId);
      if (unsubscribe) unsubscribe();
    };
  }, [rideId, dropoffLocation]);

  const handleCall = () => {
    Alert.alert('Call Driver', `Calling ${driverName}...`);
  };

  const handleMessage = () => {
    Alert.alert('Message', `Send a message to ${driverName}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Waiting for driver location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {checkMapAvailability() && MapView ? (
        <>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            customMapStyle={MAP_CONFIG.MAP_STYLE}
            initialRegion={{
              latitude: driverLocation?.latitude || pickupLocation.latitude,
              longitude: driverLocation?.longitude || pickupLocation.longitude,
              latitudeDelta: MAP_CONFIG.DEFAULT_REGION.latitudeDelta,
              longitudeDelta: MAP_CONFIG.DEFAULT_REGION.longitudeDelta,
            }}>
            
            {/* Planned route polyline (from Google Directions API - fetched once) */}
            {plannedRoute.length > 0 && Polyline && (
              <Polyline
                coordinates={plannedRoute}
                strokeColor={Colors.dark.gold + '60'}
                strokeWidth={4}
                lineDashPattern={[1]}
              />
            )}

            {/* Pickup location marker */}
            {Marker && (
              <Marker
                coordinate={pickupLocation}
                title="Pickup Location"
                pinColor={Colors.dark.gold}>
                <View style={styles.markerContainer}>
                  <MapPin size={20} color={Colors.dark.gold} />
                </View>
              </Marker>
            )}

            {/* Dropoff location marker */}
            {Marker && (
              <Marker
                coordinate={dropoffLocation}
                title="Dropoff Location"
                pinColor={Colors.dark.pink}>
                <View style={styles.markerContainer}>
                  <MapPin size={20} color={Colors.dark.pink} />
                </View>
              </Marker>
            )}

            {/* Driver location marker (updated via WebSocket) */}
            {driverLocation && Marker && (
              <Marker
                coordinate={{
                  latitude: driverLocation.latitude,
                  longitude: driverLocation.longitude,
                }}
                title={driverName}
                pinColor={Colors.dark.success}>
                <View style={styles.driverMarker}>
                  <Navigation
                    size={16}
                    color={Colors.dark.background}
                    fill={Colors.dark.success}
                  />
                </View>
              </Marker>
            )}

            {/* Driver's traveled path (from WebSocket updates, not Google) */}
            {routePath.length > 1 && Polyline && (
              <Polyline
                coordinates={routePath.map((loc) => ({
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }))}
                strokeColor={Colors.dark.success}
                strokeWidth={3}
              />
            )}
          </MapView>
        </>
      ) : (
        <MapPlaceholder message="Ride tracking requires a development build" />
      )}

      {/* Driver Info Card */}
      <View style={styles.driverCard}>
        <View style={styles.driverInfo}>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driverName}</Text>
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>⭐ {driverRating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCall}
            activeOpacity={0.7}>
            <Phone size={18} color={Colors.dark.background} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleMessage}
            activeOpacity={0.7}>
            <MessageCircle size={18} color={Colors.dark.background} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.closeButton]}
            onPress={onClose}
            activeOpacity={0.7}>
            <X size={18} color={Colors.dark.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Location Status with real-time ETA (calculated locally, no Google API) */}
      {driverLocation && (
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {eta} away • {distanceRemaining}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  map: {
    flex: 1,
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: 20,
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.gold,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  driverCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  driverInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    color: Colors.dark.gold,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: Colors.dark.error + '20',
  },
  statusBanner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: Colors.dark.success,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.background,
    marginRight: 8,
  },
  statusText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600',
  },
});
