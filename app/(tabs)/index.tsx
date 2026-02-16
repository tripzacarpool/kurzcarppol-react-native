import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
import { Search, MapPin, Bell, SlidersHorizontal, Navigation, Plus } from 'lucide-react-native';
import { MapView, Marker, PROVIDER_GOOGLE, checkMapAvailability, MapPlaceholder } from '@/components/ConditionalMap';
import { Colors } from '@/constants/Colors';
import { RideCard } from '@/components/RideCard';
import { BookingModal } from '@/components/BookingModal';
import RideRequestModal from '@/components/RideRequestModal';
import LocationPicker from '@/components/LocationPicker';
import { Ride } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { getAvailableRides, getAllRides, getAvailableRideOffers } from '@/lib/api';
import { subscribeToNewRides, unsubscribeFromRideEvents, initializeLocationSocket } from '@/lib/locationSocket';
import CustomAlert, { AlertType } from '@/components/CustomAlert';
import { MAP_CONFIG } from '@/config/googleMaps';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
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

  useEffect(() => {
    fetchAvailableRides();
    
    // Initialize socket connection
    initializeLocationSocket();
    
    // Subscribe to new rides in real-time
    subscribeToNewRides((newRide) => {
      console.log('📨 Received new ride via socket:', newRide);
      // Refresh rides to include the new one
      fetchAvailableRides();
    });
    
    // Poll for new rides every 30 seconds as fallback
    const interval = setInterval(fetchAvailableRides, 30000);
    
    return () => {
      clearInterval(interval);
      unsubscribeFromRideEvents();
    };
  }, []);

  const fetchAvailableRides = async () => {
    if (!user?.id) return;
    try {
      setLoadingRides(true);
      // Use the new getAllRides API that fetches both offers and requests
      const response = await getAvailableRideOffers();
      console.log('📥 API Response:', { 
        success: response.success, 
        count: response.count,
        ridesReceived: response.rideOffers?.length 
      });
      
      if (response.rideOffers && Array.isArray(response.rideOffers)) {
        console.log('👤 Current user ID:', user.id);
        console.log('🔍 Filtering rides - Before filter:', response.rideOffers.length);
        
        // Filter out self-authored rides and mark as offers
        const filtered = response.rideOffers
          .filter((ride: any) => {
            const isOwnRide = ride.clerkId === user.id;
            if (isOwnRide) {
              console.log('🚫 Filtered out own ride:', {
                from: ride.from,
                to: ride.to,
                rideClerkId: ride.clerkId,
                userClerkId: user.id
              });
            }
            return !isOwnRide;
          })
          .map((ride: any) => ({ ...ride, rideType: 'offer' as const }));
        
        console.log('✅ After filter:', filtered.length);
        setAvailableRides(filtered);
        console.log('✅ Available ride offers fetched:', filtered.length);
        console.log('📦 Rides data:', filtered);
      } else {
        console.warn('⚠️ No ride offers in response, using empty array');
        setAvailableRides([]);
      }
    } catch (error) {
      console.error('❌ Error fetching available rides:', error);
      // Don't clear rides on error, keep showing existing data
      if (availableRides.length === 0) {
        console.log('📦 No rides available');
        setAvailableRides([]);
      }
    } finally {
      setLoadingRides(false);
    }
  };

  const handleRequestLocation = async () => {
    const granted = await requestPermission();
    if (granted) {
      await updateLocation();
      showAlert('Success', 'Location permission granted and location updated!', 'success');
    } else {
      showAlert('Permission Denied', 'Location permission is required to show nearby rides.', 'warning');
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
    : 'Location not available';

  // Filter out invalid and expired rides
  const filterValidRides = (rides: any[]) => {
    const now = new Date();
    return rides.filter((ride) => {
      // Must have a valid departure time
      if (!ride.departureTime) {
        console.log('❌ Ride without departure time:', ride.id);
        return false;
      }

      // Parse departure time
      const departureTime = new Date(ride.departureTime);
      
      // Check if date is valid
      if (isNaN(departureTime.getTime())) {
        console.log('❌ Ride with invalid departure time:', ride.id, ride.departureTime);
        return false;
      }

      // Check if ride has expired (5 minutes after departure)
      const expirationTime = new Date(departureTime.getTime() + 5 * 60000);
      if (now > expirationTime) {
        console.log('⏰ Expired ride:', ride.id, 'departed at', departureTime);
        return false;
      }

      return true;
    });
  };

  // Filter valid rides only
  const validAvailableRides = filterValidRides(availableRides);
  const displayRides = validAvailableRides;
  
  console.log('🔍 Total available rides:', availableRides.length);
  console.log('🔍 Valid rides after filtering:', validAvailableRides.length);
  console.log('🔍 Display rides count:', displayRides.length);

  const filteredRides = displayRides.filter((ride) => {
    const matchesWomenFilter = !womenOnlyFilter || ride.womenOnly;
    const matchesSearch =
      !searchQuery ||
      ride.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.from.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWomenFilter && matchesSearch;
  });

  const unreadCount = 0; // TODO: Implement real notifications system

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAvailableRides();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}, {userName}!</Text>
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
            ) : !hasPermission ? (
              <Navigation size={20} color={Colors.dark.gold} />
            ) : null}
          </TouchableOpacity>

          {/* Interactive Map with Search */}
          <View style={styles.mapSection}>
            {checkMapAvailability() && MapView ? (
              <>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  customMapStyle={MAP_CONFIG.MAP_STYLE}
                  region={{
                    latitude: location?.latitude || MAP_CONFIG.DEFAULT_REGION.latitude,
                    longitude: location?.longitude || MAP_CONFIG.DEFAULT_REGION.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  showsUserLocation
                  showsMyLocationButton>
                  
                  {/* Current location marker */}
                  {location && Marker && (
                    <Marker
                      coordinate={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                      }}
                      title="Your Location"
                      pinColor={Colors.dark.gold}>
                      <View style={styles.currentLocationMarker}>
                        <Navigation size={20} color={Colors.dark.background} fill={Colors.dark.gold} />
                      </View>
                    </Marker>
                  )}

                  {/* Selected destination marker */}
                  {selectedDestination && Marker && (
                    <Marker
                      coordinate={{
                        latitude: selectedDestination.latitude,
                        longitude: selectedDestination.longitude,
                      }}
                      title={selectedDestination.address}
                      pinColor={Colors.dark.pink}>
                      <View style={styles.destinationMarker}>
                        <MapPin size={20} color={Colors.dark.background} fill={Colors.dark.pink} />
                      </View>
                    </Marker>
                  )}
                </MapView>

                {/* Search Overlay */}
                <TouchableOpacity
                  style={styles.searchOverlay}
                  onPress={() => setShowLocationPicker(true)}
                  activeOpacity={0.9}>
                  <Search size={20} color={Colors.dark.textSecondary} />
                  <Text style={styles.searchOverlayText}>
                    {selectedDestination?.address || 'Where do you want to go?'}
                  </Text>
                  <SlidersHorizontal size={20} color={Colors.dark.gold} />
                </TouchableOpacity>
              </>
            ) : (
              <MapPlaceholder message="Interactive maps require a development build" />
            )}
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color={Colors.dark.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search rides by location..."
              placeholderTextColor={Colors.dark.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity style={styles.filterButton}>
              <SlidersHorizontal size={20} color={Colors.dark.gold} />
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.womenToggle, womenOnlyFilter && styles.womenToggleActive]}
              onPress={() => setWomenOnlyFilter(!womenOnlyFilter)}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.toggleIndicator,
                  womenOnlyFilter && styles.toggleIndicatorActive,
                ]}
              />
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
        </View>

        <View style={styles.ridesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Rides</Text>
            <View style={styles.rideCountContainer}>
              {validAvailableRides.length > 0 && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveIndicator} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              )}
              <Text style={styles.rideCount}>
                {filteredRides.length} {filteredRides.length === 1 ? 'ride' : 'rides'}
              </Text>
            </View>
          </View>

          {loadingRides && validAvailableRides.length === 0 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.dark.gold} />
              <Text style={styles.loadingText}>Loading available rides...</Text>
            </View>
          ) : filteredRides.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No rides available</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || womenOnlyFilter
                  ? 'Try adjusting your filters or check back later'
                  : 'Be the first to create a ride!'}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setRideRequestModalVisible(true)}>
                <Plus size={20} color={Colors.dark.text} />
                <Text style={styles.emptyButtonText}>Request a Ride</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {filteredRides.map((ride, index) => (
                <RideCard
                  key={ride.id || `ride-${index}`}
                  ride={ride}
                  onPress={() => {
                    // Prevent booking completed or cancelled rides
                    if (ride.status === 'completed' || ride.status === 'cancelled') {
                      showAlert(
                        'Ride Unavailable',
                        `This ride has been ${ride.status}. You cannot book rides that have ended.`,
                        'error'
                      );
                      return;
                    }
                    setSelectedRide(ride);
                    setBookingModalVisible(true);
                  }}
                  isOwner={ride.clerkId === user?.id}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <BookingModal
        visible={bookingModalVisible}
        ride={selectedRide}
        onClose={() => setBookingModalVisible(false)}
      />

      <RideRequestModal
        visible={rideRequestModalVisible}
        onClose={() => setRideRequestModalVisible(false)}
        onRideCreated={() => {
          // Refresh rides list or show success message
          console.log('✅ Ride created successfully');
        }}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={(loc) => {
          setSelectedDestination(loc);
          setSearchQuery(loc.address);
          setShowLocationPicker(false);
        }}
        title="Where do you want to go?"
        initialLocation={selectedDestination || undefined}
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
  header: {
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  ipText: {
    fontSize: 11,
    color: Colors.dark.gold,
    fontWeight: '600',
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
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  currentLocation: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  locationCoords: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  mapSection: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  searchOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: Colors.dark.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  searchOverlayText: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
    marginLeft: 10,
  },
  filterButton: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 12,
  },
  womenToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  womenToggleActive: {
    backgroundColor: Colors.dark.pink + '20',
    borderColor: Colors.dark.pink,
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.border,
    marginRight: 10,
  },
  toggleIndicatorActive: {
    backgroundColor: Colors.dark.pink,
  },
  toggleText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.dark.pink,
  },
  createRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 6,
  },
  createRideButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
  ridesSection: {
    padding: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  rideCount: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  rideCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  emptyButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
