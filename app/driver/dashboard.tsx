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
  Platform,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert, { AlertType, AlertButton } from '@/components/CustomAlert';
import * as Notifications from 'expo-notifications';
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
  MessageSquare,
  User,
  Phone,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';
import { useAuthContext } from '@/contexts/AuthContext';
import type { DriverVerificationResult, DriverVerificationStatus } from '@/types';
import { useAuth as useClerkAuth } from '@/lib/clerkHooks';
import { getAvailableRides, acceptRide, cancelRide, driverConfirmPickup, getUserConversations, getRideOfferById, setAuthToken, getMyRideOffers, getPendingApprovals, getAllDriverPendingApprovals, approveBooking, rejectBooking, driverInitiatePickup } from '@/lib/api';
import { initializeLocationSocket, emitDriverLocation, driverGoesOnline, subscribeToNewRides, unsubscribeFromRideEvents, getLocationSocket, subscribeToPickupConfirmed, unsubscribeFromPickupEvents } from '@/lib/locationSocket';
import DriverRideOfferModal from '@/components/DriverRideOfferModal';
import ApprovalControlsDriver from '@/components/ApprovalControlsDriver';
import VerificationBadge from '@/components/VerificationBadge';
import ChatModal from '@/components/ChatModal';
import PushNotificationDebug from '@/components/PushNotificationDebug';

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
  departureTime?: string;
  status?: 'live' | 'completed' | 'draft';
}

interface Conversation {
  _id: string;
  rideId: string;
  participants: string[];
  driverId: string;
  passengerId: string;
  lastMessage: string;
  lastMessageAt: string;
}

interface ConversationWithDetails extends Conversation {
  otherUserName: string;
  otherUserId: string;
  rideDetails?: {
    from: string;
    to: string;
  };
  otherUserPhone?: string;
  unreadCount?: number;
}

type DashboardTab = 'live' | 'offers' | 'messages' | 'insights';

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
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const [approvalControlsModalVisible, setApprovalControlsModalVisible] = useState(false);
  const [requiresManualApproval, setRequiresManualApproval] = useState(false);
  const [isFestivalRide, setIsFestivalRide] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [approvingBookingId, setApprovingBookingId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentActiveRide, setCurrentActiveRide] = useState<any | null>(null);
  const [initiatingPickupForBooking, setInitiatingPickupForBooking] = useState<string | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | number | null>(null);
  const liveStateKey = user?.id ? `driver_live_state_${user.id}` : null;
  const offersKey = user?.id ? `driver_offers_${user.id}` : null;
  const verificationKey = user?.id ? `driver_verification_${user.id}` : null;
  const { getToken } = useClerkAuth();

  // Calculate total unread messages
  const totalUnreadMessages = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

  // Update app icon badge
  useEffect(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Notifications.setBadgeCountAsync(totalUnreadMessages).catch(err => {
        console.log('Failed to set badge count:', err);
      });
    }
  }, [totalUnreadMessages]);

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
    if (!user?.id) return;
    try {
      setOffersLoading(true);
      
      // First try to fetch from backend API to get complete data with departure times
      try {
        const token = await getToken();
        if (token) {
          setAuthToken(token);
        }
        
        const response = await getMyRideOffers(user.id);
        if (response.success && response.rideOffers && Array.isArray(response.rideOffers)) {
          // Transform backend data to match DriverOffer interface
          const backendOffers: DriverOffer[] = response.rideOffers.map((offer: any) => ({
            id: offer._id || offer.id,
            from: offer.from,
            to: offer.to,
            seats: offer.totalSeats - 1, // Subtract 1 for driver seat
            fare: offer.farePerSeat,
            womenOnly: offer.womenOnly,
            createdAt: offer.createdAt,
            departureTime: offer.departureTime,
            status: offer.status === 'waiting' ? 'live' : offer.status,
          }));
          
          console.log('✅ Loaded offers from backend:', backendOffers.length);
          setMyOffers(backendOffers);
          
          // Update local storage with fresh data
          if (offersKey) {
            persistOffers(backendOffers);
          }
          
          setOffersLoading(false);
          return;
        }
      } catch (apiError) {
        console.warn('⚠️ API fetch failed, falling back to local storage:', apiError);
      }
      
      // Fallback to local storage if API fails
      if (offersKey) {
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
          console.log('✅ Loaded valid offers from local storage:', validOffers.length);
          
          // Debug: Check what IDs look like  
          validOffers.forEach(offer => {
            console.log('📋 Offer ID:', offer.id, 'Type:', typeof offer.id, 'Is Local:', offer.id?.startsWith('local-'));
          });
          
          // Clean up any offers with local IDs (they're stale)
          const realOffers = validOffers.filter(offer => !offer.id?.startsWith('local-'));
          if (realOffers.length !== validOffers.length) {
            console.log('🧹 Cleaning up', validOffers.length - realOffers.length, 'stale local offers');
            setMyOffers(realOffers);
            persistOffers(realOffers);
          }
        } else {
          console.log('📋 No saved offers found');
        }
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

  const loadConversations = async () => {
    if (!user?.id) return;

    try {
      setConversationsLoading(true);
      console.log('🔍 [DRIVER] Loading conversations for driver ID:', user.id);
      
      // Set auth token
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      const { conversations: convos } = await getUserConversations(user.id);
      console.log('📬 [DRIVER] Received enriched conversations from API:', convos?.length || 0);
      if (convos && convos.length > 0) {
        console.log('📋 [DRIVER] First conversation:', {
          otherUserName: convos[0].otherUserName,
          rideDetails: convos[0].rideDetails,
          lastMessage: convos[0].lastMessage,
        });
      }

      // Backend now provides enriched data with otherUserName, rideDetails, etc.
      setConversations(convos || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  };

  const loadPendingApprovals = async (rideId: string) => {
    if (!user?.id || !rideId) return;

    try {
      console.log('🔍 [APPROVALS] Loading pending approvals for ride:', rideId);
      
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      const response = await getPendingApprovals(rideId);
      console.log('📋 [APPROVALS] Pending approvals:', response?.pendingBookings?.length || 0);
      
      if (response?.success && response?.pendingBookings) {
        setPendingApprovals(response.pendingBookings);
        
        // If there are pending approvals and modal not already visible, show the first one
        if (response.pendingBookings.length > 0 && !expandedBookingId) {
          setExpandedBookingId(response.pendingBookings[0]._id);
        }
      }
    } catch (error) {
      console.error('Error loading pending approvals:', error);
    }
  };

  const fetchAllPendingApprovals = async () => {
    if (!user?.id) {
      console.log('⚠️ [APPROVALS] Skipping fetch - no user');
      setPendingApprovals([]);
      return;
    }

    try {
      console.log(`🔍 [APPROVALS] Fetching all pending approvals (batch endpoint)`);
      
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Use batch endpoint instead of looping through all offers
      const response = await getAllDriverPendingApprovals();
      
      if (response?.success && response?.pendingBookings) {
        console.log(`✅ [APPROVALS] Found ${response.pendingBookings.length} total pending approvals`);
        setPendingApprovals(response.pendingBookings);
        
        // If we found new approvals and modal not showing, show the first one
        if (response.pendingBookings.length > 0 && !expandedBookingId) {
          console.log('🎯 [APPROVALS] Auto-expanding first approval request');
          setExpandedBookingId(response.pendingBookings[0]._id);
        }
      } else {
        console.log(`ℹ️ [APPROVALS] No pending approvals found`);
        setPendingApprovals([]);
      }
    } catch (error) {
      console.error('❌ Error fetching all pending approvals:', error);
      setPendingApprovals([]);
    }
  };

  const fetchCurrentActiveRide = async () => {
    if (!user?.id) {
      console.log('⚠️ [ACTIVE RIDE] Skipping fetch - no user');
      setCurrentActiveRide(null);
      return;
    }

    try {
      console.log('🔍 [ACTIVE RIDE] Fetching current active ride with bookings');
      
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      // Fetch all driver's ride offers
      const response = await getMyRideOffers(user.id);
      if (response?.success && response?.rideOffers) {
        // Find the first 'waiting' ride with confirmed bookings
        const activeRide = response.rideOffers.find((ride: any) => 
          ride.status === 'waiting' && 
          ride.bookings && 
          ride.bookings.length > 0 &&
          ride.bookings.some((booking: any) => booking.status === 'confirmed')
        );
        
        if (activeRide) {
          console.log(`✅ [ACTIVE RIDE] Found active ride ${activeRide._id || activeRide.id} with ${activeRide.bookings.length} bookings`);
          setCurrentActiveRide(activeRide);
        } else {
          console.log('ℹ️ [ACTIVE RIDE] No active ride with confirmed bookings found');
          setCurrentActiveRide(null);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching current active ride:', error);
      setCurrentActiveRide(null);
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

  useEffect(() => {
    if (!liveStateReady) return;
    console.log('👤 Driver user:', user?.id);
    
    // Initialize location socket when component mounts
    if (user?.id) {
      initializeLocationSocket();
      driverGoesOnline(user.id);
      console.log('🟢 Location socket initialized');
      
      // Load conversations immediately to show unread count on home screen
      loadConversations();
      
      // Subscribe to new rides in real-time
      subscribeToNewRides((newRide) => {
        console.log('📨 Driver received new ride via socket:', newRide);
        fetchLiveRides();
      });

      // Subscribe to pickup confirmations (when passenger confirms boarding)
      subscribeToPickupConfirmed(user.id, (data) => {
        console.log('✅ Passenger confirmed pickup:', data);
        showAlert(
          '✅ Passenger Boarded',
          `${data.passengerName || 'Passenger'} has confirmed boarding. Ride started!`,
          'success'
        );
        // Refresh active ride to update pickup status
        fetchCurrentActiveRide();
      });
    }
    
    if (isLive) {
      // Initial fetch
      fetchLiveRides();
      if (myOffers.length > 0) {
        fetchAllPendingApprovals();
        fetchCurrentActiveRide();
      }
      
      // Poll for new requests every 60 seconds as fallback (socket is primary)
      const interval = setInterval(() => {
        fetchLiveRides();
        if (myOffers.length > 0) {
          fetchAllPendingApprovals();
          fetchCurrentActiveRide();
        }
      }, 60000);
      return () => {
        clearInterval(interval);
        unsubscribeFromRideEvents();
        if (user?.id) {
          unsubscribeFromPickupEvents(user.id, true);
        }
      };
    } else {
      setLiveRides([]);
      setPendingApprovals([]);
    }
  }, [isLive, user?.id, liveStateReady, myOffers.length]);

  useEffect(() => {
    if (!user?.id) return;

    const socket = getLocationSocket();
    
    console.log(`🔌 [SOCKET] Setting up socket listeners for driver: ${user.id}`);
    console.log(`🔌 [SOCKET] Socket connected: ${socket.connected}`);
    console.log(`🔌 [SOCKET] Socket ID: ${socket.id}`);
    console.log(`📡 [SOCKET] Will listen on: driver:booking-approval-request:${user.id}`);

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

    const handleNewMessage = (data: any) => {
      console.log('💬 Driver received new message via socket:', data);
      if (data.type === 'new_message') {
        // Immediately reload conversations to show new message
        loadConversations();
        
        // Push notifications are handled by the backend - no need for in-app alerts
        console.log('📱 New message received - push notification will be sent by backend');
      }
    };

    const handleBookingApprovalRequest = async (data: any) => {
      console.log('🔔 [APPROVAL] Driver received booking approval request:', data);
      console.log(`🔔 [APPROVAL] Data driverId: ${data.driverId}, My userId: ${user.id}`);
      console.log(`🔔 [APPROVAL] Match: ${data.driverId === user.id}`);
      
      if (data.driverId !== user.id) {
        console.log(`⚠️ [APPROVAL] Skipping - not for this driver`);
        return;
      }
      
      console.log(`✅ [APPROVAL] Processing approval request`);
      
      // Show visible mobile notification
      const bookingData = data.booking;
      const passengerName = bookingData?.userDetails?.name || 'A passenger';
      const pickupLocation = bookingData?.from || 'Your pickup location';
      
      // Show alert with sound
      showAlert(
        '👤 New Booking Request',
        `${passengerName} wants to book seats for ${pickupLocation}. Review now!`,
        'info',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Review',
            style: 'default',
            onPress: () => {
              setExpandedBookingId(bookingData._id);
              setSelectedTab('live');
            },
          },
        ]
      );

      // Trigger local notification badge update
      try {
        const currentBadgeCount = await Notifications.getBadgeCountAsync();
        await Notifications.setBadgeCountAsync(currentBadgeCount + 1);
        console.log('📱 Badge count updated');
      } catch (err) {
        console.log('Badge update failed:', err);
      }

      // Refetch pending approvals
      if (activeRideId) {
        loadPendingApprovals(activeRideId);
      }
    };

    socket.on('ride:pickup-passenger', handlePassengerPickup);
    socket.on('ride:completed', handleRideCompleted);
    socket.on(`user:message:${user.id}`, handleNewMessage);
    socket.on(`driver:booking-approval-request:${user.id}`, handleBookingApprovalRequest);

    return () => {
      socket.off('ride:pickup-passenger', handlePassengerPickup);
      socket.off('ride:completed', handleRideCompleted);
      socket.off(`user:message:${user.id}`, handleNewMessage);
      socket.off(`driver:booking-approval-request:${user.id}`, handleBookingApprovalRequest);
    };
  }, [user?.id, activeRideId]);

  // Load conversations when Messages tab is shown
  useEffect(() => {
    if (user?.id && selectedTab === 'messages') {
      loadConversations();
      // Poll for new messages every 10 seconds
      const interval = setInterval(loadConversations, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.id, selectedTab]);

  // Poll for pending approvals when a ride is active (for active ride only)
  useEffect(() => {
    if (!activeRideId || !user?.id) return;

    try {
      // Initial load
      loadPendingApprovals(activeRideId);
      
      // Poll every 10 seconds for active ride approvals (reduced from 5s)
      const interval = setInterval(() => {
        loadPendingApprovals(activeRideId);
      }, 10000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Error setting up approval polling:', error);
    }
  }, [activeRideId, user?.id]);

  // Fetch approvals when Live tab is selected (for immediate visibility)
  useEffect(() => {
    if (selectedTab === 'live' && isLive && myOffers.length > 0) {
      console.log('🔄 Live tab selected - fetching pending approvals');
      fetchAllPendingApprovals();
    }
  }, [selectedTab, isLive, myOffers.length]);

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
    setRequiresManualApproval(false);
    setIsFestivalRide(false);
    setApprovalControlsModalVisible(false);
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

      const acceptedRide = liveRides.find((r) => r.id === rideId) || null;
      setActiveRideDetails(acceptedRide);
      setDriverPickupConfirmed(false);
      
      // Initialize approval settings for this ride
      setRequiresManualApproval(false); // Default to auto-confirm
      setIsFestivalRide(false); // Will be updated if needed
      
      // Remove from list
      if (isLive) {
        setLiveRides(liveRides.filter(r => r.id !== rideId));
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

  const handleApproveBooking = async (bookingId: string, notes?: string) => {
    if (!user?.id) {
      showAlert('Error', 'Missing driver information', 'error');
      return;
    }

    // Get booking and rideId from pendingApprovals
    const booking = pendingApprovals.find(b => b._id === bookingId);
    const rideId = booking?.rideId;
    if (!rideId) {
      showAlert('Error', 'Missing ride information', 'error');
      return;
    }

    try {
      setApprovingBookingId(bookingId);
      console.log('✅ [APPROVAL] Approving booking:', bookingId, 'for ride:', rideId);
      
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await approveBooking(bookingId, user.id, notes);
      
      // Remove from pending list
      setPendingApprovals(pendingApprovals.filter(b => b._id !== bookingId));
      setExpandedBookingId(null);
      setApprovalNotes('');
      
      // Show success feedback
      showAlert(
        '✅ Booking Approved',
        'Passenger will be notified immediately.',
        'success'
      );
      
      // Send message to passenger via chat
      console.log('📱 [APPROVAL] Sending approval notification to passenger...');
      
      // Reload pending approvals for this specific ride
      await fetchAllPendingApprovals();
      await fetchCurrentActiveRide();
    } catch (error) {
      console.error('❌ Error approving booking:', error);
      showAlert('Error', 'Failed to approve booking. Try again.', 'error');
    } finally {
      setApprovingBookingId(null);
    }
  };

  const handleRejectBooking = async (bookingId: string, rejectionReason: string) => {
    if (!user?.id) {
      showAlert('Error', 'Missing driver information', 'error');
      return;
    }

    // Get booking and rideId from pendingApprovals
    const booking = pendingApprovals.find(b => b._id === bookingId);
    const rideId = booking?.rideId;
    if (!rideId) {
      showAlert('Error', 'Missing ride information', 'error');
      return;
    }

    try {
      setApprovingBookingId(bookingId);
      console.log('❌ [APPROVAL] Rejecting booking:', bookingId, 'for ride:', rideId, 'Reason:', rejectionReason);
      
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await rejectBooking(bookingId, user.id, rejectionReason);
      
      // Remove from pending list
      setPendingApprovals(pendingApprovals.filter(b => b._id !== bookingId));
      setExpandedBookingId(null);
      setApprovalNotes('');
      
      // Show feedback
      showAlert(
        '❌ Booking Rejected',
        'Passenger has been notified and their seats have been released.',
        'info'
      );
      
      // Send rejection message to passenger
      console.log('📱 [APPROVAL] Sending rejection notification to passenger...');
      
      // Reload pending approvals for all rides
      await fetchAllPendingApprovals();
      await fetchCurrentActiveRide();
    } catch (error) {
      console.error('❌ Error rejecting booking:', error);
      showAlert('Error', 'Failed to reject booking. Try again.', 'error');
    } finally {
      setApprovingBookingId(null);
    }
  };

  const handleInitiatePickup = async (
    bookingId: string,
    passengerClerkId: string,
    passengerName: string,
  ) => {
    if (!currentActiveRide) {
      showAlert('Error', 'No active ride found', 'error');
      return;
    }

    try {
      setInitiatingPickupForBooking(bookingId);
      console.log('🚗 [PICKUP] Initiating pickup for booking:', bookingId);
      
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await driverInitiatePickup(
        currentActiveRide._id || currentActiveRide.id,
        bookingId,
        passengerClerkId,
      );
      
      showAlert(
        '✅ Pickup Initiated',
        `Waiting for ${passengerName} to confirm boarding.`,
        'success'
      );
      
      // Refresh active ride data
      await fetchCurrentActiveRide();
    } catch (error) {
      console.error('❌ Error initiating pickup:', error);
      showAlert('Error', 'Failed to initiate pickup. Try again.', 'error');
    } finally {
      setInitiatingPickupForBooking(null);
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

  const handleCall = (phoneNumber: string | undefined) => {
    if (!phoneNumber) {
      Alert.alert('Phone number not available', 'This user has not provided a phone number.');
      return;
    }
    
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Not Supported', 'Phone call not supported on this device');
        }
      })
      .catch((error) => {
        console.error('Error opening phone dialer:', error);
        Alert.alert('Error', 'Failed to open phone dialer');
      });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isLive) {
      await fetchLiveRides();
      await fetchAllPendingApprovals();
      await fetchCurrentActiveRide();
    }
    setRefreshing(false);
  };

  const handleOfferCreatedFromModal = async (offer: DriverOffer) => {
    console.log('📤 Received offer from modal:', JSON.stringify(offer, null, 2));
    
    // Ensure all required fields have valid values
    const hydrated: DriverOffer = {
      id: offer.id || `local-${Date.now()}`, // This should now be the real MongoDB _id
      from: offer.from || 'Pickup Location',
      to: offer.to || 'Drop Location',
      seats: typeof offer.seats === 'number' ? offer.seats : 1,
      fare: offer.fare,
      womenOnly: offer.womenOnly,
      createdAt: offer.createdAt || new Date().toISOString(),
      departureTime: offer.departureTime || new Date(Date.now() + 30 * 60000).toISOString(), // Default: 30 mins from now
      status: offer.status || 'live',
    };
    
    console.log('🔧 Hydrated offer with ID:', hydrated.id);
    console.log('🔄 Is this a real MongoDB ID?', !hydrated.id.startsWith('local-'));
    
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
      // Attempt to cancel via backend with correct type
      try {
        await cancelRide(offerId, 'offer'); // Specify it's an offer
        console.log('✅ Ride offer cancelled on backend');
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

    // Separate rides into active and upcoming
    const validOffers = myOffers.filter(offer => offer && offer.id && offer.from && offer.to && offer.seats != null);
    
    const activeRides = validOffers.filter(offer => {
      // Active: ride is live and departure time has passed (indicating ride is in progress)
      const departureTime = offer.departureTime ? new Date(offer.departureTime) : null;
      const hasDeparted = departureTime && departureTime <= new Date();
      
      return offer.status === 'live' && hasDeparted;
    });

    const upcomingRides = validOffers.filter(offer => {
      // Upcoming: everything else (not yet departed or completed rides)
      return !activeRides.includes(offer);
    });

    const renderOfferCard = (offer: DriverOffer) => {
      const truncateAddr = (addr: string = '', max: number = 25) => {
        if (!addr) return '';
        return addr.length > max ? addr.substring(0, max) + '...' : addr;
      };

      const isActive = activeRides.includes(offer);

      return (
      <View key={offer.id} style={[styles.requestCard, styles.offerCard, isActive && styles.activeOfferCard]}>
        {isActive && (
          <View style={styles.activeRideBadge}>
            <Text style={styles.activeRideBadgeText}>🚗 Active</Text>
          </View>
        )}
        <View style={styles.requestHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.passengerName} numberOfLines={1}>{truncateAddr(offer.from, 20)} → {truncateAddr(offer.to, 20)}</Text>
            {offer.departureTime && typeof offer.departureTime === 'string' && (
              <Text style={styles.offerTime}>
                🚗 Departure: {new Date(offer.departureTime).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            )}
            {!offer.departureTime && offer.createdAt && typeof offer.createdAt === 'string' && (
              <Text style={styles.offerTime}>
                Created: {new Date(offer.createdAt).toLocaleString('en-IN', {
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
          {offer.departureTime && typeof offer.departureTime === 'string' && (
            <View style={styles.detailRow}>
              <Clock size={14} color={Colors.dark.gold} />
              <Text style={styles.detailText}>Departing {new Date(offer.departureTime).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}</Text>
            </View>
          )}
          {!offer.departureTime && offer.createdAt && typeof offer.createdAt === 'string' && (
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
                console.log('🔄 Editing offer with ID:', offer.id, 'Type:', typeof offer.id);
                
                // Check if it's a valid MongoDB ID (not a local temporary ID)
                const isValidMongoId = (id: string) => {
                  return id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id) && !id.startsWith('local-');
                };

                if (!isValidMongoId(offer.id)) {
                  showAlert('Cannot Edit', 'This ride offer cannot be edited. Please create a new one instead.', 'warning');
                  return;
                }

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
    };

    return (
      <View style={styles.requestsSection}>
        {/* Active/Ongoing Rides Section */}
        {activeRides.length > 0 && (
          <>
            <View style={styles.requestsHeader}>
              <View style={styles.sectionHeaderWithBadge}>
                <Text style={styles.sectionTitle}>Active Rides</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{activeRides.length}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={loadSavedOffers}
                activeOpacity={0.7}>
                <RefreshCw size={18} color={Colors.dark.gold} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionSubtitle}>Rides currently in progress</Text>
            {activeRides.map(renderOfferCard)}
          </>
        )}

        {/* Upcoming/Created Rides Section */}
        {upcomingRides.length > 0 && (
          <>
            <View style={[styles.requestsHeader, activeRides.length > 0 && { marginTop: 20 }]}>
              <View style={styles.sectionHeaderWithBadge}>
                <Text style={styles.sectionTitle}>Upcoming Rides</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{upcomingRides.length}</Text>
                </View>
              </View>
              {activeRides.length === 0 && (
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={loadSavedOffers}
                  activeOpacity={0.7}>
                  <RefreshCw size={18} color={Colors.dark.gold} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>All your created ride offers</Text>
            {upcomingRides.map(renderOfferCard)}
          </>
        )}
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
          {/* Pending Approvals Bell */}
          {pendingApprovals.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (pendingApprovals.length > 0) {
                  setSelectedTab('live');
                  setExpandedBookingId(pendingApprovals[0]._id);
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({ y: 400, animated: true });
                  }, 100);
                }
              }}
              style={styles.notificationBellButton}
              activeOpacity={0.7}>
              <MessageSquare size={22} color={Colors.dark.gold} />
              {pendingApprovals.length > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{pendingApprovals.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setDebugModalVisible(true)}
            style={[styles.createRideButton, { backgroundColor: Colors.dark.gold }]}
            activeOpacity={0.7}>
            <Text style={[styles.debugButtonText, { color: Colors.dark.background }]}>🔔</Text>
          </TouchableOpacity>
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
        ref={scrollViewRef}
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
            <>
              <View style={styles.womenOnlyContainer}>
                <Text style={styles.womenOnlyLabel}>Women Only Mode</Text>
                <Switch
                  value={womenOnlyMode}
                  onValueChange={setWomenOnlyMode}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.pink }}
                  thumbColor={Colors.dark.text}
                />
              </View>
            </>
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

            {/* CURRENT ACTIVE RIDE OFFER - Your ride with confirmed passengers */}
            {currentActiveRide && (
              <View style={styles.activeRideOfferCard}>
                <View style={styles.activeRideHeader}>
                  <Text style={styles.sectionTitle}>Your Current Ride</Text>
                  <View style={styles.activeRideStatusSuccess}>
                    <Text style={styles.activeRideStatusText}>
                      {currentActiveRide.bookings?.filter((b: any) => b.status === 'confirmed').length || 0} confirmed
                    </Text>
                  </View>
                </View>

                {/* Route */}
                <View style={styles.requestRoute}>
                  <View style={styles.routeRow}>
                    <MapPin size={14} color={Colors.dark.gold} />
                    <Text style={styles.routeText}>{currentActiveRide.from}</Text>
                  </View>
                  <View style={styles.routeLine} />
                  <View style={styles.routeRow}>
                    <MapPin size={14} color={Colors.dark.pink} />
                    <Text style={styles.routeText}>{currentActiveRide.to}</Text>
                  </View>
                </View>

                {/* Departure Time */}
                {currentActiveRide.departureTime && (
                  <View style={styles.detailRow}>
                    <Clock size={14} color={Colors.dark.textSecondary} />
                    <Text style={styles.detailText}>
                      Departure: {new Date(currentActiveRide.departureTime).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </Text>
                  </View>
                )}

                {/* Seats Info */}
                <View style={styles.seatsInfoRow}>
                  <View style={styles.detailRow}>
                    <Users size={14} color={Colors.dark.textSecondary} />
                    <Text style={styles.detailText}>
                      {currentActiveRide.availableSeats?.length || 0} seats available
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <DollarSign size={14} color={Colors.dark.gold} />
                    <Text style={[styles.detailText, { color: Colors.dark.gold }]}>
                      ₹{currentActiveRide.bookings
                        ?.filter((b: any) => b.status === 'confirmed')
                        .reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0) || 0}
                    </Text>
                  </View>
                </View>

                {/* Passenger List - Only show passengers waiting for pickup */}
                <View style={styles.passengerListContainer}>
                  <Text style={styles.passengerListTitle}>Waiting for Pickup:</Text>
                  {currentActiveRide.bookings
                    ?.filter((b: any) => {
                      // Only show confirmed bookings that haven't boarded yet
                      const hasBoarded = currentActiveRide.pickupStatus?.confirmedPassengers?.includes(b.passengerClerkId || b.userId);
                      return b.status === 'confirmed' && !hasBoarded;
                    })
                    .map((booking: any, index: number) => {
                      // Find corresponding booking in RideBooking collection to get the actual booking ID
                      const isPickupConfirmed = false; // Will always be false since we filtered out boarded passengers
                      const bookingId = booking._id; // This should be set when adding to ride.bookings
                      
                      return (
                        <View key={index} style={styles.passengerItem}>
                          <View style={styles.passengerInfo}>
                            <Text style={styles.passengerItemName}>
                              {booking.passengerName || 'Passenger'}
                            </Text>
                            {booking.passengerPhone && (
                              <TouchableOpacity
                                onPress={() => Linking.openURL(`tel:${booking.passengerPhone}`)}
                                style={styles.phoneLink}>
                                <Phone size={12} color={Colors.dark.gold} />
                                <Text style={styles.phoneText}>{booking.passengerPhone}</Text>
                              </TouchableOpacity>
                            )}
                            <View style={styles.seatBadge}>
                              <Text style={styles.seatBadgeText}>
                                Seat{booking.seatNumbers?.length > 1 ? 's' : ''}: {booking.seatNumbers?.join(', ') || 'N/A'}
                              </Text>
                            </View>
                          </View>
                          
                          {/* Pickup Button */}
                          <TouchableOpacity
                            style={[
                              styles.pickupButton,
                              isPickupConfirmed && styles.pickupButtonConfirmed,
                              initiatingPickupForBooking === bookingId && styles.pickupButtonDisabled,
                            ]}
                            onPress={() => handleInitiatePickup(
                              bookingId,
                              booking.passengerClerkId || booking.userId,
                              booking.passengerName || 'Passenger',
                            )}
                            disabled={isPickupConfirmed || initiatingPickupForBooking === bookingId}
                            activeOpacity={0.7}>
                            {initiatingPickupForBooking === bookingId ? (
                              <ActivityIndicator size="small" color={Colors.dark.gold} />
                            ) : isPickupConfirmed ? (
                              <>
                                <Check size={14} color={Colors.dark.success} />
                                <Text style={styles.pickupButtonTextConfirmed}>Boarded</Text>
                              </>
                            ) : (
                              <>
                                <Users size={14} color={Colors.dark.gold} />
                                <Text style={styles.pickupButtonText}>Pickup</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  
                  {/* Show message when all passengers have boarded */}
                  {currentActiveRide.bookings?.filter((b: any) => {
                    const hasBoarded = currentActiveRide.pickupStatus?.confirmedPassengers?.includes(b.passengerClerkId || b.userId);
                    return b.status === 'confirmed' && !hasBoarded;
                  }).length === 0 && (
                    <View style={styles.allBoardedMessage}>
                      <Check size={18} color={Colors.dark.success} />
                      <Text style={styles.allBoardedText}>All passengers have boarded! 🚗</Text>
                    </View>
                  )}
                </View>

                {/* Passengers Onboard Section */}
                {currentActiveRide.pickupStatus?.confirmedPassengers && 
                 currentActiveRide.pickupStatus.confirmedPassengers.length > 0 && (
                  <View style={styles.passengersOnboardContainer}>
                    <View style={styles.onboardHeader}>
                      <Check size={18} color={Colors.dark.success} />
                      <Text style={styles.onboardTitle}>Passengers Onboard ({currentActiveRide.pickupStatus.confirmedPassengers.length})</Text>
                    </View>
                    {currentActiveRide.bookings
                      ?.filter((b: any) => {
                        const hasBoarded = currentActiveRide.pickupStatus?.confirmedPassengers?.includes(b.passengerClerkId || b.userId);
                        return b.status === 'confirmed' && hasBoarded;
                      })
                      .map((booking: any, index: number) => (
                        <View key={index} style={styles.onboardPassengerItem}>
                          <View style={styles.onboardPassengerInfo}>
                            <View style={styles.onboardCheckmark}>
                              <Check size={12} color={Colors.dark.success} />
                            </View>
                            <View style={styles.onboardPassengerDetails}>
                              <Text style={styles.onboardPassengerName}>
                                {booking.passengerName || 'Passenger'}
                              </Text>
                              {booking.passengerPhone && (
                                <TouchableOpacity
                                  onPress={() => Linking.openURL(`tel:${booking.passengerPhone}`)}
                                  style={styles.phoneLink}>
                                  <Phone size={10} color={Colors.dark.gold} />
                                  <Text style={styles.phoneTextSmall}>{booking.passengerPhone}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          <View style={styles.onboardSeatBadge}>
                            <Text style={styles.onboardSeatText}>
                              Seat{booking.seatNumbers?.length > 1 ? 's' : ''}: {booking.seatNumbers?.join(', ') || 'N/A'}
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                )}

                <Text style={styles.activeRideHint}>
                  📍 Passengers waiting for pickup are shown above. Once they board and confirm, they'll be removed from this list.
                </Text>
              </View>
            )}

            {isLive && (liveRides.length > 0 || pendingApprovals.length > 0) && (
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

                {/* PENDING APPROVAL REQUESTS */}
                {pendingApprovals.length > 0 && (
                  <>
                    <View style={styles.requestsHeader}>
                      <Text style={styles.sectionTitle}>Pending Approval Requests</Text>
                    </View>
                    {pendingApprovals.map((booking) => (
                      <View key={booking._id}>
                        <TouchableOpacity
                          style={styles.requestCard}
                          onPress={() => setExpandedBookingId(expandedBookingId === booking._id ? null : booking._id)}
                          activeOpacity={0.7}>
                          <View style={styles.requestHeader}>
                            <Text style={styles.passengerName}>
                              {booking.userDetails?.name || 'Unknown Passenger'}
                            </Text>
                            <View style={styles.ratingBadge}>
                              <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
                              <Text style={styles.ratingText}>
                                {booking.userDetails?.rating?.toFixed(1) || '5.0'}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.requestRoute}>
                            <View style={styles.routeRow}>
                              <MapPin size={14} color={Colors.dark.gold} />
                              <Text style={styles.routeText}>{booking.from || 'Pickup Location'}</Text>
                            </View>
                            <View style={styles.routeLine} />
                            <View style={styles.routeRow}>
                              <MapPin size={14} color={Colors.dark.pink} />
                              <Text style={styles.routeText}>{booking.to || 'Drop Location'}</Text>
                            </View>
                          </View>

                          <View style={styles.requestDetails}>
                            <View style={styles.detailRow}>
                              <Users size={14} color={Colors.dark.textSecondary} />
                              <Text style={styles.detailText}>
                                {booking.seatNumbers?.length || 1} {booking.seatNumbers?.length === 1 ? 'seat' : 'seats'}
                              </Text>
                            </View>
                            {booking.fare && (
                              <View style={styles.detailRow}>
                                <DollarSign size={14} color={Colors.dark.textSecondary} />
                                <Text style={styles.detailText}>₹{booking.fare}</Text>
                              </View>
                            )}
                            {booking.customRequest && (
                              <View style={styles.detailRow}>
                                <Text style={[styles.detailText, { fontStyle: 'italic', color: Colors.dark.textSecondary }]}>
                                  "{booking.customRequest}"
                                </Text>
                              </View>
                            )}
                          </View>

                          {expandedBookingId === booking._id && (
                            <View style={styles.expandedSection}>
                              <View style={styles.expandedDivider} />
                              
                              {/* Additional booking details */}
                              {booking.pickupTime && (
                                <View style={styles.expandedRow}>
                                  <Clock size={14} color={Colors.dark.textSecondary} />
                                  <Text style={styles.expandedLabel}>Pickup Time:</Text>
                                  <Text style={styles.expandedValue}>
                                    {new Date(booking.pickupTime).toLocaleString()}
                                  </Text>
                                </View>
                              )}
                              
                              {booking.userDetails?.phone && (
                                <View style={styles.expandedRow}>
                                  <Phone size={14} color={Colors.dark.textSecondary} />
                                  <Text style={styles.expandedLabel}>Contact:</Text>
                                  <Text style={styles.expandedValue}>{booking.userDetails.phone}</Text>
                                </View>
                              )}
                              
                              {/* Approval Notes Input */}
                              <Text style={styles.notesLabel}>Approval Notes (Optional):</Text>
                              <TextInput
                                style={styles.notesInput}
                                placeholder="Add notes for this booking..."
                                placeholderTextColor={Colors.dark.textSecondary}
                                value={approvalNotes}
                                onChangeText={setApprovalNotes}
                                multiline
                                numberOfLines={3}
                                maxLength={200}
                              />
                            </View>
                          )}

                          <View style={styles.requestActions}>
                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                showAlert(
                                  'Reject Booking',
                                  'Why are you rejecting this booking?',
                                  'warning',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'Not Available',
                                      onPress: () => handleRejectBooking(booking._id, 'Driver not available'),
                                    },
                                    {
                                      text: 'Other Reason',
                                      onPress: () => handleRejectBooking(booking._id, 'Rejected by driver'),
                                    },
                                  ]
                                );
                              }}
                              activeOpacity={0.7}
                              disabled={approvingBookingId === booking._id}>
                              <X size={20} color={Colors.dark.error} />
                              <Text style={styles.rejectButtonText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleApproveBooking(booking._id);
                              }}
                              activeOpacity={0.7}
                              disabled={approvingBookingId === booking._id}>
                              {approvingBookingId === booking._id ? (
                                <ActivityIndicator size="small" color={Colors.dark.background} />
                              ) : (
                                <>
                                  <Check size={20} color={Colors.dark.background} />
                                  <Text style={styles.acceptButtonText}>Approve</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {isLive && liveRides.length === 0 && pendingApprovals.length === 0 && (
              <View style={styles.emptyState}>
                <Users size={48} color={Colors.dark.textSecondary} />
                <Text style={styles.emptyText}>Waiting for requests...</Text>
                <Text style={styles.emptySubtext}>
                  You'll see ride requests and approval requests here
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

        {selectedTab === 'messages' && (
          <View style={styles.messagesContainer}>
            {conversationsLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.dark.gold} />
                <Text style={styles.emptyText}>Loading conversations...</Text>
              </View>
            ) : conversations.length === 0 ? (
              <View style={styles.centerContainer}>
                <MessageSquare size={64} color={Colors.dark.textSecondary} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtext}>
                  Your conversations with passengers will appear here
                </Text>
              </View>
            ) : (
              conversations.map((conversation) => {
                const timeAgo = getTimeAgo(new Date(conversation.lastMessageAt));
                return (
                  <TouchableOpacity
                    key={conversation._id}
                    style={styles.conversationItem}
                    onPress={() => {
                      setSelectedConversation(conversation);
                      setChatModalVisible(true);
                    }}
                    activeOpacity={0.7}>
                    <View style={styles.avatar}>
                      <User size={24} color={Colors.dark.gold} />
                    </View>
                    
                    <View style={styles.conversationContent}>
                      <View style={styles.conversationHeader}>
                        <Text style={styles.conversationName} numberOfLines={1}>
                          {conversation.otherUserName}
                        </Text>
                        <View style={styles.timeContainer}>
                          <Clock size={12} color={Colors.dark.textSecondary} />
                          <Text style={styles.conversationTime}>{timeAgo}</Text>
                        </View>
                      </View>
                      
                      {conversation.rideDetails && 
                       typeof conversation.rideDetails.from === 'string' && 
                       typeof conversation.rideDetails.to === 'string' ? (
                        <Text style={styles.rideRoute} numberOfLines={1}>
                          {conversation.rideDetails.from} → {conversation.rideDetails.to}
                        </Text>
                      ) : null}
                      
                      <Text style={styles.lastMessage} numberOfLines={2}>
                        {conversation.lastMessage || 'No messages yet'}
                      </Text>
                    </View>

                    <View style={styles.rightActions}>
                      {conversation.otherUserPhone && (
                        <TouchableOpacity
                          style={styles.phoneButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleCall(conversation.otherUserPhone);
                          }}
                        >
                          <Phone size={20} color={Colors.dark.gold} />
                        </TouchableOpacity>
                      )}
                      {conversation.unreadCount && conversation.unreadCount > 0 ? (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {selectedTab === 'insights' && renderInsights()}
      </ScrollView>

      {/* Approval Controls Modal */}
      {approvalControlsModalVisible && activeRideId && (
        <View style={styles.modalOverlay}>
          <View style={styles.approvalModal}>
            <TouchableOpacity
              style={styles.closeApprovalModal}
              onPress={() => setApprovalControlsModalVisible(false)}
            >
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
            <ApprovalControlsDriver
              rideId={activeRideId}
              requiresManualApproval={requiresManualApproval}
              isFestivalRide={isFestivalRide}
              onSave={(settings) => {
                setRequiresManualApproval(settings.requiresManualApproval);
                setApprovalControlsModalVisible(false);
                showAlert('Success', 'Approval settings updated!', 'success');
              }}
              onError={(error) => {
                showAlert('Error', error, 'error');
              }}
            />
          </View>
        </View>
      )}

      {/* Approval modal removed - using inline expandable cards */}

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
            departureTime: offer.departureTime,
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
          style={[styles.bottomNavItem, selectedTab === 'offers' && styles.bottomNavItemActive]}
          onPress={() => setSelectedTab('offers')}
          activeOpacity={0.85}>
          <List size={18} color={selectedTab === 'offers' ? Colors.dark.background : Colors.dark.text} />
          <Text style={[styles.bottomNavText, selectedTab === 'offers' && styles.bottomNavTextActive]}>My rides</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bottomNavCreate}
          onPress={() => {
            setRideOfferModalVisible(true);
          }}
          activeOpacity={0.9}>
          <Plus size={20} color={Colors.dark.background} />
          <Text style={styles.bottomNavCreateText}>Offer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomNavItem, selectedTab === 'messages' && styles.bottomNavItemActive]}
          onPress={() => setSelectedTab('messages')}
          activeOpacity={0.85}>
          <View>
            <MessageSquare size={18} color={selectedTab === 'messages' ? Colors.dark.background : Colors.dark.text} />
            {totalUnreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeCountText}>{totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomNavText, selectedTab === 'messages' && styles.bottomNavTextActive]}>Messages</Text>
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

      {selectedConversation && (
        <ChatModal
          visible={chatModalVisible}
          onClose={() => {
            setChatModalVisible(false);
            loadConversations();
          }}
          rideId={selectedConversation.rideId}
          driverId={selectedConversation.driverId}
          driverName={
            selectedConversation.driverId === user?.id
              ? user.firstName || 'You'
              : selectedConversation.otherUserName
          }
          driverPhone={
            selectedConversation.driverId !== user?.id
              ? selectedConversation.otherUserPhone
              : undefined
          }
          passengerId={selectedConversation.passengerId}
          passengerName={
            selectedConversation.passengerId === user?.id
              ? user.firstName || 'You'
              : selectedConversation.otherUserName
          }
          passengerPhone={
            selectedConversation.passengerId !== user?.id
              ? selectedConversation.otherUserPhone
              : undefined
          }
        />
      )}

      {/* Debug Modal */}
      {debugModalVisible && (
        <View style={styles.debugModal}>
          <View style={styles.debugModalContent}>
            <View style={styles.debugModalHeader}>
              <Text style={styles.debugModalTitle}>Push Notification Debug</Text>
              <TouchableOpacity
                onPress={() => setDebugModalVisible(false)}
                style={styles.debugModalClose}>
                <X size={20} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            <PushNotificationDebug />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// Helper function to get time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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
  activeRideOfferCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.dark.gold,
  },
  seatsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 12,
  },
  passengerListContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    gap: 8,
  },
  passengerListTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  passengerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  passengerInfo: {
    flex: 1,
    gap: 4,
  },
  passengerItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  phoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  phoneText: {
    fontSize: 12,
    color: Colors.dark.gold,
  },
  seatBadge: {
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  seatBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  pickupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.dark.gold + '20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  pickupButtonConfirmed: {
    backgroundColor: Colors.dark.success + '20',
    borderColor: Colors.dark.success,
  },
  pickupButtonDisabled: {
    opacity: 0.5,
  },
  pickupButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  pickupButtonTextConfirmed: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.success,
  },
  allBoardedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.dark.success + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.success + '30',
  },
  allBoardedText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.success,
  },
  passengersOnboardContainer: {
    marginTop: 16,
    backgroundColor: Colors.dark.success + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.success + '30',
  },
  onboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  onboardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.success,
  },
  onboardPassengerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.success + '20',
  },
  onboardPassengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  onboardCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardPassengerDetails: {
    flex: 1,
  },
  onboardPassengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  phoneTextSmall: {
    fontSize: 10,
    color: Colors.dark.gold,
    marginLeft: 4,
  },
  onboardSeatBadge: {
    backgroundColor: Colors.dark.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  onboardSeatText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.success,
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
  expandedSection: {
    marginTop: 16,
    paddingTop: 16,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginBottom: 12,
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  expandedLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  expandedValue: {
    fontSize: 13,
    color: Colors.dark.text,
    flex: 1,
  },
  notesLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    color: Colors.dark.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
  activeOfferCard: {
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '08',
  },
  activeRideBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  activeRideBadgeText: {
    color: Colors.dark.background,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeaderWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: Colors.dark.gold + '30',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '700',
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
  disabledButtonAlt: {
    backgroundColor: Colors.dark.textSecondary + '10',
    borderColor: Colors.dark.textSecondary + '30',
  },
  disabledText: {
    color: Colors.dark.textSecondary,
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
  messagesContainer: {
    padding: 20,
    paddingTop: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtextAlt: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phoneButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    flex: 1,
    marginRight: 8,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conversationTime: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  rideRoute: {
    fontSize: 13,
    color: Colors.dark.gold,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  unreadBadge: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.background,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  debugButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
},
  notificationBellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.card,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.dark.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  notificationBadgeText: {
    color: Colors.dark.background,
    fontSize: 11,
    fontWeight: '700',
  },
  debugModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  debugModalContent: {
    backgroundColor: Colors.dark.card,
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
    width: '90%',
  },
  debugModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  debugModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  debugModalClose: {
    padding: 4,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  approvalModal: {
    backgroundColor: Colors.dark.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  closeApprovalModal: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 10,
  },
});
