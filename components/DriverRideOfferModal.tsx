import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, MapPin, Users, DollarSign, FileText } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { createDriverRideOffer } from '@/lib/api';
import CustomAlert, { AlertType } from './CustomAlert';
import {
  VEHICLE_TYPE_OPTIONS,
  type RideVehicleType,
} from '@/constants/vehicleTypes';

interface DriverRideOfferModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (offer?: {
    id?: string;
    from: string;
    to: string;
    passengers: number;
    fare?: number;
    womenOnly?: boolean;
    createdAt?: string;
  }) => void;
}

export default function DriverRideOfferModal({
  visible,
  onClose,
  onSuccess,
}: DriverRideOfferModalProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [passengers, setPassengers] = useState('2');
  const [fare, setFare] = useState('');
  const [notes, setNotes] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [vehicleType, setVehicleType] = useState<RideVehicleType>('four_wheeler');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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

  const handleSubmit = async () => {
    if (!from.trim() || !to.trim()) {
      showAlert('Error', 'Please enter pickup and dropoff locations', 'error');
      return;
    }

    const passengerCount = parseInt(passengers);
    if (isNaN(passengerCount) || passengerCount < 1 || passengerCount > 4) {
      showAlert('Error', 'Passengers must be between 1 and 4', 'error');
      return;
    }

    const fareAmount = fare ? parseFloat(fare) : 0;
    if (fare && (isNaN(fareAmount) || fareAmount < 0)) {
      showAlert('Error', 'Please enter a valid fare amount', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        from: from.trim(),
        to: to.trim(),
        passengers: passengerCount,
        vehicleType,
        fare: fareAmount,
        notes: notes.trim(),
        womenOnly,
      };

      const response = await createDriverRideOffer(payload);
      const offerPayload = {
        id: response?.offer?.id || response?.id,
        ...payload,
        passengers: passengerCount,
        createdAt: new Date().toISOString(),
      };

      console.log('✅ Driver ride offer created:', response);
      showAlert('Success', 'Your ride offer has been created! Passengers can now see and book it.', 'success');
      setTimeout(() => {
        handleClose();
        onSuccess?.(offerPayload);
      }, 1500);
    } catch (error) {
      console.error('❌ Error creating ride offer:', error);
      showAlert('Error', 'Failed to create ride offer. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFrom('');
    setTo('');
    setPassengers('2');
    setFare('');
    setNotes('');
    setWomenOnly(false);
    setVehicleType('four_wheeler');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Offer a Ride</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <MapPin size={16} color={Colors.dark.gold} />
                  <Text style={styles.label}>From</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Pickup location"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={from}
                  onChangeText={setFrom}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <MapPin size={16} color={Colors.dark.pink} />
                  <Text style={styles.label}>To</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Dropoff location"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={to}
                  onChangeText={setTo}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <View style={styles.inputLabel}>
                    <Users size={16} color={Colors.dark.gold} />
                    <Text style={styles.label}>Seats</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="1-4"
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={passengers}
                    onChangeText={setPassengers}
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                </View>

                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <View style={styles.inputLabel}>
                    <DollarSign size={16} color={Colors.dark.gold} />
                    <Text style={styles.label}>Fare (₹)</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional"
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={fare}
                    onChangeText={setFare}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.vehicleSection}>
                <Text style={styles.vehicleTitle}>Vehicle Type</Text>
                <Text style={styles.vehicleSubtitle}>
                  Let riders know what you are driving today.
                </Text>
                <View style={styles.vehicleTypeList}>
                  {VEHICLE_TYPE_OPTIONS.map((option) => {
                    const isActive = option.value === vehicleType;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.vehicleChip,
                          isActive && styles.vehicleChipActive,
                        ]}
                        onPress={() => setVehicleType(option.value)}
                        disabled={isSubmitting}
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            styles.vehicleChipLabel,
                            isActive && styles.vehicleChipLabelActive,
                          ]}>
                          {option.label}
                        </Text>
                        {option.subtitle ? (
                          <Text style={styles.vehicleChipSubtitle}>
                            {option.subtitle}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <FileText size={16} color={Colors.dark.gold} />
                  <Text style={styles.label}>Notes (Optional)</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Any special notes for passengers..."
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.switchContainer}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchText}>Women Only</Text>
                  <Text style={styles.switchSubtext}>
                    Only female passengers can book
                  </Text>
                </View>
                <Switch
                  value={womenOnly}
                  onValueChange={setWomenOnly}
                  trackColor={{
                    false: Colors.dark.border,
                    true: Colors.dark.pink,
                  }}
                  thumbColor={Colors.dark.text}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.7}>
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Creating...' : 'Offer Ride'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  input: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 16,
  },
  vehicleSection: {
    marginTop: 8,
  },
  vehicleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  vehicleSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 6,
  },
  vehicleTypeList: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  vehicleChip: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  vehicleChipActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '20',
  },
  vehicleChipLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  vehicleChipLabelActive: {
    color: Colors.dark.gold,
  },
  vehicleChipSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  switchLabel: {
    flex: 1,
  },
  switchText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  switchSubtext: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.background,
  },
});
