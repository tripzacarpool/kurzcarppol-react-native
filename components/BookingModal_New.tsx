import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import {
  X,
  Check,
  MapPin,
  Clock,
  Users,
  DollarSign,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Ride } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import CustomAlert, { AlertType } from './CustomAlert';

const { height: screenHeight } = Dimensions.get('window');

interface BookingModalProps {
  visible: boolean;
  ride: Ride | null;
  onClose: () => void;
}

type BookingStep = 'confirm' | 'payment' | 'completed';

export function BookingModal({ visible, ride, onClose }: BookingModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<BookingStep>('confirm');
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as AlertType,
  });

  const showAlert = useCallback(
    (title: string, message: string, type: AlertType = 'info') => {
      setAlertConfig({ title, message, type });
      setAlertVisible(true);
    },
    []
  );

  const hideAlert = useCallback(() => {
    setAlertVisible(false);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setStep('confirm');
      setSelectedSeats([]);
    }
  }, [visible]);

  if (!ride) return null;

  const totalAmount = selectedSeats.length * ride.farePerSeat;

  const handleSeatSelect = useCallback((seatNumber: number) => {
    setSelectedSeats((prev) => {
      if (prev.includes(seatNumber)) {
        return prev.filter((s) => s !== seatNumber);
      }
      return [...prev, seatNumber];
    });
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'payment' || step === 'completed') {
      setStep('confirm');
    }
  }, [step]);

  const handleClose = useCallback(() => {
    setStep('confirm');
    setSelectedSeats([]);
    onClose();
  }, [onClose]);

  const renderModalHeader = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.handleBar} />
        {step !== 'confirm' && (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <ArrowLeft size={20} color={Colors.dark.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <X size={24} color={Colors.dark.text} />
        </TouchableOpacity>
      </View>
    ),
    [step, handleBack, handleClose]
  );

  const renderConfirmStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <View style={styles.successIcon}>
          <Check size={48} color={Colors.dark.gold} />
        </View>
        <Text style={styles.stepTitle}>Confirm Your Ride</Text>

        {/* Route Info */}
        <View style={styles.routeCard}>
          <View style={styles.routeItem}>
            <MapPin size={20} color={Colors.dark.gold} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>From</Text>
              <Text style={styles.routeText}>{ride.from}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.routeItem}>
            <MapPin size={20} color={Colors.dark.pink} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>To</Text>
              <Text style={styles.routeText}>{ride.to}</Text>
            </View>
          </View>
        </View>

        {/* Driver & Ride Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Driver</Text>
            <Text style={styles.infoValue}>{ride.driver.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle</Text>
            <Text style={styles.infoValue}>{ride.vehicle.model}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Seats Available</Text>
            <Text style={styles.infoValue}>{ride.availableSeats.length}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Fare/Seat</Text>
            <Text style={[styles.infoValue, { color: Colors.dark.gold }]}>
              ₹{ride.farePerSeat}
            </Text>
          </View>
        </View>

        {/* Seat Selection */}
        <View style={styles.seatsSection}>
          <Text style={styles.sectionTitle}>Select Seats</Text>
          <View style={styles.seatsGrid}>
            {[1, 2, 3, 4].map((seatNum) => {
              const isAvailable = ride.availableSeats.includes(seatNum);
              const isSelected = selectedSeats.includes(seatNum);

              return (
                <TouchableOpacity
                  key={seatNum}
                  disabled={!isAvailable}
                  onPress={() => handleSeatSelect(seatNum)}
                  style={[
                    styles.seatBtn,
                    !isAvailable && styles.seatUnavailable,
                    isSelected && styles.seatSelected,
                  ]}>
                  <Text
                    style={[
                      styles.seatText,
                      !isAvailable && styles.seatTextUnavailable,
                      isSelected && styles.seatTextSelected,
                    ]}>
                    {seatNum}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Seats Summary */}
        {selectedSeats.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              {selectedSeats.length} Seat(s) × ₹{ride.farePerSeat}
            </Text>
            <Text style={styles.summaryAmount}>₹{totalAmount}</Text>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            selectedSeats.length === 0 && styles.actionBtnDisabled,
          ]}
          disabled={selectedSeats.length === 0}
          onPress={() => setStep('payment')}>
          <Text style={styles.actionBtnText}>
            {selectedSeats.length === 0 ? 'Select Seats' : 'Proceed to Payment'}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [ride, selectedSeats, totalAmount, handleSeatSelect]
  );

  const renderPaymentStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <View style={styles.paymentIcon}>
          <DollarSign size={48} color={Colors.dark.gold} />
        </View>
        <Text style={styles.stepTitle}>Payment</Text>
        <Text style={styles.stepSubtitle}>Amount to pay</Text>

        <View style={styles.amountCard}>
          <Text style={styles.amountText}>₹{totalAmount}</Text>
        </View>

        <View style={styles.paymentMethods}>
          <TouchableOpacity
            style={[styles.paymentMethod, styles.paymentMethodActive]}>
            <View style={styles.methodIcon}>
              <DollarSign size={24} color={Colors.dark.gold} />
            </View>
            <Text style={styles.methodText}>Wallet</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            setStep('completed');
          }}>
          <Text style={styles.actionBtnText}>Pay ₹{totalAmount}</Text>
        </TouchableOpacity>
      </View>
    ),
    [totalAmount]
  );

  const renderCompletedStep = useMemo(
    () => (
      <View style={styles.stepContainer}>
        <View style={styles.completedIcon}>
          <CheckCircle2 size={64} color={Colors.dark.success} />
        </View>
        <Text style={styles.stepTitle}>Booking Confirmed!</Text>
        <Text style={styles.stepSubtitle}>Your ride is confirmed</Text>

        <View style={styles.confirmationCard}>
          <View style={styles.confirmationRow}>
            <Users size={20} color={Colors.dark.gold} />
            <Text style={styles.confirmationText}>
              {selectedSeats.length} Seat(s) Booked
            </Text>
          </View>
          <View style={styles.confirmationRow}>
            <DollarSign size={20} color={Colors.dark.gold} />
            <Text style={styles.confirmationText}>₹{totalAmount} Paid</Text>
          </View>
          <View style={styles.confirmationRow}>
            <Clock size={20} color={Colors.dark.gold} />
            <Text style={styles.confirmationText}>{ride.departureTime}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.actionBtn} onPress={handleClose}>
          <Text style={styles.actionBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    ),
    [selectedSeats, totalAmount, ride, handleClose]
  );

  const renderContent = useMemo(() => {
    switch (step) {
      case 'confirm':
        return renderConfirmStep;
      case 'payment':
        return renderPaymentStep;
      case 'completed':
        return renderCompletedStep;
      default:
        return null;
    }
  }, [step, renderConfirmStep, renderPaymentStep, renderCompletedStep]);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        hardwareAccelerated={true}
        onRequestClose={handleClose}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            {renderModalHeader}
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={8}
              decelerationRate="fast"
              bounces={false}
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentInner}>
              {renderContent}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type as AlertType}
        onClose={hideAlert}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: screenHeight * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.dark.border + '30',
    position: 'relative',
  },
  handleBar: {
    width: 50,
    height: 5,
    backgroundColor: Colors.dark.gold,
    borderRadius: 2.5,
    marginBottom: 8,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card + '60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card + '60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  paymentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  completedIcon: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  routeCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
    gap: 12,
  },
  routeItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border + '30',
  },
  infoCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  seatsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  seatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 12,
  },
  seatBtn: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seatSelected: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  seatUnavailable: {
    backgroundColor: Colors.dark.border,
    borderColor: Colors.dark.border,
    opacity: 0.5,
  },
  seatText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  seatTextSelected: {
    color: Colors.dark.background,
  },
  seatTextUnavailable: {
    color: Colors.dark.textSecondary,
  },
  summaryCard: {
    backgroundColor: Colors.dark.gold + '15',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.gold,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.gold,
  },
  amountCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: Colors.dark.gold + '40',
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.dark.gold,
  },
  paymentMethods: {
    gap: 12,
    marginBottom: 20,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    padding: 14,
  },
  paymentMethodActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '10',
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    flex: 1,
  },
  confirmationCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  confirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmationText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    flex: 1,
  },
  actionBtn: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.background,
  },
});
