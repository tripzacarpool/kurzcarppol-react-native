import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { X, Check, MapPin, MessageSquare, Armchair, Navigation, CheckCircle2, ArrowLeft, Wallet as WalletIcon, CreditCard, ShieldCheck, UserCheck, Clock, AlertCircle, Star, Car } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { MAP_CONFIG } from '@/config/googleMaps';
import { Ride } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { RazorpayWebView } from './RazorpayWebView';
import { DRIVER_MODE_META } from '@/constants/driverModes';
import CustomAlert, { AlertType } from './CustomAlert';
import RideTrackingMap from './RideTrackingMap';
import ChatModal from './ChatModal';
import { getSocket } from '@/lib/locationSocket';
import {
  processWalletPayment,
  getWalletBalance,
  createRazorpayOrder,
  verifyPayment,
  getRazorpayKeyId,
  RazorpayOrderResponse,
} from '@/lib/razorpay';
import {
  confirmRideBooking,
  passengerConfirmPickup,
  completeRide,
  setAuthToken,
  bookRideOffer,
  confirmBookingPayment,
  getBookingApprovalStatus,
  joinRideRequest,
  cancelPendingApproval,
  passengerConfirmRideOfferPickup,
  getApiErrorCode,
  getApiErrorMessage,
} from '@/lib/api';

interface BookingModalProps {
  visible: boolean;
  ride: Ride | null;
  onClose: () => void;
  initialStep?: BookingStep;
  initialBooking?: any;
}

type BookingStep = 'confirm' | 'request' | 'seats' | 'approval-waiting' | 'payment' | 'boarding' | 'tracking' | 'completed';

export function BookingModal({ visible, ride, onClose, initialStep, initialBooking }: BookingModalProps) {
  const { user, getAuthToken } = useAuth();
  const [step, setStep] = useState<BookingStep>('confirm');
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [customRequest, setCustomRequest] = useState('');
  const [customFare, setCustomFare] = useState('');
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderResponse | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [pickupActionLoading, setPickupActionLoading] = useState(false);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [showTrackingMap, setShowTrackingMap] = useState(false);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [liveAvailableSeats, setLiveAvailableSeats] = useState<number[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending');
  const [approvalCountdown, setApprovalCountdown] = useState(300); // 5 minutes
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const rideRef = useRef(ride);

  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
  }>({ title: '', message: '', type: 'info' });

  const showAlert = useCallback((title: string, message: string, type: AlertType = 'info') => {
    setAlertConfig({ title, message, type });
    setAlertVisible(true);
  }, []);

  // Update ride ref when ride changes
  useEffect(() => {
    rideRef.current = ride;
    if (ride?.availableSeats) {
      setLiveAvailableSeats(ride.availableSeats);
    }
  }, [ride]);

  // Listen for real-time seat booking updates
  useEffect(() => {
    if (!visible || !ride?.id) return;

    try {
      const socket = getSocket();
      if (!socket) return;

      const handleSeatUpdate = (data: { offerId: string; availableSeats: number[]; status: string }) => {
        if (data.offerId === ride.id) {
          console.log(`📡 Real-time seat update for ${ride.id}: [${data.availableSeats.join(', ')}]`);
          setLiveAvailableSeats(data.availableSeats);
          
          // Deselect any seats that are no longer available
          setSelectedSeats(prev => prev.filter(seat => data.availableSeats.includes(seat)));
          
          // Show alert if ride is fully booked
          if (data.availableSeats.length === 0 && data.status === 'booked') {
            showAlert('Ride Fully Booked', 'All seats have been booked by other passengers.', 'warning');
          }
        }
      };

      socket.on('ride:offer:booked', handleSeatUpdate);

      return () => {
        socket.off('ride:offer:booked', handleSeatUpdate);
      };
    } catch (error) {
      console.error('Error setting up socket listener:', error);
    }
  }, [visible, ride?.id, showAlert]);
  
  const handleBookingApproved = useCallback((message = 'Driver approved your request. Please confirm when you board.') => {
    setApprovalStatus('approved');
    setApprovalCountdown(0);
    setBookingConfirmed(true);
    showAlert('Approved!', message, 'success');
    setTimeout(() => {
      setStep('boarding');
    }, 1500);
  }, [showAlert]);

  const handleBookingRejected = useCallback((message = 'Driver rejected your booking request.') => {
    setApprovalStatus('rejected');
    setApprovalCountdown(0);
    showAlert('Booking Rejected', message, 'error');
    setTimeout(() => {
      setStep('seats');
      setCurrentBookingId(null);
    }, 2000);
  }, [showAlert]);

  const hideAlert = () => {
    setAlertVisible(false);
    setTimeout(() => {
      setAlertConfig({ title: '', message: '', type: 'info' });
    }, 300);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setStep('confirm');
      setSelectedSeats([]);
      setCustomRequest('');
      setCustomFare('');
      setPickupConfirmed(false);
      setBookingConfirmed(false);
      setPaymentMethod(null);
      setProcessingPayment(false);
      setTrackingActive(false);
      setPickupActionLoading(false);
      setCompletionLoading(false);
      setShowTrackingMap(false);
      // Reset approval-related states
      setApprovalStatus('pending');
      setApprovalCountdown(300);
      setCurrentBookingId(null);
      setCreatingBooking(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !ride || !initialStep) return;

    const bookingId = initialBooking?._id || initialBooking?.id || null;
    const seatNumbers = Array.isArray(initialBooking?.seatNumbers)
      ? initialBooking.seatNumbers
      : [];
    const status = initialBooking?.approvalStatus;

    setStep(initialStep);
    setCurrentBookingId(bookingId);
    setSelectedSeats(seatNumbers);
    setCustomRequest(initialBooking?.customRequest || '');
    setBookingConfirmed(
      status === 'confirmed' ||
      status === 'auto_accepted' ||
      initialStep === 'boarding' ||
      initialStep === 'tracking',
    );
    setApprovalStatus(
      status === 'pending_approval'
        ? 'pending'
        : status === 'rejected'
          ? 'rejected'
          : status === 'expired'
            ? 'expired'
            : 'approved',
    );
    setPickupConfirmed(Boolean(initialBooking?.hasConfirmedPickup || initialStep === 'tracking'));
    setTrackingActive(Boolean(initialBooking?.hasConfirmedPickup || initialStep === 'tracking'));
  }, [visible, ride, initialStep, initialBooking]);

  // Check if ride has ended when modal opens
  useEffect(() => {
    if (visible && ride && (ride.status === 'completed' || ride.status === 'cancelled')) {
      showAlert(
        'Ride Unavailable',
        `This ride has been ${ride.status}. You cannot book rides that have ended.`,
        'error'
      );
    }
  }, [visible, ride, showAlert]);

  useEffect(() => {
    if (step === 'tracking' && pickupConfirmed) {
      setTrackingActive(true);
    }
  }, [step, pickupConfirmed]);

  // Countdown timer for approval waiting
  useEffect(() => {
    if (step !== 'approval-waiting' || approvalCountdown <= 0) return;

    const timer = setInterval(() => {
      setApprovalCountdown((prev) => {
        const newCount = prev - 1;
        if (newCount <= 0 && approvalStatus === 'pending') {
          // Auto-expire after 5 minutes
          setApprovalStatus('expired');
          showAlert('Approval Expired', 'Driver did not respond in time. Your booking was cancelled.', 'warning');
          setTimeout(() => {
            setStep('seats');
            setCurrentBookingId(null);
          }, 1500);
        }
        return newCount;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, approvalCountdown, approvalStatus, showAlert]);

  useEffect(() => {
    if (step !== 'approval-waiting' || !currentBookingId) return;

    let cancelled = false;
    const pollApprovalStatus = async () => {
      try {
        const token = await getAuthToken();
        if (token) {
          setAuthToken(token);
        }

        const response = await getBookingApprovalStatus(currentBookingId);
        if (cancelled || !response?.booking) return;

        const status = response.booking.approvalStatus;
        if (['confirmed', 'approved', 'auto_accepted'].includes(status)) {
          handleBookingApproved('Driver approved your request. Please confirm when you board.');
        } else if (['rejected', 'cancelled', 'expired'].includes(status)) {
          handleBookingRejected(
            status === 'rejected'
              ? response.booking.rejectionReason || 'Driver rejected your booking request.'
              : 'This booking request is no longer active.',
          );
        }
      } catch (error) {
        console.warn('Could not poll booking approval status:', error);
      }
    };

    pollApprovalStatus();
    const interval = setInterval(pollApprovalStatus, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, currentBookingId, getAuthToken, handleBookingApproved, handleBookingRejected]);

  // Socket listener for booking approval/rejection
  useEffect(() => {
    if (step !== 'approval-waiting' || !currentBookingId || !user?.id) return;

    const socket = getSocket();
    if (!socket) {
      console.warn('⚠️ Socket not available for booking approval listener');
      return;
    }

    const approvalEventName = `passenger:booking-approved:${user.id}`;
    const rejectionEventName = `passenger:booking-rejected:${user.id}`;

    const handleApproval = (data: any) => {
      if (data.bookingId === currentBookingId) {
        console.log('✅ Booking approved by driver:', data.bookingId);
        handleBookingApproved();
      }
    };

    const handleRejection = (data: any) => {
      if (data.bookingId === currentBookingId) {
        console.log('❌ Booking rejected by driver:', data.bookingId);
        handleBookingRejected(data.reason || 'Driver rejected your booking request.');
      }
    };

    socket.on(approvalEventName, handleApproval);
    socket.on(rejectionEventName, handleRejection);

    console.log(`📡 Listening for booking events on: ${approvalEventName}, ${rejectionEventName}`);

    return () => {
      socket.off(approvalEventName, handleApproval);
      socket.off(rejectionEventName, handleRejection);
      console.log('❌ Stopped listening for booking events');
    };
  }, [step, currentBookingId, user?.id, handleBookingApproved, handleBookingRejected]);

  const loadWalletBalance = useCallback(async () => {
    if (!user?.id) return;
    try {
      const balance = await getWalletBalance(user.id);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  }, [user?.id]);

  // Load wallet balance when payment step is reached
  useEffect(() => {
    if (step === 'payment' && user?.id) {
      loadWalletBalance();
    }
  }, [loadWalletBalance, step, user?.id]);

  const handleBack = useCallback(async () => {
    // Cancel booking if going back from approval-waiting
    if (step === 'approval-waiting' && currentBookingId) {
      console.log('Cancelling booking request:', currentBookingId);
      try {
        const token = await getAuthToken();
        if (token) {
          setAuthToken(token);
        }
        await cancelPendingApproval(currentBookingId);
        showAlert(
          'Request Cancelled',
          'Your booking request was cancelled and the selected seats were released.',
          'success',
        );
      } catch (error: any) {
        console.error('Error cancelling pending approval:', error);
        showAlert(
          'Cancellation Failed',
          error.response?.data?.message ||
            error.response?.data?.error ||
            'Could not cancel the request on the server. Refresh before booking those seats again.',
          'error',
        );
      }
      setCurrentBookingId(null);
      setApprovalStatus('pending');
      setApprovalCountdown(300);
    }

    switch (step) {
      case 'request':
        setStep('confirm');
        break;
      case 'seats':
        setStep('request');
        break;
      case 'approval-waiting':
        setStep('seats');
        break;
      case 'payment':
        setStep('approval-waiting');
        break;
      case 'boarding':
        setStep('payment');
        break;
      case 'tracking':
        setStep('boarding');
        break;
      default:
        onClose();
    }
  }, [step, onClose, currentBookingId, getAuthToken, showAlert]);

  const handleClose = useCallback(() => {
    setStep('confirm');
    setSelectedSeats([]);
    setCustomRequest('');
    setCustomFare('');
    setPickupConfirmed(false);
    setBookingConfirmed(false);
    setPaymentMethod(null);
    setProcessingPayment(false);
    setTrackingActive(false);
    setPickupActionLoading(false);
    setCompletionLoading(false);
    setShowTrackingMap(false);
    onClose();
  }, [onClose]);

  const requestedSeatNumbers = useMemo(() => {
    if (!ride) return [];
    if (ride.totalSeats === 2 && selectedSeats.length === 0) {
      return [2];
    }
    return selectedSeats;
  }, [ride, selectedSeats]);

  const totalAmount = useMemo(() => {
    if (!ride) return 0;
    return requestedSeatNumbers.length * ride.farePerSeat;
  }, [ride, requestedSeatNumbers.length]);

  const handleBookingError = useCallback((error: any, fallback: string) => {
    const code = getApiErrorCode(error);
    const message = getApiErrorMessage(error, fallback);

    if (code === 'SEATS_UNAVAILABLE' || /seat|booked by another passenger/i.test(message)) {
      setSelectedSeats((prev) =>
        prev.filter((seat) => liveAvailableSeats.length === 0 || liveAvailableSeats.includes(seat)),
      );
      setCurrentBookingId(null);
      setStep('seats');
      showAlert('Seat just got booked', message, 'warning');
      return;
    }

    if (code === 'BOOKING_NOT_FOUND') {
      setCurrentBookingId(null);
      setStep('seats');
      showAlert('Booking changed', message, 'warning');
      return;
    }

    showAlert('Error', message, 'error');
  }, [liveAvailableSeats, showAlert]);

  const pickupLocation = useMemo(() => {
    if (!ride) return null;
    if (ride.pickupPoint?.lat && ride.pickupPoint?.lng) {
      return {
        latitude: ride.pickupPoint.lat,
        longitude: ride.pickupPoint.lng,
      };
    }
    const latitude = (ride as any).pickupLatitude;
    const longitude = (ride as any).pickupLongitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return { latitude, longitude };
    }
    return null;
  }, [ride]);

  const dropoffLocation = useMemo(() => {
    if (!ride) return null;
    if (ride.dropPoint?.lat && ride.dropPoint?.lng) {
      return {
        latitude: ride.dropPoint.lat,
        longitude: ride.dropPoint.lng,
      };
    }
    const latitude = (ride as any).dropoffLatitude;
    const longitude = (ride as any).dropoffLongitude;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      return { latitude, longitude };
    }
    return null;
  }, [ride]);

  const trackingPickupLocation = pickupLocation || {
    latitude: MAP_CONFIG.DEFAULT_REGION.latitude,
    longitude: MAP_CONFIG.DEFAULT_REGION.longitude,
  };

  const trackingDropoffLocation = dropoffLocation || {
    latitude: trackingPickupLocation.latitude + 0.01,
    longitude: trackingPickupLocation.longitude + 0.01,
  };

  const handlePayment = useCallback(async () => {
    if (!paymentMethod || !user?.id || !ride) return;
    
    // Check if ride has ended
    if (ride.status === 'completed' || ride.status === 'cancelled') {
      showAlert('Ride Ended', 'This ride has already ended. You cannot make bookings for completed rides.', 'error');
      setTimeout(() => {
        onClose();
      }, 1500);
      return;
    }
    
    if (requestedSeatNumbers.length === 0) {
      showAlert('Select Seats', 'Pick at least one seat before paying.', 'warning');
      return;
    }
    if (bookingConfirmed) {
      showAlert('Already Booked', 'Booking already confirmed. Proceed to pickup verification.', 'info');
      return;
    }

    setProcessingPayment(true);

    try {
      const token = await getAuthToken();
      if (token) {
        setAuthToken(token);
      }

      if (paymentMethod === 'wallet') {
        // Process wallet payment
        const result = await processWalletPayment(user.id, totalAmount, {
          rideId: ride.id,
          from: ride.from,
          to: ride.to,
          seats: requestedSeatNumbers,
        });

        if (result.success) {
          // Get fresh token before API call
          const token = await getAuthToken();
          if (token) {
            setAuthToken(token);
            console.log('🔑 Token set for booking confirmation');
          } else if ((ride as any).clerkId && (ride as any).clerkId !== user.id) {
            console.log('Joining shared ride request:', ride.id);
            await joinRideRequest(ride.id, {
              seatCount: requestedSeatNumbers.length || 1,
              paymentMethod: 'upi',
            });
          } else {
            console.warn('⚠️ No token available');
          }
          
          // Only call booking endpoint if we haven't already created the booking
          // (in the approval-waiting step, we already created it)
          if (!currentBookingId) {
            // Use correct booking endpoint based on ride type
            if (ride.rideType === 'offer') {
              console.log('📦 Booking ride offer:', ride.id);
              await bookRideOffer(ride.id, {
                seatNumbers: requestedSeatNumbers,
                paymentMethod: 'wallet',
                customRequest: customRequest || undefined,
              });
            } else if ((ride as any).clerkId && (ride as any).clerkId !== user.id) {
              console.log('Joining shared ride request:', ride.id);
              await joinRideRequest(ride.id, {
                seatCount: requestedSeatNumbers.length || 1,
                paymentMethod: 'wallet',
              });
            } else {
              console.log('📦 Booking ride request:', ride.id);
              await confirmRideBooking(ride.id, {
                seatNumbers: requestedSeatNumbers,
                totalAmount,
                paymentMethod: 'wallet',
                customRequest: customRequest || undefined,
              });
            }
          } else {
            // Booking already created (after driver approval), now confirm payment
            console.log('✅ Confirming payment for booking:', currentBookingId);
            if (!result.transactionId) {
              throw new Error('Wallet payment succeeded without a transaction id');
            }
            await confirmBookingPayment(currentBookingId, result.transactionId, 'wallet');
          }
          setBookingConfirmed(true);
          
          // If payment after ride completion, go to completed step
          if (step === 'payment') {
            showAlert('Payment Complete', 'Thank you! Payment secured. Driver will receive payout.', 'success');
            setStep('completed');
          } else {
            // If payment before ride (old flow), go to boarding
            showAlert('Success', 'Payment secured in escrow. Driver notified with your details.', 'success');
            setPickupConfirmed(false);
            setStep('boarding');
          }
        } else {
          showAlert('Payment Failed', result.error || 'Insufficient balance', 'error');
        }
        setProcessingPayment(false);
      } else if (paymentMethod === 'upi') {
        // Create Razorpay order
        const order = await createRazorpayOrder(totalAmount, user.id, {
          rideId: ride.id,
          from: ride.from,
          to: ride.to,
          seats: requestedSeatNumbers,
        });

        setRazorpayOrder(order);
        setProcessingPayment(false);
        setShowRazorpay(true);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      handleBookingError(error, 'Payment failed');
      setProcessingPayment(false);
    }
  }, [paymentMethod, user?.id, totalAmount, ride, requestedSeatNumbers, showAlert, customRequest, bookingConfirmed, getAuthToken, handleBookingError, currentBookingId, onClose, step]);

  const handleRazorpaySuccess = useCallback(async (paymentId: string, orderId: string, signature: string) => {
    try {
      if (!ride) return;
      setShowRazorpay(false);
      setProcessingPayment(true);

      const token = await getAuthToken();
      if (token) {
        setAuthToken(token);
      }

      const verified = await verifyPayment(orderId, paymentId, signature);
      
      if (verified) {
        // Get fresh token before API call
        const token = await getAuthToken();
        if (token) {
          setAuthToken(token);
          console.log('🔑 Token set for booking confirmation');
        } else {
          console.warn('⚠️ No token available');
        }
        
        // Check if booking already exists (after driver approval)
        if (!currentBookingId) {
          // Use correct booking endpoint based on ride type
          if (ride.rideType === 'offer') {
            console.log('📦 Booking ride offer:', ride.id);
            await bookRideOffer(ride.id, {
              seatNumbers: requestedSeatNumbers,
              paymentMethod: 'upi',
              customRequest: customRequest || undefined,
            });
          } else {
            console.log('📦 Booking ride request:', ride.id);
            await confirmRideBooking(ride.id, {
              seatNumbers: requestedSeatNumbers,
              totalAmount,
              paymentMethod: 'upi',
              customRequest: customRequest || undefined,
            });
          }
        } else {
          // Booking already created (after driver approval), now confirm payment
          console.log('✅ Confirming payment for booking:', currentBookingId);
          await confirmBookingPayment(currentBookingId, paymentId, 'razorpay');
        }
        setBookingConfirmed(true);
        
        // If payment after ride completion, go to completed step
        if (step === 'payment') {
          showAlert('Payment Complete!', 'Thank you! Payment secured. Driver will receive payout.', 'success');
          setStep('completed');
        } else {
          // If payment before ride (old flow), go to boarding
          showAlert('Success!', 'Payment secured in escrow. Confirm pickup to start tracking.', 'success');
          setPickupConfirmed(false);
          setStep('boarding');
        }
      } else {
        showAlert('Error', 'Payment verification failed. Please contact support.', 'error');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      handleBookingError(error, 'Payment verification failed');
    } finally {
      setProcessingPayment(false);
    }
  }, [ride, requestedSeatNumbers, totalAmount, customRequest, showAlert, getAuthToken, handleBookingError, currentBookingId, step]);

  const handleRazorpayFailure = useCallback((error: string) => {
    setShowRazorpay(false);
    showAlert('Payment Failed', error, 'error');
  }, [showAlert]);

  const handlePickupConfirmation = useCallback(async () => {
    if (!ride) return;
    if (pickupConfirmed) {
      setTrackingActive(true);
      setShowTrackingMap(true);
      setStep('tracking');
      return;
    }

    try {
      setPickupActionLoading(true);
      
      // Get fresh token before API call
      const token = await getAuthToken();
      if (token) {
        setAuthToken(token);
        console.log('🔑 Token set for pickup confirmation');
      } else {
        console.warn('⚠️ No token available');
      }
      
      if (ride.rideType === 'offer' && currentBookingId) {
        await passengerConfirmRideOfferPickup(ride.id, currentBookingId);
      } else {
        await passengerConfirmPickup(ride.id, user?.id);
      }
      setPickupConfirmed(true);
      setTrackingActive(true);
      setShowTrackingMap(true);
      setStep('tracking');
      showAlert('Pickup Confirmed', 'Live tracking has started.', 'success');
    } catch (error: any) {
      console.error('Pickup confirmation error:', error);
      const message = getApiErrorMessage(error, 'Unable to confirm pickup');
      showAlert('Pickup changed', message, 'warning');
    } finally {
      setPickupActionLoading(false);
    }
  }, [ride, pickupConfirmed, user?.id, showAlert, getAuthToken, currentBookingId]);

  const handleDropConfirmation = useCallback(async () => {
    if (!ride) return;
    try {
      setCompletionLoading(true);
      
      // Get fresh token before API call
      const token = await getAuthToken();
      if (token) {
        setAuthToken(token);
        console.log('🔑 Token set for ride completion');
      } else {
        console.warn('⚠️ No token available');
      }
      
      await completeRide(ride.id);
      setTrackingActive(false);
      setShowTrackingMap(false);
      setStep('payment');
      showAlert('Ride Completed!', 'Please complete payment to finish your booking.', 'success');
    } catch (error: any) {
      console.error('Ride completion error:', error);
      showAlert('Error', getApiErrorMessage(error, 'Unable to complete ride'), 'error');
    } finally {
      setCompletionLoading(false);
    }
  }, [ride, showAlert, getAuthToken]);

  const handleSeatSelect = useCallback((seatNumber: number) => {
    setSelectedSeats((prev) => {
      if (prev.includes(seatNumber)) {
        return prev.filter((s) => s !== seatNumber);
      } else {
        return [...prev, seatNumber];
      }
    });
  }, []);

  const handleSeatsContinue = useCallback(async () => {
    const seatsToRequest = ride?.totalSeats === 2 && selectedSeats.length === 0 ? [2] : selectedSeats;

    if (!ride?.id || seatsToRequest.length === 0) {
      showAlert('Select Seats', 'Please select at least one seat', 'warning');
      return;
    }

    // Check if ride has ended
    if (ride.status === 'completed' || ride.status === 'cancelled') {
      showAlert('Ride Ended', 'This ride has already ended. You cannot make bookings for completed rides.', 'error');
      setTimeout(() => {
        onClose();
      }, 1500);
      return;
    }

    try {
      setCreatingBooking(true);
      const token = await getAuthToken();
      if (token) {
        setAuthToken(token);
      }

      if (ride.rideType !== 'offer') {
        await joinRideRequest(ride.id, {
          seatCount: seatsToRequest.length || 1,
          paymentMethod: 'unknown',
        });
        setBookingConfirmed(true);
        setApprovalStatus('approved');
        showAlert(
          'Joined shared ride',
          'Your seat is confirmed and the fare split has been updated for everyone.',
          'success',
        );
        setTimeout(() => {
          setStep('boarding');
        }, 1200);
        return;
      }

      // Create booking with pending_approval status
      const response = await bookRideOffer(ride.id, {
        seatNumbers: seatsToRequest,
        customRequest: customRequest.trim(),
      });

      if (response.success && response.booking) {
        setCurrentBookingId(response.booking._id || response.booking.id);
        
        // Check if booking was auto-approved or requires manual approval
        const bookingStatus = response.booking.approvalStatus;
        console.log('📋 Booking status:', bookingStatus);
        
        if (bookingStatus === 'auto_accepted') {
          // Auto-approved! Skip approval waiting and go directly to boarding
          console.log('✅ Booking auto-approved! Going to boarding step.');
          setBookingConfirmed(true);
          setApprovalStatus('approved');
          showAlert(
            '✅ Booking Confirmed!', 
            'Your booking was instantly confirmed. The driver will pick you up at the scheduled time.',
            'success'
          );
          setTimeout(() => {
            setStep('boarding');
          }, 1500);
        } else {
          // Requires manual approval - wait for driver
          console.log('📬 Booking requires driver approval');
          setApprovalStatus('pending');
          setApprovalCountdown(300); // 5 minutes
          setStep('approval-waiting');
          console.log('✅ Booking created, waiting for driver approval:', response.booking._id);
        }
      } else {
        showAlert('Booking Failed', response.message || 'Could not create booking', 'error');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      handleBookingError(error, 'Failed to create booking');
    } finally {
      setCreatingBooking(false);
    }
  }, [ride?.id, ride?.totalSeats, ride?.rideType, ride?.status, selectedSeats, getAuthToken, customRequest, showAlert, handleBookingError, onClose]);

  const handleRequestContinue = useCallback(() => {
    setStep('seats');
  }, []);

  const renderSeatLayout = useMemo(() => {
    if (!ride) return null;
    
    const totalSeats = ride.totalSeats || 4;
    const vehicleType = ride.vehicleType || 'four_wheeler';
    // Use live seat availability for real-time updates
    const availableSeats = liveAvailableSeats.length > 0 ? liveAvailableSeats : (ride.availableSeats || []);
    
    // AUTO RICKSHAW layout (3-wheeler):
    // Driver (Seat 1) is at front alone
    // Back: [Pass 1 (Seat 2)] [Pass 2 (Seat 3)] [Pass 3 (Seat 4)]
    const renderAutoLayout = () => {
      const backSeats = [2, 3, 4]; // All 3 passengers sit in back
      
      return (
        <View style={styles.seatContainer}>
          <View style={styles.autoDriverRow}>
            <Text style={styles.rowLabel}>Front</Text>
            <View style={styles.autoDriverSeat}>
              <View style={[styles.seat, styles.seatDriver]}>
                <Armchair size={28} color={Colors.dark.textSecondary} />
                <Text style={[styles.seatNumber, styles.seatNumberDisabled]}>1</Text>
              </View>
              <Text style={styles.seatLabel}>Driver</Text>
            </View>
          </View>
          
          <View style={styles.seatRow}>
            <Text style={styles.rowLabel}>Back</Text>
            {backSeats.map((seatNumber) => {
              const isAvailable = availableSeats.includes(seatNumber);
              const isSelected = selectedSeats.includes(seatNumber);
              const isBooked = !isAvailable;

              return (
                <View key={seatNumber} style={styles.seatWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.seat,
                      isBooked && styles.seatUnavailable,
                      isSelected && styles.seatSelected,
                      !isAvailable && !isSelected && styles.seatBooked,
                    ]}
                    disabled={!isAvailable}
                    onPress={() => handleSeatSelect(seatNumber)}>
                    <Armchair
                      size={28}
                      color={
                        isSelected
                          ? Colors.dark.background
                          : isAvailable
                          ? Colors.dark.gold
                          : Colors.dark.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.seatNumber,
                        isSelected && styles.seatNumberSelected,
                        isBooked && styles.seatNumberDisabled,
                      ]}>
                      {seatNumber}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      );
    };
    
    // INDIAN CAR layout (Right-Hand Drive):
    // Front: [Pass 1 (Seat 2)] [Driver (Seat 1)]
    // Row 2: [Pass 2 (Seat 3)] [Pass 3 (Seat 4)] [Pass 4 (Seat 5)]
    // Row 3 (7-seater): [Pass 5 (Seat 6)] [Pass 6 (Seat 7)] [Pass 7 (Seat 8)]
    
    const renderIndianCarLayout = () => {
      const frontSeats = [2, 1]; // LEFT to RIGHT: Front Passenger, Driver
      
      // Calculate rows based on total seats
      // Total seats includes driver, so passenger seats = totalSeats - 1
      const passengerSeats = totalSeats - 1;
      
      // Distribute remaining seats into rows of 3
      const remainingAfterFront = passengerSeats - 1; // Already have front passenger
      const rows: number[][] = [];
      
      let seatNum = 3; // Start from seat 3
      let remaining = remainingAfterFront;
      
      while (remaining > 0) {
        const seatsInRow = Math.min(3, remaining);
        rows.push(Array.from({ length: seatsInRow }, (_, i) => seatNum + i));
        seatNum += seatsInRow;
        remaining -= seatsInRow;
      }

      return (
        <View style={styles.seatContainer}>
          {/* Front Row - Indian Layout (RHD) */}
          <View style={styles.seatRow}>
            <Text style={styles.rowLabel}>Front</Text>
            {frontSeats.map((seatNumber) => {
              const isDriverSeat = seatNumber === 1;
              const isAvailable = availableSeats.includes(seatNumber);
              const isSelected = selectedSeats.includes(seatNumber);
              const isBooked = !isAvailable && !isDriverSeat;

              return (
                <View key={seatNumber} style={styles.seatWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.seat,
                      isDriverSeat && styles.seatDriver,
                      isBooked && styles.seatUnavailable,
                      isSelected && styles.seatSelected,
                      !isAvailable && !isDriverSeat && !isSelected && styles.seatBooked,
                    ]}
                    disabled={!isAvailable || isDriverSeat}
                    onPress={() => handleSeatSelect(seatNumber)}>
                    <Armchair
                      size={28}
                      color={
                        isDriverSeat
                          ? Colors.dark.textSecondary
                          : isSelected
                          ? Colors.dark.background
                          : isAvailable
                          ? Colors.dark.gold
                          : Colors.dark.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.seatNumber,
                        isDriverSeat && styles.seatNumberDisabled,
                        isSelected && styles.seatNumberSelected,
                      ]}>
                      {seatNumber}
                    </Text>
                  </TouchableOpacity>
                  {isDriverSeat && (
                    <Text style={styles.seatLabel}>Driver</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Additional Rows */}
          {rows.map((rowSeats, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.seatRow}>
              <Text style={styles.rowLabel}>Row {rowIndex + 2}</Text>
              {rowSeats.map((seatNumber) => {
                const isAvailable = availableSeats.includes(seatNumber);
                const isSelected = selectedSeats.includes(seatNumber);
                const isBooked = !isAvailable;

                return (
                  <View key={seatNumber} style={styles.seatWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.seat,
                        isBooked && styles.seatUnavailable,
                        isSelected && styles.seatSelected,
                        !isAvailable && !isSelected && styles.seatBooked,
                      ]}
                      disabled={!isAvailable}
                      onPress={() => handleSeatSelect(seatNumber)}>
                      <Armchair
                        size={28}
                        color={
                          isSelected
                            ? Colors.dark.background
                            : isAvailable
                            ? Colors.dark.gold
                            : Colors.dark.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.seatNumber,
                          isSelected && styles.seatNumberSelected,
                          isBooked && styles.seatNumberDisabled,
                        ]}>
                        {seatNumber}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      );
    };

    // For two-wheelers (bikes), no seat selection needed - only 1 passenger seat
    if (totalSeats === 2 || vehicleType === 'two_wheeler') {
      return null; // Will auto-select seat 2 in payment step
    }
    
    // For auto-rickshaws (3-wheelers), show auto layout
    if (totalSeats === 4 && vehicleType === 'three_wheeler') {
      return renderAutoLayout();
    }
    
    return renderIndianCarLayout();
  }, [liveAvailableSeats, ride, selectedSeats, handleSeatSelect]);

  const driverModeInfo = ride ? DRIVER_MODE_META[ride.driverMode] : DRIVER_MODE_META.all_access;

  const renderStep = useMemo(() => {
    const BookingModalStepContent = () => {
      if (!ride) return null;
      const pickupLockedForResume =
        Boolean(initialBooking) &&
        ride.rideType === 'offer' &&
        !initialBooking?.driverInitiatedPickup &&
        !initialBooking?.hasConfirmedPickup;
      
      switch (step) {
      case 'confirm':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <Check size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Confirm Booking</Text>
            <View style={styles.rideDetails}>
              <View style={styles.routeRow}>
                <MapPin size={16} color={Colors.dark.gold} />
                <Text style={styles.routeText}>{ride.from}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <MapPin size={16} color={Colors.dark.pink} />
                <Text style={styles.routeText}>{ride.to}</Text>
              </View>
            </View>
            <View style={styles.infoGridClean}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Driver</Text>
                <View style={styles.infoValueRow}>
                  <Text style={styles.infoValue}>{ride.driver.name}</Text>
                  <View style={styles.compactModeBadge}>
                    <Text style={styles.compactModeText}>{driverModeInfo.label}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Departure</Text>
                <Text style={styles.infoValue}>
                  {new Date(ride.departureTime).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vehicle</Text>
                <Text style={styles.infoValue}>{ride.vehicle.model}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fare/Seat</Text>
                <Text style={styles.infoValue}>₹{ride.farePerSeat}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                // Check if ride has ended
                if (ride.status === 'completed' || ride.status === 'cancelled') {
                  showAlert('Ride Ended', 'This ride has already ended. You cannot make bookings for completed rides.', 'error');
                  setTimeout(() => {
                    onClose();
                  }, 1500);
                  return;
                }
                setStep('request');
              }}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 'request':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <MessageSquare size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Special Requests & Chat</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Any special requests or pickup instructions?"
              placeholderTextColor={Colors.dark.textSecondary}
              value={customRequest}
              onChangeText={setCustomRequest}
              multiline
            />
            <TextInput
              style={styles.textInput}
              placeholder="Suggest custom fare (Optional)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={customFare}
              onChangeText={setCustomFare}
              keyboardType="numeric"
            />
            
            {/* Chat with Driver Button */}
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => setChatModalVisible(true)}>
              <MessageSquare size={20} color={Colors.dark.gold} />
              <Text style={styles.chatButtonText}>Chat with Driver</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRequestContinue}>
              <Text style={styles.primaryButtonText}>Select Seats</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRequestContinue}>
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        );

      case 'seats':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <Armchair size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>
              {ride.totalSeats === 2 ? 'Passenger Seat' : 'Select Your Seat'}
            </Text>
            {ride.totalSeats === 2 ? (
              <View style={styles.bikeNote}>
                <Text style={styles.bikeNoteText}>
                  Two-wheeler ride - Only 1 passenger seat available
                </Text>
              </View>
            ) : renderSeatLayout}
            <View style={styles.seatLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: Colors.dark.gold + '30' }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: Colors.dark.gold }]} />
                <Text style={styles.legendText}>Selected</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: Colors.dark.border }]} />
                <Text style={styles.legendText}>Booked</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: Colors.dark.backgroundSecondary, borderWidth: 1, borderColor: Colors.dark.border }]} />
                <Text style={styles.legendText}>Driver</Text>
              </View>
            </View>
            {requestedSeatNumbers.length > 0 && (
              <View style={styles.fareBreakdown}>
                <Text style={styles.fareLabel}>
                  {requestedSeatNumbers.length} Seat(s) × ₹{ride.farePerSeat}
                </Text>
                <Text style={styles.fareTotal}>₹{totalAmount}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.primaryButton, 
                requestedSeatNumbers.length === 0 && styles.disabledButton
              ]}
              disabled={requestedSeatNumbers.length === 0 || creatingBooking}
              onPress={handleSeatsContinue}>
              <Text style={styles.primaryButtonText}>
                {creatingBooking ? 'Creating Booking...' : 'Request Booking'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'approval-waiting':
        const minutes = Math.floor(approvalCountdown / 60);
        const seconds = approvalCountdown % 60;
        const countdownDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        return (
          <View style={styles.stepContent}>
            <View style={[styles.stepIcon, { backgroundColor: Colors.dark.gold + '20' }]}>
              <Clock size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Waiting for Driver Approval</Text>
            
            {ride.driver && (
              <View style={styles.driverCard}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {(ride.driver.name || 'D').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{ride.driver.name}</Text>
                  <View style={styles.ratingRow}>
                    <Star size={16} color={Colors.dark.gold} fill={Colors.dark.gold} />
                    <Text style={styles.driverRating}>
                      {ride.driver.rating?.toFixed(1) || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.countdownContainer}>
              <Text style={styles.countdownLabel}>Driver Response Time</Text>
              <Text style={styles.countdownText}>{countdownDisplay}</Text>
              <Text style={styles.countdownNote}>(Maximum 5 minutes)</Text>
            </View>

            <View style={styles.approvalMessageBox}>
              <AlertCircle size={20} color={Colors.dark.gold} />
              <Text style={styles.approvalMessage}>
                Your booking request has been sent to the driver. Please wait for their approval.
              </Text>
            </View>

            {/* Booking Request Details Card */}
            <View style={styles.bookingRequestCard}>
              <Text style={styles.bookingRequestTitle}>Booking Request Details</Text>
              
              {/* Route */}
              <View style={styles.requestRouteSection}>
                <View style={styles.requestRouteRow}>
                  <MapPin size={14} color={Colors.dark.gold} />
                  <Text style={styles.requestRouteText}>{ride.from}</Text>
                </View>
                <View style={styles.requestRouteLine} />
                <View style={styles.requestRouteRow}>
                  <MapPin size={14} color={Colors.dark.pink} />
                  <Text style={styles.requestRouteText}>{ride.to}</Text>
                </View>
              </View>

              {/* Seats and Fare */}
              <View style={styles.requestDetailRow}>
                <View style={styles.requestDetailItem}>
                  <Text style={styles.requestDetailLabel}>Requested Seats</Text>
                  <View style={styles.seatBadgeContainer}>
                    {requestedSeatNumbers.map((seat) => (
                      <View key={seat} style={styles.requestedSeatBadge}>
                        <Text style={styles.requestedSeatText}>{seat}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.requestDetailRow}>
                <View style={styles.requestDetailItem}>
                  <Text style={styles.requestDetailLabel}>Total Fare</Text>
                  <Text style={styles.requestDetailValueLarge}>₹{totalAmount}</Text>
                </View>
                <View style={styles.requestDetailItem}>
                  <Text style={styles.requestDetailLabel}>Departure Time</Text>
                  <Text style={styles.requestDetailValue}>
                    {new Date(ride.departureTime).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              {customRequest.trim() && (
                <View style={styles.customRequestSection}>
                  <Text style={styles.requestDetailLabel}>Special Request</Text>
                  <Text style={styles.customRequestText}>{customRequest}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleBack}>
              <Text style={styles.secondaryButtonText}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        );

      case 'payment':
        const canPayWithWallet = walletBalance >= totalAmount;

        return (
          <View style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <WalletIcon size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Choose Payment Method</Text>
            
            {/* Booking Summary */}
            <View style={styles.bookingDetailsCard}>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.bookingDetailLabel}>Approved Seats</Text>
                <View style={styles.seatBadgeContainer}>
                  {requestedSeatNumbers.map((seat) => (
                    <View key={seat} style={styles.approvedSeatBadge}>
                      <Text style={styles.approvedSeatText}>{seat}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.bookingDetailLabel}>Fare per seat</Text>
                <Text style={styles.bookingDetailValue}>₹{ride.farePerSeat}</Text>
              </View>
            </View>
            
            <View style={styles.fareBreakdown}>
              <Text style={styles.fareLabel}>
                {requestedSeatNumbers.length} Seat(s) × ₹{ride.farePerSeat}
              </Text>
              <Text style={styles.fareTotal}>₹{totalAmount}</Text>
            </View>

            {/* Wallet Balance */}
            <View style={styles.walletBalanceCard}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Wallet Balance</Text>
                <Text style={styles.balanceAmount}>₹{walletBalance.toFixed(2)}</Text>
              </View>
            </View>

            {/* Payment Options */}
            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'wallet' && styles.paymentOptionSelected,
                  !canPayWithWallet && styles.paymentOptionDisabled,
                ]}
                onPress={() => canPayWithWallet && setPaymentMethod('wallet')}
                disabled={!canPayWithWallet}>
                <View style={styles.paymentOptionLeft}>
                  <WalletIcon size={24} color={canPayWithWallet ? Colors.dark.gold : Colors.dark.textSecondary} />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionTitle, !canPayWithWallet && styles.disabledText]}>
                      Pay from Wallet
                    </Text>
                    <Text style={styles.paymentOptionSubtitle}>
                      {canPayWithWallet ? 'Instant payment' : 'Insufficient balance'}
                    </Text>
                  </View>
                </View>
                {paymentMethod === 'wallet' && (
                  <CheckCircle2 size={24} color={Colors.dark.gold} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  paymentMethod === 'upi' && styles.paymentOptionSelected,
                ]}
                onPress={() => setPaymentMethod('upi')}>
                <View style={styles.paymentOptionLeft}>
                  <CreditCard size={24} color={Colors.dark.gold} />
                  <View style={styles.paymentOptionText}>
                    <Text style={styles.paymentOptionTitle}>Pay via UPI/Card</Text>
                    <Text style={styles.paymentOptionSubtitle}>UPI, Card, Net Banking</Text>
                  </View>
                </View>
                {paymentMethod === 'upi' && (
                  <CheckCircle2 size={24} color={Colors.dark.gold} />
                )}
              </TouchableOpacity>
            </View>
            
            {/* Escrow Payment Notice */}
            <View style={styles.escrowNotice}>
              <ShieldCheck size={20} color={Colors.dark.gold} />
              <View style={styles.escrowText}>
                <Text style={styles.escrowTitle}>Secure Escrow Payment</Text>
                <Text style={styles.escrowDescription}>
                  Your payment is held securely and will only be released to the driver after successful ride completion. This protects both you and the driver.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (!paymentMethod || processingPayment) && styles.disabledButton]}
              disabled={!paymentMethod || processingPayment}
              onPress={handlePayment}>
              {processingPayment ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Pay ₹{totalAmount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'tracking':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <Navigation size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Ride in Progress</Text>
            <Text style={styles.stepDescription}>
              GPS tracking is active. You can open the live map to follow your driver in real time. Confirm drop-off when you exit so we can release the driver payout.
            </Text>
            <TouchableOpacity
              style={[styles.secondaryButton, !trackingActive && styles.disabledButton]}
              onPress={() => setShowTrackingMap(true)}
              disabled={!trackingActive}>
              <Text style={styles.secondaryButtonText}>
                {trackingActive ? 'Open Live Map' : 'Waiting for live tracking'}
              </Text>
            </TouchableOpacity>
            <View style={styles.statusCard}>
              <Text style={styles.statusCardLabel}>Passenger Status</Text>
              <View style={styles.statusCardRow}>
                <CheckCircle2 size={22} color={Colors.dark.success} />
                <Text style={styles.statusCardText}>Onboard & verified</Text>
              </View>
              <Text style={styles.statusCardSubtext}>Drop confirmation pending</Text>
            </View>
            <View style={styles.trackingInfo}>
              <Text style={styles.trackingLabel}>ETA to destination</Text>
              <Text style={styles.trackingValue}>{ride.duration}</Text>
            </View>
            <View style={styles.trackingInfo}>
              <Text style={styles.trackingLabel}>Distance remaining</Text>
              <Text style={styles.trackingValue}>{ride.distance}</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, completionLoading && styles.primaryButtonDisabled]}
              onPress={handleDropConfirmation}
              disabled={completionLoading}>
              {completionLoading ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Mark myself dropped off</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setChatModalVisible(true)}>
              <MessageSquare size={20} color={Colors.dark.gold} />
              <Text style={styles.secondaryButtonText}>Contact Driver</Text>
            </TouchableOpacity>
            <Text style={styles.escrowNote}>Driver payout releases after every passenger on the route is marked finished.</Text>
          </View>
        );

      case 'boarding':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <ShieldCheck size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Pickup Verification</Text>
            <Text style={styles.stepDescription}>
              {pickupLockedForResume
                ? 'Your booking is confirmed. The pickup button will unlock after the driver starts pickup for you.'
                : 'Driver has approved your booking. Confirm once you board the car to start tracking.'}
            </Text>
            
            {/* Booking Details Card */}
            <View style={styles.bookingDetailsCard}>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.bookingDetailLabel}>Approved Seats</Text>
                <View style={styles.seatBadgeContainer}>
                  {requestedSeatNumbers.map((seat) => (
                    <View key={seat} style={styles.approvedSeatBadge}>
                      <Text style={styles.approvedSeatText}>{seat}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.bookingDetailLabel}>Total Amount</Text>
                <Text style={styles.bookingDetailValue}>₹{totalAmount}</Text>
              </View>
              <View style={styles.bookingDetailRow}>
                <Text style={styles.bookingDetailLabel}>Status</Text>
                <View style={styles.approvalStatusBadge}>
                  <CheckCircle2 size={14} color={Colors.dark.success} />
                  <Text style={styles.approvalStatusText}>Approved by Driver</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.singleVerificationCard}>
              <Text style={styles.verificationQuestion}>Did you board the car?</Text>
              <Text style={styles.verificationHint}>
                Driver is waiting for your confirmation
              </Text>
            </View>
            <View style={styles.statusPillRow}>
              <View style={[styles.statusPill, pickupConfirmed && styles.statusPillActive]}>
                <UserCheck
                  size={20}
                  color={pickupConfirmed ? Colors.dark.background : Colors.dark.textSecondary}
                />
                <Text
                  style={[styles.statusPillText, pickupConfirmed && styles.statusPillTextActive]}>
                  {pickupConfirmed ? 'Onboard confirmed' : 'Waiting for confirmation'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (pickupActionLoading || pickupConfirmed || pickupLockedForResume) && styles.primaryButtonDisabled,
              ]}
              onPress={handlePickupConfirmation}
              disabled={pickupActionLoading || pickupLockedForResume}>
              {pickupActionLoading ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {pickupLockedForResume
                    ? 'Waiting for driver pickup'
                    : pickupConfirmed
                    ? 'Tracking Live'
                    : 'I boarded the car'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setChatModalVisible(true)}>
              <MessageSquare size={20} color={Colors.dark.gold} />
              <Text style={styles.secondaryButtonText}>Contact Driver</Text>
            </TouchableOpacity>
            <Text style={styles.escrowNote}>Escrow releases only after the passenger is marked dropped.</Text>
          </View>
        );

      case 'completed':
        return (
          <View style={styles.stepContent}>
            <View style={[styles.stepIcon, styles.successIcon]}>
              <CheckCircle2 size={48} color={Colors.dark.success} />
            </View>
            <Text style={styles.stepTitle}>Ride Completed!</Text>
            <Text style={styles.stepDescription}>
              Driver payout is being released now that every passenger is marked dropped. Thank you for riding respectfully!
            </Text>
            <View style={styles.completedFare}>
              <Text style={styles.completedFareLabel}>Total Fare</Text>
              <Text style={styles.completedFareValue}>
                ₹{totalAmount}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleClose}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
      }
    };

    return BookingModalStepContent;
  }, [step, requestedSeatNumbers, totalAmount, customRequest, customFare, paymentMethod, walletBalance, processingPayment, pickupConfirmed, approvalCountdown, completionLoading, creatingBooking, driverModeInfo.label, handleRequestContinue, handleSeatsContinue, onClose, pickupActionLoading, initialBooking, ride, showAlert, trackingActive, handlePayment, handleBack, handleClose, handlePickupConfirmation, handleDropConfirmation, renderSeatLayout]);

  // Early return after all hooks
  if (!ride) return null;

  const stepOrder: BookingStep[] = ['confirm', 'request', 'seats', 'approval-waiting', 'payment', 'boarding', 'tracking', 'completed'];
  const stepLabels: Record<BookingStep, string> = {
    confirm: 'Ride',
    request: 'Notes',
    seats: 'Seats',
    'approval-waiting': 'Approval',
    payment: 'Pay',
    boarding: 'Pickup',
    tracking: 'Live',
    completed: 'Done',
  };
  const currentStepIndex = Math.max(0, stepOrder.indexOf(step));

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        hardwareAccelerated={true}
        onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={[styles.backButton, step === 'confirm' && styles.hiddenButton]}
                onPress={handleBack}
                disabled={step === 'confirm'}>
                <ArrowLeft size={24} color={Colors.dark.text} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <View style={styles.headerIconBadge}>
                  <Car size={18} color={Colors.dark.background} />
                </View>
                <Text style={styles.headerStepLabel}>{stepLabels[step]}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}>
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.stepTracker}>
              {stepOrder.map((item, index) => {
                const active = index <= currentStepIndex;
                const current = item === step;
                return (
                  <View key={item} style={styles.stepTrackerItem}>
                    <View
                      style={[
                        styles.stepTrackerDot,
                        active && styles.stepTrackerDotActive,
                        current && styles.stepTrackerDotCurrent,
                      ]}
                    />
                    <Text
                      style={[
                        styles.stepTrackerText,
                        current && styles.stepTrackerTextCurrent,
                      ]}
                      numberOfLines={1}>
                      {stepLabels[item]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={8}
              decelerationRate="fast"
              bounces
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              contentContainerStyle={styles.modalScrollContent}>
              {renderStep()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Razorpay WebView Modal */}
      {showRazorpay && razorpayOrder && user && (
        <RazorpayWebView
          visible={showRazorpay}
          orderId={razorpayOrder.orderId}
          amount={razorpayOrder.amount}
          currency={razorpayOrder.currency}
          keyId={getRazorpayKeyId()}
          name="TripZa"
          description={`Ride from ${ride.from} to ${ride.to}`}
          prefill={{
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.email,
            contact: '',
          }}
          onSuccess={handleRazorpaySuccess}
          onFailure={handleRazorpayFailure}
          onClose={() => setShowRazorpay(false)}
        />
      )}

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />

      {ride && user && (
        <ChatModal
          visible={chatModalVisible}
          onClose={() => {
            console.log('🔍 [BOOKING] ChatModal closing');
            setChatModalVisible(false);
          }}
          rideId={ride.id}
          driverId={(() => {
            const driverId = ride.driverId || ride.driver?.name || 'driver';
            console.log('🔍 [BOOKING] Passing driverId to ChatModal:', driverId);
            console.log('🔍 [BOOKING] ride.driverId:', ride.driverId);
            console.log('🔍 [BOOKING] ride.driver?.name:', ride.driver?.name);
            return driverId;
          })()}
          driverName={ride.driver?.name || 'Driver'}
          driverPhone={ride.vehicle?.number}
          passengerId={user.id}
          passengerName={user.firstName || 'Passenger'}
          passengerPhone={user.email}
        />
      )}

      {showTrackingMap && (
        <Modal
          visible={showTrackingMap}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowTrackingMap(false)}>
          <RideTrackingMap
            rideId={ride.id}
            driverName={ride.driver?.name || 'Driver'}
            driverRating={ride.driver?.rating || 5}
            pickupLocation={trackingPickupLocation}
            dropoffLocation={trackingDropoffLocation}
            onClose={() => setShowTrackingMap(false)}
          />
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
  },
  modalContent: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: Colors.dark.backgroundSecondary,
    height: '100%',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
    ...Platform.select({
      web: { boxShadow: '0 -4px 8px rgba(0, 0, 0, 0.15)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    position: 'relative',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark.border + '40',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  headerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.dark.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.gold + '55',
  },
  headerStepLabel: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card + '80',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  hiddenButton: {
    opacity: 0,
    pointerEvents: 'none',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card + '80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTracker: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + '55',
  },
  stepTrackerItem: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    gap: 4,
  },
  stepTrackerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.border,
  },
  stepTrackerDotActive: {
    backgroundColor: Colors.dark.gold + '80',
  },
  stepTrackerDotCurrent: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.dark.gold,
  },
  stepTrackerText: {
    color: Colors.dark.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    maxWidth: 56,
  },
  stepTrackerTextCurrent: {
    color: Colors.dark.gold,
  },
  modalScroll: {
    flex: 1,
    marginHorizontal: 0,
  },
  modalScrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 140,
    flexGrow: 1,
  },
  stepContent: {
    alignItems: 'center',
    width: '100%',
    justifyContent: 'flex-start',
    paddingBottom: 20,
  },
  stepIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    backgroundColor: Colors.dark.success + '20',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  rideDetails: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  routeText: {
    color: Colors.dark.text,
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '500',
    flex: 1,
    minWidth: 0,
    lineHeight: 21,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.dark.border,
    marginLeft: 7,
    marginVertical: 6,
  },
  infoGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  infoGridClean: {
    width: '100%',
    marginBottom: 24,
    gap: 16,
  },
  modeCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: Colors.dark.card,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modeLabel: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modeTagline: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  modeDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    minWidth: 0,
    flexWrap: 'wrap',
    gap: 8,
  },
  compactModeBadge: {
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactModeText: {
    fontSize: 10,
    color: Colors.dark.gold,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  textInput: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    color: Colors.dark.text,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    minHeight: 56,
  },
  verificationGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  singleVerificationCard: {
    width: '100%',
    backgroundColor: Colors.dark.gold + '10',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  bookingDetailsCard: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  bookingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingDetailLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  bookingDetailValue: {
    color: Colors.dark.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  seatBadgeContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  approvedSeatBadge: {
    backgroundColor: Colors.dark.gold + '25',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '50',
  },
  approvedSeatText: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  approvalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.success + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  approvalStatusText: {
    color: Colors.dark.success,
    fontSize: 13,
    fontWeight: '600',
  },
  verificationQuestion: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationHint: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  verificationCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
  },
  verificationLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  verificationValue: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  statusPillRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.card,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statusPillActive: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  statusPillSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.border + '33',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statusPillText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  statusPillTextActive: {
    color: Colors.dark.background,
  },
  escrowNote: {
    marginTop: 16,
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  seatContainer: {
    width: '100%',
    marginBottom: 20,
    gap: 20,
  },
  seatRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  seat: {
    width: 80,
    height: 80,
    backgroundColor: Colors.dark.gold + '30',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.gold,
  },
  seatUnavailable: {
    backgroundColor: Colors.dark.border,
    borderColor: Colors.dark.border,
  },
  seatSelected: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  seatDriver: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    opacity: 0.6,
  },
  seatBooked: {
    backgroundColor: Colors.dark.border,
    borderColor: Colors.dark.border,
  },
  seatNumber: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  seatNumberUnavailable: {
    color: Colors.dark.textSecondary,
  },
  seatNumberDisabled: {
    color: Colors.dark.textSecondary,
    opacity: 0.7,
  },
  seatNumberSelected: {
    color: Colors.dark.background,
  },
  seatWrapper: {
    alignItems: 'center',
  },
  seatLabel: {
    marginTop: 6,
    fontSize: 10,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  rowLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginRight: 12,
    alignSelf: 'center',
    minWidth: 45,
  },
  seatLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  bikeNote: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '30',
  },
  bikeNoteText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  autoDriverRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  autoDriverSeat: {
    alignItems: 'center',
  },
  chatButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  chatButtonText: {
    color: Colors.dark.gold,
    fontSize: 15,
    fontWeight: '600',
  },
  escrowNotice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.dark.gold + '15',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '30',
  },
  escrowText: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 14,
    color: Colors.dark.gold,
    fontWeight: '700',
    marginBottom: 4,
  },
  escrowDescription: {
    fontSize: 12,
    color: Colors.dark.text,
    lineHeight: 18,
  },
  fareBreakdown: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  fareLabel: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  fareTotal: {
    fontSize: 24,
    color: Colors.dark.gold,
    fontWeight: '700',
  },
  trackingInfo: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  trackingLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  trackingValue: {
    fontSize: 20,
    color: Colors.dark.gold,
    fontWeight: '700',
  },
  statusCard: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    marginBottom: 16,
  },
  statusCardLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statusCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusCardText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  statusCardSubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  completedFare: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.dark.success,
  },
  completedFareLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  completedFareValue: {
    fontSize: 36,
    color: Colors.dark.success,
    fontWeight: '700',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Colors.dark.gold,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.backgroundSecondary,
    minHeight: 50,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
    gap: 8,
  },
  secondaryButtonText: {
    color: Colors.dark.gold,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  walletBalanceCard: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  balanceAmount: {
    fontSize: 20,
    color: Colors.dark.gold,
    fontWeight: '700',
  },
  paymentOptions: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  paymentOptionSelected: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '10',
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  paymentOptionText: {
    flex: 1,
    minWidth: 0,
  },
  paymentOptionTitle: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentOptionSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  disabledText: {
    color: Colors.dark.textSecondary,
  },
  // Approval waiting styles
  driverCard: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: Colors.dark.gold + '20',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    color: Colors.dark.gold,
    fontSize: 24,
    fontWeight: '800',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  driverRating: {
    fontSize: 13,
    color: Colors.dark.gold,
    fontWeight: '600',
  },
  countdownContainer: {
    width: '100%',
    backgroundColor: Colors.dark.gold + '15',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.dark.gold + '40',
  },
  countdownLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.dark.gold,
    fontVariant: ['tabular-nums'],
  },
  countdownNote: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
  approvalMessageBox: {
    width: '100%',
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.gold,
  },
  approvalMessage: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  bookingRequestCard: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '30',
    gap: 16,
  },
  bookingRequestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  requestRouteSection: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  requestRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestRouteText: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '600',
    flex: 1,
  },
  requestRouteLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.dark.border,
    marginLeft: 6,
  },
  requestDetailRow: {
    flexDirection: 'row',
    gap: 12,
  },
  requestDetailItem: {
    flex: 1,
    gap: 6,
  },
  requestDetailLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  requestDetailValue: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '600',
  },
  requestDetailValueLarge: {
    fontSize: 20,
    color: Colors.dark.gold,
    fontWeight: '700',
  },
  requestedSeatBadge: {
    backgroundColor: Colors.dark.gold + '20',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  requestedSeatText: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  customRequestSection: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  customRequestText: {
    fontSize: 13,
    color: Colors.dark.text,
    lineHeight: 18,
  },
  bookingDetailsBox: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  detailRow_last: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
});
