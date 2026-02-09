/**
 * Location Picker with Map and Autocomplete
 * 
 * Features:
 * - Google Places Autocomplete for suggestions
 * - Interactive map to select location
 * - Calculates distance and ETA between pickup and dropoff
 * - Cost-optimized: Uses Autocomplete API only when user types
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native';
import { MapView, Marker, PROVIDER_GOOGLE, checkMapAvailability, MapPlaceholder } from './ConditionalMap';
import type { Region } from 'react-native-maps';
import { MapPin, Search, X, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { GOOGLE_MAPS_API_KEY, MAP_CONFIG } from '@/config/googleMaps';
import { calculateDistance, estimateETA } from '@/lib/routeService';

const { width, height } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  title: string;
  initialLocation?: LocationData;
}

export default function LocationPicker({
  visible,
  onClose,
  onLocationSelect,
  title,
  initialLocation,
}: LocationPickerProps) {
  const mapRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: initialLocation?.latitude || MAP_CONFIG.DEFAULT_REGION.latitude,
    longitude: initialLocation?.longitude || MAP_CONFIG.DEFAULT_REGION.longitude,
    latitudeDelta: MAP_CONFIG.DEFAULT_REGION.latitudeDelta,
    longitudeDelta: MAP_CONFIG.DEFAULT_REGION.longitudeDelta,
  });

  // Debounced autocomplete search
  useEffect(() => {
    if (searchQuery.length < 3) {
      setPredictions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchPlaces = async (query: string) => {
    try {
      setLoading(true);
      
      // Use backend proxy on web to avoid CORS, direct API on mobile
      if (!process.env.EXPO_PUBLIC_API_URL && IS_WEB) {
        throw new Error('EXPO_PUBLIC_API_URL environment variable is required for web');
      }
      const url = IS_WEB
        ? `${process.env.EXPO_PUBLIC_API_URL}/api/maps/autocomplete?input=${encodeURIComponent(query)}`
        // ? `http://10.238.194.123:5000/api/maps/autocomplete?input=${encodeURIComponent(query)}` // Local development
        : `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            query
          )}&key=${GOOGLE_MAPS_API_KEY}&components=country:in`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        setPredictions(data.predictions);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('❌ Autocomplete error:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceSelect = async (placeId: string, description: string) => {
    try {
      Keyboard.dismiss();
      setLoading(true);
      setPredictions([]);

      // Get place details for coordinates - use proxy on web
      if (!process.env.EXPO_PUBLIC_API_URL && IS_WEB) {
        throw new Error('EXPO_PUBLIC_API_URL environment variable is required for web');
      }
      const url = IS_WEB
        ? `${process.env.EXPO_PUBLIC_API_URL}/api/maps/place-details?place_id=${placeId}`
        // ? `http://10.238.194.123:5000/api/maps/place-details?place_id=${placeId}` // Local development
        : `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result?.geometry?.location) {
        const { lat, lng } = data.result.geometry.location;
        const location: LocationData = {
          address: description,
          latitude: lat,
          longitude: lng,
        };

        setSelectedLocation(location);
        setSearchQuery(description);

        // Animate map to location
        const region = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setMapRegion(region);
        mapRef.current?.animateToRegion(region, 500);
      }
    } catch (error) {
      console.error('❌ Place details error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    try {
      setLoading(true);

      // Reverse geocode to get address - use proxy on web
      if (!process.env.EXPO_PUBLIC_API_URL && IS_WEB) {
        throw new Error('EXPO_PUBLIC_API_URL environment variable is required for web');
      }
      const url = IS_WEB
        ? `${process.env.EXPO_PUBLIC_API_URL}/api/maps/geocode?latlng=${latitude},${longitude}`
        // ? `http://10.238.194.123:5000/api/maps/geocode?latlng=${latitude},${longitude}` // Local development
        : `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results[0]) {
        const address = data.results[0].formatted_address;
        const location: LocationData = {
          address,
          latitude,
          longitude,
        };

        setSelectedLocation(location);
        setSearchQuery(address);
      }
    } catch (error) {
      console.error('❌ Reverse geocode error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
      onClose();
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setPredictions([]);
    setSelectedLocation(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.dark.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location..."
            placeholderTextColor={Colors.dark.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClear}>
              <X size={20} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete Predictions */}
        {predictions.length > 0 && (
          <View style={styles.predictionsContainer}>
            <FlatList
              data={predictions}
              keyExtractor={(item) => item.place_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.predictionItem}
                  onPress={() => handlePlaceSelect(item.place_id, item.description)}>
                  <MapPin size={18} color={Colors.dark.gold} />
                  <View style={styles.predictionText}>
                    <Text style={styles.predictionMain}>
                      {item.structured_formatting.main_text}
                    </Text>
                    <Text style={styles.predictionSecondary}>
                      {item.structured_formatting.secondary_text}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.predictionsList}
            />
          </View>
        )}

        {/* Map */}
        <View style={styles.mapContainer}>
          {checkMapAvailability() && MapView ? (
            <>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                customMapStyle={MAP_CONFIG.MAP_STYLE}
                initialRegion={mapRegion}
                onPress={handleMapPress}
                showsUserLocation
                showsMyLocationButton>
                {selectedLocation && Marker && (
                  <Marker
                    coordinate={{
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                    }}
                    title={selectedLocation.address}>
                    <View style={styles.markerContainer}>
                      <Navigation size={24} color={Colors.dark.gold} fill={Colors.dark.gold} />
                    </View>
                  </Marker>
                )}
              </MapView>

              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.dark.gold} />
                </View>
              )}

              {/* Instruction */}
              <View style={styles.instructionBanner}>
                <Text style={styles.instructionText}>
                  Tap on map to select location or search above
                </Text>
              </View>
            </>
          ) : (
            <MapPlaceholder message="Maps require a development build. Use search above." />
          )}
        </View>

        {/* Selected Location Info */}
        {selectedLocation && (
          <View style={styles.selectedLocationContainer}>
            <MapPin size={20} color={Colors.dark.gold} />
            <Text style={styles.selectedLocationText} numberOfLines={2}>
              {selectedLocation.address}
            </Text>
          </View>
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          style={[
            styles.confirmButton,
            !selectedLocation && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!selectedLocation}>
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: Colors.dark.text,
  },
  predictionsContainer: {
    maxHeight: height * 0.3,
    marginHorizontal: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 8,
  },
  predictionsList: {
    maxHeight: height * 0.3,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  predictionText: {
    flex: 1,
    marginLeft: 12,
  },
  predictionMain: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  predictionSecondary: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.gold,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: Colors.dark.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  instructionText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  selectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  selectedLocationText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: Colors.dark.text,
  },
  confirmButton: {
    backgroundColor: Colors.dark.gold,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.background,
  },  webConfirmContainer: {
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  webHint: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  webConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.gold,
    padding: 14,
    borderRadius: 8,
  },
  webConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.background,
  },});
