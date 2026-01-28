import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, MapPin, Clock, Users, Plus, Minus } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { createRideRequest } from '@/lib/api';
import CustomAlert, { AlertType } from './CustomAlert';
import LocationPicker from './LocationPicker';
import RouteInfo from './RouteInfo';

interface RideRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onRideCreated?: () => void;
}

interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
}

export default function RideRequestModal({
  visible,
  onClose,
  onRideCreated,
}: RideRequestModalProps) {
  const { user } = useAuth();
  const { location } = useLocation();
  const [loading, setLoading] = useState(false);
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showDropoffPicker, setShowDropoffPicker] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [notes, setNotes] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [error, setError] = useState('');
  
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

  const handleCreateRide = async () => {
    if (!pickupLocation) {
      setError('Please select pickup location');
      return;
    }
    if (!dropoffLocation) {
      setError('Please select dropoff location');
      return;
    }

    setLoading(true);
    setError('');

    if (!user?.id) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    try {
      console.log('🚗 Creating ride request...');
      
      const ridePayload = {
        clerkId: user.id,
        from: pickupLocation.address,
        to: dropoffLocation.address,
        passengers,
        notes,
        womenOnly,
        pickupLatitude: pickupLocation.latitude,
        pickupLongitude: pickupLocation.longitude,
        dropoffLatitude: dropoffLocation.latitude,
        dropoffLongitude: dropoffLocation.longitude,
        pickupCity: location?.city,
        pickupCountry: location?.country,
      };

      console.log('📦 Payload:', ridePayload);

      // Call backend API to create ride
      const response = await createRideRequest(ridePayload);
      
      console.log('✅ Ride request created successfully!', response);
      
      showAlert(
        'Ride Request Created',
        `Your ride from ${pickupLocation.address} to ${dropoffLocation.address} is now live! Drivers will start accepting it soon.`,
        'success'
      );

      // Reset form
      setPickupLocation(null);
      setDropoffLocation(null);
      setPassengers(1);
      setNotes('');
      setWomenOnly(false);

      setTimeout(() => {
        onRideCreated?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to create ride';
      setError(errorMsg);
      console.error('❌ Error creating ride:', err);
    } finally {
      setLoading(false);
    }
  };

  const incrementPassengers = () => {
    if (passengers < 4) setPassengers(passengers + 1);
  };

  const decrementPassengers = () => {
    if (passengers > 1) setPassengers(passengers - 1);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Request a Ride</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Pickup Location */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Pickup Location</Text>
            </View>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setShowPickupPicker(true)}
              disabled={loading}>
              <Text
                style={[
                  styles.locationButtonText,
                  !pickupLocation && styles.locationPlaceholder,
                ]}>
                {pickupLocation?.address || 'Select pickup location'}
              </Text>
              <MapPin size={18} color={Colors.dark.gold} />
            </TouchableOpacity>
          </View>

          {/* Dropoff Location */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color={Colors.dark.pink} />
              <Text style={styles.sectionTitle}>Dropoff Location</Text>
            </View>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setShowDropoffPicker(true)}
              disabled={loading}>
              <Text
                style={[
                  styles.locationButtonText,
                  !dropoffLocation && styles.locationPlaceholder,
                ]}>
                {dropoffLocation?.address || 'Select dropoff location'}
              </Text>
              <MapPin size={18} color={Colors.dark.pink} />
            </TouchableOpacity>
          </View>

          {/* Route Info */}
          {pickupLocation && dropoffLocation && (
            <RouteInfo
              pickupLocation={{
                latitude: pickupLocation.latitude,
                longitude: pickupLocation.longitude,
              }}
              dropoffLocation={{
                latitude: dropoffLocation.latitude,
                longitude: dropoffLocation.longitude,
              }}
            />
          )}

          {/* Passengers */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={20} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Number of Passengers</Text>
            </View>
            <View style={styles.passengerControl}>
              <TouchableOpacity
                onPress={decrementPassengers}
                disabled={passengers === 1 || loading}
                style={[
                  styles.passengerButton,
                  (passengers === 1 || loading) && styles.passengerButtonDisabled,
                ]}>
                <Minus size={20} color={Colors.dark.text} />
              </TouchableOpacity>
              <Text style={styles.passengerCount}>{passengers}</Text>
              <TouchableOpacity
                onPress={incrementPassengers}
                disabled={passengers === 4 || loading}
                style={[
                  styles.passengerButton,
                  (passengers === 4 || loading) && styles.passengerButtonDisabled,
                ]}>
                <Plus size={20} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Special Requests */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Requests</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any special requests? (e.g., please stop at ATM)"
              placeholderTextColor={Colors.dark.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              editable={!loading}
            />
          </View>

          {/* Women Only Toggle */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.womenToggle,
                womenOnly && styles.womenToggleActive,
              ]}
              onPress={() => setWomenOnly(!womenOnly)}
              disabled={loading}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.toggleIndicator,
                  womenOnly && styles.toggleIndicatorActive,
                ]}
              />
              <Text
                style={[
                  styles.toggleText,
                  womenOnly && styles.toggleTextActive,
                ]}>
                Women Only Ride
              </Text>
            </TouchableOpacity>
            <Text style={styles.toggleHint}>
              Only female drivers will see this request
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cancelButton, loading && styles.buttonDisabled]}
            onPress={onClose}
            disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.requestButton, loading && styles.buttonDisabled]}
            onPress={handleCreateRide}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={Colors.dark.background} />
            ) : (
              <Text style={styles.requestButtonText}>Request Ride</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />

      {/* Location Pickers */}
      <LocationPicker
        visible={showPickupPicker}
        onClose={() => setShowPickupPicker(false)}
        onLocationSelect={(loc) => {
          setPickupLocation(loc);
          setShowPickupPicker(false);
        }}
        title="Select Pickup Location"
        initialLocation={pickupLocation || undefined}
      />

      <LocationPicker
        visible={showDropoffPicker}
        onClose={() => setShowDropoffPicker(false)}
        onLocationSelect={(loc) => {
          setDropoffLocation(loc);
          setShowDropoffPicker(false);
        }}
        title="Select Dropoff Location"
        initialLocation={dropoffLocation || undefined}
      />
    </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  errorContainer: {
    backgroundColor: Colors.dark.error + '20',
    borderWidth: 1,
    borderColor: Colors.dark.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  input: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 15,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  locationButtonText: {
    flex: 1,
    fontSize: 15,
    color: Colors.dark.text,
  },
  locationPlaceholder: {
    color: Colors.dark.textSecondary,
  },
  textArea: {
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
  passengerControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  passengerButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerButtonDisabled: {
    backgroundColor: Colors.dark.border,
    opacity: 0.5,
  },
  passengerCount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.dark.text,
    minWidth: 40,
    textAlign: 'center',
  },
  womenToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  womenToggleActive: {
    backgroundColor: Colors.dark.pink + '20',
    borderColor: Colors.dark.pink,
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  toggleIndicatorActive: {
    borderColor: Colors.dark.pink,
    backgroundColor: Colors.dark.pink,
  },
  toggleText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: Colors.dark.pink,
    fontWeight: '600',
  },
  toggleHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 8,
    marginLeft: 30,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  requestButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.background,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
