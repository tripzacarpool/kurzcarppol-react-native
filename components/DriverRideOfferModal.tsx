import React, { useState, useEffect } from 'react';
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
import { X, MapPin, Users, DollarSign, FileText, Navigation, Clock } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@clerk/clerk-expo';
import { Colors } from '@/constants/Colors';
import { createDriverRideOffer, setAuthToken } from '@/lib/api';
import CustomAlert, { AlertType } from './CustomAlert';
import LocationPicker from './LocationPicker';
import RouteInfo from './RouteInfo';

interface DriverRideOfferModalProps {
  visible: boolean;
  onClose: () => void;
  editingOffer?: {
    id: string;
    from: string;
    to: string;
    seats: number;
    fare?: number;
    womenOnly?: boolean;
    createdAt?: string;
  } | null;
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
  editingOffer = null,
  onSuccess,
}: DriverRideOfferModalProps) {
  const { getToken } = useAuth();
  const isEditMode = !!editingOffer;
  
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromLocation, setFromLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [toLocation, setToLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [passengers, setPassengers] = useState('2');
  const [fare, setFare] = useState('');
  const [notes, setNotes] = useState('');
  const [womenOnly, setWomenOnly] = useState(false);
  const [maxPassengers, setMaxPassengers] = useState('3'); // Max passengers driver can accommodate
  const [departureTime, setDepartureTime] = useState<Date>(new Date(Date.now() + 30 * 60000)); // Default: 30 mins from now
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerMode, setLocationPickerMode] = useState<'from' | 'to'>('from');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  const [suggestedFare, setSuggestedFare] = useState<number>(0);
  const [isRouteCalculated, setIsRouteCalculated] = useState(false);
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
  }>({ title: '', message: '', type: 'info' });

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Load editing data when modal opens with editingOffer
  useEffect(() => {
    if (visible && editingOffer) {
      setFrom(editingOffer.from || '');
      setTo(editingOffer.to || '');
      setMaxPassengers(editingOffer.seats?.toString() || '3');
      setFare(editingOffer.fare?.toString() || '');
      setWomenOnly(editingOffer.womenOnly || false);
    } else if (!visible) {
      // Reset when modal closes
      setFrom('');
      setTo('');
      setFromLocation(null);
      setToLocation(null);
      setMaxPassengers('3');
      setFare('');
      setNotes('');
      setWomenOnly(false);
      setSelectedSeats([]);
      setIsRouteCalculated(false);
      setSuggestedFare(0);
    }
  }, [visible, editingOffer]);

  // Reset route calculation when locations change
  useEffect(() => {
    // Reset when locations are cleared
    if (!fromLocation || !toLocation) {
      setIsRouteCalculated(false);
      setSuggestedFare(0);
    }
  }, [fromLocation, toLocation]);

  // Update available seats when max passengers changes
  useEffect(() => {
    const maxPassengerCount = parseInt(maxPassengers) || 0;
    // Reset seats if current selection exceeds limit
    if (selectedSeats.length > maxPassengerCount) {
      setSelectedSeats([]);
    }
  }, [maxPassengers]);

  const getTotalSeats = (): number => {
    const maxPassengerCount = parseInt(maxPassengers) || 0;
    return maxPassengerCount + 1; // +1 for driver seat
  };

  const getPassengerSeats = (): number => {
    return parseInt(maxPassengers) || 0;
  };

  const showDateTimePicker = () => {
    setPickerMode('date');
    setShowTimePicker(true);
  };

  const handleDateTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowTimePicker(false);
        setPickerMode('date');
        setTempDate(null);
        return;
      }
      
      if (pickerMode === 'date' && selectedDate) {
        // Date selected, store it temporarily and switch to time picker
        setTempDate(selectedDate);
        setShowTimePicker(false);
        // Small delay to allow re-render with time picker
        setTimeout(() => {
          setPickerMode('time');
          setShowTimePicker(true);
        }, 100);
      } else if (pickerMode === 'time' && selectedDate && tempDate) {
        // Time selected, combine with stored date
        const combined = new Date(tempDate);
        combined.setHours(selectedDate.getHours());
        combined.setMinutes(selectedDate.getMinutes());
        setDepartureTime(combined);
        setShowTimePicker(false);
        setPickerMode('date');
        setTempDate(null);
      }
    } else {
      // iOS: single step
      setShowTimePicker(false);
      if (selectedDate) {
        setDepartureTime(selectedDate);
      }
    }
  };

  const loadRecentSearches = async () => {
    try {
      const searches = await AsyncStorage.getItem('recentLocationSearches');
      if (searches) {
        setRecentSearches(JSON.parse(searches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (location: string) => {
    try {
      const searches = [...new Set([location, ...recentSearches])].slice(0, 10); // Keep last 10 unique searches
      await AsyncStorage.setItem('recentLocationSearches', JSON.stringify(searches));
      setRecentSearches(searches);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

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

  const handleFareCalculated = (calculatedFare: number) => {
    setSuggestedFare(calculatedFare);
    setIsRouteCalculated(true);
    // Auto-populate fare if field is empty
    if (!fare || fare === '0') {
      setFare(calculatedFare.toString());
    }
  };

  const handleCalculationStart = () => {
    setIsRouteCalculated(false);
    setSuggestedFare(0);
  };

  const handleLocationSelect = (location: { address: string; latitude: number; longitude: number }) => {
    if (locationPickerMode === 'from') {
      setFrom(location.address);
      setFromLocation({ latitude: location.latitude, longitude: location.longitude });
    } else {
      setTo(location.address);
      setToLocation({ latitude: location.latitude, longitude: location.longitude });
    }
    saveRecentSearch(location.address);
    setShowLocationPicker(false);
  };

  const openLocationPicker = (mode: 'from' | 'to') => {
    setLocationPickerMode(mode);
    setShowLocationPicker(true);
  };

  const toggleSeatSelection = (seatNumber: number) => {
    if (selectedSeats.includes(seatNumber)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNumber));
    } else {
      const maxPassengerCount = getPassengerSeats();
      if (selectedSeats.length < maxPassengerCount) {
        setSelectedSeats([...selectedSeats, seatNumber]);
      } else {
        showAlert('Limit Reached', `You can only select ${maxPassengerCount} passenger seat${maxPassengerCount > 1 ? 's' : ''}.`, 'warning');
      }
    }
  };

  const renderSeatSelection = () => {
    const totalSeats = getTotalSeats();
    const passengerSeats = getPassengerSeats();

    if (passengerSeats === 0) {
      return null; // Don't show seat selection if no passengers
    }

    // Create seat layout based on total seats
    // For cars: Seat 1 (Driver) and Seat 2 (Front), then Seats 3,4,5+ (Back)
    const renderCarLayout = () => {
      const frontSeats = [1, 2]; // Driver and front passenger
      const backSeats = Array.from({ length: totalSeats - 2 }, (_, i) => i + 3); // Remaining seats

      return (
        <View style={styles.carLayoutContainer}>
          {/* Front Row */}
          <View style={styles.seatRow}>
            {frontSeats.map((seatNum) => {
              const isDriverSeat = seatNum === 1;
              const isSelected = selectedSeats.includes(seatNum);
              
              return (
                <TouchableOpacity
                  key={seatNum}
                  style={[
                    styles.seatBtn,
                    isDriverSeat && styles.seatUnavailable,
                    isSelected && styles.seatSelected,
                  ]}
                  onPress={() => !isDriverSeat && toggleSeatSelection(seatNum)}
                  disabled={isDriverSeat}
                >
                  <Text style={[
                    styles.seatText,
                    isDriverSeat && styles.seatTextUnavailable,
                    isSelected && styles.seatTextSelected,
                  ]}>
                    {seatNum}
                  </Text>
                  {isDriverSeat && (
                    <Text style={styles.driverLabel}>Driver</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Back Row */}
          {backSeats.length > 0 && (
            <View style={styles.seatRow}>
              {backSeats.map((seatNum) => {
                const isSelected = selectedSeats.includes(seatNum);
                
                return (
                  <TouchableOpacity
                    key={seatNum}
                    style={[
                      styles.seatBtn,
                      isSelected && styles.seatSelected,
                    ]}
                    onPress={() => toggleSeatSelection(seatNum)}
                  >
                    <Text style={[
                      styles.seatText,
                      isSelected && styles.seatTextSelected,
                    ]}>
                      {seatNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      );
    };

    return (
      <View style={styles.seatsSection}>
        <Text style={styles.sectionTitle}>Select Passenger Seats</Text>
        <Text style={styles.seatHint}>
          Tap seats that passengers can book. Seat 1 is reserved for driver.
        </Text>
        <View style={styles.seatsGrid}>
          {totalSeats <= 2 ? (
            // For 2-seater (bike/scooter), show simple layout
            <View style={styles.seatRow}>
              {[1, 2].map((seatNum) => {
                const isDriverSeat = seatNum === 1;
                const isSelected = selectedSeats.includes(seatNum);
                
                return (
                  <TouchableOpacity
                    key={seatNum}
                    style={[
                      styles.seatBtn,
                      isDriverSeat && styles.seatUnavailable,
                      isSelected && styles.seatSelected,
                    ]}
                    onPress={() => !isDriverSeat && toggleSeatSelection(seatNum)}
                    disabled={isDriverSeat}
                  >
                    <Text style={[
                      styles.seatText,
                      isDriverSeat && styles.seatTextUnavailable,
                      isSelected && styles.seatTextSelected,
                    ]}>
                      {seatNum}
                    </Text>
                    {isDriverSeat && (
                      <Text style={styles.driverLabel}>Driver</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            // For 3+ seats (cars, vans, etc.), show front/back layout
            renderCarLayout()
          )}
        </View>
        {selectedSeats.length > 0 && (
          <Text style={styles.selectedSeatsText}>
            Selected: {selectedSeats.sort((a, b) => a - b).join(', ')} ({selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''})
          </Text>
        )}
      </View>
    );
  };

  const handleSubmit = async () => {
    if (!from.trim() || !to.trim()) {
      showAlert('Error', 'Please enter pickup and dropoff locations', 'error');
      return;
    }

    if (!fromLocation || !toLocation) {
      showAlert('Error', 'Please select valid locations from the map', 'error');
      return;
    }

    if (!isRouteCalculated || suggestedFare === 0) {
      showAlert('Calculating Route', 'Please wait while we calculate the route and fare...', 'info');
      return;
    }

    const passengerCount = getPassengerSeats();
    if (passengerCount === 0) {
      showAlert('Error', 'Please enter maximum number of passengers', 'error');
      return;
    }

    if (selectedSeats.length === 0) {
      showAlert('Info', 'No specific seats selected - all passenger seats will be available for booking', 'info');
    }

    const fareAmount = fare ? parseFloat(fare) : 0;
    if (fare && (isNaN(fareAmount) || fareAmount < 0)) {
      showAlert('Error', 'Please enter a valid fare amount', 'error');
      return;
    }

    // Validate departure time is in future
    const now = new Date();
    if (departureTime <= now) {
      showAlert('Error', 'Departure time must be in the future', 'error');
      return;
    }

    // Warn if departure time is too far in future (more than 24 hours)
    const hoursDiff = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursDiff > 24) {
      showAlert('Warning', 'Departure time is more than 24 hours away. Passengers may not see this offer immediately.', 'warning');
    }

    setIsSubmitting(true);

    try {
      // Get fresh Clerk token before making API call
      const token = await getToken();
      if (token) {
        setAuthToken(token);
        console.log('🔑 Fresh token set for ride offer creation');
      } else {
        console.warn('⚠️ No token available, API call may fail');
      }

      const totalSeats = getTotalSeats();
      const availableSeats = selectedSeats.length > 0 
        ? selectedSeats 
        : Array.from({ length: passengerCount }, (_, i) => i + 2); // Seats 2, 3, 4, etc.

      const payload = {
        from: from.trim(),
        to: to.trim(),
        totalSeats,
        availableSeats,
        farePerSeat: fareAmount,
        notes: notes.trim(),
        womenOnly,
        departureTime: departureTime.toISOString(),
        pickupLatitude: fromLocation?.latitude,
        pickupLongitude: fromLocation?.longitude,
        dropoffLatitude: toLocation?.latitude,
        dropoffLongitude: toLocation?.longitude,
      };

      // Use the new createRideOffer API
      const { createRideOffer } = await import('@/lib/api');
      const response = await createRideOffer(payload);

      console.log('✅ Ride offer created:', response);
      showAlert('Success', 'Your ride offer has been created! Passengers can now see and book it.', 'success');
      setTimeout(() => {
        handleClose();
        onSuccess?.({
          id: response?.rideOffer?.id,
          from: from.trim(),
          to: to.trim(),
          passengers: passengerCount,
          fare: fareAmount,
          womenOnly,
          createdAt: new Date().toISOString(),
        });
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
    setFromLocation(null);
    setToLocation(null);
    setMaxPassengers('3');
    setDepartureTime(new Date(Date.now() + 30 * 60000));
    setFare('');
    setNotes('');
    setWomenOnly(false);
    setSelectedSeats([]);
    setIsRouteCalculated(false);
    setSuggestedFare(0);
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
            <Text style={styles.title}>{isEditMode ? 'Edit Ride Offer' : 'Offer a Ride'}</Text>
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
                <View style={styles.locationInputContainer}>
                  <TextInput
                    style={[styles.input, styles.locationInput]}
                    placeholder="Pickup location"
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={from}
                    onChangeText={setFrom}
                    onFocus={() => setFromFocused(true)}
                    onBlur={() => setTimeout(() => setFromFocused(false), 300)}
                    autoCapitalize="words"
                  />
                  <TouchableOpacity
                    style={styles.mapButton}
                    onPress={() => openLocationPicker('from')}
                  >
                    <Navigation size={20} color={Colors.dark.gold} />
                  </TouchableOpacity>
                </View>
                {/* Recent Searches Dropdown for From */}
                {fromFocused && recentSearches.length > 0 && (
                  <View style={styles.recentDropdown}>
                    {recentSearches.slice(0, 5).map((search, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentDropdownItem}
                        activeOpacity={0.7}
                        onPressIn={() => {
                          setFrom(search);
                          setFromFocused(false);
                        }}
                      >
                        <MapPin size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.recentDropdownText}>{search}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <MapPin size={16} color={Colors.dark.gold} />
                  <Text style={styles.label}>To</Text>
                </View>
                <View style={styles.locationInputContainer}>
                  <TextInput
                    style={[styles.input, styles.locationInput]}
                    placeholder="Dropoff location"
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={to}
                    onChangeText={setTo}
                    onFocus={() => setToFocused(true)}
                    onBlur={() => setTimeout(() => setToFocused(false), 300)}
                    autoCapitalize="words"
                  />
                  <TouchableOpacity
                    style={styles.mapButton}
                    onPress={() => openLocationPicker('to')}
                  >
                    <Navigation size={20} color={Colors.dark.gold} />
                  </TouchableOpacity>
                </View>
                {/* Recent Searches Dropdown for To */}
                {toFocused && recentSearches.length > 0 && (
                  <View style={styles.recentDropdown}>
                    {recentSearches.slice(0, 5).map((search, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentDropdownItem}
                        activeOpacity={0.7}
                        onPressIn={() => {
                          setTo(search);
                          setToFocused(false);
                        }}
                      >
                        <MapPin size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.recentDropdownText}>{search}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Recent Searches */}
              {recentSearches.length > 0 && !from && !to && (
                <View style={styles.recentSearches}>
                  <Text style={styles.recentTitle}>Recent Searches</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {recentSearches.slice(0, 5).map((search, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentChip}
                        onPress={() => {
                          if (!from) {
                            setFrom(search);
                          } else if (!to) {
                            setTo(search);
                          }
                        }}
                      >
                        <MapPin size={12} color={Colors.dark.textSecondary} />
                        <Text style={styles.recentText} numberOfLines={1}>
                          {search}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

            </View>

            {/* Route Information - Inline */}
            {fromLocation && toLocation && (
              <View style={styles.section}>
                <RouteInfo
                  pickupLocation={fromLocation}
                  dropoffLocation={toLocation}
                  farePerKm={15}
                  onFareCalculated={handleFareCalculated}
                  onCalculationStart={handleCalculationStart}
                />
                {!isRouteCalculated && (
                  <Text style={styles.calculatingHint}>
                    ⏳ Calculating route and suggested fare...
                  </Text>
                )}
                {isRouteCalculated && suggestedFare > 0 && (
                  <Text style={styles.fareHint}>
                    ✅ Suggested fare: ₹{suggestedFare}
                  </Text>
                )}
              </View>
            )}

            {/* Show message when locations are not set */}
            {(!fromLocation || !toLocation) && from && to && (
              <View style={styles.section}>
                <Text style={styles.locationHint}>
                  📍 Please select locations from the map to calculate route
                </Text>
              </View>
            )}

            {/* Departure Time */}
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Clock size={16} color={Colors.dark.gold} />
                  <Text style={styles.label}>Departure Time</Text>
                </View>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={showDateTimePicker}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timePickerText}>
                    {departureTime.toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>
                  <Clock size={20} color={Colors.dark.gold} />
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={Platform.OS === 'android' && pickerMode === 'time' && tempDate ? tempDate : departureTime}
                    mode={Platform.OS === 'android' ? pickerMode : 'datetime'}
                    display="default"
                    minimumDate={pickerMode === 'date' ? new Date() : undefined}
                    onChange={handleDateTimeChange}
                  />
                )}
              </View>
            </View>

            {/* Max Passengers */}
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <Users size={16} color={Colors.dark.gold} />
                  <Text style={styles.label}>Max Passengers You Can Seat</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 3 for a 4-seater car (1 driver + 3 passengers)"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={maxPassengers}
                  onChangeText={setMaxPassengers}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Seat Selection */}
            {renderSeatSelection()}

            {/* Fare */}
            <View style={styles.section}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <DollarSign size={16} color={Colors.dark.gold} />
                  <Text style={styles.label}>Fare per Seat (₹)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={suggestedFare > 0 ? `Suggested: ₹${suggestedFare} (10% off map estimate)` : "Will be suggested after route calculation"}
                  placeholderTextColor={suggestedFare > 0 ? Colors.dark.gold : Colors.dark.textSecondary}
                  value={fare}
                  onChangeText={setFare}
                  keyboardType="decimal-pad"
                />
                {suggestedFare > 0 && (
                  <Text style={styles.fareHint}>
                    💡 Fare auto-set to ₹{suggestedFare} (10% less than map estimate)
                  </Text>
                )}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
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
                (isSubmitting || !isRouteCalculated) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !isRouteCalculated}
              activeOpacity={0.7}>
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Creating...' : !isRouteCalculated ? 'Calculating Route...' : 'Offer Ride'}
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

      {/* Location Picker Modal */}
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={handleLocationSelect}
        title={locationPickerMode === 'from' ? 'Select Pickup Location' : 'Select Dropoff Location'}
        initialLocation={
          locationPickerMode === 'from' && fromLocation
            ? { address: from, ...fromLocation }
            : locationPickerMode === 'to' && toLocation
            ? { address: to, ...toLocation }
            : undefined
        }
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
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationInput: {
    flex: 1,
  },
  mapButton: {
    width: 50,
    height: 54,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentSearches: {
    marginTop: 12,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    maxWidth: 150,
  },
  recentText: {
    fontSize: 13,
    color: Colors.dark.text,
  },
  routeInfoContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  routeInfoHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  fareHint: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  vehicleTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  vehicleTypeButton: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  vehicleTypeButtonActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '20',
  },
  vehicleTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  vehicleTypeTextActive: {
    color: Colors.dark.gold,
  },
  vehicleTypeSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  seatsSection: {
    marginTop: 8,
  },
  seatHint: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  seatsGrid: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  seatRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  carLayoutContainer: {
    gap: 16,
  },
  seatBtn: {
    width: 70,
    height: 70,
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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  seatTextSelected: {
    color: Colors.dark.background,
  },
  seatTextUnavailable: {
    color: Colors.dark.textSecondary,
  },
  driverLabel: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  selectedSeatsText: {
    fontSize: 13,
    color: Colors.dark.gold,
    marginTop: 12,
    fontWeight: '600',
  },
  calculatingHint: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  fareHint: {
    fontSize: 13,
    color: Colors.dark.gold,
    marginTop: 12,
    padding: 10,
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  locationHint: {
    fontSize: 13,
    color: Colors.dark.pink,
    padding: 12,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.pink,
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
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  timePickerText: {
    fontSize: 16,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  recentDropdown: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    maxHeight: 200,
  },
  recentDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  recentDropdownText: {
    fontSize: 15,
    color: Colors.dark.text,
    flex: 1,
  },
});
