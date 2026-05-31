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
  Keyboard,
} from 'react-native';
import { X, MapPin, Users, DollarSign, FileText, Navigation, Sparkles, CalendarDays } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimeSelectorAdvanced from './DateTimeSelectorAdvanced';
import { useAuth, useUser } from '@/lib/clerkHooks';
import { Colors } from '@/constants/Colors';
import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';
import { getApiBaseUrl } from '@/lib/backendConfig';
import { VEHICLE_TYPE_OPTIONS } from '@/constants/vehicleTypes';
import {
  ACTIVE_FESTIVAL_STORAGE_KEY,
  DEFAULT_ACTIVE_FESTIVAL_CAMPAIGNS,
  FESTIVALS,
  type ActiveFestivalCampaign,
} from '@/constants/festivals';
import { createDriverRideOffer, createRideOffer, updateRideOffer, setAuthToken } from '@/lib/api';
import CustomAlert, { AlertType } from './CustomAlert';
import LocationPicker from './LocationPicker';
import RouteInfo from './RouteInfo';

const MAPS_PROXY_BASE_URL = getApiBaseUrl();
type FestivalToggleKey = 'longRoute' | 'discount' | 'groupBooking' | 'smartPricing';

const FESTIVAL_TOGGLE_OPTIONS: { key: FestivalToggleKey; label: string }[] = [
  { key: 'longRoute', label: 'Long route' },
  { key: 'discount', label: 'Festival discount' },
  { key: 'groupBooking', label: 'Group booking' },
  { key: 'smartPricing', label: 'Smart pricing' },
];

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
    festivalType?: string;
    festivalConfig?: {
      longRoute?: boolean;
      discount?: boolean;
      groupBooking?: boolean;
      smartPricing?: boolean;
      tier?: string;
    };
  } | null;
  onSuccess?: (offer?: {
    id?: string;
    from: string;
    to: string;
    passengers: number;
    fare?: number;
    womenOnly?: boolean;
    createdAt?: string;
    departureTime?: string;
  }) => void;
}

export default function DriverRideOfferModal({
  visible,
  onClose,
  editingOffer = null,
  onSuccess,
}: DriverRideOfferModalProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerMode, setLocationPickerMode] = useState<'from' | 'to'>('from');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);
  const [suggestedFare, setSuggestedFare] = useState<number>(0);
  const [isRouteCalculated, setIsRouteCalculated] = useState(false);
  const [vehicleType, setVehicleType] = useState<'two_wheeler' | 'three_wheeler' | 'four_wheeler'>('four_wheeler');
  const [requiresManualApproval, setRequiresManualApproval] = useState(false);
  const [driverPrivacyType, setDriverPrivacyType] = useState<'private_vehicle' | 'full_detail'>('private_vehicle');
  const [activeFestivalCampaigns, setActiveFestivalCampaigns] = useState<ActiveFestivalCampaign[]>([]);

  // Festival special-pool state
  const [festivalType, setFestivalType] = useState<string>('');
  const [festivalConfig, setFestivalConfig] = useState<{
    longRoute: boolean;
    discount: boolean;
    groupBooking: boolean;
    smartPricing: boolean;
    tier: string;
  }>({ longRoute: false, discount: false, groupBooking: false, smartPricing: false, tier: '' });
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
  }>({ title: '', message: '', type: 'info' });

  const toggleFestivalConfigOption = (key: FestivalToggleKey) => {
    setFestivalConfig((config) => ({
      ...config,
      [key]: !config[key],
    }));
  };

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (!visible) return;

    const loadActiveFestivals = async () => {
      try {
        const saved = await AsyncStorage.getItem(ACTIVE_FESTIVAL_STORAGE_KEY);
        const campaigns: ActiveFestivalCampaign[] = saved
          ? JSON.parse(saved)
          : DEFAULT_ACTIVE_FESTIVAL_CAMPAIGNS;
        setActiveFestivalCampaigns(campaigns.filter((campaign) => campaign.enabled));
      } catch (error) {
        console.warn('Could not load active festival campaigns:', error);
        setActiveFestivalCampaigns([]);
      }
    };

    loadActiveFestivals();
  }, [visible]);

  useEffect(() => {
    if (!festivalType) return;
    const stillActive = activeFestivalCampaigns.some((campaign) => campaign.id === festivalType);
    if (!stillActive) {
      setFestivalType('');
    }
  }, [activeFestivalCampaigns, festivalType]);

  // Load editing data when modal opens with editingOffer
  useEffect(() => {
    if (visible && editingOffer) {
      setFrom(editingOffer.from || '');
      setTo(editingOffer.to || '');
      setMaxPassengers(editingOffer.seats?.toString() || '3');
      setFare(editingOffer.fare?.toString() || '');
      setWomenOnly(editingOffer.womenOnly || false);
      
      // In edit mode, create placeholder location objects since we already have the location names
      // These will be used if user doesn't change locations
      setFromLocation({ latitude: 0, longitude: 0 });
      setToLocation({ latitude: 0, longitude: 0 });
      setFestivalType(editingOffer.festivalType || '');
      setFestivalConfig({
        longRoute: editingOffer.festivalConfig?.longRoute || false,
        discount: editingOffer.festivalConfig?.discount || false,
        groupBooking: editingOffer.festivalConfig?.groupBooking || false,
        smartPricing: editingOffer.festivalConfig?.smartPricing || false,
        tier: editingOffer.festivalConfig?.tier || '',
      });
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
      setFestivalType('');
      setFestivalConfig({
        longRoute: false,
        discount: false,
        groupBooking: false,
        smartPricing: false,
        tier: '',
      });
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

  // Geocode address to get coordinates
  const geocodeAddress = async (address: string) => {
    try {
      const encodedAddress = encodeURIComponent(address);
      const url = MAPS_PROXY_BASE_URL
        ? `${MAPS_PROXY_BASE_URL}/api/maps/geocode?address=${encodedAddress}`
        : `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng,
          address: data.results[0].formatted_address
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  // Handle recent search selection with proper geocoding
  const handleRecentSearchSelect = async (search: string, mode: 'from' | 'to') => {
    Keyboard.dismiss();
    
    // Set text immediately for better UX
    if (mode === 'from') {
      setFrom(search);
      setFromFocused(false);
    } else {
      setTo(search);
      setToFocused(false);
    }

    // Geocode the address in background
    const location = await geocodeAddress(search);
    if (location) {
      if (mode === 'from') {
        setFromLocation({ latitude: location.latitude, longitude: location.longitude });
      } else {
        setToLocation({ latitude: location.latitude, longitude: location.longitude });
      }
      console.log(`📍 Geocoded ${mode} location:`, location);
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

    // AUTO RICKSHAW layout (3-wheeler):
    // Driver (Seat 1) is at front alone
    // Back: [Pass 1 (Seat 2)] [Pass 2 (Seat 3)] [Pass 3 (Seat 4)]
    const renderAutoLayout = () => {
      const backSeats = [2, 3, 4];
      
      return (
        <View style={styles.carLayoutContainer}>
          <View style={styles.autoDriverRow}>
            <Text style={styles.rowLabel}>Front</Text>
            <View style={styles.autoDriverSeat}>
              <View style={[styles.seatBtn, styles.seatUnavailable]}>
                <Text style={[styles.seatText, styles.seatTextUnavailable]}>1</Text>
              </View>
              <Text style={styles.driverLabel}>Driver</Text>
            </View>
          </View>
          
          <View style={styles.seatRow}>
            <Text style={styles.rowLabel}>Back</Text>
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
      const passengerSeats = totalSeats - 1;
      const remainingAfterFront = passengerSeats - 1;
      
      const rows: number[][] = [];
      let seatNum = 3;
      let remaining = remainingAfterFront;
      
      while (remaining > 0) {
        const seatsInRow = Math.min(3, remaining);
        rows.push(Array.from({ length: seatsInRow }, (_, i) => seatNum + i));
        seatNum += seatsInRow;
        remaining -= seatsInRow;
      }

      return (
        <View style={styles.carLayoutContainer}>
          {/* Front Row - Indian Right-Hand Drive */}
          <View style={styles.seatRow}>
            <Text style={styles.rowLabel}>Front</Text>
            {frontSeats.map((seatNum) => {
              const isDriverSeat = seatNum === 1;
              const isSelected = selectedSeats.includes(seatNum);
              
              return (
                <View key={seatNum} style={styles.seatWrapper}>
                  <TouchableOpacity
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
                  </TouchableOpacity>
                  {isDriverSeat && (
                    <Text style={styles.driverLabel}>Driver</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Additional Rows */}
          {rows.map((rowSeats, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.seatRow}>
              <Text style={styles.rowLabel}>Row {rowIndex + 2}</Text>
              {rowSeats.map((seatNum) => {
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
          ))}
        </View>
      );
    };

    return (
      <View style={styles.seatsSection}>
        <Text style={styles.sectionTitle}>Select Passenger Seats</Text>
        <Text style={styles.seatHint}>
          {totalSeats <= 2 
            ? 'Two-wheeler: Only 1 passenger seat (auto-selected)'
            : totalSeats === 4 && vehicleType === 'three_wheeler'
            ? 'Auto Rickshaw: 3 passengers sit in back, driver at front'
            : 'Tap seats that passengers can book. Seat 1 (driver) is fixed on right side (Indian RHD).'}
        </Text>
        <View style={styles.seatsGrid}>
          {totalSeats <= 2 ? (
            // For 2-seater (bike/scooter), no selection needed
            <View style={styles.bikeInfo}>
              <Text style={styles.bikeInfoText}>✓ 1 passenger seat available (Seat 2)</Text>
            </View>
          ) : totalSeats === 4 && vehicleType === 'three_wheeler' ? (
            // For auto-rickshaws, show auto layout
            renderAutoLayout()
          ) : (
            // For 4+ seats (cars, vans, etc.), show Indian RHD layout
            renderIndianCarLayout()
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

    console.log('📤 Submit - Edit mode:', isEditMode, 'Editing offer ID:', editingOffer?.id);

    // In edit mode, skip location validation since we already have the location strings
    if (!isEditMode && (!fromLocation || !toLocation)) {
      showAlert('Error', 'Please select valid locations from the map', 'error');
      return;
    }

    const passengerCount = getPassengerSeats();
    if (passengerCount === 0) {
      showAlert('Error', 'Please enter maximum number of passengers', 'error');
      return;
    }

    const totalSeats = getTotalSeats();
    
    // Skip seat selection validation for bikes (auto-selected)
    if (totalSeats > 2 && selectedSeats.length === 0) {
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
      
      // For bikes (2 seats), only seat 2 is available
      // For cars, use selected seats or auto-generate
      let availableSeats: number[];
      if (totalSeats === 2) {
        availableSeats = [2]; // Only 1 passenger seat for bikes
      } else if (selectedSeats.length > 0) {
        availableSeats = selectedSeats;
      } else {
        // Auto-generate if none selected: Seats 2, 3, 4, etc.
        availableSeats = Array.from({ length: passengerCount }, (_, i) => i + 2);
      }

      const payload = {
        clerkId: user?.id, // Include clerkId as fallback for auth
        from: from.trim(),
        to: to.trim(),
        totalSeats,
        availableSeats,
        farePerSeat: fareAmount,
        vehicleType,
        notes: notes.trim(),
        womenOnly,
        requiresManualApproval,
        driverPrivacyType,
        publicDisclosure:
          driverPrivacyType === 'full_detail'
            ? {
                showFullName: true,
                showPhone: true,
                showFullVehicleNumber: true,
                showProfilePhoto: true,
              }
            : {
                showFullName: false,
                showPhone: false,
                showFullVehicleNumber: false,
                showProfilePhoto: false,
              },
        departureTime: departureTime.toISOString(),
        pickupLatitude: fromLocation?.latitude,
        pickupLongitude: fromLocation?.longitude,
        dropoffLatitude: toLocation?.latitude,
        dropoffLongitude: toLocation?.longitude,
        festivalType,
        festivalConfig,
      };

      console.log('📤 Payload:', JSON.stringify(payload, null, 2));

      let response;
      if (isEditMode && editingOffer?.id) {
        // Check if it's a local/temporary ID (should not be edited)
        const isLocalId = (id: string) => {
          return id.startsWith('local-') || id.startsWith('temp-');
        };

        if (isLocalId(editingOffer.id)) {
          console.log('❌ Cannot edit temporary/local ride offer:', editingOffer.id);
          showAlert('Error', 'Cannot edit this ride offer. Please create a new one instead.', 'error');
          return;
        }

        // Update existing ride offer (accept any non-local ID)
        console.log('🔄 Updating existing ride offer:', editingOffer.id);
        try {
          // updateRideOffer expects availableSeats as number, not array
          const updatePayload = { 
            ...payload, 
            availableSeats: availableSeats.length 
          };
          response = await updateRideOffer(editingOffer.id, updatePayload);
          console.log('✅ Ride offer updated:', response);
          showAlert('Success', 'Your ride offer has been updated!', 'success');
        } catch (error: any) {
          console.error('❌ Update failed, will create new:', error);
          // If update fails (e.g., ID not found), create new instead
          console.log('🔄 Fallback: Creating new ride offer');
          response = await createRideOffer(payload);
          console.log('✅ New ride offer created:', response);
          showAlert('Success', 'Your ride offer has been created!', 'success');
        }
      } else {
        // Create new ride offer
        console.log('✨ Creating new ride offer');
        response = await createRideOffer(payload);
        console.log('✅ Ride offer created:', response);
        console.log('🔍 Response structure:', JSON.stringify(response, null, 2));
        showAlert('Success', 'Your ride offer has been created! Passengers can now see and book it.', 'success');
      }
      setTimeout(() => {
        handleClose();
        const realId = response?.rideOffer?._id || response?.rideOffer?.id || editingOffer?.id;
        const successPayload = {
          id: realId,
          from: from.trim(),
          to: to.trim(),
          passengers: passengerCount,
          fare: fareAmount,
          womenOnly,
          createdAt: response?.rideOffer?.createdAt || editingOffer?.createdAt || new Date().toISOString(),
          departureTime: departureTime.toISOString(),
        };
        console.log('🖭 Real ID extracted:', realId);
        console.log('📤 Calling onSuccess with payload:', JSON.stringify(successPayload, null, 2));
        onSuccess?.(successPayload);
      }, 1500);
    } catch (error) {
      console.error(`❌ Error ${isEditMode ? 'updating' : 'creating'} ride offer:`, error);
      showAlert('Error', `Failed to ${isEditMode ? 'update' : 'create'} ride offer. Please try again.`, 'error');
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
    setRequiresManualApproval(false);
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
            <View style={styles.routePanel}>
              <Text style={styles.routePanelTitle}>Route</Text>
              <Text style={styles.routePanelSubtitle}>
                Pick exact pickup and drop-off points. Distance can be estimated after both are selected.
              </Text>
              <View style={styles.routeRows}>
                <View style={styles.routeRail}>
                  <View style={[styles.routeDot, styles.pickupDot]} />
                  <View style={styles.routeLine} />
                  <View style={[styles.routeDot, styles.dropoffDot]} />
                  <View style={styles.routeLine} />
                  <View style={[styles.routeDot, styles.timeDot]} />
                </View>
                <View style={styles.routeInputs}>
                  <TouchableOpacity
                    style={styles.routeField}
                    onPress={() => openLocationPicker('from')}
                    activeOpacity={0.75}>
                    <View style={styles.routeFieldCopy}>
                      <Text style={styles.routeLabel}>Pickup</Text>
                      <Text
                        style={[styles.routeValue, !from && styles.routePlaceholder]}
                        numberOfLines={1}>
                        {from || 'Where will passengers board?'}
                      </Text>
                    </View>
                    <Navigation size={18} color={Colors.dark.gold} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.routeField}
                    onPress={() => openLocationPicker('to')}
                    activeOpacity={0.75}>
                    <View style={styles.routeFieldCopy}>
                      <Text style={styles.routeLabel}>Drop-off</Text>
                      <Text
                        style={[styles.routeValue, !to && styles.routePlaceholder]}
                        numberOfLines={1}>
                        {to || 'Where are you going?'}
                      </Text>
                    </View>
                    <MapPin size={18} color={Colors.dark.pink} />
                  </TouchableOpacity>

                  <View style={[styles.routeField, styles.routeFieldLast]}>
                    <View style={styles.routeFieldCopy}>
                      <Text style={styles.routeLabel}>Departure</Text>
                      <Text style={styles.routeValue} numberOfLines={1}>
                        {departureTime.toLocaleString('en-IN', {
                          weekday: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                    <Navigation size={18} color={Colors.dark.gold} />
                  </View>
                </View>
              </View>

              {/* Recent Searches */}
              {recentSearches.length > 0 && (!from || !to) && (
                <View style={styles.recentSearches}>
                  <Text style={styles.recentTitle}>📍 Recent Searches</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScrollView}>
                    {recentSearches.slice(0, 8).map((search, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.recentChip}
                        onPress={() => {
                          Keyboard.dismiss();
                          if (!from) {
                            handleRecentSearchSelect(search, 'from');
                          } else if (!to) {
                            handleRecentSearchSelect(search, 'to');
                          }
                        }}
                      >
                        <Navigation size={14} color={Colors.dark.gold} />
                        <Text style={styles.recentText} numberOfLines={1}>
                          {search}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

            </View>

            {/* Route Information - Optional */}
            {fromLocation && toLocation && (
              <View style={styles.routeSummarySection}>
                <RouteInfo
                  pickupLocation={fromLocation}
                  dropoffLocation={toLocation}
                  farePerKm={15}
                  totalSeats={getPassengerSeats()}
                  onFareCalculated={handleFareCalculated}
                  onCalculationStart={handleCalculationStart}
                />
              </View>
            )}

            {/* Show message when locations are not set */}
            {(!fromLocation || !toLocation) && from && to && (
              <View style={styles.routeSummarySection}>
                <Text style={styles.locationHint}>
                  📍 Please select locations from the map to calculate route
                </Text>
              </View>
            )}

            {/* Departure Time */}
            <DateTimeSelectorAdvanced
              value={departureTime}
              onChange={setDepartureTime}
              minimumDate={new Date(Date.now() + 5 * 60 * 1000)} // 5 minutes from now
              label="When do you want to depart?"
            />

            {/* Vehicle Type Selection */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>Vehicle and seats</Text>
                <Text style={styles.sectionStep}>2</Text>
              </View>
              <Text style={styles.sectionHint}>
                Choose the vehicle first. Passenger seats adjust automatically and can be edited.
              </Text>
              <View style={styles.vehicleTypeList}>
                {VEHICLE_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.vehicleTypeButton,
                      vehicleType === option.value && styles.vehicleTypeButtonActive,
                    ]}
                    onPress={() => {
                      setVehicleType(option.value);
                      // Auto-set max passengers based on vehicle type
                      if (option.value === 'two_wheeler') {
                        setMaxPassengers('1');
                      } else if (option.value === 'three_wheeler') {
                        setMaxPassengers('3');
                      } else {
                        setMaxPassengers('3'); // Default for cars
                      }
                    }}>
                    <Text
                      style={[
                        styles.vehicleTypeText,
                        vehicleType === option.value && styles.vehicleTypeTextActive,
                      ]}>
                      {option.label}
                    </Text>
                    {option.subtitle && (
                      <Text style={styles.vehicleTypeSubtitle}>{option.subtitle}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {activeFestivalCampaigns.length > 0 && (
              <View style={styles.festivalSection}>
                <View style={styles.festivalHeader}>
                  <View style={styles.festivalHeaderCopy}>
                    <View style={styles.festivalTitleRow}>
                      <Sparkles size={17} color={Colors.dark.gold} />
                      <Text style={styles.sectionTitle}>Festival pool</Text>
                    </View>
                    <Text style={styles.sectionHint}>
                      Optional. Only admin-enabled seasons are shown here.
                    </Text>
                  </View>
                  {festivalType ? (
                    <TouchableOpacity onPress={() => setFestivalType('')} style={styles.clearFestivalButton}>
                      <Text style={styles.clearFestivalText}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.festivalList}>
                  {activeFestivalCampaigns.map((campaign) => {
                    const meta = FESTIVALS[campaign.id];
                    const isSelected = festivalType === campaign.id;

                    return (
                      <TouchableOpacity
                        key={campaign.id}
                        style={[
                          styles.festivalOption,
                          isSelected && styles.festivalOptionActive,
                        ]}
                        onPress={() => {
                          setFestivalType(campaign.id);
                          setFestivalConfig((config) => ({
                            ...config,
                            discount: true,
                            smartPricing: true,
                            tier: config.tier || 'Tier 1',
                          }));
                        }}
                        activeOpacity={0.8}>
                        <View style={styles.festivalOptionTop}>
                          <Text style={styles.festivalEmoji}>{meta.emoji}</Text>
                          <View style={styles.festivalOptionCopy}>
                            <Text style={styles.festivalOptionTitle}>{campaign.label}</Text>
                            <Text style={styles.festivalOptionNote} numberOfLines={2}>
                              {campaign.note}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.festivalOptionMeta}>
                          <CalendarDays size={13} color={Colors.dark.textSecondary} />
                          <Text style={styles.festivalOptionMetaText}>
                            {campaign.startsAt} to {campaign.endsAt}
                          </Text>
                          <Text style={styles.festivalDiscountText}>
                            {meta.discountPercentage}% promo
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {festivalType ? (
                  <View style={styles.festivalToggles}>
                    {FESTIVAL_TOGGLE_OPTIONS.map(({ key, label }) => (
                      <TouchableOpacity
                        key={key}
                        style={styles.festivalToggle}
                        onPress={() => toggleFestivalConfigOption(key)}>
                        <Switch
                          value={festivalConfig[key]}
                          onValueChange={() => toggleFestivalConfigOption(key)}
                        />
                        <Text style={styles.festivalToggleText}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            )}

            {/* Max Passengers */}
            <View style={styles.formSectionCompact}>
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
            <View style={styles.formSectionCompact}>
              <View style={styles.inputGroup}>
                <View style={styles.inputLabel}>
                  <DollarSign size={16} color={Colors.dark.gold} />
                  <Text style={styles.label}>Fare per Seat (₹)</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={suggestedFare > 0 ? `Suggested: ₹${suggestedFare} (10% off map estimate)` : "Enter your fare per seat"}
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
            <View style={styles.formSection}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>Preferences</Text>
                <Text style={styles.sectionStep}>3</Text>
              </View>
              <Text style={styles.sectionHint}>
                Add notes and booking rules only when they help passengers decide.
              </Text>
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

              <View style={styles.switchContainer}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchText}>Driver public profile</Text>
                  <Text style={styles.switchSubtext}>
                    Private vehicle hides full identity and vehicle number from passengers
                  </Text>
                </View>
              </View>

              <View style={styles.approvalModeOptions}>
                <TouchableOpacity
                  style={[
                    styles.approvalModeButton,
                    driverPrivacyType === 'private_vehicle' && styles.approvalModeButtonActive,
                  ]}
                  onPress={() => setDriverPrivacyType('private_vehicle')}>
                  <Text style={[
                    styles.approvalModeButtonText,
                    driverPrivacyType === 'private_vehicle' && styles.approvalModeButtonTextActive,
                  ]}>
                    Private vehicle
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.approvalModeButton,
                    driverPrivacyType === 'full_detail' && styles.approvalModeButtonActive,
                  ]}
                  onPress={() => setDriverPrivacyType('full_detail')}>
                  <Text style={[
                    styles.approvalModeButtonText,
                    driverPrivacyType === 'full_detail' && styles.approvalModeButtonTextActive,
                  ]}>
                    Full details
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.approvalModeDescription}>
                {driverPrivacyType === 'private_vehicle'
                  ? 'Passengers see limited public details. Admin still keeps verification data separately.'
                  : 'Passengers can see your full public driver and vehicle details.'}
              </Text>

              <View style={styles.switchContainer}>
                <View style={styles.switchLabel}>
                  <Text style={styles.switchText}>Passenger Approval</Text>
                  <Text style={styles.switchSubtext}>
                    How you want to approve bookings
                  </Text>
                </View>
              </View>

              <View style={styles.approvalModeOptions}>
                <TouchableOpacity
                  style={[
                    styles.approvalModeButton,
                    !requiresManualApproval && styles.approvalModeButtonActive,
                  ]}
                  onPress={() => setRequiresManualApproval(false)}>
                  <Text style={[
                    styles.approvalModeButtonText,
                    !requiresManualApproval && styles.approvalModeButtonTextActive,
                  ]}>
                    🚀 Auto-Approve
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.approvalModeButton,
                    requiresManualApproval && styles.approvalModeButtonActive,
                  ]}
                  onPress={() => setRequiresManualApproval(true)}>
                  <Text style={[
                    styles.approvalModeButtonText,
                    requiresManualApproval && styles.approvalModeButtonTextActive,
                  ]}>
                    ✋ Manual Review
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.approvalModeDescription}>
                {requiresManualApproval
                  ? 'You\'ll review and approve each booking within 5 minutes'
                  : 'Bookings are automatically confirmed instantly'}
              </Text>
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
                {isSubmitting 
                  ? (isEditMode ? 'Updating...' : 'Creating...') 
                  : (isEditMode ? 'Update Offer' : 'Offer Ride')
                }
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
  routePanel: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  routePanelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  routePanelSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  routeSummarySection: {
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
    maxWidth: 180,
  },
  recentScrollView: {
    paddingVertical: 4,
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
  fareHintSubtle: {
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
  formSection: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  formSectionCompact: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionStep: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.dark.gold + '22',
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    overflow: 'hidden',
  },
  sectionHint: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  festivalSection: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '55',
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  festivalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  festivalHeaderCopy: {
    flex: 1,
  },
  festivalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearFestivalButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  clearFestivalText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  festivalList: {
    gap: 10,
  },
  festivalOption: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    padding: 12,
  },
  festivalOptionActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '14',
  },
  festivalOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  festivalEmoji: {
    fontSize: 24,
  },
  festivalOptionCopy: {
    flex: 1,
  },
  festivalOptionTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  festivalOptionNote: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  festivalOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  festivalOptionMetaText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
  },
  festivalDiscountText: {
    color: Colors.dark.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  festivalToggles: {
    marginTop: 12,
    gap: 10,
  },
  festivalToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  festivalToggleText: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
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
  seatWrapper: {
    alignItems: 'center',
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
  bikeInfo: {
    width: '100%',
    backgroundColor: Colors.dark.gold + '15',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '30',
  },
  bikeInfoText: {
    fontSize: 14,
    color: Colors.dark.gold,
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
  recentLocationIcon: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: Colors.dark.background,
  },
  recentDropdownText: {
    fontSize: 15,
    color: Colors.dark.text,
    flex: 1,
  },
  approvalModeOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  approvalModeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approvalModeButtonActive: {
    backgroundColor: Colors.dark.gold + '20',
    borderColor: Colors.dark.gold,
  },
  approvalModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  approvalModeButtonTextActive: {
    color: Colors.dark.gold,
  },
  approvalModeDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 16,
    fontStyle: 'italic',
    paddingHorizontal: 0,
  },
});
