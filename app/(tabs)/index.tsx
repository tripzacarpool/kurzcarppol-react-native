import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { Search, MapPin, Bell, SlidersHorizontal, Navigation, Plus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { RideCard } from '@/components/RideCard';
import { BookingModal } from '@/components/BookingModal';
import RideRequestModal from '@/components/RideRequestModal';
import { mockRides, mockNotifications } from '@/data/mockData';
import { Ride } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { getAvailableRides } from '@/lib/api';
import { subscribeToNewRides, unsubscribeFromRideEvents, initializeLocationSocket } from '@/lib/locationSocket';
import CustomAlert, { AlertType } from '@/components/CustomAlert';

export default function HomeScreen() {
  const { user } = useAuth();
  const { location, loading: locationLoading, hasPermission, requestPermission, updateLocation } = useLocation();
  const [womenOnlyFilter, setWomenOnlyFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [rideRequestModalVisible, setRideRequestModalVisible] = useState(false);
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
      // Pass type=offers so passengers see only driver offers (not their own requests)
      const response = await getAvailableRides(user.id, 'offers');
      if (response.rides && Array.isArray(response.rides)) {
        // Defensive: filter out any accidental self-authored rides
        const filtered = response.rides.filter((ride: any) => ride.clerkId !== user.id);
        setAvailableRides(filtered);
        console.log('✅ Available ride offers fetched:', filtered.length);
      }
    } catch (error) {
      console.error('❌ Error fetching available rides:', error);
      // Fall back to mock data if API fails
      setAvailableRides([]);
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

  // Combine backend rides with mock rides for demo
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

          <View style={styles.searchContainer}>
            <Search size={20} color={Colors.dark.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Where do you want to go?"
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
            <Text style={styles.rideCount}>
              {filteredRides.length} {filteredRides.length === 1 ? 'ride' : 'rides'}
            </Text>
          </View>

          {filteredRides.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No rides available</Text>
              <Text style={styles.emptySubtext}>
                Try adjusting your filters or check back later
              </Text>
            </View>
          ) : (
            filteredRides.map((ride, index) => (
              <View key={ride.id}>
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
  },
});
