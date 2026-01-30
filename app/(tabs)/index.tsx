import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Search, MapPin, Bell, SlidersHorizontal, Navigation, Plus, LocateFixed } from 'lucide-react-native';
import { MapView, Marker, PROVIDER_GOOGLE, checkMapAvailability, MapPlaceholder } from '@/components/ConditionalMap';
import { Colors } from '@/constants/Colors';
import { RideCard } from '@/components/RideCard';
import { BookingModal } from '@/components/BookingModal';
import RideRequestModal from '@/components/RideRequestModal';
import LocationPicker from '@/components/LocationPicker';
import { mockRides, mockNotifications } from '@/data/mockData';
import { Ride } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { getAvailableRides } from '@/lib/api';
import { subscribeToNewRides, unsubscribeFromRideEvents, initializeLocationSocket } from '@/lib/locationSocket';
import CustomAlert, { AlertType } from '@/components/CustomAlert';
import { MAP_CONFIG } from '@/config/googleMaps';

export default function HomeScreen() {
  const mapRef = useRef<any>(null);
  const permissionRequestedRef = useRef(false);
  const { user } = useAuth();
  const { location, loading: locationLoading, hasPermission, requestPermission, updateLocation } = useLocation();
  const [womenOnlyFilter, setWomenOnlyFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [rideRequestModalVisible, setRideRequestModalVisible] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
  }>({ title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: AlertType = 'info') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  };

  const hideAlert = () => {
    setAlertVisible(false);
    setTimeout(() => {
      setAlertConfig({ title: '', message: '', type: 'info' });
    }, 300);
  };

  const fetchAvailableRides = async () => {
    if (!user?.id) return;

    try {
      setLoadingRides(true);
      const response = await getAvailableRides(user.id, 'offers');

      if (response.rides && Array.isArray(response.rides)) {
        const filtered = response.rides.filter((ride: any) => ride.clerkId !== user.id);
        setAvailableRides(filtered);
        console.log('✅ Available ride offers fetched:', filtered.length);
      }
    } catch (error) {
      console.error('❌ Error fetching available rides:', error);
      setAvailableRides([]);
    } finally {
      setLoadingRides(false);
    }
  };

  useEffect(() => {
    fetchAvailableRides();
    initializeLocationSocket();

    subscribeToNewRides((newRide) => {
      console.log('📨 Received new ride via socket:', newRide);
      fetchAvailableRides();
    });

    const interval = setInterval(fetchAvailableRides, 30000);

    return () => {
      clearInterval(interval);
      unsubscribeFromRideEvents();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    if (hasPermission) {
      if (!location && !locationLoading) {
        updateLocation();
      }
      return;
    }

    if (!permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestPermission().then((granted) => {
        if (granted) {
          updateLocation();
        }
      });
    }
  }, [hasPermission, location, locationLoading, requestPermission, updateLocation]);

  const handleRequestLocation = async () => {
    const granted = await requestPermission();
    if (granted) {
      await updateLocation();
      showAlert('Success', 'Location permission granted and location updated!', 'success');
    } else {
      showAlert('Permission Denied', 'Location permission is required to show nearby rides.', 'warning');
    }
  };

  const handleCenterOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500,
      );
    } else {
      handleRequestLocation();
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const userName = user?.firstName?.split(' ')[0] || 'Rider';

  const currentLocation = location
    ? location.city && location.country
      ? `${location.city}, ${location.country}`
      : `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
    : hasPermission
    ? 'Locating you...'
    : 'Enable location access';

  const mapRegion = useMemo(
    () => ({
      latitude: location?.latitude ?? MAP_CONFIG.DEFAULT_REGION.latitude,
      longitude: location?.longitude ?? MAP_CONFIG.DEFAULT_REGION.longitude,
      latitudeDelta: location ? 0.02 : MAP_CONFIG.DEFAULT_REGION.latitudeDelta,
      longitudeDelta: location ? 0.02 : MAP_CONFIG.DEFAULT_REGION.longitudeDelta,
    }),
    [location?.latitude, location?.longitude],
  );

  const displayRides = availableRides.length > 0 ? availableRides : mockRides;

  const filteredRides = displayRides.filter((ride) => {
    const matchesWomenFilter = !womenOnlyFilter || ride.womenOnly;
    const matchesSearch =
      !searchQuery ||
      ride.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.from.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWomenFilter && matchesSearch;
  });

  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAvailableRides();
    setRefreshing(false);
  };

  const isMapAvailable = checkMapAvailability() && MapView;

  const handleDestinationSelect = (destination: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setSelectedDestination(destination);
    setShowLocationPicker(false);

    const region = {
      latitude: destination.latitude,
      longitude: destination.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };

    mapRef.current?.animateToRegion(region, 500);
  };

  

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                {getGreeting()}, {userName}!
              </Text>
              <Text style={styles.subtitle}>Where are you going today?</Text>
            </View>
            <TouchableOpacity style={styles.notificationButton}>
              <Bell size={24} color={Colors.dark.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.locationContainer}
          onPress={hasPermission ? updateLocation : handleRequestLocation}
          activeOpacity={0.7}>
          <View style={styles.locationLeft}>
            <MapPin size={20} color={Colors.dark.gold} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.currentLocation}>{currentLocation}</Text>
              {location && (
                <Text style={styles.locationCoords}>
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
              )}
            </View>
          </View>
          {locationLoading ? (
            <ActivityIndicator size="small" color={Colors.dark.gold} />
          ) : (
            <LocateFixed size={18} color={Colors.dark.gold} />
          )}
        </TouchableOpacity>

        <View style={styles.mapSection}>
          {isMapAvailable ? (
            <>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                customMapStyle={MAP_CONFIG.MAP_STYLE}
                region={mapRegion}
                showsUserLocation
                showsMyLocationButton>
                {location && Marker && (
                  <Marker
                    coordinate={{
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }}
                    title="Your Location"
                    pinColor={Colors.dark.gold}>
                    <View style={styles.currentLocationMarker}>
                      <Navigation size={20} color={Colors.dark.background} />
                    </View>
                  </Marker>
                )}

                {selectedDestination && Marker && (
                  <Marker
                    coordinate={{
                      latitude: selectedDestination.latitude,
                      longitude: selectedDestination.longitude,
                    }}
                    title={selectedDestination.address}
                    pinColor={Colors.dark.pink}>
                    <View style={styles.destinationMarker}>
                      <MapPin size={20} color={Colors.dark.background} />
                    </View>
                  </Marker>
                )}
              </MapView>

              <TouchableOpacity
                style={styles.centerButton}
                onPress={handleCenterOnUser}
                activeOpacity={0.8}>
                {locationLoading ? (
                  <ActivityIndicator size="small" color={Colors.dark.background} />
                ) : (
                  <LocateFixed size={20} color={Colors.dark.background} />
                )}
              </TouchableOpacity>

              {locationLoading && (
                <View style={styles.mapLoader}>
                  <ActivityIndicator size="large" color={Colors.dark.gold} />
                  <Text style={styles.loaderText}>Acquiring your location...</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholderWrapper}>
              <MapPlaceholder message="Interactive maps require a development build" />
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.searchOverlay}
          onPress={() => setShowLocationPicker(true)}
          activeOpacity={0.9}>
          <Search size={20} color={Colors.dark.textSecondary} />
          <Text style={styles.searchOverlayText} numberOfLines={1}>
            {selectedDestination?.address || 'Search for a destination'}
          </Text>
          <SlidersHorizontal size={20} color={Colors.dark.gold} />
        </TouchableOpacity>

        {!hasPermission && (
          <TouchableOpacity
            style={styles.permissionBanner}
            onPress={handleRequestLocation}
            activeOpacity={0.8}>
            <Text style={styles.permissionText}>Allow location access to show your live position</Text>
          </TouchableOpacity>
        )}

        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={[styles.womenToggle, womenOnlyFilter && styles.womenToggleActive]}
            onPress={() => setWomenOnlyFilter(!womenOnlyFilter)}
            activeOpacity={0.7}>
            <View style={[styles.toggleIndicator, womenOnlyFilter && styles.toggleIndicatorActive]} />
            <Text style={[styles.toggleText, womenOnlyFilter && styles.toggleTextActive]}>
              Women Only Rides
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createRideButton}
            onPress={() => setRideRequestModalVisible(true)}
            activeOpacity={0.7}>
            <Plus size={20} color={Colors.dark.background} />
            <Text style={styles.createRideButtonText}>Request Ride</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.dark.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rides by pickup or drop"
            placeholderTextColor={Colors.dark.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.filterButton}>
            <SlidersHorizontal size={18} color={Colors.dark.gold} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Rides</Text>
          <Text style={styles.rideCount}>
            {filteredRides.length} {filteredRides.length === 1 ? 'ride' : 'rides'}
          </Text>
        </View>

        {loadingRides ? (
          <View style={styles.loadingRides}>
            <ActivityIndicator size="small" color={Colors.dark.gold} />
            <Text style={styles.loadingRidesText}>Fetching nearby rides...</Text>
          </View>
        ) : filteredRides.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No rides available</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or check back later</Text>
          </View>
        ) : (
          filteredRides.map((ride) => (
            <View key={ride.id} style={styles.rideCardWrapper}>
              <RideCard
                ride={ride}
                onPress={() => {
                  setSelectedRide(ride);
                  setBookingModalVisible(true);
                }}
              />
            </View>
          ))
        )}
      </ScrollView>

      <BookingModal
        visible={bookingModalVisible}
        ride={selectedRide}
        onClose={() => {
          setBookingModalVisible(false);
          setSelectedRide(null);
        }}
      />

      <RideRequestModal
        visible={rideRequestModalVisible}
        onClose={() => setRideRequestModalVisible(false)}
        onRideCreated={fetchAvailableRides}
      />

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={handleDestinationSelect}
        title="Choose destination"
        initialLocation={selectedDestination ?? undefined}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.dark.pink,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.dark.text,
    fontSize: 10,
    fontWeight: '700',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  locationTextContainer: {
    flex: 1,
  },
  currentLocation: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  locationCoords: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  mapSection: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    height: 260,
  },
  map: {
    flex: 1,
  },
  centerButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  searchOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginHorizontal: 20,
    marginTop: 16,
  },
  searchOverlayText: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
  },
  permissionBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: Colors.dark.pink + '33',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.pink,
  },
  permissionText: {
    color: Colors.dark.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  mapLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000044',
    gap: 10,
  },
  loaderText: {
    color: Colors.dark.text,
    fontSize: 13,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  womenToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  womenToggleActive: {
    backgroundColor: Colors.dark.pink + '26',
    borderColor: Colors.dark.pink,
  },
  toggleIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.dark.border,
    marginRight: 10,
  },
  toggleIndicatorActive: {
    backgroundColor: Colors.dark.pink,
  },
  toggleText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.dark.pink,
  },
  createRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 6,
  },
  createRideButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
  },
  filterButton: {
    padding: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  rideCount: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  loadingRides: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    marginHorizontal: 20,
  },
  loadingRidesText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  rideCardWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
    marginHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  currentLocationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  destinationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.pink,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  placeholderWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
