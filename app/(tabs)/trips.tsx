import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, ActivityIndicator } from 'react-native';
import { MapPin, Star, Calendar, User as UserIcon, Plus, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/lib/ipService';
import { getUserRides, cancelRide } from '@/lib/api';
import RideRequestModal from '@/components/RideRequestModal';
import { subscribeToRideAcceptance, unsubscribeFromRideEvents, initializeLocationSocket } from '@/lib/locationSocket';
import CustomAlert, { AlertButton, AlertType } from '@/components/CustomAlert';

export default function TripsScreen() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRides, setUserRides] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rideRequestModalVisible, setRideRequestModalVisible] = useState(false);
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
    buttons?: AlertButton[];
  }>({ title: '', message: '', type: 'info' });

  const showAlert = (title: string, message: string, type: AlertType = 'info', buttons?: AlertButton[]) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const hideAlert = () => {
    setAlertVisible(false);
    setTimeout(() => {
      setAlertConfig({ title: '', message: '', type: 'info' });
    }, 300);
  };

  useEffect(() => {
    if (user) {
      loadUserProfile();
      fetchUserRides();
      
      // Initialize socket connection
      initializeLocationSocket();
      
      // Subscribe to ride acceptance updates
      subscribeToRideAcceptance((acceptedRide) => {
        console.log('✅ Ride accepted via socket:', acceptedRide);
        // Refresh user rides to show updated status
        fetchUserRides();
      });
      
      // Poll for updates every 30 seconds as fallback
      const interval = setInterval(fetchUserRides, 30000);
      
      return () => {
        clearInterval(interval);
        unsubscribeFromRideEvents();
      };
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const fetchUserRides = async () => {
    if (!user?.id) return;
    try {
      setLoadingRides(true);
      const response = await getUserRides(user.id);
      if (response.rides && Array.isArray(response.rides)) {
        setUserRides(response.rides);
        console.log('✅ User rides fetched:', response.rides.length);
      }
    } catch (error) {
      console.error('❌ Error fetching user rides:', error);
      // Fall back to mock data
      setUserRides([]);
    } finally {
      setLoadingRides(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserRides();
    setRefreshing(false);
  };

  const handleCancelRide = (rideId: string, rideStatus: string) => {
    // Can only cancel rides that are waiting or accepted
    if (!['waiting', 'accepted'].includes(rideStatus)) {
      showAlert('Cannot Cancel', `This ride cannot be cancelled as it's already ${rideStatus}.`, 'warning');
      return;
    }

    showAlert(
      'Cancel Ride Request?',
      'Are you sure you want to cancel this ride request? You won\'t be matched with a driver.',
      'warning',
      [
        {
          text: 'Keep it',
          style: 'cancel',
        },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            await performCancelRide(rideId);
          },
        },
      ]
    );
  };

  const performCancelRide = async (rideId: string) => {
    setCancellingRideId(rideId);
    try {
      await cancelRide(rideId, 'request'); // Specify it's a request
      
      // Remove from local state
      const updated = userRides.filter(ride => ride.id !== rideId);
      setUserRides(updated);
      
      showAlert('Cancelled', 'Your ride request has been cancelled.', 'success');
      console.log('✅ Ride cancelled:', rideId);
    } catch (error) {
      console.error('❌ Error cancelling ride:', error);
      showAlert('Error', 'Failed to cancel the ride. Please try again.', 'error');
    } finally {
      setCancellingRideId(null);
    }
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.firstName?.split(' ')[0] || 'there';
  const displayRides = userRides.length > 0 ? userRides : mockTrips;
  const totalRides = displayRides.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Rides</Text>
          <Text style={styles.subtitle}>Hey {userName}! You have {totalRides} ride{totalRides !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setRideRequestModalVisible(true)}
          activeOpacity={0.7}>
          <Plus size={22} color={Colors.dark.background} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loadingRides ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.gold} />
            <Text style={styles.loadingText}>Loading your rides...</Text>
          </View>
        ) : displayRides.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No rides yet</Text>
            <Text style={styles.emptySubtext}>Create a ride request to get started</Text>
            <TouchableOpacity
              style={styles.createRideBtn}
              onPress={() => setRideRequestModalVisible(true)}
              activeOpacity={0.7}>
              <Plus size={20} color={Colors.dark.background} />
              <Text style={styles.createRideBtnText}>Create Ride</Text>
            </TouchableOpacity>
          </View>
        ) : (
          displayRides.map((ride, index) => (
            <View key={ride.id || index}>
              <TouchableOpacity
                style={styles.tripCard}
                activeOpacity={0.7}>
                <View style={styles.tripHeader}>
                  <View style={styles.routeInfo}>
                    <View style={styles.routeRow}>
                      <MapPin size={14} color={Colors.dark.gold} />
                      <Text style={styles.location}>{ride.from}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                      <MapPin size={14} color={Colors.dark.pink} />
                      <Text style={styles.location}>{ride.to}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      ride.status === 'cancelled' && styles.cancelledBadge,
                      ride.status === 'accepted' && styles.acceptedBadge,
                      ride.status === 'waiting' && styles.waitingBadge,
                    ]}>
                    <Text
                      style={[
                        styles.statusText,
                        ride.status === 'cancelled' && styles.cancelledText,
                        ride.status === 'accepted' && styles.acceptedText,
                        ride.status === 'waiting' && styles.waitingText,
                      ]}>
                      {ride.status === 'completed' ? 'Completed' : ride.status === 'accepted' ? 'Accepted' : ride.status === 'waiting' ? 'Waiting' : 'Cancelled'}
                    </Text>
                  </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.tripDetails}>
                {ride.createdAt && (
                  <View style={styles.detailRow}>
                    <Calendar size={14} color={Colors.dark.textSecondary} />
                    <Text style={styles.detailText}>{new Date(ride.createdAt).toLocaleDateString()}</Text>
                  </View>
                )}
              </View>

              {['waiting', 'accepted'].includes(ride.status) && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { opacity: cancellingRideId === ride.id ? 0.6 : 1 }]}
                    onPress={() => handleCancelRide(ride.id, ride.status)}
                    disabled={cancellingRideId === ride.id}
                    activeOpacity={0.7}>
                    {cancellingRideId === ride.id ? (
                      <ActivityIndicator size="small" color={Colors.dark.background} />
                    ) : (
                      <>
                        <X size={16} color={Colors.dark.background} />
                        <Text style={styles.cancelButtonText}>Cancel Request</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <RideRequestModal
        visible={rideRequestModalVisible}
        onClose={() => setRideRequestModalVisible(false)}
        onRideCreated={() => {
          console.log('✅ Ride created successfully');
          fetchUserRides();
        }}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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
    marginBottom: 24,
  },
  createRideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  createRideBtnText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '600',
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
  acceptedBadge: {
    backgroundColor: Colors.dark.gold + '20',
  },
  waitingBadge: {
    backgroundColor: Colors.dark.textSecondary + '20',
  },
  statusText: {
    color: Colors.dark.success,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelledText: {
    color: Colors.dark.error,
  },
  acceptedText: {
    color: Colors.dark.gold,
  },
  waitingText: {
    color: Colors.dark.textSecondary,
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
  actionRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.error,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  cancelButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600',
  },
});
