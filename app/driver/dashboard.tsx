import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert, { AlertType, AlertButton } from '@/components/CustomAlert';
import {
  Power,
  DollarSign,
  Clock,
  Star,
  Users,
  MapPin,
  Check,
  X,
  LogOut,
  RefreshCw,
  Plus,
  LayoutDashboard,
  List,
  BarChart3,
  ShieldCheck,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { useAuthContext } from '@/contexts/AuthContext';
import type { DriverVerificationResult, DriverVerificationStatus } from '@/types';
import { getAvailableRides, acceptRide, cancelRide, driverConfirmPickup } from '@/lib/api';
import { initializeLocationSocket, emitDriverLocation, driverGoesOnline, subscribeToNewRides, unsubscribeFromRideEvents, getLocationSocket } from '@/lib/locationSocket';
import DriverRideOfferModal from '@/components/DriverRideOfferModal';
import VerificationBadge from '@/components/VerificationBadge';

interface Ride {
  id: string;
  passenger: string;
  from: string;
  to: string;
  passengers: number;
  fare?: number;
  customRequest?: string;
  rating?: number;
  profileImage?: string;
  createdAt?: string;
  isLive?: boolean;
}

interface DriverStats {
  earnings: number;
  ridesCount: number;
  rating: number;
  onlineTime: number;
}

interface DriverOffer {
  id: string;
  from: string;
  to: string;
  seats: number;
  fare?: number;
  womenOnly?: boolean;
  createdAt?: string;
  status?: 'live' | 'completed' | 'draft';
}

type DashboardTab = 'live' | 'offers' | 'insights';

function formatVerificationStatusLabel(status: DriverVerificationStatus) {
  switch (status) {
    case 'auto_approved':
      return 'Auto approved';
    case 'manual_review':
      return 'Manual review';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}

export default function DriverDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuthContext();
  const [isLive, setIsLive] = useState(false);
  const [liveStateReady, setLiveStateReady] = useState(false);
  const [womenOnlyMode, setWomenOnlyMode] = useState(false);
  const [liveRides, setLiveRides] = useState<Ride[]>([]);
  const [randomRides, setRandomRides] = useState<Ride[]>([]);
  const [myOffers, setMyOffers] = useState<DriverOffer[]>([]);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [activeRideDetails, setActiveRideDetails] = useState<Ride | null>(null);
  const [driverPickupConfirmed, setDriverPickupConfirmed] = useState(false);
  const [pickupConfirming, setPickupConfirming] = useState(false);
  const [stats, setStats] = useState<DriverStats>({
    earnings: 2450,
    ridesCount: 12,
    rating: 4.8,
    onlineTime: 240,
  });
  const [selectedTab, setSelectedTab] = useState<DashboardTab>('live');
  const [offersLoading, setOffersLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rideOfferModalVisible, setRideOfferModalVisible] = useState(false);
  const [editingOffer, setEditingOffer] = useState<DriverOffer | null>(null);
  const [cancellingOfferId, setCancellingOfferId] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
    buttons?: AlertButton[];
  } | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<DriverVerificationStatus>('pending');
  const [verificationScore, setVerificationScore] = useState<number | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const liveStateKey = user?.id ? `driver_live_state_${user.id}` : null;
  const offersKey = user?.id ? `driver_offers_${user.id}` : null;
  const verificationKey = user?.id ? `driver_verification_${user.id}` : null;

  const showAlert = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' = 'info',
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const hideAlert = () => {
    setAlertVisible(false);
    setTimeout(() => {
      setAlertConfig(null);
    }, 300);
  };

  const loadSavedOffers = async () => {
    if (!offersKey) return;
    try {
      setOffersLoading(true);
      const stored = await AsyncStorage.getItem(offersKey);
      if (stored) {
        const parsed: DriverOffer[] = JSON.parse(stored);
        console.log('📋 Raw parsed offers:', parsed);
        // Filter out invalid offers with missing critical fields
        const validOffers = parsed.filter(offer => {
          const isValid = offer && 
            offer.id && 
            typeof offer.from === 'string' && 
            offer.from.trim().length > 0 &&
            typeof offer.to === 'string' && 
            offer.to.trim().length > 0 &&
            typeof offer.seats === 'number' &&
            offer.seats > 0;
          
          if (!isValid) {
            console.warn('⚠️ Filtering out invalid offer:', JSON.stringify(offer));
          }
          return isValid;
        });
        setMyOffers(validOffers);
        console.log('✅ Loaded valid offers:', validOffers.length);
      } else {
        console.log('📋 No saved offers found');
      }
    } catch (error) {
      console.warn('⚠️ Unable to load saved offers:', error);
    } finally {
      setOffersLoading(false);
    }
  };

  const persistOffers = async (offers: DriverOffer[]) => {
    if (!offersKey) return;
    try {
      // Validate all offers before saving
      const validOffers = offers.filter(offer =>
        offer &&
        offer.id &&
        typeof offer.from === 'string' &&
        offer.from.trim().length > 0 &&
        typeof offer.to === 'string' &&
        offer.to.trim().length > 0 &&
        typeof offer.seats === 'number' &&
        offer.seats > 0
      );
      
      if (validOffers.length !== offers.length) {
        console.warn(`⚠️ Filtered out ${offers.length - validOffers.length} invalid offers before saving`);
      }
      
      await AsyncStorage.setItem(offersKey, JSON.stringify(validOffers));
    } catch (error) {
      console.warn('⚠️ Unable to persist offers:', error);
    }
  };

  const persistLiveState = async (value: boolean) => {
    if (!liveStateKey) return;
    try {
      await AsyncStorage.setItem(liveStateKey, value ? 'true' : 'false');
    } catch (error) {
      console.warn('⚠️ Unable to persist live toggle:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const loadVerificationState = async () => {
        if (!verificationKey) {
          if (!isMounted) return;
          setVerificationStatus('pending');
          setVerificationScore(null);
          return;
        }
        try {
          const stored = await AsyncStorage.getItem(verificationKey);
          if (!isMounted) return;
          if (!stored) {
            setVerificationStatus('pending');
            setVerificationScore(null);
            return;
          }
          const parsed = JSON.parse(stored) as { result?: DriverVerificationResult };
          if (parsed?.result) {
            setVerificationStatus(parsed.result.status);
            setVerificationScore(parsed.result.score ?? null);
          } else {
            setVerificationStatus('pending');
            setVerificationScore(null);
          }
        } catch (error) {
          if (!isMounted) return;
          console.warn('Warning: Unable to load driver verification status:', error);
          setVerificationStatus('pending');
          setVerificationScore(null);
        }
      };

      loadVerificationState();

      return () => {
        isMounted = false;
      };
    }, [verificationKey]),
  );

  useEffect(() => {
    if (!user?.id) {
      setLiveStateReady(false);
      setIsLive(false);
      setMyOffers([]);
      setLiveStateReady(true);
      return;
    }

    const restoreState = async () => {
      try {
        setLiveStateReady(false);
        const savedLive = liveStateKey
          ? await AsyncStorage.getItem(liveStateKey)
          : null;
        if (savedLive !== null) {
          setIsLive(savedLive === 'true');
        }

        await loadSavedOffers();
        console.log('🔄 Initial state restored for user:', user.id);
      } catch (error) {
        console.warn('⚠️ Failed to restore driver state:', error);
      } finally {
        setLiveStateReady(true);
      }
    };

    restoreState();
  }, [user?.id, liveStateKey]);

  // Generate random demo rides for UI
  const generateRandomRides = (): Ride[] => {
    const passengers = [
      'Priya Sharma',
      'Rahul Verma',
      'Ananya Singh',
      'Arjun Patel',
      'Neha Gupta',
    ];
    const locations = [
      { from: 'CP Metro', to: 'Gurgaon' },
      { from: 'IGI Airport', to: 'Connaught Place' },
      { from: 'Delhi University', to: 'Cyber City' },
      { from: 'AIIMS', to: 'Noida' },
    ];

    return Array.from({ length: 3 }, (_, i) => ({
      id: `demo-${i}`,
      passenger: passengers[Math.floor(Math.random() * passengers.length)],
      from: locations[i].from,
      to: locations[i].to,
      passengers: Math.floor(Math.random() * 3) + 1,
      fare: Math.floor(Math.random() * 150) + 100,
      rating: Math.floor(Math.random() * 2) + 4.2,
      isLive: false,
    }));
  };

  useEffect(() => {
    if (!liveStateReady) return;
    console.log('👤 Driver user:', user?.id);
    
    // Initialize location socket when component mounts
    if (user?.id) {
      initializeLocationSocket();
      driverGoesOnline(user.id);
      console.log('🟢 Location socket initialized');
      
      // Subscribe to new rides in real-time
      subscribeToNewRides((newRide) => {
        console.log('📨 Driver received new ride via socket:', newRide);
        fetchLiveRides();
      });
    }
    
    if (isLive) {
      fetchLiveRides();
      setRandomRides(generateRandomRides());
      // Poll for new requests every 30 seconds as fallback
      const interval = setInterval(fetchLiveRides, 30000);
      return () => {
        clearInterval(interval);
        unsubscribeFromRideEvents();
      };
    } else {
      setLiveRides([]);
      setRandomRides([]);
    }
  }, [isLive, user?.id, liveStateReady]);

  useEffect(() => {
    if (!user?.id) return;

    const socket = getLocationSocket();

    const handlePassengerPickup = (data: any) => {
      if (data.driverClerkId !== user.id || !activeRideId || data.rideId !== activeRideId) {
        return;
      }
      setDriverPickupConfirmed(true);
      showAlert('Passenger Onboard', 'Passenger confirmed pickup. Start navigation to the drop-off.', 'success');
    };

    const handleRideCompleted = (data: any) => {
      if (data.driverClerkId !== user.id || !activeRideId || data.rideId !== activeRideId) {
        return;
      }
      stopSendingLocation();
      showAlert('Ride Completed', 'Passenger marked the ride complete. Payout is on the way.', 'success');
    };

    socket.on('ride:pickup-passenger', handlePassengerPickup);
    socket.on('ride:completed', handleRideCompleted);

    return () => {
      socket.off('ride:pickup-passenger', handlePassengerPickup);
      socket.off('ride:completed', handleRideCompleted);
    };
  }, [user?.id, activeRideId]);

  const fetchLiveRides = async () => {
    if (!user?.id) return;
    try {
      console.log('📨 Fetching available live rides...');
      const response = await getAvailableRides(user.id, 'requests');
      
      if (response.rides && Array.isArray(response.rides)) {
        const formattedRides = response.rides.map((ride: any) => ({
          id: ride.id,
          passenger: ride.passenger?.name || 'Unknown',
          from: ride.from,
          to: ride.to,
          passengers: ride.totalSeats,
          rating: ride.passenger?.rating || 5,
          profileImage: ride.passenger?.profileImage,
          createdAt: ride.createdAt,
          isLive: true,
        }));
        setLiveRides(formattedRides);
        console.log('✅ Live rides fetched:', formattedRides.length);
      }
    } catch (error) {
      console.error('❌ Error fetching live rides:', error);
    }
  };

  const startSendingLocation = async (rideId: string) => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Location permission denied');
        showAlert('Permission Required', 'Location access is required to track your ride', 'warning');
        return;
      }

      // Start sending location every 2-3 seconds
      console.log('📍 Starting to send driver location for ride:', rideId);
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current as any);
      }

      locationIntervalRef.current = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const { latitude, longitude } = location.coords;
          
          // Send location to backend via socket
          emitDriverLocation(rideId, latitude, longitude);
          console.log(`📍 Location sent: ${latitude}, ${longitude}`);
        } catch (error) {
          console.error('❌ Error getting location:', error);
        }
      }, 3000); // Send every 3 seconds

      setActiveRideId(rideId);
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      showAlert('Error', 'Failed to start location tracking', 'error');
    }
  };

  const stopSendingLocation = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
      console.log('🛑 Stopped sending location');
    }
    setActiveRideId(null);
    setActiveRideDetails(null);
    setDriverPickupConfirmed(false);
    setPickupConfirming(false);
  };

  const handleAcceptRide = async (rideId: string, isLive: boolean) => {
    try {
      console.log('✅ Accepting ride:', rideId);
      
      if (isLive) {
        // Accept from DB
        const response = await acceptRide(rideId);
        console.log('Ride accepted:', response);
        
        // Start tracking location for this ride
        await startSendingLocation(rideId);
      }

      const acceptedRide = (isLive ? liveRides : randomRides).find((r) => r.id === rideId) || null;
      setActiveRideDetails(acceptedRide);
      setDriverPickupConfirmed(false);
      
      // Remove from list
      if (isLive) {
        setLiveRides(liveRides.filter(r => r.id !== rideId));
      } else {
        setRandomRides(randomRides.filter(r => r.id !== rideId));
      }
      
      showAlert('Success', 'Ride request accepted! Location tracking started.', 'success');
    } catch (error) {
      console.error('❌ Error accepting ride:', error);
      showAlert('Error', 'Failed to accept ride', 'error');
    }
  };

  const handleRejectRide = (rideId: string, isLive: boolean) => {
    try {
      console.log('❌ Rejecting ride:', rideId);
      
      // Stop location tracking if this is the active ride
      if (rideId === activeRideId) {
        stopSendingLocation();
      }
      
      if (isLive) {
        setLiveRides(liveRides.filter(r => r.id !== rideId));
      } else {
        setRandomRides(randomRides.filter(r => r.id !== rideId));
      }
    } catch (error) {
      console.error('❌ Error rejecting ride:', error);
    }
  };

  const handleDriverPickupConfirm = async () => {
    if (!activeRideId) {
      showAlert('No Active Ride', 'Accept a ride before marking pickup.', 'warning');
      return;
    }

    try {
      setPickupConfirming(true);
      await driverConfirmPickup(activeRideId);
      setDriverPickupConfirmed(true);
      showAlert('Passenger Notified', 'Passenger alerted to confirm onboarding.', 'success');
    } catch (error) {
      console.error('❌ Error confirming pickup:', error);
      showAlert('Error', 'Failed to notify passenger. Try again.', 'error');
    } finally {
      setPickupConfirming(false);
    }
  };

  const handleToggleLive = (value: boolean) => {
    if (!liveStateReady) return;
    setIsLive(value);
    persistLiveState(value);
    if (value) {
      console.log('🟢 Going live...');
      fetchLiveRides();
    } else {
      console.log('🔴 Going offline...');
    }
  };

  const handleLogout = async () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop location tracking
              stopSendingLocation();
              await signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              showAlert('Error', 'Failed to logout', 'error');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isLive) {
      await fetchLiveRides();
      setRandomRides(generateRandomRides());
    }
    setRefreshing(false);
  };

  const handleOfferCreatedFromModal = async (offer: DriverOffer) => {
    // Ensure all required fields have valid values
    const hydrated: DriverOffer = {
      id: offer.id || `local-${Date.now()}`,
      from: offer.from || 'Pickup Location',
      to: offer.to || 'Drop Location',
      seats: typeof offer.seats === 'number' ? offer.seats : 1,
      fare: offer.fare,
      womenOnly: offer.womenOnly,
      createdAt: offer.createdAt || new Date().toISOString(),
      status: offer.status || 'live',
    };
    const updated = [hydrated, ...myOffers].slice(0, 25);
    setMyOffers(updated);
    await persistOffers(updated);
    console.log('✅ Offer created and saved:', hydrated);
    console.log('📋 Total offers:', updated.length);
    setSelectedTab('offers');
  };

  const handleCancelOffer = (offerId: string) => {
    showAlert(
      'Cancel Ride?',
      'Are you sure you want to cancel this ride offer? Passengers cannot book it anymore.',
      'warning',
      [
        {
          text: 'Keep it',
          style: 'cancel',
        },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            await performCancelOffer(offerId);
          },
        },
      ]
    );
  };

  const performCancelOffer = async (offerId: string) => {
    setCancellingOfferId(offerId);
    try {
      // Attempt to cancel via backend if available
      try {
        await cancelRide(offerId);
        console.log('✅ Ride cancelled on backend');
      } catch (backendError) {
        console.log('⚠️ Backend cancel failed, removing from local storage:', backendError);
      }
      
      // Remove from local state
      const updated = myOffers.filter(offer => offer.id !== offerId);
      setMyOffers(updated);
      await persistOffers(updated);
      
      showAlert('Cancelled', 'Your ride offer has been cancelled.', 'success');
      console.log('✅ Offer cancelled:', offerId);
    } catch (error) {
      console.error('❌ Error cancelling offer:', error);
      showAlert('Error', 'Failed to cancel the ride. Please try again.', 'error');
    } finally {
      setCancellingOfferId(null);
    }
  };

  const renderMyOffers = () => {
    if (offersLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="small" color={Colors.dark.gold} />
          <Text style={styles.emptySubtext}>Loading your rides...</Text>
        </View>
      );
    }

    if (myOffers.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Users size={48} color={Colors.dark.textSecondary} />
          <Text style={styles.emptyText}>No rides created yet</Text>
          <Text style={styles.emptySubtext}>Offer a ride to see it listed here</Text>
          <TouchableOpacity
            style={[styles.acceptButton, { marginTop: 16 }]}
            onPress={() => setRideOfferModalVisible(true)}
            activeOpacity={0.8}>
            <Plus size={18} color={Colors.dark.background} />
            <Text style={styles.acceptButtonText}>Create Ride Offer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.requestsSection}>
        <View style={styles.requestsHeader}>
          <Text style={styles.sectionTitle}>Your ride offers</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadSavedOffers}
            activeOpacity={0.7}>
            <RefreshCw size={18} color={Colors.dark.gold} />
          </TouchableOpacity>
        </View>
        {myOffers
          .filter(offer => offer && offer.id && offer.from && offer.to && offer.seats != null)
          .map((offer) => {
          const truncateAddr = (addr: string = '', max: number = 25) => {
            if (!addr) return '';
            return addr.length > max ? addr.substring(0, max) + '...' : addr;
          };

          return (
          <View key={offer.id} style={[styles.requestCard, styles.offerCard]}>
            <View style={styles.requestHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.passengerName} numberOfLines={1}>{truncateAddr(offer.from, 20)} → {truncateAddr(offer.to, 20)}</Text>
                {offer.createdAt && typeof offer.createdAt === 'string' && (
                  <Text style={styles.offerTime}>
                    {new Date(offer.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                )}
              </View>
              <View style={styles.fareAndSeatsContainer}>
                {offer.fare != null && typeof offer.fare === 'number' && (
                  <Text style={styles.requestFare}>₹{offer.fare}<Text style={styles.perSeatSmall}>/seat</Text></Text>
                )}
                {offer.seats != null && typeof offer.seats === 'number' && (
                  <Text style={styles.seatsCount}>{offer.seats} {offer.seats === 1 ? 'seat' : 'seats'}</Text>
                )}
              </View>
            </View>

            <View style={styles.requestRoute}>
              <View style={styles.routeRow}>
                <MapPin size={14} color={Colors.dark.gold} />
                <Text style={styles.routeText}>{offer.from || 'N/A'}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <MapPin size={14} color={Colors.dark.pink} />
                <Text style={styles.routeText}>{offer.to || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.requestDetails}>
              {offer.seats != null && typeof offer.seats === 'number' && (
                <View style={styles.detailRow}>
                  <Users size={14} color={Colors.dark.textSecondary} />
                  <Text style={styles.detailText}>{offer.seats} {offer.seats === 1 ? 'seat' : 'seats'}</Text>
                </View>
              )}
              {offer.womenOnly && (
                <View style={styles.detailRow}>
                  <Star size={14} color={Colors.dark.pink} />
                  <Text style={styles.detailText}>Women only</Text>
                </View>
              )}
              {offer.createdAt && typeof offer.createdAt === 'string' && (
                <View style={styles.detailRow}>
                  <Clock size={14} color={Colors.dark.textSecondary} />
                  <Text style={styles.detailText}>Created {new Date(offer.createdAt).toLocaleString()}</Text>
                </View>
              )}
            </View>

            <View style={styles.offerStatusRow}>
              <Text style={[styles.badgeText, styles.liveBadge]}>
                {(offer.status || 'live') === 'completed' ? '✓ Completed' : '🔴 Live'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setEditingOffer(offer);
                    setRideOfferModalVisible(true);
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton]}
                  onPress={() => handleCancelOffer(offer.id)}
                  disabled={cancellingOfferId === offer.id}
                  activeOpacity={0.7}>
                  {cancellingOfferId === offer.id ? (
                    <ActivityIndicator size="small" color={Colors.dark.error} />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          );
        })}
      </View>
    );
  };

  const renderInsights = () => (
    <View style={styles.insightsContainer}>
      <Text style={styles.sectionTitle}>Performance Overview</Text>
      <Text style={styles.sectionSubtitle}>Track your driving metrics and earnings</Text>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <DollarSign size={20} color={Colors.dark.gold} />
          </View>
          <Text style={styles.statValue}>₹{stats.earnings}</Text>
          <Text style={styles.statLabel}>Today's Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Users size={20} color={Colors.dark.gold} />
          </View>
          <Text style={styles.statValue}>{stats.ridesCount}</Text>
          <Text style={styles.statLabel}>Rides</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Star size={20} color={Colors.dark.gold} />
          </View>
          <Text style={styles.statValue}>{stats.rating}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Clock size={20} color={Colors.dark.gold} />
          </View>
          <Text style={styles.statValue}>{Math.floor(stats.onlineTime / 60)}h {stats.onlineTime % 60}m</Text>
          <Text style={styles.statLabel}>Online time</Text>
        </View>
      </View>
      
      <View style={styles.insightCard}>
        <View style={styles.insightHeader}>
          <Text style={styles.insightTitle}>💡 Pro Tips</Text>
        </View>
        <View style={styles.insightTip}>
          <Text style={styles.insightBullet}>•</Text>
          <Text style={styles.insightText}>Stay online during peak hours (8-10 AM, 6-9 PM) for more requests</Text>
        </View>
        <View style={styles.insightTip}>
          <Text style={styles.insightBullet}>•</Text>
          <Text style={styles.insightText}>Enable women-only mode to increase trust and attract more riders</Text>
        </View>
        <View style={styles.insightTip}>
          <Text style={styles.insightBullet}>•</Text>
          <Text style={styles.insightText}>Respond quickly to ride requests within 30 seconds</Text>
        </View>
      </View>
      
      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>📊 This Week</Text>
        <View style={styles.weeklyStatsRow}>
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatValue}>₹8,450</Text>
            <Text style={styles.weeklyStatLabel}>Earnings</Text>
          </View>
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatValue}>42</Text>
            <Text style={styles.weeklyStatLabel}>Rides</Text>
          </View>
          <View style={styles.weeklyStatItem}>
            <Text style={styles.weeklyStatValue}>18.5h</Text>
            <Text style={styles.weeklyStatLabel}>Online</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSpacer} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.userInfo}>
            <View style={styles.welcomeRow}>
              <Text style={styles.headerTitle}>
                Welcome, {user?.firstName || 'Driver'}
              </Text>
              <VerificationBadge
                verificationBatch={user?.verificationBatch}
                driverVerified={user?.driverVerified}
                size="small"
                showLabel={false}
              />
            </View>
            <Text style={styles.headerSubtitle}>Ready to earn?</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setRideOfferModalVisible(true)}
            style={styles.createRideButton}
            activeOpacity={0.7}>
            <Plus size={20} color={Colors.dark.background} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
            activeOpacity={0.7}>
            <LogOut size={20} color={Colors.dark.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View style={styles.verificationIcon}>
              <ShieldCheck size={20} color={Colors.dark.gold} />
            </View>
            <View style={styles.verificationCopy}>
              <Text style={styles.verificationTitle}>Driver Verification</Text>
              <Text style={styles.verificationStatus}>
                {formatVerificationStatusLabel(verificationStatus)}
              </Text>
              <Text style={styles.verificationHelper}>
                {verificationStatus === 'auto_approved'
                  ? 'All automated checks cleared. Keep documents handy for audits.'
                  : 'Complete camera capture to unlock payouts and go live.'}
              </Text>
              {verificationScore !== null ? (
                <Text style={styles.verificationScore}>
                  Last score: {verificationScore}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={styles.verificationButton}
            onPress={() => router.push('/driver/verification')}
            activeOpacity={0.8}>
            <Text style={styles.verificationButtonText}>
              {verificationStatus === 'auto_approved' ? 'View details' : 'Start verification'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIcon}>
              <Power
                size={24}
                color={isLive ? Colors.dark.success : Colors.dark.textSecondary}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isLive ? 'You are Live' : 'Go Live'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isLive
                  ? 'Accepting ride requests'
                  : liveStateReady
                    ? 'Toggle to start accepting rides'
                    : 'Restoring your last status...'}
              </Text>
            </View>
            <Switch
              value={isLive}
              onValueChange={handleToggleLive}
              trackColor={{ false: Colors.dark.border, true: Colors.dark.success }}
              thumbColor={Colors.dark.text}
              disabled={!liveStateReady}
            />
          </View>

          {isLive && (
            <View style={styles.womenOnlyContainer}>
              <Text style={styles.womenOnlyLabel}>Women Only Mode</Text>
              <Switch
                value={womenOnlyMode}
                onValueChange={setWomenOnlyMode}
                trackColor={{ false: Colors.dark.border, true: Colors.dark.pink }}
                thumbColor={Colors.dark.text}
              />
            </View>
          )}
        </View>

        {selectedTab === 'live' && (
          <>
            {activeRideDetails && (
              <View style={styles.activeRideCard}>
                <View style={styles.activeRideHeader}>
                  <Text style={styles.sectionTitle}>Active Ride</Text>
                  <View
                    style={[
                      styles.activeRideStatus,
                      driverPickupConfirmed && styles.activeRideStatusSuccess,
                    ]}>
                    <Text style={styles.activeRideStatusText}>
                      {driverPickupConfirmed ? 'Passenger onboard' : 'Pickup pending'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.activeRidePassenger}>{activeRideDetails.passenger}</Text>
                <View style={styles.requestRoute}>
                  <View style={styles.routeRow}>
                    <MapPin size={14} color={Colors.dark.gold} />
                    <Text style={styles.routeText}>{activeRideDetails.from}</Text>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routeRow}>
                    <MapPin size={14} color={Colors.dark.pink} />
                    <Text style={styles.routeText}>{activeRideDetails.to}</Text>
                  </View>
                </View>
                <Text style={styles.activeRideHint}>
                  Tap the button once the passenger is seated so they can confirm onboarding.
                </Text>
                <TouchableOpacity
                  style={[styles.acceptButton, (pickupConfirming || driverPickupConfirmed) && styles.disabledButton]}
                  onPress={handleDriverPickupConfirm}
                  disabled={pickupConfirming || driverPickupConfirmed}
                  activeOpacity={0.7}>
                  {pickupConfirming ? (
                    <ActivityIndicator color={Colors.dark.background} />
                  ) : (
                    <Text style={styles.acceptButtonText}>
                      {driverPickupConfirmed ? 'Waiting for passenger' : 'Mark passenger picked'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {isLive && (liveRides.length > 0 || randomRides.length > 0) && (
              <View style={styles.requestsSection}>
                {/* LIVE RIDES SECTION */}
                {liveRides.length > 0 && (
                  <>
                    <View style={styles.requestsHeader}>
                      <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.sectionTitle}>Live Requests</Text>
                      </View>
                      <TouchableOpacity
                        onPress={onRefresh}
                        style={styles.refreshButton}
                        activeOpacity={0.7}>
                        <RefreshCw size={18} color={Colors.dark.gold} />
                      </TouchableOpacity>
                    </View>
                    {liveRides.map((ride) => (
                      <View key={ride.id}>
                        <View style={[styles.requestCard, styles.liveRideCard]}>
                          <View style={styles.requestHeader}>
                            <Text style={styles.passengerName}>{ride.passenger}</Text>
                            <View style={styles.ratingBadge}>
                              <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
                              <Text style={styles.ratingText}>{ride.rating?.toFixed(1) || '5.0'}</Text>
                            </View>
                          </View>

                          <View style={styles.requestRoute}>
                            <View style={styles.routeRow}>
                              <MapPin size={14} color={Colors.dark.gold} />
                              <Text style={styles.routeText}>{ride.from}</Text>
                            </View>
                            <View style={styles.routeLine} />
                            <View style={styles.routeRow}>
                              <MapPin size={14} color={Colors.dark.pink} />
                              <Text style={styles.routeText}>{ride.to}</Text>
                            </View>
                          </View>

                          <View style={styles.requestDetails}>
                            <View style={styles.detailRow}>
                              <Users size={14} color={Colors.dark.textSecondary} />
                              <Text style={styles.detailText}>
                                {ride.passengers} {ride.passengers === 1 ? 'passenger' : 'passengers'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.requestActions}>
                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={() => handleRejectRide(ride.id, true)}
                              activeOpacity={0.7}>
                              <X size={20} color={Colors.dark.error} />
                              <Text style={styles.rejectButtonText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={() => handleAcceptRide(ride.id, true)}
                              activeOpacity={0.7}>
                              <Check size={20} color={Colors.dark.background} />
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* AVAILABLE RIDES SECTION (Random Data) */}
                {randomRides.length > 0 && (
                  <>
                    <View style={styles.requestsHeader}>
                      <Text style={styles.sectionTitle}>Other Available Rides</Text>
                    </View>
                    {randomRides.map((ride) => (
                      <View key={ride.id}>
                        <View style={styles.requestCard}>
                          <View style={styles.requestHeader}>
                            <Text style={styles.passengerName}>{ride.passenger}</Text>
                            <View style={styles.ratingBadge}>
                              <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
                              <Text style={styles.ratingText}>{ride.rating?.toFixed(1) || '5.0'}</Text>
                            </View>
                          </View>

                          <View style={styles.requestRoute}>
                            <View style={styles.routeRow}>
                              <MapPin size={14} color={Colors.dark.gold} />
                              <Text style={styles.routeText}>{ride.from}</Text>
                            </View>
                            <View style={styles.routeLine} />
                            <View style={styles.routeRow}>
                              <MapPin size={14} color={Colors.dark.pink} />
                              <Text style={styles.routeText}>{ride.to}</Text>
                            </View>
                          </View>

                          <View style={styles.requestDetails}>
                            <View style={styles.detailRow}>
                              <Users size={14} color={Colors.dark.textSecondary} />
                              <Text style={styles.detailText}>
                                {ride.passengers} {ride.passengers === 1 ? 'passenger' : 'passengers'}
                              </Text>
                            </View>
                            {ride.fare && (
                              <View style={styles.detailRow}>
                                <DollarSign size={14} color={Colors.dark.textSecondary} />
                                <Text style={styles.detailText}>₹{ride.fare}</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.requestActions}>
                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={() => handleRejectRide(ride.id, false)}
                              activeOpacity={0.7}>
                              <X size={20} color={Colors.dark.error} />
                              <Text style={styles.rejectButtonText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={() => handleAcceptRide(ride.id, false)}
                              activeOpacity={0.7}>
                              <Check size={20} color={Colors.dark.background} />
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {isLive && liveRides.length === 0 && randomRides.length === 0 && (
              <View style={styles.emptyState}>
                <Users size={48} color={Colors.dark.textSecondary} />
                <Text style={styles.emptyText}>Waiting for requests...</Text>
                <Text style={styles.emptySubtext}>
                  You'll see ride requests here
                </Text>
              </View>
            )}

            {!isLive && (
              <View style={styles.offlineState}>
                <Power size={48} color={Colors.dark.textSecondary} />
                <Text style={styles.offlineText}>You're currently offline</Text>
                <Text style={styles.offlineSubtext}>
                  Toggle the switch above to start accepting rides
                </Text>
              </View>
            )}
          </>
        )}

        {selectedTab === 'offers' && renderMyOffers()}

        {selectedTab === 'insights' && renderInsights()}
      </ScrollView>

      <DriverRideOfferModal
        visible={rideOfferModalVisible}
        editingOffer={editingOffer}
        onClose={() => {
          setRideOfferModalVisible(false);
          setEditingOffer(null);
        }}
        onSuccess={(offer) => {
          if (!offer) {
            console.error('❌ No offer data received from modal');
            return;
          }
          
          const from = offer.from?.trim() || '';
          const to = offer.to?.trim() || '';
          const seats = typeof offer.passengers === 'number' && offer.passengers > 0 ? offer.passengers : 1;
          
          if (!from || !to) {
            console.error('❌ Invalid offer data: missing from/to locations');
            showAlert('Error', 'Please provide valid pickup and drop-off locations', 'error');
            return;
          }
          
          handleOfferCreatedFromModal({
            id: offer.id || `local-${Date.now()}`,
            from,
            to,
            seats,
            fare: offer.fare,
            womenOnly: offer.womenOnly,
            createdAt: offer.createdAt || new Date().toISOString(),
          });
          fetchLiveRides();
        }}
      />

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.bottomNavItem, selectedTab === 'live' && styles.bottomNavItemActive]}
          onPress={() => setSelectedTab('live')}
          activeOpacity={0.85}>
          <LayoutDashboard size={18} color={selectedTab === 'live' ? Colors.dark.background : Colors.dark.text} />
          <Text style={[styles.bottomNavText, selectedTab === 'live' && styles.bottomNavTextActive]}>Live</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomNavCreate}
          onPress={() => {
            setRideOfferModalVisible(true);
            setSelectedTab('offers');
          }}
          activeOpacity={0.9}>
          <Plus size={20} color={Colors.dark.background} />
          <Text style={styles.bottomNavCreateText}>Offer ride</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomNavItem, selectedTab === 'offers' && styles.bottomNavItemActive]}
          onPress={() => setSelectedTab('offers')}
          activeOpacity={0.85}>
          <List size={18} color={selectedTab === 'offers' ? Colors.dark.background : Colors.dark.text} />
          <Text style={[styles.bottomNavText, selectedTab === 'offers' && styles.bottomNavTextActive]}>My rides</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomNavItem, selectedTab === 'insights' && styles.bottomNavItemActive]}
          onPress={() => setSelectedTab('insights')}
          activeOpacity={0.85}>
          <BarChart3 size={18} color={selectedTab === 'insights' ? Colors.dark.background : Colors.dark.text} />
          <Text style={[styles.bottomNavText, selectedTab === 'insights' && styles.bottomNavTextActive]}>Insights</Text>
        </TouchableOpacity>
      </View>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig?.title || ''}
        message={alertConfig?.message || ''}
        type={alertConfig?.type || 'info'}
        buttons={alertConfig?.buttons}
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
  topSpacer: {
    height: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flex: 1,
  },
  userInfo: {
    flex: 1,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  createRideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  verificationCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 16,
  },
  verificationHeader: {
    flexDirection: 'row',
    gap: 16,
  },
  verificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationCopy: {
    flex: 1,
    gap: 4,
  },
  verificationTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  verificationStatus: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  verificationHelper: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  verificationScore: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  verificationButton: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  verificationButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  statusCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  womenOnlyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  womenOnlyLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.pink,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  requestsSection: {
    marginBottom: 20,
  },
  activeRideCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeRideStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.dark.border + '60',
  },
  activeRideStatusSuccess: {
    backgroundColor: Colors.dark.success + '30',
  },
  activeRideStatusText: {
    color: Colors.dark.text,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  activeRidePassenger: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 10,
  },
  activeRideHint: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginBottom: 14,
  },
  requestsHeader: {
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  requestFare: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  requestRoute: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    color: Colors.dark.text,
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: Colors.dark.border,
    marginLeft: 6,
    marginVertical: 4,
  },
  requestDetails: {
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
  customRequestBox: {
    backgroundColor: Colors.dark.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  customRequestLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  customRequestText: {
    fontSize: 14,
    color: Colors.dark.text,
  },
  customFareBox: {
    backgroundColor: Colors.dark.gold + '20',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  customFareLabel: {
    fontSize: 13,
    color: Colors.dark.gold,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.error + '20',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  rejectButtonText: {
    color: Colors.dark.error,
    fontSize: 15,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  acceptButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '700',
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  offlineState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  offlineText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  offlineSubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.success,
  },
  liveRideCard: {
    borderWidth: 2,
    borderColor: Colors.dark.success,
    backgroundColor: Colors.dark.success + '10',
  },
  offerCard: {
    borderColor: Colors.dark.border,
  },
  offerStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  offerTime: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  fareAndSeatsContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  perSeatSmall: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '400',
  },
  seatsCount: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  liveBadge: {
    flex: 1,
  },
  editButton: {
    backgroundColor: Colors.dark.gold + '20',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  editButtonText: {
    color: Colors.dark.gold,
    fontSize: 13,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.dark.error + '15',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.error,
  },
  cancelButtonText: {
    color: Colors.dark.error,
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  secondaryButtonText: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 13,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
  badgeText: {
    color: Colors.dark.gold,
    fontWeight: '700',
    fontSize: 12,
  },
  insightsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  sectionSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginTop: -4,
    marginBottom: 16,
  },
  insightCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  insightHeader: {
    marginBottom: 12,
  },
  insightTitle: {
    color: Colors.dark.text,
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
  },
  insightTip: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  insightBullet: {
    color: Colors.dark.gold,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
    marginTop: -2,
  },
  insightText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  weeklyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  weeklyStatItem: {
    alignItems: 'center',
  },
  weeklyStatValue: {
    color: Colors.dark.gold,
    fontSize: 18,
    fontWeight: '700',
  },
  weeklyStatLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 10,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  bottomNavItemActive: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  bottomNavText: {
    color: Colors.dark.text,
    fontWeight: '700',
    fontSize: 12,
  },
  bottomNavTextActive: {
    color: Colors.dark.background,
  },
  bottomNavCreate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.gold,
  },
  bottomNavCreateText: {
    color: Colors.dark.background,
    fontWeight: '800',
    fontSize: 13,
  },
});
