import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Search, MapPin, Bell, SlidersHorizontal, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { RideCard } from '@/components/RideCard';
import { BookingModal } from '@/components/BookingModal';
import { mockRides, mockNotifications } from '@/data/mockData';
import { Ride } from '@/types';
import Animated from 'react-native-reanimated';
import { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { getUserProfile } from '@/lib/ipService';

export default function HomeScreen() {
  const { user } = useAuth();
  const { location, loading: locationLoading, hasPermission, requestPermission, updateLocation } = useLocation();
  const [womenOnlyFilter, setWomenOnlyFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
      setLoadingProfile(false);
    }
  };

  const handleRequestLocation = async () => {
    const granted = await requestPermission();
    if (granted) {
      await updateLocation();
      Alert.alert('Success', 'Location permission granted and location updated!');
    } else {
      Alert.alert('Permission Denied', 'Location permission is required to show nearby rides.');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'Rider';

  const currentLocation = location
    ? location.city && location.country
      ? `${location.city}, ${location.country}`
      : `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
    : userProfile?.city && userProfile?.country
    ? `${userProfile.city}, ${userProfile.country}`
    : 'Location not available';

  const filteredRides = mockRides.filter((ride) => {
    const matchesWomenFilter = !womenOnlyFilter || ride.isWomenOnly;
    const matchesSearch =
      !searchQuery ||
      ride.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.from.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesWomenFilter && matchesSearch;
  });

  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}, {userName}!</Text>
              <Text style={styles.subtitle}>Where are you going today?</Text>
              {userProfile?.ip_address && (
                <Text style={styles.ipText}>IP: {userProfile.ip_address}</Text>
              )}
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
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(100).springify()} style={styles.ridesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Rides</Text>
            <Text style={styles.rideCount}>{filteredRides.length} rides</Text>
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
              <Animated.View
                key={ride.id}
                entering={FadeInDown.delay(index * 50).springify()}>
                <RideCard
                  ride={ride}
                  onPress={() => {
                    setSelectedRide(ride);
                    setBookingModalVisible(true);
                  }}
                />
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      <BookingModal
        visible={bookingModalVisible}
        ride={selectedRide}
        onClose={() => setBookingModalVisible(false)}
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
  },
  womenToggle: {
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
