import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, ActivityIndicator, Linking, Platform, StatusBar } from 'react-native';
import { MapPin, Star, Calendar, User as UserIcon, Plus, X, Check, Clock, Phone, DollarSign, Users, MessageSquare } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/lib/ipService';
import { getUserRides, cancelRide, getPassengerBookings, passengerConfirmRideOfferPickup, passengerConfirmPickup, completeRide, setAuthToken, submitRating, getPendingRatings, cancelPendingApproval, activateSOS, getApiErrorMessage } from '@/lib/api';
import { useAuth as useClerkAuth } from '@/lib/clerkHooks';
import RideRequestModal from '@/components/RideRequestModal';
import RatingModal from '@/components/RatingModal';
import SOSButton from '@/components/SOSButton';
import ChatModal from '@/components/ChatModal';
import { BookingModal } from '@/components/BookingModal';
import { 
  subscribeToRideAcceptance, 
  unsubscribeFromRideEvents, 
  initializeLocationSocket,
  subscribeToPickupInitiated,
  unsubscribeFromPickupEvents,
} from '@/lib/locationSocket';
import CustomAlert, { AlertButton, AlertType } from '@/components/CustomAlert';
import { Ride } from '@/types';

type TripsSection = 'upcoming' | 'requests' | 'old';

export default function TripsScreen() {
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRides, setUserRides] = useState<any[]>([]);
  const [rideOfferBookings, setRideOfferBookings] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [hasLoadedTrips, setHasLoadedTrips] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTripsSection, setSelectedTripsSection] = useState<TripsSection>('upcoming');
  const [rideRequestModalVisible, setRideRequestModalVisible] = useState(false);
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);
  const [confirmingPickupFor, setConfirmingPickupFor] = useState<string | null>(null);
  const [cancellingApprovalId, setCancellingApprovalId] = useState<string | null>(null);
  const [completingRideFor, setCompletingRideFor] = useState<string | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedChatBooking, setSelectedChatBooking] = useState<any | null>(null);
  const [resumeBookingModalVisible, setResumeBookingModalVisible] = useState(false);
  const [resumeBookingRide, setResumeBookingRide] = useState<Ride | null>(null);
  const [resumeBooking, setResumeBooking] = useState<any | null>(null);
  const [resumeBookingStep, setResumeBookingStep] = useState<any>(undefined);
  
  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRideForRating, setSelectedRideForRating] = useState<any>(null);
  const [pendingRatings, setPendingRatings] = useState<any[]>([]);
  
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
      fetchPassengerBookings();
      fetchPendingRatings();
      
      // Initialize socket connection
      initializeLocationSocket();
      
      // Subscribe to ride acceptance updates
      subscribeToRideAcceptance((acceptedRide) => {
        console.log('✅ Ride accepted via socket:', acceptedRide);
        // Refresh user rides to show updated status
        fetchUserRides();
      });

      // Subscribe to pickup initiation (when driver starts pickup process)
      if (user.id) {
        subscribeToPickupInitiated(user.id, (data) => {
          console.log('🚗 Driver initiated pickup:', data);
          // Show alert to passenger
          showAlert(
            '🚗 Driver is Here!',
            'Your driver has initiated pickup. Please confirm once you board the car.',
            'info'
          );
          // Refresh bookings to show pickup confirmation UI
          fetchPassengerBookings();
        });
      }
      
      // Poll for updates every 30 seconds as fallback
      const interval = setInterval(() => {
        fetchUserRides();
        fetchPassengerBookings();
        fetchPendingRatings();
      }, 30000);
      
      return () => {
        clearInterval(interval);
        unsubscribeFromRideEvents();
        if (user?.id) {
          unsubscribeFromPickupEvents(user.id, false);
        }
      };
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (user) {
      const token = await getToken();
      const profile = await getUserProfile(user.id, token);
      setUserProfile(profile);
    }
  };

  const getBookingRideId = (booking: any) =>
    booking?.rideOffer?._id || booking?.rideId || booking?._id;

  const getBookingDriverId = (booking: any) =>
    booking?.driverId || booking?.driver?.id || booking?.rideOffer?.driverId || booking?.rideOffer?.clerkId;

  const canMessageDriver = (booking: any) =>
    Boolean(user?.id && getBookingRideId(booking) && getBookingDriverId(booking));

  const openDriverChat = (booking: any) => {
    if (!canMessageDriver(booking)) {
      showAlert(
        'Chat unavailable',
        'Driver chat will be available once the booking is linked to a driver.',
        'warning',
      );
      return;
    }

    setSelectedChatBooking(booking);
    setChatModalVisible(true);
  };

  const getResumeStepForBooking = (booking: any) => {
    if (booking?.approvalStatus === 'pending_approval') return 'approval-waiting';
    if (booking?.hasConfirmedPickup) return 'tracking';
    if (isBookedApprovalStatus(booking?.approvalStatus)) return 'boarding';
    return 'confirm';
  };

  const mapBookingToRide = (booking: any): Ride | null => {
    const rideOffer = booking?.rideOffer || {};
    const rideId = getBookingRideId(booking);
    const seatNumbers = Array.isArray(booking?.seatNumbers) ? booking.seatNumbers : [];
    const seatCount = Math.max(1, seatNumbers.length || 1);
    const farePerSeat = Math.max(
      0,
      Number(rideOffer.farePerSeat || booking?.fare || booking?.totalAmount / seatCount || 0),
    );

    if (!rideId) return null;

    return {
      id: rideId,
      rideType: 'offer',
      driverId: getBookingDriverId(booking) || 'driver',
      driver: {
        name: booking?.driver?.name || booking?.driverName || 'Driver',
        rating: booking?.driver?.rating || 5,
        gender: booking?.driver?.gender || 'other',
        ridesCompleted: booking?.driver?.ridesCompleted || 0,
        driverVerified: booking?.driver?.driverVerified,
        verificationBatch: booking?.driver?.verificationBatch,
      },
      vehicleId: rideOffer.vehicleId || rideOffer.vehicle?._id || 'vehicle',
      vehicle: {
        model: rideOffer.vehicle?.model || rideOffer.vehicleModel || 'Vehicle',
        number: rideOffer.vehicle?.number || rideOffer.vehicleNumber || 'N/A',
        color: rideOffer.vehicle?.color || rideOffer.vehicleColor || 'Unknown',
      },
      vehicleType: rideOffer.vehicleType || 'four_wheeler',
      from: rideOffer.from || booking?.from || 'Pickup',
      to: rideOffer.to || booking?.to || 'Drop-off',
      pickupPoint: {
        name: rideOffer.from || 'Pickup',
        lat: Number(rideOffer.pickupLatitude) || 0,
        lng: Number(rideOffer.pickupLongitude) || 0,
      },
      dropPoint: {
        name: rideOffer.to || 'Drop-off',
        lat: Number(rideOffer.dropoffLatitude) || 0,
        lng: Number(rideOffer.dropoffLongitude) || 0,
      },
      departureTime:
        rideOffer.departureTime ||
        rideOffer.scheduledDeparture ||
        booking?.pickupTime ||
        new Date().toISOString(),
      scheduledDeparture: rideOffer.scheduledDeparture,
      availableSeats: seatNumbers.length ? seatNumbers : rideOffer.availableSeats || [],
      totalSeats: rideOffer.totalSeats || Math.max(4, seatCount + 1),
      farePerSeat,
      isWomenOnly: Boolean(rideOffer.womenOnly),
      status: booking?.hasConfirmedPickup ? 'ongoing' : 'booked',
      distance: rideOffer.distance || 'Route active',
      duration: rideOffer.duration || 'ETA available after pickup',
      driverMode: rideOffer.driverMode || 'all_access',
      pickupLatitude: rideOffer.pickupLatitude,
      pickupLongitude: rideOffer.pickupLongitude,
      dropoffLatitude: rideOffer.dropoffLatitude,
      dropoffLongitude: rideOffer.dropoffLongitude,
      approvalMode: rideOffer.approvalMode || 'auto',
      requiresManualApproval: Boolean(rideOffer.requiresManualApproval),
      isFestivalRide: Boolean(rideOffer.isFestivalRide),
      seatLocks: [],
      bookingDetails: {
        seatNumbers,
        totalAmount: booking?.totalAmount || farePerSeat * seatCount,
        customRequest: booking?.customRequest,
        passengerName: user?.firstName || 'Passenger',
      },
    } as Ride;
  };

  const openBookingResume = (booking: any) => {
    const ride = mapBookingToRide(booking);
    if (!ride) {
      showAlert('Trip unavailable', 'Ride details are missing. Refresh and try again.', 'warning');
      return;
    }

    setResumeBookingRide(ride);
    setResumeBooking(booking);
    setResumeBookingStep(getResumeStepForBooking(booking));
    setResumeBookingModalVisible(true);
  };

  const fetchUserRides = async () => {
    if (!user?.id) return;
    try {
      if (!hasLoadedTrips) {
        setLoadingRides(true);
      }
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
      setHasLoadedTrips(true);
    }
  };

  const fetchPassengerBookings = async () => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }
      
      const response = await getPassengerBookings();
      if (response.success && response.bookings && Array.isArray(response.bookings)) {
        setRideOfferBookings(response.bookings);
        console.log('✅ Ride offer bookings fetched:', response.bookings.length);
        console.log('📊 Booking statuses:', response.bookings.map((b: any) => ({
          id: b._id,
          status: b.approvalStatus,
          from: b.rideOffer?.from,
          to: b.rideOffer?.to,
          rideStatus: b.rideOffer?.status,
          hasPickup: b.hasConfirmedPickup,
          driverInitiated: b.driverInitiatedPickup
        })));
        
        // Log detailed info for debugging active rides
        const confirmedPickup = response.bookings.filter((b: any) => b.hasConfirmedPickup);
        if (confirmedPickup.length > 0) {
          console.log('🚗 Bookings with confirmed pickup:', confirmedPickup.map((b: any) => ({
            id: b._id,
            approvalStatus: b.approvalStatus,
            rideStatus: b.rideOffer?.status,
            hasConfirmedPickup: b.hasConfirmedPickup,
            from: b.rideOffer?.from,
            to: b.rideOffer?.to
          })));
        }
      }
    } catch (error) {
      console.error('❌ Error fetching ride offer bookings:', error);
      setRideOfferBookings([]);
    } finally {
      setHasLoadedTrips(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserRides(), fetchPassengerBookings()]);
    setRefreshing(false);
  };

  const handleConfirmPickup = async (bookingId: string, rideId: string) => {
    try {
      setConfirmingPickupFor(bookingId);
      console.log('🚗 [PICKUP] Confirming pickup for booking:', bookingId);
      
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await passengerConfirmRideOfferPickup(rideId, bookingId);
      
      showAlert(
        '✅ Pickup Confirmed',
        'You have confirmed boarding. Ride tracking started!',
        'success'
      );
      
      // Refresh bookings
      await fetchPassengerBookings();
    } catch (error) {
      console.error('❌ Error confirming pickup:', error);
      showAlert('Pickup changed', getApiErrorMessage(error, 'Failed to confirm pickup. Try again.'), 'warning');
    } finally {
      setConfirmingPickupFor(null);
    }
  };

  const handleConfirmRideRequestPickup = async (rideId: string) => {
    try {
      setConfirmingPickupFor(rideId);

      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await passengerConfirmPickup(rideId);

      showAlert(
        'Pickup Confirmed',
        'You have confirmed boarding. Ride tracking is active.',
        'success'
      );

      await fetchUserRides();
    } catch (error) {
      console.error('Error confirming ride request pickup:', error);
      showAlert('Pickup changed', getApiErrorMessage(error, 'Failed to confirm pickup. Try again.'), 'warning');
    } finally {
      setConfirmingPickupFor(null);
    }
  };

  const handleCompleteRideOffer = async (booking: any) => {
    const rideId = booking.rideOffer?._id || booking.rideId;
    if (!rideId) {
      showAlert('Error', 'Ride details are missing. Refresh and try again.', 'error');
      return;
    }

    try {
      setCompletingRideFor(booking._id);
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await completeRide(rideId);
      showAlert('Ride Completed', 'Drop-off confirmed. Thank you for riding with Tripza.', 'success');
      await Promise.all([fetchPassengerBookings(), fetchPendingRatings()]);
    } catch (error: any) {
      console.error('Error completing ride offer:', error);
      const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Unable to complete ride.';
      showAlert('Error', message, 'error');
    } finally {
      setCompletingRideFor(null);
    }
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

  const handleCancelPendingApproval = (bookingId: string, rideName: string) => {
    showAlert(
      'Cancel Booking Request?',
      `Are you sure you want to cancel your booking request for ${rideName}? The driver hasn't responded yet.`,
      'warning',
      [
        {
          text: 'Keep Waiting',
          style: 'cancel',
        },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            await performCancelPendingApproval(bookingId);
          },
        },
      ]
    );
  };

  const performCancelPendingApproval = async (bookingId: string) => {
    setCancellingApprovalId(bookingId);
    try {
      const token = await getToken();
      if (token) {
        setAuthToken(token);
      }

      await cancelPendingApproval(bookingId);
      
      showAlert('Cancelled', 'Your booking request has been cancelled. You can try booking again.', 'success');
      console.log('✅ Pending approval cancelled:', bookingId);
      
      // Refresh bookings to update the UI
      await fetchPassengerBookings();
    } catch (error: any) {
      console.error('❌ Error cancelling pending approval:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to cancel the booking request. Please try again.';
      showAlert('Error', errorMessage, 'error');
    } finally {
      setCancellingApprovalId(null);
    }
  };

  // Fetch pending ratings
  const fetchPendingRatings = async () => {
    if (!user?.id) return;
    
    try {
      const response = await getPendingRatings(user.id);
      if (response.success) {
        setPendingRatings(response.pendingRatings || []);
        console.log(`📊 Found ${response.count} pending ratings`);
      }
    } catch (error) {
      console.error('❌ Error fetching pending ratings:', error);
    }
  };

  // Handle opening rating modal
  const handleRateRide = (ride: any, booking?: any) => {
    const driver = booking?.driver || {};
    const rideData = {
      rideId: ride.id || ride._id,
      bookingId: booking?._id,
      from: ride.from,
      to: ride.to,
      ratedId: booking ? booking.driverId : ride.driverId,
      ratedName: booking ? driver.name || booking.driverName || 'Driver' : ride.driverName || 'Driver',
      ratedRole: 'driver' as const,
    };
    setSelectedRideForRating(rideData);
    setRatingModalVisible(true);
  };

  const hasPendingRatingForBooking = (booking: any) => {
    const rideId = booking.rideOffer?._id || booking.rideId;
    return pendingRatings.some(
      (pending) =>
        String(pending.rideId) === String(rideId) &&
        (!pending.bookingId || String(pending.bookingId) === String(booking._id)),
    );
  };

  // Handle rating submission
  const handleSubmitRating = async (rating: number, feedback: string, tags: string[]) => {
    if (!user?.id || !selectedRideForRating) return;

    try {
      await submitRating({
        rideId: selectedRideForRating.rideId,
        bookingId: selectedRideForRating.bookingId,
        raterId: user.id,
        ratedId: selectedRideForRating.ratedId,
        raterRole: 'passenger',
        ratedRole: selectedRideForRating.ratedRole,
        rating,
        feedback,
        tags,
      });

      showAlert('Thank You!', 'Your rating has been submitted successfully.', 'success');
      
      // Refresh pending ratings
      fetchPendingRatings();
      
      setRatingModalVisible(false);
      setSelectedRideForRating(null);
    } catch (error: any) {
      console.error('❌ Error submitting rating:', error);
      if (error.response?.status === 409) {
        showAlert('Already Rated', 'You have already rated this ride.', 'warning');
      } else {
        showAlert('Error', 'Failed to submit rating. Please try again.', 'error');
      }
    }
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.firstName?.split(' ')[0] || 'there';
  const isBookedApprovalStatus = (status?: string) =>
    status === 'confirmed' || status === 'auto_accepted';

  const getTimeMs = (...values: any[]) => {
    for (const value of values) {
      if (!value) continue;
      const ms = new Date(value).getTime();
      if (Number.isFinite(ms)) return ms;
    }
    return null;
  };

  const nowMs = Date.now();
  const isBookingPast = (booking: any) => {
    const departureMs = getTimeMs(
      booking.rideOffer?.departureTime,
      booking.rideOffer?.scheduledDeparture,
      booking.createdAt,
    );
    return departureMs !== null && departureMs < nowMs;
  };

  const isRideRequestPast = (ride: any) => {
    const departureMs = getTimeMs(
      ride.scheduledDeparture,
      ride.departureTime,
      ride.latestDeparture,
      ride.createdAt,
    );
    return departureMs !== null && departureMs < nowMs;
  };
  
  // Filter out old cancelled/completed rides (older than 48 hours)
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const displayRides = userRides.filter((ride) => {
    // Always show active rides (waiting, accepted, ongoing)
    if (['waiting', 'accepted', 'ongoing'].includes(ride.status)) {
      return true;
    }
    
    // For cancelled/completed rides, only show recent ones (within 48 hours)
    if (['cancelled', 'completed'].includes(ride.status)) {
      const rideDate = new Date(ride.createdAt || ride.updatedAt);
      return rideDate > twoDaysAgo;
    }
    
    return true; // Show any other status
  });

  // Filter active/ongoing rides (passenger has boarded and is traveling)
  const activeRides = rideOfferBookings.filter(
    (booking) => {
      const isActive = booking.hasConfirmedPickup && 
                      isBookedApprovalStatus(booking.approvalStatus) &&
                      ['waiting', 'booked', 'ongoing'].includes(booking.rideOffer?.status);
      
      if (booking.hasConfirmedPickup) {
        console.log('🔍 Checking booking for active ride:', {
          id: booking._id,
          hasConfirmedPickup: booking.hasConfirmedPickup,
          approvalStatus: booking.approvalStatus,
          rideStatus: booking.rideOffer?.status,
          isActive,
          from: booking.rideOffer?.from,
          to: booking.rideOffer?.to
        });
      }
      
      return isActive;
    }
  );

  // Filter bookings that need pickup confirmation
  const pendingPickups = rideOfferBookings.filter(
    (booking) => booking.driverInitiatedPickup && !booking.hasConfirmedPickup && isBookedApprovalStatus(booking.approvalStatus)
  );

  // Filter confirmed bookings (approved but not yet picked up)
  const confirmedBookings = rideOfferBookings.filter(
    (booking) =>
      isBookedApprovalStatus(booking.approvalStatus) &&
      !booking.driverInitiatedPickup &&
      !booking.hasConfirmedPickup &&
      !isBookingPast(booking)
  );

  const pastConfirmedBookings = rideOfferBookings.filter(
    (booking) =>
      isBookedApprovalStatus(booking.approvalStatus) &&
      !booking.driverInitiatedPickup &&
      !booking.hasConfirmedPickup &&
      isBookingPast(booking)
  );

  // Filter pending approval bookings
  const pendingApprovalBookings = rideOfferBookings.filter(
    (booking) => booking.approvalStatus === 'pending_approval'
  );

  // Filter rejected/expired bookings
  const rejectedBookings = rideOfferBookings.filter(
    (booking) => booking.approvalStatus === 'rejected' || booking.approvalStatus === 'expired'
  );

  // Filter completed bookings (ride finished, payment done)
  const completedBookings = rideOfferBookings.filter(
    (booking) => booking.approvalStatus === 'completed' || booking.rideOffer?.status === 'completed'
  );

  // Filter cancelled bookings
  const cancelledBookings = rideOfferBookings.filter(
    (booking) => booking.approvalStatus === 'cancelled'
  );

  const currentRideRequests = displayRides.filter(
    (ride) =>
      ['waiting', 'accepted', 'ongoing', 'in_progress'].includes(ride.status) &&
      !isRideRequestPast(ride),
  );
  const oldRideRequests = displayRides.filter(
    (ride) =>
      ['cancelled', 'completed'].includes(ride.status) ||
      isRideRequestPast(ride),
  );
  const oldBookings = [
    ...pastConfirmedBookings,
    ...rejectedBookings,
    ...completedBookings,
    ...cancelledBookings,
  ];

  // Calculate total active bookings (excluding completed/cancelled/rejected)
  const upcomingCount = activeRides.length + pendingPickups.length + confirmedBookings.length;
  const requestsCount = pendingApprovalBookings.length + currentRideRequests.length;
  const oldCount = oldBookings.length + oldRideRequests.length;
  const totalRides = upcomingCount + requestsCount + oldCount;

  console.log('📊 Trips screen breakdown:', {
    activeRides: activeRides.length,
    pendingPickups: pendingPickups.length,
    confirmedBookings: confirmedBookings.length,
    pendingApprovalBookings: pendingApprovalBookings.length,
    rejectedBookings: rejectedBookings.length,
    completedBookings: completedBookings.length,
    cancelledBookings: cancelledBookings.length,
    displayRides: displayRides.length,
    totalActiveRides: totalRides
  });

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

      <View style={styles.sectionTabs}>
        {[
          { key: 'upcoming' as const, label: 'Upcoming', count: upcomingCount },
          { key: 'requests' as const, label: 'Requests', count: requestsCount },
          { key: 'old' as const, label: 'Old', count: oldCount },
        ].map((tab) => {
          const isSelected = selectedTripsSection === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.sectionTab, isSelected && styles.sectionTabActive]}
              onPress={() => setSelectedTripsSection(tab.key)}
              activeOpacity={0.75}>
              <Text style={[styles.sectionTabText, isSelected && styles.sectionTabTextActive]}>
                {tab.label}
              </Text>
              <View style={[styles.sectionTabBadge, isSelected && styles.sectionTabBadgeActive]}>
                <Text style={[styles.sectionTabBadgeText, isSelected && styles.sectionTabBadgeTextActive]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loadingRides && !hasLoadedTrips ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.dark.gold} />
            <Text style={styles.loadingText}>Loading your rides...</Text>
          </View>
        ) : (
          <>
            {/* Active/Ongoing Rides Section - Highest Priority */}
            {selectedTripsSection === 'upcoming' && activeRides.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🚗 Active Ride</Text>
                <Text style={styles.sectionSubtitle}>Your current trip is in progress</Text>
                {activeRides.map((booking) => (
                  <TouchableOpacity
                    key={booking._id}
                    style={[styles.tripCard, styles.activeRideCard]}
                    onPress={() => openBookingResume(booking)}
                    activeOpacity={0.86}>
                    <View style={styles.activeRideHeader}>
                      <View style={styles.activeRideBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.activeRideBadgeText}>Ride in Progress</Text>
                      </View>
                      <View style={styles.activeRideStatus}>
                        <Check size={14} color={Colors.dark.success} />
                        <Text style={styles.activeRideStatusText}>Onboard</Text>
                      </View>
                    </View>

                    <View style={styles.tripHeader}>
                      <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.gold} />
                          <Text style={styles.location}>{booking.rideOffer?.from || 'N/A'}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.pink} />
                          <Text style={styles.location}>{booking.rideOffer?.to || 'N/A'}</Text>
                        </View>
                      </View>
                    </View>

                    {booking.driver && (
                      <View style={styles.driverInfoSection}>
                        <View style={styles.driverInfoRow}>
                          <UserIcon size={16} color={Colors.dark.textSecondary} />
                          <Text style={styles.driverName}>{booking.driver.name}</Text>
                          <View style={styles.ratingBadge}>
                            <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
                            <Text style={styles.ratingText}>{booking.driver.rating?.toFixed(1) || '5.0'}</Text>
                          </View>
                        </View>
                        {booking.driver.phone && (
                          <TouchableOpacity
                            onPress={() => {
                              Linking.openURL(`tel:${booking.driver.phone}`);
                            }}
                            style={styles.callDriverButton}>
                            <Phone size={16} color={Colors.dark.gold} />
                            <Text style={styles.callDriverText}>Call Driver</Text>
                          </TouchableOpacity>
                        )}
                        {canMessageDriver(booking) && (
                          <TouchableOpacity
                            onPress={() => openDriverChat(booking)}
                            style={styles.messageDriverButton}
                            activeOpacity={0.7}>
                            <MessageSquare size={16} color={Colors.dark.gold} />
                            <Text style={styles.messageDriverText}>Message Driver</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <View style={styles.activeRideInfo}>
                      <View style={styles.activeRideInfoRow}>
                        <Users size={14} color={Colors.dark.textSecondary} />
                        <Text style={styles.activeRideInfoText}>
                          Seat{booking.seatNumbers?.length > 1 ? 's' : ''}: {booking.seatNumbers?.join(', ') || 'N/A'}
                        </Text>
                      </View>
                      {booking.totalAmount && (
                        <View style={styles.activeRideInfoRow}>
                          <DollarSign size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.activeRideInfoText}>₹{booking.totalAmount}</Text>
                        </View>
                      )}
                      {booking.rideOffer?.departureTime && (
                        <View style={styles.activeRideInfoRow}>
                          <Clock size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.activeRideInfoText}>
                            {new Date(booking.rideOffer.departureTime).toLocaleTimeString()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* SOS Safety Button */}
                    <SOSButton
                      rideId={booking.rideOffer?._id || booking._id}
                      onSOSActivated={activateSOS}
                      driverName={booking.driver?.name || 'Driver'}
                      driverPhone={booking.driver?.phone}
                    />

                    <TouchableOpacity
                      style={[
                        styles.confirmPickupButton,
                        completingRideFor === booking._id && styles.disabledButton,
                      ]}
                      onPress={() => handleCompleteRideOffer(booking)}
                      disabled={completingRideFor === booking._id}
                      activeOpacity={0.7}>
                      {completingRideFor === booking._id ? (
                        <ActivityIndicator size="small" color={Colors.dark.background} />
                      ) : (
                        <>
                          <Check size={18} color={Colors.dark.background} />
                          <Text style={styles.confirmPickupButtonText}>Mark myself dropped off</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <View style={styles.activeRideFooter}>
                      <Text style={styles.activeRideFooterText}>🎯 Traveling to destination...</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Pending Pickups Section - Most Important */}
            {selectedTripsSection === 'upcoming' && pendingPickups.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🚗 Pickup Verification Required</Text>
                <Text style={styles.sectionSubtitle}>Driver is waiting for you to confirm boarding</Text>
                {pendingPickups.map((booking) => (
                  <TouchableOpacity
                    key={booking._id}
                    style={[styles.tripCard, styles.pickupVerificationCard]}
                    onPress={() => openBookingResume(booking)}
                    activeOpacity={0.86}>
                    {/* Verification Header with Shield Icon */}
                    <View style={styles.verificationHeader}>
                      <View style={styles.shieldIconContainer}>
                        <Check size={32} color={Colors.dark.gold} strokeWidth={3} />
                      </View>
                    </View>

                    <Text style={styles.verificationTitle}>Pickup Verification</Text>
                    <Text style={styles.verificationSubtitle}>
                      Driver has approved your booking. Confirm once you board the car to start tracking.
                    </Text>

                    {/* Route Information */}
                    <View style={styles.verificationRoute}>
                      <View style={styles.routeRow}>
                        <MapPin size={16} color={Colors.dark.gold} />
                        <Text style={styles.verificationLocation}>{booking.rideOffer?.from || 'N/A'}</Text>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routeRow}>
                        <MapPin size={16} color={Colors.dark.pink} />
                        <Text style={styles.verificationLocation}>{booking.rideOffer?.to || 'N/A'}</Text>
                      </View>
                    </View>

                    {/* Booking Details */}
                    <View style={styles.verificationDetails}>
                      <View style={styles.verificationDetailRow}>
                        <Text style={styles.verificationDetailLabel}>Approved Seats</Text>
                        <View style={styles.verificationDetailValue}>
                          <Users size={14} color={Colors.dark.gold} />
                          <Text style={styles.verificationDetailText}>
                            {booking.seatNumbers?.length || 1}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.verificationDivider} />

                      <View style={styles.verificationDetailRow}>
                        <Text style={styles.verificationDetailLabel}>Total Amount</Text>
                        <Text style={styles.verificationAmountText}>₹{booking.totalAmount || booking.fare || 0}</Text>
                      </View>

                      <View style={styles.verificationDivider} />

                      <View style={styles.verificationDetailRow}>
                        <Text style={styles.verificationDetailLabel}>Status</Text>
                        <View style={styles.approvedBadge}>
                          <Check size={12} color={Colors.dark.success} />
                          <Text style={styles.approvedBadgeText}>Approved by Driver</Text>
                        </View>
                      </View>
                    </View>

                    {/* Driver Info */}
                    {booking.driver && (
                      <View style={styles.verificationDriverInfo}>
                        <View style={styles.driverInfoRow}>
                          <UserIcon size={16} color={Colors.dark.textSecondary} />
                          <Text style={styles.driverNameCompact}>{booking.driver.name}</Text>
                          {booking.driver.rating && (
                            <View style={styles.ratingBadge}>
                              <Star size={10} color={Colors.dark.gold} fill={Colors.dark.gold} />
                              <Text style={styles.ratingText}>{booking.driver.rating.toFixed(1)}</Text>
                            </View>
                          )}
                        </View>
                        {booking.driver.phone && (
                          <TouchableOpacity
                            onPress={() => {
                              Linking.openURL(`tel:${booking.driver.phone}`);
                            }}
                            style={styles.callDriverButton}>
                            <Phone size={16} color={Colors.dark.gold} />
                            <Text style={styles.callDriverText}>Call Driver</Text>
                          </TouchableOpacity>
                        )}
                        {canMessageDriver(booking) && (
                          <TouchableOpacity
                            onPress={() => openDriverChat(booking)}
                            style={styles.messageDriverButton}
                            activeOpacity={0.7}>
                            <MessageSquare size={16} color={Colors.dark.gold} />
                            <Text style={styles.messageDriverText}>Message Driver</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Confirmation Question */}
                    <View style={styles.verificationQuestion}>
                      <Text style={styles.verificationQuestionTitle}>Did you board the car?</Text>
                      <Text style={styles.verificationQuestionSubtitle}>Driver is waiting for your confirmation</Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.confirmPickupButton,
                        confirmingPickupFor === booking._id && styles.disabledButton
                      ]}
                      onPress={() => handleConfirmPickup(booking._id, booking.rideId)}
                      disabled={confirmingPickupFor === booking._id}
                      activeOpacity={0.7}>
                      {confirmingPickupFor === booking._id ? (
                        <ActivityIndicator size="small" color={Colors.dark.background} />
                      ) : (
                        <>
                          <Check size={18} color={Colors.dark.background} />
                          <Text style={styles.confirmPickupButtonText}>Yes, I'm in the Car</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Confirmed Bookings - Waiting for Driver */}
            {selectedTripsSection === 'upcoming' && confirmedBookings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming Booked Trip</Text>
                <Text style={styles.sectionSubtitle}>Tap a trip to resume pickup verification, chat, or live tracking</Text>
                {confirmedBookings.map((booking) => (
                  <TouchableOpacity
                    key={booking._id}
                    style={styles.tripCard}
                    onPress={() => openBookingResume(booking)}
                    activeOpacity={0.86}>
                    <View style={styles.tripHeader}>
                      <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.gold} />
                          <Text style={styles.location}>{booking.rideOffer?.from || 'N/A'}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.pink} />
                          <Text style={styles.location}>{booking.rideOffer?.to || 'N/A'}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles.acceptedBadge]}>
                        <Text style={[styles.statusText, styles.acceptedText]}>Confirmed</Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.tripDetails}>
                      {booking.rideOffer?.departureTime && (
                        <View style={styles.detailRow}>
                          <Calendar size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>
                            {new Date(booking.rideOffer.departureTime).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      {booking.seatNumbers && booking.seatNumbers.length > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailText}>
                            Seat{booking.seatNumbers.length > 1 ? 's' : ''}: {booking.seatNumbers.join(', ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    {booking.driver && (
                      <View style={styles.driverInfo}>
                        <View style={styles.driverDetails}>
                          <Text style={styles.driverName}>{booking.driver.name}</Text>
                          {booking.driver.rating && (
                            <View style={styles.ratingRow}>
                              <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
                              <Text style={styles.rating}>{booking.driver.rating.toFixed(1)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {canMessageDriver(booking) && (
                      <TouchableOpacity
                        style={styles.messageDriverButtonWide}
                        onPress={() => openDriverChat(booking)}
                        activeOpacity={0.7}>
                        <MessageSquare size={16} color={Colors.dark.gold} />
                        <Text style={styles.messageDriverText}>Message Driver</Text>
                      </TouchableOpacity>
                    )}

                    <View style={styles.resumeHintRow}>
                      <Text style={styles.resumeHintText}>Tap card to resume trip flow</Text>
                      <Text style={styles.resumeHintArrow}>›</Text>
                    </View>

                    {hasPendingRatingForBooking(booking) && (
                      <TouchableOpacity
                        style={styles.rateButton}
                        onPress={() => handleRateRide(booking.rideOffer || {}, booking)}
                        activeOpacity={0.7}>
                        <Star size={16} color={Colors.dark.background} fill={Colors.dark.background} />
                        <Text style={styles.rateButtonText}>Rate Driver</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Pending Approval Bookings */}
            {selectedTripsSection === 'requests' && pendingApprovalBookings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⏳ Pending Approval</Text>
                <Text style={styles.sectionSubtitle}>Waiting for driver to approve your request</Text>
                {pendingApprovalBookings.map((booking) => (
                  <TouchableOpacity
                    key={booking._id}
                    style={styles.tripCard}
                    onPress={() => openBookingResume(booking)}
                    activeOpacity={0.86}>
                    <View style={styles.tripHeader}>
                      <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.gold} />
                          <Text style={styles.location}>{booking.rideOffer?.from || 'N/A'}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.pink} />
                          <Text style={styles.location}>{booking.rideOffer?.to || 'N/A'}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles.waitingBadge]}>
                        <Clock size={12} color={Colors.dark.gold} />
                        <Text style={[styles.statusText, styles.waitingText]}>Pending</Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.tripDetails}>
                      {booking.rideOffer?.departureTime && (
                        <View style={styles.detailRow}>
                          <Calendar size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>
                            {new Date(booking.rideOffer.departureTime).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      {booking.seatNumbers && booking.seatNumbers.length > 0 && (
                        <View style={styles.detailRow}>
                          <Users size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>
                            Seat{booking.seatNumbers.length > 1 ? 's' : ''}: {booking.seatNumbers.join(', ')}
                          </Text>
                        </View>
                      )}
                      {booking.fare && (
                        <View style={styles.detailRow}>
                          <DollarSign size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>₹{booking.fare}</Text>
                        </View>
                      )}
                      {booking.driver && (
                        <View style={styles.detailRow}>
                          <UserIcon size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>{booking.driver.name}</Text>
                        </View>
                      )}
                    </View>

                    {/* Cancel Button */}
                    <View style={styles.divider} />
                    <TouchableOpacity 
                      style={styles.cancelApprovalButton}
                      onPress={() => handleCancelPendingApproval(
                        booking._id, 
                        `${booking.rideOffer?.from} → ${booking.rideOffer?.to}`
                      )}
                      disabled={cancellingApprovalId === booking._id}
                    >
                      {cancellingApprovalId === booking._id ? (
                        <ActivityIndicator size="small" color={Colors.dark.pink} />
                      ) : (
                        <>
                          <X size={16} color={Colors.dark.pink} />
                          <Text style={styles.cancelApprovalText}>Cancel Request</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Rejected/Expired Bookings */}
            {selectedTripsSection === 'old' && pastConfirmedBookings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Past Booked Trips</Text>
                <Text style={styles.sectionSubtitle}>Booked trips whose pickup time has passed</Text>
                {pastConfirmedBookings.map((booking) => (
                  <View key={booking._id} style={styles.tripCard}>
                    <View style={styles.tripHeader}>
                      <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.gold} />
                          <Text style={styles.location}>{booking.rideOffer?.from || 'N/A'}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.pink} />
                          <Text style={styles.location}>{booking.rideOffer?.to || 'N/A'}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles.waitingBadge]}>
                        <Text style={[styles.statusText, styles.waitingText]}>Past</Text>
                      </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.tripDetails}>
                      {booking.rideOffer?.departureTime && (
                        <View style={styles.detailRow}>
                          <Calendar size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>
                            {new Date(booking.rideOffer.departureTime).toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {selectedTripsSection === 'old' && rejectedBookings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>❌ Rejected/Expired</Text>
                <Text style={styles.sectionSubtitle}>These bookings were not approved</Text>
                {rejectedBookings.map((booking) => (
                  <View key={booking._id} style={styles.tripCard}>
                    <View style={styles.tripHeader}>
                      <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.gold} />
                          <Text style={styles.location}>{booking.rideOffer?.from || 'N/A'}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.pink} />
                          <Text style={styles.location}>{booking.rideOffer?.to || 'N/A'}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles.cancelledBadge]}>
                        <Text style={[styles.statusText, styles.cancelledText]}>
                          {booking.approvalStatus === 'expired' ? 'Expired' : 'Rejected'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.tripDetails}>
                      {booking.rideOffer?.departureTime && (
                        <View style={styles.detailRow}>
                          <Calendar size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>
                            {new Date(booking.rideOffer.departureTime).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      {booking.rejectionReason && (
                        <View style={styles.detailRow}>
                          <Text style={[styles.detailText, { color: Colors.dark.pink }]}>
                            Reason: {booking.rejectionReason}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {selectedTripsSection === 'old' && cancelledBookings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cancelled Bookings</Text>
                <Text style={styles.sectionSubtitle}>Bookings cancelled before travel</Text>
                {cancelledBookings.map((booking) => (
                  <View key={booking._id} style={styles.tripCard}>
                    <View style={styles.tripHeader}>
                      <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.gold} />
                          <Text style={styles.location}>{booking.rideOffer?.from || 'N/A'}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.pink} />
                          <Text style={styles.location}>{booking.rideOffer?.to || 'N/A'}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles.cancelledBadge]}>
                        <Text style={[styles.statusText, styles.cancelledText]}>Cancelled</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Completed Bookings */}
            {selectedTripsSection === 'old' && completedBookings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ Completed Rides</Text>
                <Text style={styles.sectionSubtitle}>Your finished rides</Text>
                {completedBookings.map((booking) => (
                  <View key={booking._id} style={styles.tripCard}>
                    <View style={styles.tripHeader}>
                      <View style={styles.routeInfo}>
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.gold} />
                          <Text style={styles.location}>{booking.rideOffer?.from || 'N/A'}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routeRow}>
                          <MapPin size={14} color={Colors.dark.pink} />
                          <Text style={styles.location}>{booking.rideOffer?.to || 'N/A'}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles.acceptedBadge]}>
                        <Text style={[styles.statusText, styles.acceptedText]}>Completed</Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.tripDetails}>
                      {booking.rideOffer?.departureTime && (
                        <View style={styles.detailRow}>
                          <Calendar size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>
                            {new Date(booking.rideOffer.departureTime).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      {booking.fare && (
                        <View style={styles.detailRow}>
                          <DollarSign size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>₹{booking.fare}</Text>
                        </View>
                      )}
                    </View>

                    {booking.driver && (
                      <View style={styles.driverInfo}>
                        <View style={styles.driverDetails}>
                          <Text style={styles.driverName}>{booking.driver.name}</Text>
                          {booking.driver.rating && (
                            <View style={styles.ratingRow}>
                              <Star size={12} color={Colors.dark.gold} fill={Colors.dark.gold} />
                              <Text style={styles.rating}>{booking.driver.rating.toFixed(1)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {canMessageDriver(booking) && (
                      <TouchableOpacity
                        style={styles.messageDriverButtonWide}
                        onPress={() => openDriverChat(booking)}
                        activeOpacity={0.7}>
                        <MessageSquare size={16} color={Colors.dark.gold} />
                        <Text style={styles.messageDriverText}>Message Driver</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Ride Requests Section */}
            {selectedTripsSection === 'requests' && currentRideRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📍 My Ride Requests</Text>
                {currentRideRequests.map((ride, index) => {
                  const isRideRequestActive = ['accepted', 'ongoing', 'in_progress'].includes(ride.status);
                  const hasDriverMarkedPickup = Boolean(ride.pickupStatus?.driverConfirmedAt);
                  const hasPassengerConfirmedPickup = Boolean(ride.pickupStatus?.passengerConfirmedAt);
                  const rideId = ride.id || ride._id;

                  return (
                  <View key={rideId || index}>
                    <View style={styles.tripCard}>
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
                            ['accepted', 'ongoing', 'in_progress'].includes(ride.status) && styles.acceptedBadge,
                            ride.status === 'waiting' && styles.waitingBadge,
                          ]}>
                          <Text
                            style={[
                              styles.statusText,
                              ride.status === 'cancelled' && styles.cancelledText,
                              ['accepted', 'ongoing', 'in_progress'].includes(ride.status) && styles.acceptedText,
                              ride.status === 'waiting' && styles.waitingText,
                            ]}>
                            {ride.status === 'completed'
                              ? 'Completed'
                              : ride.status === 'accepted'
                                ? 'Accepted'
                                : ['ongoing', 'in_progress'].includes(ride.status)
                                  ? 'Ongoing'
                                  : ride.status === 'waiting'
                                    ? 'Waiting'
                                    : 'Cancelled'}
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

                      {isRideRequestActive && (
                        <>
                          <View style={styles.divider} />

                          {ride.acceptedBy && (
                            <View style={styles.driverInfoSection}>
                              <View style={styles.driverInfoRow}>
                                <UserIcon size={16} color={Colors.dark.textSecondary} />
                                <Text style={styles.driverName}>
                                  {ride.acceptedBy.driverName || 'Driver'}
                                </Text>
                              </View>
                              {ride.acceptedBy.driverPhone && (
                                <TouchableOpacity
                                  onPress={() => {
                                    Linking.openURL(`tel:${ride.acceptedBy.driverPhone}`);
                                  }}
                                  style={styles.callDriverButton}>
                                  <Phone size={16} color={Colors.dark.gold} />
                                  <Text style={styles.callDriverText}>Call Driver</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}

                          {hasDriverMarkedPickup && !hasPassengerConfirmedPickup && (
                            <View style={styles.verificationQuestion}>
                              <Text style={styles.verificationQuestionTitle}>Did you board the car?</Text>
                              <Text style={styles.verificationQuestionSubtitle}>
                                Driver has marked pickup. Confirm once you are seated.
                              </Text>
                              <TouchableOpacity
                                style={[
                                  styles.confirmPickupButton,
                                  confirmingPickupFor === rideId && styles.disabledButton
                                ]}
                                onPress={() => handleConfirmRideRequestPickup(rideId)}
                                disabled={confirmingPickupFor === rideId}
                                activeOpacity={0.7}>
                                {confirmingPickupFor === rideId ? (
                                  <ActivityIndicator size="small" color={Colors.dark.background} />
                                ) : (
                                  <>
                                    <Check size={18} color={Colors.dark.background} />
                                    <Text style={styles.confirmPickupButtonText}>Yes, I'm in the Car</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            </View>
                          )}

                          {hasPassengerConfirmedPickup && (
                            <View style={styles.activeRideStatus}>
                              <Check size={14} color={Colors.dark.success} />
                              <Text style={styles.activeRideStatusText}>Pickup confirmed</Text>
                            </View>
                          )}

                          <SOSButton
                            rideId={rideId}
                            onSOSActivated={activateSOS}
                            driverName={ride.acceptedBy?.driverName || 'Driver'}
                            driverPhone={ride.acceptedBy?.driverPhone}
                          />
                        </>
                      )}
                    </View>
                  </View>
                  );
                })}
              </View>
            )}

            {selectedTripsSection === 'old' && oldRideRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Old Ride Requests</Text>
                <Text style={styles.sectionSubtitle}>Past, cancelled, and completed requests</Text>
                {oldRideRequests.map((ride, index) => {
                  const rideId = ride.id || ride._id || index;
                  return (
                    <View key={rideId} style={styles.tripCard}>
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
                        <View style={[styles.statusBadge, styles.cancelledBadge]}>
                          <Text style={[styles.statusText, styles.cancelledText]}>
                            {ride.status === 'completed' ? 'Completed' : ride.status === 'cancelled' ? 'Cancelled' : 'Past'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.divider} />

                      <View style={styles.tripDetails}>
                        <View style={styles.detailRow}>
                          <Calendar size={14} color={Colors.dark.textSecondary} />
                          <Text style={styles.detailText}>
                            {new Date(ride.scheduledDeparture || ride.departureTime || ride.createdAt).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {((selectedTripsSection === 'upcoming' && upcomingCount === 0) ||
              (selectedTripsSection === 'requests' && requestsCount === 0) ||
              (selectedTripsSection === 'old' && oldCount === 0)) && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {selectedTripsSection === 'upcoming'
                    ? 'No upcoming trips'
                    : selectedTripsSection === 'requests'
                      ? 'No waiting requests'
                      : 'No old rides'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {selectedTripsSection === 'requests'
                    ? 'Ride requests waiting for drivers will appear here'
                    : selectedTripsSection === 'old'
                      ? 'Completed, cancelled, and past rides will appear here'
                      : 'Create a ride request or book a ride to get started'}
                </Text>
                <TouchableOpacity
                  style={styles.createRideBtn}
                  onPress={() => setRideRequestModalVisible(true)}
                  activeOpacity={0.7}>
                  <Plus size={20} color={Colors.dark.background} />
                  <Text style={styles.createRideBtnText}>Create Ride</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <RideRequestModal
        visible={rideRequestModalVisible}
        onClose={() => setRideRequestModalVisible(false)}
        onRideCreated={() => {
          console.log('✅ Ride created successfully');
          setSelectedTripsSection('requests');
          fetchUserRides();
        }}
      />

      <RatingModal
        visible={ratingModalVisible}
        onClose={() => {
          setRatingModalVisible(false);
          setSelectedRideForRating(null);
        }}
        onSubmit={handleSubmitRating}
        ratedName={selectedRideForRating?.ratedName}
        ratedRole={selectedRideForRating?.ratedRole || 'driver'}
        from={selectedRideForRating?.from}
        to={selectedRideForRating?.to}
      />

      <BookingModal
        visible={resumeBookingModalVisible}
        ride={resumeBookingRide}
        initialStep={resumeBookingStep}
        initialBooking={resumeBooking}
        onClose={() => {
          setResumeBookingModalVisible(false);
          setResumeBookingRide(null);
          setResumeBooking(null);
          setResumeBookingStep(undefined);
          fetchPassengerBookings();
          fetchUserRides();
        }}
      />

      {selectedChatBooking && user?.id && (
        <ChatModal
          visible={chatModalVisible}
          onClose={() => {
            setChatModalVisible(false);
            fetchPassengerBookings();
          }}
          rideId={getBookingRideId(selectedChatBooking)}
          driverId={getBookingDriverId(selectedChatBooking)}
          driverName={selectedChatBooking.driver?.name || 'Driver'}
          driverPhone={selectedChatBooking.driver?.phone}
          passengerId={user.id}
          passengerName={user.firstName || 'You'}
        />
      )}

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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
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
  sectionTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  sectionTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  sectionTabActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '18',
  },
  sectionTabText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTabTextActive: {
    color: Colors.dark.gold,
  },
  sectionTabBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionTabBadgeActive: {
    backgroundColor: Colors.dark.gold,
  },
  sectionTabBadgeText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  sectionTabBadgeTextActive: {
    color: Colors.dark.background,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  pickupCard: {
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '08',
  },
  pickupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confirmPickupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  confirmPickupButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  driverInfoCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 8,
    marginTop: 8,
  },
  driverNameCompact: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  phoneButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  rateButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600',
  },
  completedBadge: {
    backgroundColor: Colors.dark.success + '20',
  },
  completedText: {
    color: Colors.dark.success,
  },
  activeRideCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.dark.success,
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeRideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.success,
  },
  activeRideBadgeText: {
    color: Colors.dark.success,
    fontSize: 12,
    fontWeight: '700',
  },
  activeRideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.success + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  activeRideStatusText: {
    color: Colors.dark.success,
    fontSize: 11,
    fontWeight: '600',
  },
  driverInfoSection: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '600',
  },
  callDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold + '20',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 8,
  },
  callDriverText: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  messageDriverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.dark.gold + '16',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '45',
  },
  messageDriverButtonWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.dark.gold + '16',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '45',
  },
  messageDriverText: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  resumeHintRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resumeHintText: {
    color: Colors.dark.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  resumeHintArrow: {
    color: Colors.dark.gold,
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '700',
  },
  activeRideInfo: {
    marginTop: 12,
    gap: 8,
  },
  activeRideInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeRideInfoText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  activeRideFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    alignItems: 'center',
  },
  activeRideFooterText: {
    color: Colors.dark.success,
    fontSize: 13,
    fontWeight: '600',
  },
  // Pickup Verification Styles
  pickupVerificationCard: {
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.card,
    padding: 20,
  },
  verificationHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.gold + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.gold + '40',
  },
  verificationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  verificationRoute: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  verificationLocation: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '600',
    flex: 1,
  },
  verificationDetails: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  verificationDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verificationDetailLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  verificationDetailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationDetailText: {
    fontSize: 16,
    color: Colors.dark.text,
    fontWeight: '700',
  },
  verificationAmountText: {
    fontSize: 18,
    color: Colors.dark.gold,
    fontWeight: '700',
  },
  verificationDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  approvedBadgeText: {
    fontSize: 12,
    color: Colors.dark.success,
    fontWeight: '700',
  },
  verificationDriverInfo: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  verificationQuestion: {
    backgroundColor: Colors.dark.gold + '10',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '30',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  verificationQuestionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 6,
  },
  verificationQuestionSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  cancelApprovalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.pink + '10',
    borderWidth: 1,
    borderColor: Colors.dark.pink + '30',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  cancelApprovalText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.pink,
  },
});

