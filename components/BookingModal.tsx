import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { X, Check, MapPin, MessageSquare, Armchair, KeyRound, Navigation, CheckCircle2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Ride } from '@/types';
import Animated from 'react-native-reanimated';
import { FadeIn, SlideInDown } from 'react-native-reanimated';

interface BookingModalProps {
  visible: boolean;
  ride: Ride | null;
  onClose: () => void;
}

type BookingStep = 'confirm' | 'request' | 'seats' | 'otp' | 'tracking' | 'completed';

export function BookingModal({ visible, ride, onClose }: BookingModalProps) {
  const [step, setStep] = useState<BookingStep>('confirm');
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [customRequest, setCustomRequest] = useState('');
  const [customFare, setCustomFare] = useState('');
  const [otp, setOtp] = useState('');

  if (!ride) return null;

  const handleSeatSelect = (seatNumber: number) => {
    if (selectedSeats.includes(seatNumber)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seatNumber));
    } else {
      setSelectedSeats([...selectedSeats, seatNumber]);
    }
  };

  const renderSeatLayout = () => {
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
  };

  const renderStep = () => {
    switch (step) {
      case 'confirm':
        return (
          <Animated.View entering={FadeIn} style={styles.stepContent}>
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
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Driver</Text>
                <Text style={styles.infoValue}>{ride.driver.name}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Departure</Text>
                <Text style={styles.infoValue}>{ride.departureTime}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Vehicle</Text>
                <Text style={styles.infoValue}>{ride.vehicle.model}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Fare/Seat</Text>
                <Text style={styles.infoValue}>₹{ride.farePerSeat}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setStep('request')}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      case 'request':
        return (
          <Animated.View entering={FadeIn} style={styles.stepContent}>
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
              onPress={() => setStep('seats')}>
              <Text style={styles.primaryButtonText}>Select Seats</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setStep('seats')}>
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      case 'seats':
        return (
          <Animated.View entering={FadeIn} style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <Armchair size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Select Your Seat</Text>
            {renderSeatLayout()}
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
              onPress={() => setStep('otp')}>
              <Text style={styles.primaryButtonText}>Confirm Booking</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      case 'otp':
        return (
          <Animated.View entering={FadeIn} style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <KeyRound size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Enter OTP</Text>
            <Text style={styles.stepDescription}>
              Driver will provide a 4-digit OTP to start the ride
            </Text>
            <TextInput
              style={[styles.textInput, styles.otpInput]}
              placeholder="Enter OTP"
              placeholderTextColor={Colors.dark.textSecondary}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TouchableOpacity
              style={[styles.primaryButton, otp.length !== 4 && styles.disabledButton]}
              disabled={otp.length !== 4}
              onPress={() => setStep('tracking')}>
              <Text style={styles.primaryButtonText}>Start Ride</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      case 'tracking':
        return (
          <Animated.View entering={FadeIn} style={styles.stepContent}>
            <View style={styles.stepIcon}>
              <Navigation size={32} color={Colors.dark.gold} />
            </View>
            <Text style={styles.stepTitle}>Ride in Progress</Text>
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
              onPress={() => setStep('completed')}>
              <Text style={styles.primaryButtonText}>Complete Ride</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      case 'completed':
        return (
          <Animated.View entering={FadeIn} style={styles.stepContent}>
            <View style={[styles.stepIcon, styles.successIcon]}>
              <CheckCircle2 size={48} color={Colors.dark.success} />
            </View>
            <Text style={styles.stepTitle}>Ride Completed!</Text>
            <Text style={styles.stepDescription}>
              Thank you for choosing KruZ. Have a great day!
            </Text>
            <View style={styles.completedFare}>
              <Text style={styles.completedFareLabel}>Total Fare</Text>
              <Text style={styles.completedFareValue}>
                ₹{selectedSeats.length * ride.farePerSeat}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setStep('confirm');
                setSelectedSeats([]);
                setCustomRequest('');
                setCustomFare('');
                setOtp('');
                onClose();
              }}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View entering={SlideInDown.springify()} style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHandle} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setStep('confirm');
                setSelectedSeats([]);
                setCustomRequest('');
                setCustomFare('');
                setOtp('');
                onClose();
              }}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}>
            {renderStep()}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    position: 'relative',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  stepContent: {
    alignItems: 'center',
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
  infoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
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
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
