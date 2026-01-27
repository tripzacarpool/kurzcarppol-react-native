import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Check, MapPin, MessageSquare, Armchair, Navigation, CheckCircle2, ArrowLeft, Wallet as WalletIcon, CreditCard, ShieldCheck, UserCheck, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Ride } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { RazorpayWebView } from './RazorpayWebView';
import { DRIVER_MODE_META } from '@/constants/driverModes';
import CustomAlert, { AlertType } from './CustomAlert';
import {
  processWalletPayment,
  getWalletBalance,
  createRazorpayOrder,
  verifyPayment,
  getRazorpayKeyId,
  RazorpayOrderResponse,
} from '@/lib/razorpay';

interface BookingModalProps {
  visible: boolean;
  ride: Ride | null;
  onClose: () => void;
}

type BookingStep = 'confirm' | 'request' | 'seats' | 'payment' | 'boarding' | 'tracking' | 'completed';

export function BookingModal({ visible, ride, onClose }: BookingModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<BookingStep>('confirm');
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [customRequest, setCustomRequest] = useState('');
  const [customFare, setCustomFare] = useState('');
  const [pickupConfirmed, setPickupConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi' | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderResponse | null>(null);
  
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

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setStep('confirm');
      setSelectedSeats([]);
      setCustomRequest('');
      setCustomFare('');
      setPickupConfirmed(false);
      setPaymentMethod(null);
      setProcessingPayment(false);
    }
  }, [visible]);

  // Load wallet balance when payment step is reached
  useEffect(() => {
    if (step === 'payment' && user?.id) {
      loadWalletBalance();
    }
  }, [step, user]);

  const loadWalletBalance = async () => {
    if (!user?.id) return;
    try {
      const balance = await getWalletBalance(user.id);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Error loading wallet balance:', error);
    }
  };

  if (!ride) return null;

  const totalAmount = selectedSeats.length * ride.farePerSeat;
  const driverModeInfo = DRIVER_MODE_META[ride.driverMode];

  const handleBack = useCallback(() => {
    switch (step) {
      case 'request':
        setStep('confirm');
        break;
      case 'seats':
        setStep('request');
        break;
      case 'payment':
        setStep('seats');
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
  }, [step, onClose]);

  const handleClose = useCallback(() => {
    setStep('confirm');
    setSelectedSeats([]);
    setCustomRequest('');
    setCustomFare('');
    setPickupConfirmed(false);
    setPaymentMethod(null);
    setProcessingPayment(false);
    onClose();
  }, [onClose]);

  const handlePayment = useCallback(async () => {
    if (!paymentMethod || !user?.id) return;

    setProcessingPayment(true);

    try {
      if (paymentMethod === 'wallet') {
        // Process wallet payment
        const result = await processWalletPayment(user.id, totalAmount, {
          rideId: ride.id,
          from: ride.from,
          to: ride.to,
          seats: selectedSeats,
        });

        if (result.success) {
          showAlert('Success', 'Payment secured in escrow. Driver will receive it after drop-off.', 'success');
          setPickupConfirmed(false);
          setStep('boarding');
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
          seats: selectedSeats,
        });

        setRazorpayOrder(order);
        setProcessingPayment(false);
        setShowRazorpay(true);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      showAlert('Error', error.message || 'Payment failed', 'error');
      setProcessingPayment(false);
    }
  }, [paymentMethod, user?.id, totalAmount, ride, selectedSeats]);

  const handleRazorpaySuccess = useCallback(async (paymentId: string, orderId: string, signature: string) => {
    try {
      setShowRazorpay(false);
      setProcessingPayment(true);

      const verified = await verifyPayment(orderId, paymentId, signature);
      
      if (verified) {
        showAlert('Success!', 'Payment secured in escrow. Confirm pickup to start tracking.', 'success');
        setTimeout(() => {
          setPickupConfirmed(false);
          setStep('boarding');
        }, 1500);
      } else {
        showAlert('Error', 'Payment verification failed. Please contact support.', 'error');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      showAlert('Error', 'Payment verification failed', 'error');
    } finally {
      setProcessingPayment(false);
    }
  }, []);

  const handleRazorpayFailure = useCallback((error: string) => {
    setShowRazorpay(false);
    showAlert('Payment Failed', error, 'error');
  }, []);

  const handlePickupConfirmation = useCallback(() => {
    setPickupConfirmed(true);
    setStep('tracking');
  }, []);

  const handleDropConfirmation = useCallback(() => {
    setStep('completed');
  }, []);

  const handleSeatSelect = useCallback((seatNumber: number) => {
    setSelectedSeats((prev) => {
      if (prev.includes(seatNumber)) {
        return prev.filter((s) => s !== seatNumber);
      } else {
        return [...prev, seatNumber];
      }
    });
  }, []);

  const handleSeatsContinue = useCallback(() => {
    setStep('payment');
  }, []);

  const handleRequestContinue = useCallback(() => {
    setStep('seats');
  }, []);

  const renderSeatLayout = useMemo(() => {
    const rows = 2;
    const seatsPerRow = [2, 2];
    let seatCounter = 1;

    return (
      <View style={styles.seatContainer}>
        {[...Array(rows)].map((_, rowIndex) => (
          <View key={rowIndex} style={styles.seatRow}>
            {[...Array(seatsPerRow[rowIndex])].map((_, seatIndex) => {
              const seatNumber = seatCounter++;
              const isAvailable = ride.availableSeats.includes(seatNumber);
              const isSelected = selectedSeats.includes(seatNumber);

              return (
                <TouchableOpacity
                  key={seatNumber}
                  style={[
                    styles.seat,
                    !isAvailable && styles.seatUnavailable,
                    isSelected && styles.seatSelected,
                  ]}
                  disabled={!isAvailable}
                  onPress={() => handleSeatSelect(seatNumber)}>
                  <Armchair
                    size={32}
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
                      !isAvailable && styles.seatNumberUnavailable,
                      isSelected && styles.seatNumberSelected,
                    ]}>
                    {seatNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  }, [selectedSeats, handleSeatSelect, ride?.availableSeats]);

  const renderStep = useMemo(() => {
    return () => {
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
                <Text style={styles.infoValue}>{ride.driver.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Departure</Text>
                <Text style={styles.infoValue}>{ride.departureTime}</Text>
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
            <View style={styles.modeCard}>
              <Text style={styles.modeLabel}>{driverModeInfo.label}</Text>
              <Text style={styles.modeTagline}>{driverModeInfo.tagline}</Text>
              <Text style={styles.modeDescription}>{driverModeInfo.description}</Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setStep('request')}>
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
            <Text style={styles.stepTitle}>Custom Request (Optional)</Text>
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
            <Text style={styles.stepTitle}>Select Your Seat</Text>
            {renderSeatLayout}
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
            </View>
            {selectedSeats.length > 0 && (
              <View style={styles.fareBreakdown}>
                <Text style={styles.fareLabel}>
                  {selectedSeats.length} Seat(s) × ₹{ride.farePerSeat}
                </Text>
                <Text style={styles.fareTotal}>₹{selectedSeats.length * ride.farePerSeat}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, selectedSeats.length === 0 && styles.disabledButton]}
              disabled={selectedSeats.length === 0}
              onPress={handleSeatsContinue}>
              <Text style={styles.primaryButtonText}>Proceed to Payment</Text>
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
            <View style={styles.fareBreakdown}>
              <Text style={styles.fareLabel}>
                {selectedSeats.length} Seat(s) × ₹{ride.farePerSeat}
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
              GPS tracking is active. Confirm drop-off when you exit so we can release the driver payout.
            </Text>
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
              style={styles.primaryButton}
              onPress={handleDropConfirmation}>
              <Text style={styles.primaryButtonText}>Mark myself dropped off</Text>
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
              Funds stay in escrow until either you or the driver confirm pickup. The same confirmation happens again at drop-off.
            </Text>
            <View style={styles.verificationGrid}>
              <View style={styles.verificationCard}>
                <Text style={styles.verificationLabel}>Driver Sees</Text>
                <Text style={styles.verificationValue}>“Passenger picked up?”</Text>
              </View>
              <View style={styles.verificationCard}>
                <Text style={styles.verificationLabel}>Passenger Sees</Text>
                <Text style={styles.verificationValue}>“Did you board the car?”</Text>
              </View>
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
              <View style={styles.statusPillSecondary}>
                <Clock size={18} color={Colors.dark.textSecondary} />
                <Text style={styles.statusPillText}>Auto tracking after pickup</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handlePickupConfirmation}>
              <Text style={styles.primaryButtonText}>I boarded the car</Text>
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
                ₹{selectedSeats.length * ride.farePerSeat}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleClose}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };
  }, [step, selectedSeats, customRequest, customFare, paymentMethod, walletBalance, processingPayment, pickupConfirmed, ride?.id, ride?.from, ride?.to, ride?.driver?.name, ride?.farePerSeat, ride?.availableSeats, ride?.driverMode, user?.id, handlePayment, handleRazorpaySuccess, handleRazorpayFailure, handleBack, handleClose, handlePickupConfirmation, handleDropConfirmation, handleSeatSelect, renderSeatLayout]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        hardwareAccelerated={true}
        onRequestClose={onClose}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={onClose}>
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity
                style={[styles.backButton, step === 'confirm' && styles.hiddenButton]}
                onPress={handleBack}
                disabled={step === 'confirm'}>
                <ArrowLeft size={24} color={Colors.dark.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}>
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={8}
              decelerationRate="fast"
              bounces={false}
              removeClippedSubviews={true}
              nestedScrollEnabled={false}
              contentContainerStyle={styles.modalScrollContent}>
              {renderStep()}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Razorpay WebView Modal */}
      {showRazorpay && razorpayOrder && user && (
        <RazorpayWebView
          visible={showRazorpay}
          orderId={razorpayOrder.orderId}
          amount={razorpayOrder.amount}
          currency={razorpayOrder.currency}
          keyId={getRazorpayKeyId()}
          name="KruZ"
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
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '80%',
    marginBottom: 65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    position: 'relative',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark.border + '40',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalHandle: {
    width: 48,
    height: 5,
    backgroundColor: Colors.dark.gold + '60',
    borderRadius: 2.5,
    marginBottom: 12,
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
  modalScroll: {
    flex: 1,
    marginHorizontal: 0,
  },
  modalScrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 40,
    flexGrow: 1,
  },
  stepContent: {
    alignItems: 'center',
    minHeight: '100%',
    justifyContent: 'flex-start',
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
  },
  routeText: {
    color: Colors.dark.text,
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '500',
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
  seatNumber: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  seatNumberUnavailable: {
    color: Colors.dark.textSecondary,
  },
  seatNumberSelected: {
    color: Colors.dark.background,
  },
  seatLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '600',
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
  },
  paymentOptionText: {
    flex: 1,
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
});
