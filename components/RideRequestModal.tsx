import { useState, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import { X, MapPin, Users, Plus, Minus, Clock, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { createRideRequest, setAuthToken } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/backendConfig';
import CustomAlert, { AlertType } from './CustomAlert';
import LocationPicker from './LocationPicker';
import RouteInfo from './RouteInfo';
import FareBreakdown from './FareBreakdown';
import { VEHICLE_TYPE_OPTIONS, type RideVehicleType } from '@/constants/vehicleTypes';
import DateTimePicker, {
  DateTimePickerEvent,
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';

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

const FLEXIBILITY_OPTIONS = [15, 30, 60, 120];
const MAPS_PROXY_BASE_URL = getApiBaseUrl();

const roundToNearestFiveMinutes = (date: Date) => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 5;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (remainder < 3 ? -remainder : 5 - remainder));
  }
  rounded.setSeconds(0, 0);
  return rounded;
};

const formatDepartureTime = (date: Date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

export default function RideRequestModal({
  visible,
  onClose,
  onRideCreated,
}: RideRequestModalProps) {
  const { user, getAuthToken } = useAuth();
  const { location } = useLocation();
  const [loading, setLoading] = useState(false);
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [showPickupPicker, setShowPickupPicker] = useState(false);
  const [showDropoffPicker, setShowDropoffPicker] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [vehicleType, setVehicleType] = useState<RideVehicleType>('four_wheeler');
  const [requestedFare, setRequestedFare] = useState('');
  const [notes, setNotes] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [error, setError] = useState('');
  const initialDeparture = roundToNearestFiveMinutes(
    new Date(Date.now() + 30 * 60 * 1000),
  );
  const [scheduledDeparture, setScheduledDeparture] = useState<Date>(
    initialDeparture,
  );
  const [pendingIOSDate, setPendingIOSDate] = useState<Date>(initialDeparture);
  const [flexibilityMinutes, setFlexibilityMinutes] = useState<number>(60);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
  }>({ title: '', message: '', type: 'info' });

  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [fareDetails, setFareDetails] = useState({
    baseFare: 50,
    distanceCharge: 0,
    distance: 0,
    surgePricing: 0,
    discount: 0,
    taxes: 0,
    totalFare: 50,
  });

  const departureWindowStart = new Date(
    scheduledDeparture.getTime() - flexibilityMinutes * 60 * 1000,
  );
  const departureWindowEnd = new Date(
    scheduledDeparture.getTime() + flexibilityMinutes * 60 * 1000,
  );

  // Prefill pickup with current location to reduce form friction.
  useEffect(() => {
    if (!visible || pickupLocation || !location?.latitude || !location?.longitude) {
      return;
    }

    const currentLocation = {
      address:
        location.city && location.country
          ? `${location.city}, ${location.country}`
          : 'Current Location',
      latitude: location.latitude,
      longitude: location.longitude,
    };
    setPickupLocation(currentLocation);
    setPickupAddress(currentLocation.address);
  }, [
    visible,
    pickupLocation,
    location?.latitude,
    location?.longitude,
    location?.city,
    location?.country,
  ]);

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

  const openDatePicker = () => {
    const minimumDate = new Date(Date.now() + 5 * 60 * 1000);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: scheduledDeparture,
        mode: 'date',
        minimumDate,
        onChange: (dateEvent, selectedDate) => {
          if (dateEvent.type === 'dismissed' || !selectedDate) {
            return;
          }
          const combined = new Date(selectedDate);
          combined.setHours(scheduledDeparture.getHours());
          combined.setMinutes(scheduledDeparture.getMinutes());
          combined.setSeconds(0, 0);
          DateTimePickerAndroid.open({
            value: combined,
            mode: 'time',
            is24Hour: false,
            onChange: (timeEvent, selectedTime) => {
              if (timeEvent.type === 'dismissed' || !selectedTime) {
                return;
              }
              const updated = new Date(combined);
              updated.setHours(selectedTime.getHours());
              updated.setMinutes(selectedTime.getMinutes());
              setScheduledDeparture(roundToNearestFiveMinutes(updated));
            },
          });
        },
      });
      return;
    }

    setPendingIOSDate(scheduledDeparture);
    setShowDatePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) {
      setPendingIOSDate(roundToNearestFiveMinutes(date));
    }
  };

  const confirmIOSDate = () => {
    setScheduledDeparture(pendingIOSDate);
    closeDatePicker();
  };

  const resetScheduling = () => {
    const resetTime = roundToNearestFiveMinutes(
      new Date(Date.now() + 30 * 60 * 1000),
    );
    setScheduledDeparture(resetTime);
    setPendingIOSDate(resetTime);
    setFlexibilityMinutes(60);
  };

  const geocodeAddress = async (address: string): Promise<LocationData | null> => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      return null;
    }

    try {
      const response = await fetch(
        `${MAPS_PROXY_BASE_URL}/api/maps/geocode?address=${encodeURIComponent(trimmedAddress)}`,
      );
      const data = await response.json();
      const result = data?.results?.[0];
      const coordinates = result?.geometry?.location;

      if (data?.status === 'OK' && coordinates?.lat && coordinates?.lng) {
        return {
          address: result.formatted_address || trimmedAddress,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
        };
      }
    } catch (geocodeError) {
      console.error('Ride request geocoding failed:', geocodeError);
    }

    return null;
  };

  const handleCreateRide = async () => {
    const resolvedPickup =
      pickupLocation || (pickupAddress.trim() ? await geocodeAddress(pickupAddress) : null);
    const resolvedDropoff =
      dropoffLocation || (dropoffAddress.trim() ? await geocodeAddress(dropoffAddress) : null);

    if (!resolvedPickup) {
      setError('Please enter or select a valid pickup location');
      return;
    }
    if (!resolvedDropoff) {
      setError('Please enter or select a valid dropoff location');
      return;
    }

    if (!pickupLocation) {
      setPickupLocation(resolvedPickup);
    }
    if (!dropoffLocation) {
      setDropoffLocation(resolvedDropoff);
    }

    if (scheduledDeparture.getTime() < Date.now() + 5 * 60 * 1000) {
      setError('Please choose a departure time at least 5 minutes from now');
      return;
    }

    const parsedRequestedFare = Number.parseFloat(requestedFare);
    if (!Number.isFinite(parsedRequestedFare) || parsedRequestedFare <= 0) {
      setError('Please enter the total booking price you want the driver to accept');
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
      const token = await getAuthToken();
      if (token) {
        setAuthToken(token);
      }

      const ridePayload = {
        clerkId: user.id,
        from: resolvedPickup.address,
        to: resolvedDropoff.address,
        passengers,
        vehicleType,
        notes,
        womenOnly,
        pickupLatitude: resolvedPickup.latitude,
        pickupLongitude: resolvedPickup.longitude,
        dropoffLatitude: resolvedDropoff.latitude,
        dropoffLongitude: resolvedDropoff.longitude,
        pickupCity: location?.city,
        pickupCountry: location?.country,
        scheduledDeparture: scheduledDeparture.toISOString(),
        timeFlexibilityMinutes: flexibilityMinutes,
        requestedTotalFare: Math.round(parsedRequestedFare),
        maxSharedSeats:
          vehicleType === 'two_wheeler'
            ? 1
            : vehicleType === 'three_wheeler'
              ? 3
              : 4,
      };

      await createRideRequest(ridePayload);

      showAlert(
        'Ride Request Created',
        `Your ride from ${resolvedPickup.address} to ${resolvedDropoff.address} is now live! Drivers will start accepting it soon.`,
        'success',
      );

      setPickupLocation(null);
      setDropoffLocation(null);
      setPickupAddress('');
      setDropoffAddress('');
      setPassengers(1);
      setVehicleType('four_wheeler');
      setRequestedFare('');
      setNotes('');
      setWomenOnly(false);
      resetScheduling();

      setTimeout(() => {
        onRideCreated?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to create ride';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const incrementPassengers = () => {
    if (passengers < 4) {
      setPassengers(passengers + 1);
    }
  };

  const decrementPassengers = () => {
    if (passengers > 1) {
      setPassengers(passengers - 1);
    }
  };

  return (
    <>
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
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS === 'web' && styles.webContentContainer,
          ]}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.routePanel}>
            <Text style={styles.routePanelTitle}>Plan your ride</Text>
            <View style={styles.routeRows}>
              <View style={styles.routeRail}>
                <View style={[styles.routeDot, styles.pickupDot]} />
                <View style={styles.routeLine} />
                <View style={[styles.routeDot, styles.dropoffDot]} />
                <View style={styles.routeLine} />
                <View style={[styles.routeDot, styles.timeDot]} />
              </View>
              <View style={styles.routeInputs}>
                <View style={styles.routeField}>
                  <View style={styles.routeFieldCopy}>
                    <Text style={styles.routeLabel}>Pickup</Text>
                    <TextInput
                      style={styles.routeInput}
                      placeholder="Where are you starting?"
                      placeholderTextColor={Colors.dark.textSecondary}
                      value={pickupAddress}
                      onChangeText={(value) => {
                        setPickupAddress(value);
                        setPickupLocation(null);
                        setError('');
                      }}
                      editable={!loading}
                      returnKeyType="next"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.routeIconButton}
                    onPress={() => setShowPickupPicker(true)}
                    disabled={loading}
                    activeOpacity={0.75}>
                    <Navigation size={18} color={Colors.dark.gold} />
                  </TouchableOpacity>
                </View>

                <View style={styles.routeField}>
                  <View style={styles.routeFieldCopy}>
                    <Text style={styles.routeLabel}>Drop-off</Text>
                    <TextInput
                      style={styles.routeInput}
                      placeholder="Where do you want to go?"
                      placeholderTextColor={Colors.dark.textSecondary}
                      value={dropoffAddress}
                      onChangeText={(value) => {
                        setDropoffAddress(value);
                        setDropoffLocation(null);
                        setError('');
                      }}
                      editable={!loading}
                      returnKeyType="done"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.routeIconButton}
                    onPress={() => setShowDropoffPicker(true)}
                    disabled={loading}
                    activeOpacity={0.75}>
                    <MapPin size={18} color={Colors.dark.pink} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.routeField, styles.routeFieldLast]}
                  onPress={openDatePicker}
                  disabled={loading}
                  activeOpacity={0.75}>
                  <View style={styles.routeFieldCopy}>
                    <Text style={styles.routeLabel}>Departure</Text>
                    <Text style={styles.routeValue} numberOfLines={1}>
                      {formatDepartureTime(scheduledDeparture)}
                    </Text>
                  </View>
                  <Clock size={18} color={Colors.dark.gold} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

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
              totalSeats={4}
              onFareCalculated={(farePerSeat) => {
                if (!requestedFare) {
                  setRequestedFare(String(Math.max(1, Math.round(farePerSeat * 4))));
                }
              }}
            />
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking price for driver</Text>
            <Text style={styles.sectionSubtitle}>
              This is the total driver payout. If more passengers join, this same amount is split between everyone.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Total price, e.g. 400"
              placeholderTextColor={Colors.dark.textSecondary}
              value={requestedFare}
              onChangeText={setRequestedFare}
              keyboardType="numeric"
              editable={!loading}
            />
            {!!requestedFare && Number(requestedFare) > 0 && (
              <Text style={styles.hint}>
                Current share: Rs {Math.ceil(Number(requestedFare) / Math.max(1, passengers))} per requested seat. More riders can reduce this after a driver accepts.
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Departure window</Text>
            <Text style={[styles.sectionSubtitle, styles.flexSubtitle]}>
              How flexible are you?
            </Text>
            <View style={styles.flexOptionsRow}>
              {FLEXIBILITY_OPTIONS.map((option) => {
                const active = option === flexibilityMinutes;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.flexChip,
                      active && styles.flexChipActive,
                    ]}
                    onPress={() => setFlexibilityMinutes(option)}
                    disabled={loading}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.flexChipText,
                        active && styles.flexChipTextActive,
                      ]}>
                      ±{option} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.flexHint}>
              We will surface your ride to drivers who can depart between{' '}
              {formatDepartureTime(departureWindowStart)}{' '}
              and{' '}
              {formatDepartureTime(departureWindowEnd)}.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users size={20} color={Colors.dark.gold} />
              <Text style={styles.sectionTitle}>Number of Passengers</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Up to 4 passengers per request.</Text>
            <View style={styles.passengerControl}>
              <TouchableOpacity
                onPress={decrementPassengers}
                disabled={passengers === 1 || loading}
                style={[
                  styles.passengerButton,
                  (passengers === 1 || loading) && styles.passengerButtonDisabled,
                ]}
                activeOpacity={0.7}>
                <Minus size={20} color={Colors.dark.text} />
              </TouchableOpacity>
              <Text style={styles.passengerCount}>{passengers}</Text>
              <TouchableOpacity
                onPress={incrementPassengers}
                disabled={passengers === 4 || loading}
                style={[
                  styles.passengerButton,
                  (passengers === 4 || loading) && styles.passengerButtonDisabled,
                ]}
                activeOpacity={0.7}>
                <Plus size={20} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferred Vehicle Type</Text>
            <Text style={styles.sectionSubtitle}>
              Drivers matching this vehicle will be prioritised.
            </Text>
            <View style={styles.vehicleTypeRow}>
              {VEHICLE_TYPE_OPTIONS.map((option) => {
                const isActive = option.value === vehicleType;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.vehicleTypeOption,
                      isActive && styles.vehicleTypeOptionActive,
                    ]}
                    onPress={() => setVehicleType(option.value)}
                    disabled={loading}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.vehicleTypeLabel,
                        isActive && styles.vehicleTypeLabelActive,
                      ]}>
                      {option.label}
                    </Text>
                    {option.subtitle ? (
                      <Text style={styles.vehicleTypeSubtitle}>{option.subtitle}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

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
      </Modal>

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />

      <LocationPicker
        visible={showPickupPicker}
        onClose={() => setShowPickupPicker(false)}
        onLocationSelect={(loc) => {
          setPickupLocation(loc);
          setPickupAddress(loc.address);
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
          setDropoffAddress(loc.address);
          setShowDropoffPicker(false);
        }}
        title="Select Dropoff Location"
        initialLocation={dropoffLocation || undefined}
      />

      <Modal
        transparent
        visible={showDatePicker}
        animationType="fade"
        onRequestClose={closeDatePicker}>
        <View style={styles.datePickerOverlay}>
          <TouchableOpacity
            style={styles.datePickerBackdrop}
            activeOpacity={1}
            onPress={closeDatePicker}
          />
          <View style={styles.datePickerCard}>
            <DateTimePicker
              value={pendingIOSDate}
              mode="datetime"
              display="spinner"
              onChange={handleDateChange}
              minuteInterval={5}
              minimumDate={new Date(Date.now() + 5 * 60 * 1000)}
            />
            <View style={styles.datePickerActions}>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={closeDatePicker}
                activeOpacity={0.7}>
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.datePickerButton, styles.datePickerConfirm]}
                onPress={confirmIOSDate}
                activeOpacity={0.7}>
                <Text
                  style={[styles.datePickerButtonText, styles.datePickerConfirmText]}>
                  Set Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  webContentContainer: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
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
  routePanel: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  routePanelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 14,
  },
  routeRows: {
    flexDirection: 'row',
  },
  routeRail: {
    width: 22,
    alignItems: 'center',
    paddingTop: 19,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  pickupDot: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold,
  },
  dropoffDot: {
    borderColor: Colors.dark.pink,
    backgroundColor: Colors.dark.pink,
  },
  timeDot: {
    borderColor: Colors.dark.textSecondary,
    backgroundColor: Colors.dark.card,
  },
  routeLine: {
    width: 1,
    height: 54,
    backgroundColor: Colors.dark.border,
  },
  routeInputs: {
    flex: 1,
    marginLeft: 8,
  },
  routeField: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingVertical: 8,
    gap: 10,
  },
  routeFieldLast: {
    borderBottomWidth: 0,
  },
  routeFieldCopy: {
    flex: 1,
  },
  routeLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  routeInput: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 3,
    minHeight: 24,
    padding: 0,
  },
  routeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
  },
  routeValue: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 3,
  },
  routePlaceholder: {
    color: Colors.dark.textSecondary,
    fontWeight: '500',
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
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 6,
  },
  flexSubtitle: {
    marginTop: 16,
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
  departureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 12,
  },
  departureLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  departureValue: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
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
  vehicleTypeRow: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  vehicleTypeOption: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  vehicleTypeOptionActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '20',
  },
  vehicleTypeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  vehicleTypeLabelActive: {
    color: Colors.dark.gold,
  },
  vehicleTypeSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  flexOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  flexChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.card,
  },
  flexChipActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '20',
  },
  flexChipText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  flexChipTextActive: {
    color: Colors.dark.gold,
  },
  flexHint: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
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
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  datePickerCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: '100%',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 12,
  },
  datePickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  datePickerButtonText: {
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  datePickerConfirm: {
    backgroundColor: Colors.dark.gold,
    borderColor: Colors.dark.gold,
  },
  datePickerConfirmText: {
    color: Colors.dark.background,
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
