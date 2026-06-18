import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { approveBooking, rejectBooking } from '../lib/api';
import { Colors } from '../constants/Colors';

interface ApprovalRequestModalProps {
  visible: boolean;
  onClose: () => void;
  booking?: any;
  ride?: any;
  driverId: string;
  onApprovalChange?: () => void;
}

export default function ApprovalRequestModal({
  visible,
  onClose,
  booking,
  ride,
  driverId,
  onApprovalChange,
}: ApprovalRequestModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState('');

  // Calculate approval deadline countdown
  const getDeadlineCountdown = useCallback(() => {
    if (!booking?.driverApprovalDeadline) return null;
    const deadline = new Date(booking.driverApprovalDeadline).getTime();
    const now = new Date().getTime();
    const diff = deadline - now;

    if (diff <= 0) return '⏰ EXPIRED';

    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [booking?.driverApprovalDeadline]);

  const [countdown, setCountdown] = useState(getDeadlineCountdown());

  // Update countdown every second
  useEffect(() => {
    if (!visible || !booking) return;

    const interval = setInterval(() => {
      setCountdown(getDeadlineCountdown());
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, booking, getDeadlineCountdown]);

  const handleApprove = async () => {
    if (!booking?._id) {
      Alert.alert('Error', 'Booking ID not found');
      return;
    }

    setIsLoading(true);
    try {
      const result = await approveBooking(booking._id, driverId, notes);
      if (result.success) {
        setNotes('');
        onApprovalChange?.();
        onClose();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve booking');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!booking?._id) {
      Alert.alert('Error', 'Booking ID not found');
      return;
    }

    setIsLoading(true);
    try {
      const result = await rejectBooking(booking._id, driverId, 'Rejected by driver');
      if (result.success) {
        onApprovalChange?.();
        onClose();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject booking');
    } finally {
      setIsLoading(false);
    }
  };

  if (!booking) return null;

  const passengerName = booking.userDetails?.name || 'Passenger';
  const passengerRating = booking.userDetails?.rating || 4.5;
  const passengerTrips = booking.userDetails?.tripCount || 0;
  const passengerPhone = booking.userDetails?.phone || 'Not provided';
  const pickupPoint = booking.from || 'Not specified';
  const dropPoint = booking.to || 'Not specified';
  const seatsRequested = booking.seatNumbers?.length || 1;
  const seatNumbers = booking.seatNumbers?.join(', ') || 'N/A';
  const requestTime = new Date(booking.approvalRequestedAt).toLocaleTimeString();
  const departureTime = booking.departureTime ? new Date(booking.departureTime).toLocaleString() : 'Not specified';
  const fare = booking.fare || 0;
  const customRequest = booking.customRequest || '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View />
      </TouchableOpacity>
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={[Colors.dark.gold, Colors.dark.goldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>🔔 Booking Request</Text>
            <Text style={styles.coundownText}>{countdown}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={Colors.dark.background} />
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Passenger Info Card */}
          <View style={styles.card}>
            <View style={styles.passengerHeader}>
              <View style={styles.passengerInfo}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {passengerName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.passengerDetails}>
                  <Text style={styles.passengerName}>{passengerName}</Text>
                  <View style={styles.ratingRow}>
                    <MaterialIcons name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingText}>
                      {passengerRating.toFixed(1)} • {passengerTrips} trips
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Status Badges */}
            <View style={styles.badgesRow}>
              <View style={styles.badge}>
                <Feather name="check-circle" size={14} color="#4CAF50" />
                <Text style={[styles.badgeText, { color: '#4CAF50' }]}>
                  Verified Passenger
                </Text>
              </View>
              {passengerRating >= 4.5 && (
                <View style={styles.badge}>
                  <MaterialIcons name="verified-user" size={14} color="#2196F3" />
                  <Text style={[styles.badgeText, { color: '#2196F3' }]}>
                    Trusted Member
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Trip Details */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📍 Trip Details</Text>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="map-pin" size={18} color="#FF6B6B" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Pickup</Text>
                <Text style={styles.detailValue}>{pickupPoint}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="flag" size={18} color="#4CAF50" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Dropoff</Text>
                <Text style={styles.detailValue}>{dropPoint}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="users" size={18} color="#9C27B0" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Seats Requested</Text>
                <Text style={styles.detailValue}>{seatsRequested} seat(s) - Seat #{seatNumbers}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="calendar" size={18} color="#2196F3" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Departure Time</Text>
                <Text style={styles.detailValue}>{departureTime}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <MaterialIcons name="payments" size={18} color={Colors.dark.gold} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Total Fare</Text>
                <Text style={[styles.detailValue, { color: Colors.dark.gold, fontWeight: '700' }]}>₹{fare}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Feather name="clock" size={18} color="#FFA500" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Request Time</Text>
                <Text style={styles.detailValue}>{requestTime}</Text>
              </View>
            </View>

            {passengerPhone && passengerPhone !== 'Not provided' && (
              <>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Feather name="phone" size={18} color="#4CAF50" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{passengerPhone}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Custom Request/Message */}
          {customRequest && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>💬 Passenger's Message</Text>
              <View style={styles.customRequestBox}>
                <Text style={styles.customRequestText}>{customRequest}</Text>
              </View>
            </View>
          )}

          {/* Notes Section (for approval) */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>💬 Add Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g., 'I need to confirm your luggage size' or 'Great ratings!'"
              placeholderTextColor={Colors.dark.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{notes.length}/200</Text>
          </View>

          {/* Payment Info */}
          <View style={[styles.card, styles.paymentInfoCard]}>
            <View style={styles.paymentInfoHeader}>
              <MaterialIcons name="info" size={20} color={Colors.dark.gold} />
              <Text style={styles.paymentInfoTitle}>Payment Process</Text>
            </View>
            <Text style={styles.paymentInfoText}>
              After you approve, the booking is confirmed immediately. Passenger will pay <Text style={styles.paymentAmount}>₹{fare}</Text> after the ride is completed.
            </Text>
          </View>

          {/* Safety Tips */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🛡️ Important Notes</Text>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Check passenger rating and reviews before approving
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Booking is confirmed immediately upon your approval
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Payment collected from passenger after ride completion
              </Text>
            </View>
            <View style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                You can message passenger through the chat feature
              </Text>
            </View>
          </View>

          <View style={styles.spacer} />
        </ScrollView>

        {/* Action Buttons */}
        <LinearGradient
          colors={[Colors.dark.card, Colors.dark.backgroundSecondary]}
          style={styles.buttonContainer}
        >
          <TouchableOpacity
            style={[
              styles.button,
              styles.rejectButton,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleReject}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#E74C3C" size="small" />
            ) : (
              <>
                <Feather name="x-circle" size={18} color="#E74C3C" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.approveButton,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleApprove}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={styles.approveButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Platform.OS === 'ios' ? 40 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.background,
    marginBottom: 4,
  },
  coundownText: {
    fontSize: 14,
    color: Colors.dark.background,
    opacity: 0.9,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  rejectCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.error,
  },
  passengerHeader: {
    marginBottom: 12,
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.background,
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginLeft: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.backgroundSecondary,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    textAlign: 'right',
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 14,
    color: Colors.dark.warning,
    marginRight: 8,
    fontWeight: 'bold',
  },
  tipText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  customRequestBox: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.gold,
    borderRadius: 8,
    padding: 12,
  },
  customRequestText: {
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  paymentInfoCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.gold,
  },
  paymentInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  paymentInfoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
  paymentInfoText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  spacer: {
    height: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: Colors.dark.success,
  },
  approveButtonText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: Colors.dark.card,
    borderWidth: 2,
    borderColor: Colors.dark.error,
  },
  rejectButtonText: {
    color: Colors.dark.error,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.dark.border,
  },
  cancelButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmRejectButton: {
    backgroundColor: Colors.dark.error,
  },
  confirmRejectButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
