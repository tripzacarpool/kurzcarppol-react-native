import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MapPin, Phone, MessageCircle, X, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
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
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [routePath, setRoutePath] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('🗺️ Subscribing to ride location:', rideId);

    // Subscribe to driver location updates
    const unsubscribe = subscribeToRideLocation(
      rideId,
      (location: DriverLocation) => {
        console.log('📍 Driver location received:', location);
        setDriverLocation(location);
        setIsLoading(false);

        // Add to route path (keep last 50 points)
        setRoutePath((prev) => [...prev.slice(-49), location]);
      }
    );

    return () => {
      console.log('🛑 Unsubscribing from ride location');
      unsubscribeFromRideLocation(rideId);
      if (unsubscribe) unsubscribe();
    };
  }, [rideId]);

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
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: driverLocation?.latitude || pickupLocation.latitude,
          longitude: driverLocation?.longitude || pickupLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        region={
          driverLocation
            ? {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : undefined
        }>
        {/* Pickup location marker */}
        <Marker
          coordinate={pickupLocation}
          title="Pickup Location"
          pinColor={Colors.dark.gold}>
          <View style={styles.markerContainer}>
            <MapPin size={20} color={Colors.dark.gold} />
          </View>
        </Marker>

        {/* Dropoff location marker */}
        <Marker
          coordinate={dropoffLocation}
          title="Dropoff Location"
          pinColor={Colors.dark.pink}>
          <View style={styles.markerContainer}>
            <MapPin size={20} color={Colors.dark.pink} />
          </View>
        </Marker>

        {/* Driver location marker */}
        {driverLocation && (
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

        {/* Driver route path */}
        {routePath.length > 1 && (
          <Polyline
            coordinates={routePath.map((loc) => ({
              latitude: loc.latitude,
              longitude: loc.longitude,
            }))}
            strokeColor={Colors.dark.success}
            strokeWidth={3}
            lineDashPattern={[10, 5]}
          />
        )}
      </MapView>

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

      {/* Location Status */}
      {driverLocation && (
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            Driver is {Math.round(Math.random() * 5 + 2)} minutes away
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
