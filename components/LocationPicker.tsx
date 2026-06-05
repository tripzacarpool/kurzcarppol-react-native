/**
 * Location Picker with Map and Autocomplete
 *
 * Uses the backend Google Maps proxy when EXPO_PUBLIC_API_URL is set, so Expo Go
 * and web both share the same working API path.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Region } from 'react-native-maps';
import { Check, LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { GOOGLE_MAPS_API_KEY, MAP_CONFIG } from '@/config/googleMaps';
import { getApiBaseUrl } from '@/lib/backendConfig';
import { MapPlaceholder, MapView, Marker, PROVIDER_GOOGLE, checkMapAvailability } from './ConditionalMap';

const { height } = Dimensions.get('window');
const MAPS_PROXY_BASE_URL = getApiBaseUrl();

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
  const normalizedTitle = title.toLowerCase();
  const isDropoffPicker =
    normalizedTitle.includes('drop') ||
    normalizedTitle.includes('destination') ||
    normalizedTitle.includes('going') ||
    normalizedTitle.includes('go?');
  const locationKind = isDropoffPicker ? 'drop-off' : 'pickup';
  const locationAccent = locationKind === 'drop-off' ? Colors.dark.pink : Colors.dark.gold;
  const shortTitle = locationKind === 'drop-off' ? 'Choose drop-off' : 'Choose pickup';
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null,
  );
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: initialLocation?.latitude || MAP_CONFIG.DEFAULT_REGION.latitude,
    longitude: initialLocation?.longitude || MAP_CONFIG.DEFAULT_REGION.longitude,
    latitudeDelta: MAP_CONFIG.DEFAULT_REGION.latitudeDelta,
    longitudeDelta: MAP_CONFIG.DEFAULT_REGION.longitudeDelta,
  });

  useEffect(() => {
    if (!visible) return;

    setSearchQuery(initialLocation?.address || '');
    setSelectedLocation(initialLocation || null);
    setPredictions([]);
    setLocationError('');
    setMapRegion({
      latitude: initialLocation?.latitude || MAP_CONFIG.DEFAULT_REGION.latitude,
      longitude: initialLocation?.longitude || MAP_CONFIG.DEFAULT_REGION.longitude,
      latitudeDelta: MAP_CONFIG.DEFAULT_REGION.latitudeDelta,
      longitudeDelta: MAP_CONFIG.DEFAULT_REGION.longitudeDelta,
    });
  }, [visible, initialLocation]);

  const canUseTypedAddress = useMemo(
    () => searchQuery.trim().length >= 3 && !selectedLocation,
    [searchQuery, selectedLocation],
  );

  const buildMapsUrl = useCallback((path: string, params: string, fallbackUrl: string) => {
    if (MAPS_PROXY_BASE_URL) {
      return `${MAPS_PROXY_BASE_URL}/api/maps/${path}?${params}`;
    }

    return fallbackUrl;
  }, []);

  const searchPlaces = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setLocationError('');

      const url = buildMapsUrl(
        'autocomplete',
        `input=${encodeURIComponent(query)}`,
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query,
        )}&key=${GOOGLE_MAPS_API_KEY}&components=country:in`,
      );

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK') {
        setPredictions(data.predictions || []);
      } else {
        setPredictions([]);
        if (data.status !== 'ZERO_RESULTS') {
          setLocationError('Location search is not responding. Try the full address.');
        }
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setPredictions([]);
      setLocationError('Location search failed. Check backend/network, or type the full address.');
    } finally {
      setLoading(false);
    }
  }, [buildMapsUrl]);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setPredictions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchPlaces]);

  const setPickedLocation = (location: LocationData) => {
    const region = {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setSelectedLocation(location);
    setSearchQuery(location.address);
    setMapRegion(region);
    mapRef.current?.animateToRegion(region, 500);
  };

  const handlePlaceSelect = async (placeId: string, description: string) => {
    try {
      Keyboard.dismiss();
      setLoading(true);
      setLocationError('');
      setPredictions([]);

      const url = buildMapsUrl(
        'place-details',
        `place_id=${encodeURIComponent(placeId)}`,
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
          placeId,
        )}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`,
      );

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.result?.geometry?.location) {
        const { lat, lng } = data.result.geometry.location;
        setPickedLocation({
          address: description,
          latitude: lat,
          longitude: lng,
        });
      } else {
        setLocationError('Could not get coordinates for this place. Please try another result.');
      }
    } catch (error) {
      console.error('Place details error:', error);
      setLocationError('Could not select this location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reverseGeocodeLocation = async (
    latitude: number,
    longitude: number,
    fallbackLabel = 'Pinned location',
  ) => {
    try {
      setLoading(true);
      setLocationError('');

      const url = buildMapsUrl(
        'geocode',
        `latlng=${encodeURIComponent(`${latitude},${longitude}`)}`,
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`,
      );

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results?.[0]) {
        const location = {
          address: data.results[0].formatted_address,
          latitude,
          longitude,
        };
        setPickedLocation(location);
        return location;
      } else {
        const location = {
          address: `${fallbackLabel} (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
          latitude,
          longitude,
        };
        setPickedLocation(location);
        return location;
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      const location = {
        address: `${fallbackLabel} (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
        latitude,
        longitude,
      };
      setPickedLocation(location);
      setLocationError('Address lookup failed, but the pinned coordinates are selected.');
      return location;
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    await reverseGeocodeLocation(latitude, longitude, 'Tapped location');
  };

  const handleRegionChangeComplete = (region: Region) => {
    setMapRegion(region);

    if (!selectedLocation) return;

    const movedFarEnough =
      Math.abs(region.latitude - selectedLocation.latitude) > 0.00015 ||
      Math.abs(region.longitude - selectedLocation.longitude) > 0.00015;

    if (movedFarEnough) {
      setSelectedLocation(null);
      setLocationError('');
    }
  };

  const handleConfirmPinnedLocation = async () => {
    const location = await reverseGeocodeLocation(
      mapRegion.latitude,
      mapRegion.longitude,
      'Pinned location',
    );
    onLocationSelect(location);
    onClose();
  };

  const handleUseTypedAddress = async () => {
    const address = searchQuery.trim();
    if (address.length < 3) return;

    try {
      Keyboard.dismiss();
      setLoading(true);
      setLocationError('');
      setPredictions([]);

      const url = buildMapsUrl(
        'geocode',
        `address=${encodeURIComponent(address)}`,
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          address,
        )}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        setPickedLocation({
          address: data.results[0].formatted_address || address,
          latitude: lat,
          longitude: lng,
        });
      } else {
        setLocationError('Could not find that address. Please add city/area and try again.');
      }
    } catch (error) {
      console.error('Address geocode error:', error);
      setLocationError('Could not find that address. Please check backend/network.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
      onClose();
      return;
    }

    handleConfirmPinnedLocation();
  };

  const handleClear = () => {
    setSearchQuery('');
    setPredictions([]);
    setSelectedLocation(null);
    setLocationError('');
  };

  const pickerContent = (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{shortTitle}</Text>
            <Text style={styles.headerSubtitle}>Search, then adjust the pin</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchPanel}>
          <View style={[styles.routeBadge, { borderColor: locationAccent }]}>
            <View style={[styles.routeDot, { backgroundColor: locationAccent }]} />
            <Text style={styles.routeBadgeText}>
              {locationKind === 'drop-off' ? 'Destination' : 'Pickup point'}
            </Text>
          </View>

          <View style={[styles.searchContainer, { borderColor: selectedLocation ? locationAccent : Colors.dark.border }]}>
            <Search size={20} color={Colors.dark.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                locationKind === 'drop-off'
                  ? 'Search destination, area or landmark'
                  : 'Search pickup, area or landmark'
              }
              placeholderTextColor={Colors.dark.textSecondary}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setSelectedLocation(null);
              }}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleUseTypedAddress}
            />
            {loading ? (
              <ActivityIndicator size="small" color={locationAccent} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <X size={18} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

          {predictions.length > 0 && (
            <View style={styles.predictionsContainer}>
              <FlatList
                data={predictions}
                keyExtractor={(item) => item.place_id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.predictionItem}
                    onPress={() => handlePlaceSelect(item.place_id, item.description)}>
                    <View style={[styles.predictionIcon, { backgroundColor: `${locationAccent}20` }]}>
                      <MapPin size={17} color={locationAccent} />
                    </View>
                    <View style={styles.predictionText}>
                      <Text style={styles.predictionMain} numberOfLines={1}>
                        {item.structured_formatting.main_text}
                      </Text>
                      <Text style={styles.predictionSecondary} numberOfLines={1}>
                        {item.structured_formatting.secondary_text}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={styles.predictionsList}
              />
            </View>
          )}

          {canUseTypedAddress && (
            <TouchableOpacity
              style={styles.useTypedButton}
              onPress={handleUseTypedAddress}
              disabled={loading}>
              <MapPin size={18} color={locationAccent} />
              <Text style={styles.useTypedText} numberOfLines={1}>
                {`Search for "${searchQuery.trim()}"`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.mapContainer}>
          {checkMapAvailability() && MapView ? (
            <>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                customMapStyle={MAP_CONFIG.MAP_STYLE}
                initialRegion={mapRegion}
                region={mapRegion}
                onPress={handleMapPress}
                onRegionChangeComplete={handleRegionChangeComplete}
                showsUserLocation
                showsMyLocationButton>
                {selectedLocation && Marker && (
                  <Marker
                    coordinate={{
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                    }}
                    title={selectedLocation.address}>
                    <View style={[styles.markerContainer, { borderColor: locationAccent }]}>
                      <Navigation size={24} color={locationAccent} fill={locationAccent} />
                    </View>
                  </Marker>
                )}
              </MapView>

              {!selectedLocation && (
                <View pointerEvents="none" style={styles.centerPinWrap}>
                  <View style={[styles.centerPin, { borderColor: locationAccent }]}>
                    <MapPin size={28} color={locationAccent} fill={locationAccent} />
                  </View>
                  <View style={styles.pinShadow} />
                </View>
              )}

              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={locationAccent} />
                </View>
              )}

              <View style={styles.instructionBanner}>
                <LocateFixed size={16} color={locationAccent} />
                <Text style={styles.instructionText}>
                  Move the map until the pin is exactly on the {locationKind}
                </Text>
              </View>
            </>
          ) : (
            <MapPlaceholder message="Maps require a development build. Use search above." />
          )}
        </View>

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={[
            styles.selectedLocationContainer,
            !selectedLocation && styles.selectedLocationEmpty,
            selectedLocation && { borderColor: locationAccent },
          ]}>
            <View style={styles.selectedIcon}>
              {selectedLocation ? (
                <Check size={18} color={locationAccent} />
              ) : (
                <MapPin size={18} color={Colors.dark.textSecondary} />
              )}
            </View>
            <View style={styles.selectedCopy}>
              <Text style={styles.selectedLabel}>
                {selectedLocation ? `${locationKind} selected` : 'Pin is ready'}
              </Text>
              <Text
                style={[
                  styles.selectedLocationText,
                  !selectedLocation && styles.selectedPlaceholder,
                ]}
                numberOfLines={2}>
                {selectedLocation?.address || 'Drag the map or tap any spot to select the exact point'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.confirmButton,
              { backgroundColor: locationAccent },
              loading && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={loading}>
            <Text style={styles.confirmButtonText}>
              {selectedLocation ? `Confirm ${locationKind}` : 'Confirm pinned point'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
  );

  if (Platform.OS === 'web') {
    if (!visible) {
      return null;
    }

    return (
      <View style={styles.webOverlay}>
        {pickerContent}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      {pickerContent}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  webOverlay: {
    position: 'fixed' as any,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10000,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  closeButton: {
    padding: 4,
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  headerSpacer: {
    width: 32,
  },
  searchPanel: {
    backgroundColor: Colors.dark.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  routeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    backgroundColor: Colors.dark.card,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.text,
    textTransform: 'uppercase',
  },
  sheet: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderTopWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: Colors.dark.text,
    minHeight: 22,
  },
  clearButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionsContainer: {
    maxHeight: height * 0.24,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  predictionsList: {
    maxHeight: height * 0.24,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  predictionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  errorText: {
    marginBottom: 10,
    fontSize: 13,
    color: Colors.dark.error,
  },
  useTypedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  useTypedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    minHeight: 260,
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
  centerPinWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 54,
    height: 64,
    marginLeft: -27,
    marginTop: -58,
    alignItems: 'center',
  },
  centerPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.background,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinShadow: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
    marginTop: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dark.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
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
    marginBottom: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.gold,
  },
  selectedLocationEmpty: {
    borderColor: Colors.dark.border,
  },
  selectedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedCopy: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  selectedLocationText: {
    fontSize: 14,
    lineHeight: 19,
    color: Colors.dark.text,
  },
  selectedPlaceholder: {
    color: Colors.dark.textSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.background,
  },
});
