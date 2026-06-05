import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPlaceholder, MapView, Marker, Polyline, PROVIDER_GOOGLE, checkMapAvailability } from './ConditionalMap';
import { MapPin, MessageCircle, Navigation, Phone, Shield, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { MAP_CONFIG } from '@/config/googleMaps';
import SafetyToolkit from './SafetyToolkit';
import ShareTrip from './ShareTrip';
import { activateSOS } from '@/lib/api';
import {
  calculateDistance,
  estimateETA,
  fetchRouteFromGoogle,
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
  const [plannedRoute, setPlannedRoute] = useState<RouteCoordinate[]>([
    pickupLocation,
    dropoffLocation,
  ]);
  const [eta, setEta] = useState<string>('Waiting');
  const [distanceRemaining, setDistanceRemaining] = useState<string>('--');
  const [showSafetyToolkit, setShowSafetyToolkit] = useState(false);
  const [showShareTrip, setShowShareTrip] = useState(false);
  const [tripShared, setTripShared] = useState(false);

  const mapCenter = driverLocation || pickupLocation;

  useEffect(() => {
    fetchRouteFromGoogle(pickupLocation, dropoffLocation).then((result) => {
      if (result.success && result.routes.length > 0) {
        setPlannedRoute(result.routes);
      } else {
        setPlannedRoute([pickupLocation, dropoffLocation]);
      }
    });
  }, [
    pickupLocation.latitude,
    pickupLocation.longitude,
    dropoffLocation.latitude,
    dropoffLocation.longitude,
  ]);

  useEffect(() => {
    subscribeToRideLocation(rideId, (location: DriverLocation) => {
      setDriverLocation(location);

      const distance = calculateDistance(
        { latitude: location.latitude, longitude: location.longitude },
        dropoffLocation,
      );
      setDistanceRemaining(`${distance.toFixed(1)} km`);
      setEta(estimateETA(distance));
      setRoutePath((prev) => [...prev.slice(-49), location]);

      mapRef.current?.animateCamera(
        {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          zoom: 15,
        },
        { duration: MAP_CONFIG.MAP_ANIMATION_DURATION },
      );
    });

    return () => {
      unsubscribeFromRideLocation(rideId);
    };
  }, [rideId, dropoffLocation.latitude, dropoffLocation.longitude]);

  const handleOpenSOS = async () => {
    const openEmergencySms = async (response: any) => {
      const alertData = response?.data || response?.sosAlert || response;
      const emergencyContacts = Array.isArray(alertData?.emergencyContacts)
        ? alertData.emergencyContacts
        : [];
      const phones = [
        ...new Set(
          emergencyContacts
            .map((contact: any) => contact?.phone)
            .filter(Boolean),
        ),
      ];
      const location = driverLocation
        ? ` Location: https://maps.google.com/?q=${driverLocation.latitude},${driverLocation.longitude}`
        : '';
      const body = `SOS ALERT: I need help during my Tripza ride. Ride ID: ${rideId}.${location}`;

      if (phones.length === 0) {
        Alert.alert(
          'No emergency contacts',
          'SOS was sent to Tripza support and ride participants. Add emergency contacts in your safety settings for direct SMS alerts.',
          [
            { text: 'OK' },
            {
              text: 'Call 112',
              style: 'destructive',
              onPress: () => Linking.openURL('tel:112'),
            },
          ],
        );
        return;
      }

      const separator = Platform.OS === 'ios' ? ',' : ';';
      const smsUrl = `sms:${phones.join(separator)}?body=${encodeURIComponent(body)}`;
      try {
        if (await Linking.canOpenURL(smsUrl)) {
          await Linking.openURL(smsUrl);
          return;
        }
      } catch (error) {
        console.warn('Unable to open SMS composer:', error);
      }

      Alert.alert(
        'Emergency SMS ready',
        `Please message these emergency contacts now:\n${phones.join(', ')}`,
      );
    };

    Alert.alert(
      'Activate SOS Alert?',
      `This will immediately alert ${driverName}, Tripza support, and saved emergency contacts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Activate SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await activateSOS(rideId);
              Alert.alert(
                'SOS Activated',
                'Emergency alert has been sent. You can also message your saved emergency contacts now.',
                [
                  {
                    text: 'Send SMS',
                    onPress: () => {
                      openEmergencySms(response).catch((error) => {
                        console.warn('Emergency SMS failed:', error);
                      });
                    },
                  },
                  {
                    text: 'Call 112',
                    style: 'destructive',
                    onPress: () => Linking.openURL('tel:112'),
                  },
                ],
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to activate SOS.');
            }
          },
        },
      ],
    );
  };

  const handleEmergencyCall = () => {
    Linking.openURL('tel:112').catch(() => {
      Alert.alert('Error', 'Unable to initiate call. Please dial 112 manually.');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {checkMapAvailability() && MapView ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={MAP_CONFIG.MAP_STYLE}
          initialRegion={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            latitudeDelta: MAP_CONFIG.DEFAULT_REGION.latitudeDelta,
            longitudeDelta: MAP_CONFIG.DEFAULT_REGION.longitudeDelta,
          }}>
          {plannedRoute.length > 0 && Polyline && (
            <Polyline
              coordinates={plannedRoute}
              strokeColor={Colors.dark.gold + '70'}
              strokeWidth={4}
            />
          )}

          {Marker && (
            <Marker coordinate={pickupLocation} title="Pickup Location">
              <View style={styles.markerContainer}>
                <MapPin size={20} color={Colors.dark.gold} />
              </View>
            </Marker>
          )}

          {Marker && (
            <Marker coordinate={dropoffLocation} title="Dropoff Location">
              <View style={[styles.markerContainer, styles.dropoffMarker]}>
                <MapPin size={20} color={Colors.dark.pink} />
              </View>
            </Marker>
          )}

          {driverLocation && Marker && (
            <Marker
              coordinate={{
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
              }}
              title={driverName}>
              <View style={styles.driverMarker}>
                <Navigation
                  size={16}
                  color={Colors.dark.background}
                  fill={Colors.dark.success}
                />
              </View>
            </Marker>
          )}

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
      ) : (
        <MapPlaceholder message="Ride tracking map requires a development build. Tracking details are still available here." />
      )}

      <View style={styles.statusBanner}>
        <View style={driverLocation ? styles.statusDot : styles.statusDotPending} />
        <Text style={styles.statusText}>
          {driverLocation
            ? `${eta} away - ${distanceRemaining}`
            : 'Waiting for driver live location'}
        </Text>
      </View>

      <View style={styles.driverCard}>
        <View style={styles.driverDetails}>
          <Text style={styles.driverName}>{driverName}</Text>
          <Text style={styles.ratingText}>Rating {driverRating.toFixed(1)}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Call Driver', `Calling ${driverName}...`)}>
            <Phone size={18} color={Colors.dark.background} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Message', `Send a message to ${driverName}`)}>
            <MessageCircle size={18} color={Colors.dark.background} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.closeButton]}
            onPress={onClose}>
            <X size={18} color={Colors.dark.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sosContainer}>
        <TouchableOpacity
          style={styles.safetyButton}
          onPress={() => setShowSafetyToolkit(true)}>
          <Shield size={24} color={Colors.dark.background} />
          <Text style={styles.safetyButtonText}>Safety</Text>
        </TouchableOpacity>
      </View>

      <SafetyToolkit
        visible={showSafetyToolkit}
        onClose={() => setShowSafetyToolkit(false)}
        onShareTrip={() => {
          setShowSafetyToolkit(false);
          setShowShareTrip(true);
        }}
        onOpenSOS={() => {
          setShowSafetyToolkit(false);
          handleOpenSOS();
        }}
        onEmergencyCall={() => {
          setShowSafetyToolkit(false);
          handleEmergencyCall();
        }}
        onReportIssue={() => {
          setShowSafetyToolkit(false);
          Alert.alert('Report Issue', 'Your report has been sent to support.');
        }}
        hasTripShared={tripShared}
      />

      <ShareTrip
        visible={showShareTrip}
        onClose={() => setShowShareTrip(false)}
        tripDetails={{
          driverName,
          driverPhone: 'Not available',
          vehicleNumber: 'Not available',
          pickupLocation: `${pickupLocation.latitude.toFixed(5)}, ${pickupLocation.longitude.toFixed(5)}`,
          dropoffLocation: `${dropoffLocation.latitude.toFixed(5)}, ${dropoffLocation.longitude.toFixed(5)}`,
          currentLocation: driverLocation || undefined,
          eta,
        }}
        emergencyContacts={[]}
        googleMapsLink={`https://www.google.com/maps/dir/?api=1&origin=${pickupLocation.latitude},${pickupLocation.longitude}&destination=${dropoffLocation.latitude},${dropoffLocation.longitude}`}
        onTripShared={() => {
          setTripShared(true);
          setShowShareTrip(false);
        }}
      />
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
    width,
    height,
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
  dropoffMarker: {
    borderColor: Colors.dark.pink,
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
  statusDotPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.gold,
    marginRight: 8,
  },
  statusText: {
    flex: 1,
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600',
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
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
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
  sosContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  safetyButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  safetyButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
