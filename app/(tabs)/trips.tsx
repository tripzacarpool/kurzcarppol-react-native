import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { MapPin, Star, Calendar, User as UserIcon } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { mockTrips } from '@/data/mockData';
import Animated from 'react-native-reanimated';
import { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/lib/ipService';

export default function TripsScreen() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'there';
  const totalTrips = userProfile?.total_trips || mockTrips.length;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
        <Text style={styles.subtitle}>Hey {userName}! You've completed {totalTrips} trip{totalTrips !== 1 ? 's' : ''}</Text>
      </Animated.View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {mockTrips.map((trip, index) => (
          <Animated.View
            key={trip.id}
            entering={FadeInDown.delay(index * 50).springify()}>
            <TouchableOpacity
              style={styles.tripCard}
              activeOpacity={0.7}>
              <View style={styles.tripHeader}>
                <View style={styles.routeInfo}>
                  <View style={styles.routeRow}>
                    <MapPin size={14} color={Colors.dark.gold} />
                    <Text style={styles.location}>{trip.from}</Text>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routeRow}>
                    <MapPin size={14} color={Colors.dark.pink} />
                    <Text style={styles.location}>{trip.to}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    trip.status === 'cancelled' && styles.cancelledBadge,
                  ]}>
                  <Text
                    style={[
                      styles.statusText,
                      trip.status === 'cancelled' && styles.cancelledText,
                    ]}>
                    {trip.status === 'completed' ? 'Completed' : 'Cancelled'}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.tripDetails}>
                <View style={styles.detailRow}>
                  <Calendar size={14} color={Colors.dark.textSecondary} />
                  <Text style={styles.detailText}>{trip.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.fareLabel}>Fare:</Text>
                  <Text style={styles.fare}>₹{trip.fare}</Text>
                </View>
              </View>

              <View style={styles.driverInfo}>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{trip.driver.name}</Text>
                  <View style={styles.ratingRow}>
                    <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
                    <Text style={styles.rating}>{trip.driver.rating}</Text>
                  </View>
                </View>
                {trip.status === 'completed' && trip.rating && (
                  <View style={styles.tripRating}>
                    <Text style={styles.tripRatingLabel}>Your Rating:</Text>
                    <View style={styles.ratingStars}>
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          color={i < trip.rating! ? Colors.dark.gold : Colors.dark.border}
                          fill={i < trip.rating! ? Colors.dark.gold : 'transparent'}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tripCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    color: Colors.dark.text,
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.dark.border,
    marginLeft: 6,
    marginVertical: 4,
  },
  statusBadge: {
    backgroundColor: Colors.dark.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    height: 32,
  },
  cancelledBadge: {
    backgroundColor: Colors.dark.error + '20',
  },
  statusText: {
    color: Colors.dark.success,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelledText: {
    color: Colors.dark.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginLeft: 6,
  },
  fareLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginRight: 8,
  },
  fare: {
    color: Colors.dark.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  driverInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  tripRating: {
    alignItems: 'flex-end',
  },
  tripRatingLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
});
