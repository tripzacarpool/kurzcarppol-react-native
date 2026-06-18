import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, ActivityIndicator, RefreshControl, Dimensions, Platform, StatusBar, Animated } from 'react-native';
import { MapPin, Bell, Navigation, Plus, X, CircleDot } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { RideCard } from '@/components/RideCard';
import { BookingModal } from '@/components/BookingModal';
import RideRequestModal from '@/components/RideRequestModal';
import { Ride } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/contexts/LocationContext';
import { apiClient, getAvailableRideOffers, getAvailableRides, requestRideOfferHold } from '@/lib/api';
import { subscribeToNewRides, unsubscribeFromRideEvents, initializeLocationSocket } from '@/lib/locationSocket';
import CustomAlert, { AlertButton, AlertType } from '@/components/CustomAlert';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const RIDE_PAGE_SIZE = 12;

const toRadians = (value: number) => (value * Math.PI) / 180;

const normalizeSearch = (value: string) =>
  value.toLowerCase().trim().replace(/\s+/g, ' ');

const parseRouteSearch = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) return { query: '', from: '', to: '' };

  const match = cleaned.match(/^(?:from\s+)?(.+?)\s+(?:to|towards|for|->|→)\s+(.+)$/i);
  if (!match) return { query: cleaned, from: '', to: '' };

  return {
    query: cleaned,
    from: match[1].trim(),
    to: match[2].trim(),
  };
};

const getPickupDistanceKm = (ride: any, currentLocation: any) => {
  if (!currentLocation) {
    return typeof ride.pickupDistanceKm === 'number' ? ride.pickupDistanceKm : null;
  }

  const pickupLatitude = Number(ride.pickupLatitude);
  const pickupLongitude = Number(ride.pickupLongitude);
  if (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude)) {
    return typeof ride.pickupDistanceKm === 'number' ? ride.pickupDistanceKm : null;
  }

  const dLat = toRadians(pickupLatitude - currentLocation.latitude);
  const dLon = toRadians(pickupLongitude - currentLocation.longitude);
  const lat1 = toRadians(currentLocation.latitude);
  const lat2 = toRadians(pickupLatitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getDropoffDistanceKm = (ride: any, targetLocation: any) => {
  if (!targetLocation) {
    return typeof ride.dropoffDistanceKm === 'number' ? ride.dropoffDistanceKm : null;
  }

  const dropoffLatitude = Number(ride.dropoffLatitude);
  const dropoffLongitude = Number(ride.dropoffLongitude);
  if (!Number.isFinite(dropoffLatitude) || !Number.isFinite(dropoffLongitude)) {
    return typeof ride.dropoffDistanceKm === 'number' ? ride.dropoffDistanceKm : null;
  }

  const dLat = toRadians(dropoffLatitude - targetLocation.latitude);
  const dLon = toRadians(dropoffLongitude - targetLocation.longitude);
  const lat1 = toRadians(targetLocation.latitude);
  const lat2 = toRadians(dropoffLatitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const geocodeSearchPlace = async (place: string) => {
  const cleaned = place.trim();
  if (cleaned.length < 2) return null;

  const response = await apiClient.get('/api/maps/geocode', {
    params: { address: cleaned },
  });
  const match = response.data?.results?.[0]?.geometry?.location;
  const latitude = Number(match?.lat);
  const longitude = Number(match?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const rideMatchesQuery = (ride: any, query: string) => {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const routeSearch = parseRouteSearch(query);
  if (routeSearch.from && routeSearch.to) {
    return (
      normalizeSearch(ride.from || '').includes(normalizeSearch(routeSearch.from)) &&
      normalizeSearch(ride.to || '').includes(normalizeSearch(routeSearch.to))
    );
  }

  const searchable = [
    ride.from,
    ride.to,
    ride.pickupCity,
    ride.pickupCountry,
    ride.dropoffCity,
    ride.dropoffCountry,
    ride.driver?.name,
    ride.vehicle?.model,
    ride.vehicle?.number,
    ride.farePerSeat ? `rs ${ride.farePerSeat}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return normalizeSearch(searchable).includes(normalizedQuery);
};

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const { location, loading: locationLoading, hasPermission, requestPermission, updateLocation } = useLocation();
  const [womenOnlyFilter, setWomenOnlyFilter] = useState(false);
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [rideRequestModalVisible, setRideRequestModalVisible] = useState(false);
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [nearestBoardingRides, setNearestBoardingRides] = useState<any[]>([]);
  const [nearestFallbackMode, setNearestFallbackMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [fieldFallbackSuggestions, setFieldFallbackSuggestions] = useState<any[]>([]);
  const [fieldFallbackMode, setFieldFallbackMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [fieldFallbackLoading, setFieldFallbackLoading] = useState(false);
  const [loadingRides, setLoadingRides] = useState(false);
  const [loadingMoreRides, setLoadingMoreRides] = useState(false);
  const [ridePage, setRidePage] = useState(1);
  const [hasMoreRides, setHasMoreRides] = useState(true);
  const [totalRideCount, setTotalRideCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [rideDelta, setRideDelta] = useState(0);
  const [holdingRideId, setHoldingRideId] = useState<string | null>(null);
  const previousRideCountRef = useRef(0);
  const deltaAnim = useRef(new Animated.Value(0)).current;
  
  // Custom alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: AlertType;
    buttons?: AlertButton[];
  }>({ title: '', message: '', type: 'info' });

  const showAlert = (
    title: string,
    message: string,
    type: AlertType = 'info',
    buttons?: AlertButton[],
  ) => {
    setAlertConfig({ title, message, type, buttons });
    setAlertVisible(true);
  };

  const hideAlert = () => {
    setAlertVisible(false);
    setTimeout(() => {
      setAlertConfig({ title: '', message: '', type: 'info' });
    }, 300);
  };

  useEffect(() => {
    fetchAvailableRides({ reset: true, query: debouncedSearchQuery });
    
    // Initialize socket connection
    initializeLocationSocket();
    
    // Subscribe to new rides in real-time
    subscribeToNewRides((newRide) => {
      console.log('📨 Received new ride via socket:', newRide);
      // Refresh rides to include the new one
      fetchAvailableRides({ reset: true, query: debouncedSearchQuery });
    });
    
    // Poll for new rides every 30 seconds as fallback
    const interval = setInterval(() => {
      fetchAvailableRides({ reset: true, silent: true, query: debouncedSearchQuery });
    }, 30000);
    
    return () => {
      clearInterval(interval);
      unsubscribeFromRideEvents();
    };
  }, [debouncedSearchQuery, location?.latitude, location?.longitude, user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const from = fromQuery.trim();
      const to = toQuery.trim();
      setDebouncedSearchQuery(from && to ? `${from} to ${to}` : to || from);
    }, 300);

    return () => clearTimeout(timer);
  }, [fromQuery, toQuery]);

  const fetchAvailableRides = async ({
    reset = false,
    silent = false,
    query = debouncedSearchQuery,
    page,
  }: {
    reset?: boolean;
    silent?: boolean;
    query?: string;
    page?: number;
  } = {}) => {
    if (!user?.id) return;
      const nextPage = page || (reset ? 1 : ridePage);

      try {
        if (!silent) {
          if (reset) {
            setLoadingRides(true);
          } else {
            setLoadingMoreRides(true);
          }
        }

      const typedFrom = fromQuery.trim();
      const typedTo = toQuery.trim();
      const routeSearch =
        typedFrom || typedTo
          ? {
              query: query || [typedFrom, typedTo].filter(Boolean).join(' '),
              from: typedFrom,
              to: typedTo,
            }
          : parseRouteSearch(query || '');
      const response = await getAvailableRideOffers({
        q: routeSearch.from && routeSearch.to ? undefined : routeSearch.query || undefined,
        from: routeSearch.from || undefined,
        to: routeSearch.to || undefined,
        page: nextPage,
        limit: RIDE_PAGE_SIZE,
        lat: location?.latitude,
        lng: location?.longitude,
      });
      const joinableResponse = reset
        ? await getAvailableRides(user.id, 'requests', { joinable: true })
        : { rides: [] };
      
      if (response.rideOffers && Array.isArray(response.rideOffers)) {
        
        // Filter out self-authored rides and mark as offers
        const filtered = response.rideOffers
          .filter((ride: any) => {
            const isOwnRide = ride.clerkId === user.id;
            return !isOwnRide;
          })
          .map((ride: any) => ({ ...ride, rideType: 'offer' as const }));
        const joinableRequests = Array.isArray(joinableResponse.rides)
          ? joinableResponse.rides
              .filter((ride: any) => ride.clerkId !== user.id)
              .map((ride: any) => ({
                ...ride,
                rideType: 'request' as const,
                kind: 'request',
                driver: {
                  name: ride.acceptedBy?.driverName || 'Accepted driver',
                  rating: ride.acceptedBy?.driverRating || 5,
                  gender: 'other',
                  ridesCompleted: 0,
                },
                vehicle: ride.vehicle || {
                  model: 'Shared ride',
                  number: 'Pool',
                  color: 'Unknown',
                },
                farePerSeat: ride.fareSplit?.perSeatEstimate || ride.farePerSeat || 0,
                availableSeats: ride.availableSeats || [],
              }))
              .filter((ride: any) => rideMatchesQuery(ride, query || ''))
          : [];
        const visibleRides = reset ? [...filtered, ...joinableRequests] : filtered;

        if (reset && visibleRides.length === 0 && (routeSearch.from || routeSearch.to)) {
          const source = Array.isArray(response.rideOffers) ? response.rideOffers : [];
          let fromHasMatch =
            !routeSearch.from ||
            source.some((ride: any) =>
              normalizeSearch(ride.from || '').includes(normalizeSearch(routeSearch.from)),
            );
          if (routeSearch.from && routeSearch.to && !fromHasMatch) {
            const fromOnlyResponse = await getAvailableRideOffers({
              from: routeSearch.from,
              page: 1,
              limit: 1,
            });
            fromHasMatch = (fromOnlyResponse.rideOffers?.length || 0) > 0;
          }
          const fallbackMode: 'pickup' | 'dropoff' =
            routeSearch.from && !fromHasMatch ? 'pickup' : 'dropoff';
          const targetText = fallbackMode === 'pickup' ? routeSearch.from : routeSearch.to;
          const targetLocation =
            fallbackMode === 'pickup' && location?.latitude && location?.longitude
              ? await geocodeSearchPlace(targetText)
              : await geocodeSearchPlace(targetText);

          if (targetLocation) {
            const fallbackResponse = await getAvailableRideOffers({
              from: fallbackMode === 'dropoff' && routeSearch.from ? routeSearch.from : undefined,
              to: fallbackMode === 'pickup' && routeSearch.to ? routeSearch.to : undefined,
              page: 1,
              limit: 5,
              lat: targetLocation.latitude,
              lng: targetLocation.longitude,
              distanceTo: fallbackMode,
            });

            const nearest = Array.isArray(fallbackResponse.rideOffers)
              ? fallbackResponse.rideOffers
                  .filter((ride: any) => ride.clerkId !== user.id)
                  .map((ride: any) => ({
                    ...ride,
                    rideType: 'offer' as const,
                    pickupDistanceKm:
                      fallbackMode === 'pickup'
                        ? getPickupDistanceKm(ride, targetLocation) ?? ride.pickupDistanceKm
                        : ride.pickupDistanceKm,
                    dropoffDistanceKm:
                      fallbackMode === 'dropoff'
                        ? getDropoffDistanceKm(ride, targetLocation) ?? ride.dropoffDistanceKm
                        : ride.dropoffDistanceKm,
                  }))
                  .sort((a: any, b: any) => {
                    const key = fallbackMode === 'pickup' ? 'pickupDistanceKm' : 'dropoffDistanceKm';
                    const aDistance = typeof a[key] === 'number' ? a[key] : Number.POSITIVE_INFINITY;
                    const bDistance = typeof b[key] === 'number' ? b[key] : Number.POSITIVE_INFINITY;
                    return aDistance - bDistance;
                  })
                  .slice(0, 3)
              : [];

            setNearestFallbackMode(fallbackMode);
            setNearestBoardingRides(nearest);
          } else {
            setNearestBoardingRides([]);
          }
        } else if (reset) {
          setNearestBoardingRides([]);
        }
        setAvailableRides((current) => {
          if (reset) return visibleRides;

          const seen = new Set(current.map((ride) => ride.id));
          const merged = [...current];
          filtered.forEach((ride: any) => {
            if (!seen.has(ride.id)) {
              merged.push(ride);
            }
          });
          return merged;
        });
        setRidePage(nextPage + 1);
        setTotalRideCount((response.pagination?.total ?? filtered.length) + joinableRequests.length);
        setHasMoreRides(response.pagination?.hasMore ?? filtered.length === RIDE_PAGE_SIZE);
      } else {
        console.warn('⚠️ No ride offers in response, using empty array');
        if (reset) setAvailableRides([]);
        if (reset) setNearestBoardingRides([]);
        setTotalRideCount(0);
        setHasMoreRides(false);
      }
    } catch (error) {
      console.error('❌ Error fetching available rides:', error);
      // Don't clear rides on error, keep showing existing data
      if (availableRides.length === 0) {
        console.log('📦 No rides available');
        setAvailableRides([]);
      }
    } finally {
      setLoadingRides(false);
      setLoadingMoreRides(false);
    }
  };

  const submitHoldRequest = async (rideId: string, minutes: number) => {
    if (!user?.id) return;

    setHoldingRideId(rideId);
    try {
      await requestRideOfferHold(rideId, minutes, user.id);
      showAlert(
        'Hold request sent',
        `Driver will be asked to wait ${minutes} minutes. You will be notified if they agree.`,
        'success',
      );
    } catch (error: any) {
      showAlert(
        'Could not send request',
        error?.response?.data?.error || 'Please try again in a moment.',
        'error',
      );
    } finally {
      setHoldingRideId(null);
    }
  };

  const handleHoldRequest = (rideId: string) => {
    showAlert('Ask driver to wait', 'Choose how long you want the vehicle held.', 'warning', [
      { text: '5 min', onPress: () => submitHoldRequest(rideId, 5) },
      { text: '10 min', onPress: () => submitHoldRequest(rideId, 10) },
      { text: '15 min', onPress: () => submitHoldRequest(rideId, 15) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRequestLocation = async () => {
    const granted = await requestPermission();
    if (granted) {
      await updateLocation();
      showAlert('Success', 'Location permission granted and location updated!', 'success');
    } else {
      showAlert('Permission Denied', 'Location permission is required to show nearby rides.', 'warning');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const userName = user?.firstName?.split(' ')[0] || 'Rider';

  const currentLocation = location
    ? location.city && location.country
      ? `${location.city}, ${location.country}`
      : `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
    : 'Location not available';

  // Filter out invalid and expired rides
  const filterValidRides = (rides: any[]) => {
    const now = new Date();
    return rides.filter((ride) => {
      // Must have a valid departure time
      if (!ride.departureTime) {
        console.log('❌ Ride without departure time:', ride.id);
        return false;
      }

      // Parse departure time
      const departureTime = new Date(ride.departureTime);
      
      // Check if date is valid
      if (isNaN(departureTime.getTime())) {
        console.log('❌ Ride with invalid departure time:', ride.id, ride.departureTime);
        return false;
      }

      // Check if ride has expired (5 minutes after departure)
      const expirationTime = new Date(departureTime.getTime() + 5 * 60000);
      if (now > expirationTime) {
        console.log('⏰ Expired ride:', ride.id, 'departed at', departureTime);
        return false;
      }

      return true;
    });
  };

  const filteredRides = useMemo(() => {
    const validRides = filterValidRides(availableRides);

    return validRides
      .filter((ride) => {
        const matchesWomenFilter = !womenOnlyFilter || ride.womenOnly;
        return matchesWomenFilter && rideMatchesQuery(ride, debouncedSearchQuery);
      })
      .map((ride) => ({
        ...ride,
        pickupDistanceKm: getPickupDistanceKm(ride, location),
      }))
      .sort((a, b) => {
        const aDistance =
          typeof a.pickupDistanceKm === 'number'
            ? a.pickupDistanceKm
            : Number.POSITIVE_INFINITY;
        const bDistance =
          typeof b.pickupDistanceKm === 'number'
            ? b.pickupDistanceKm
            : Number.POSITIVE_INFINITY;

        const aDistanceBucket = Number.isFinite(aDistance) ? Math.floor(aDistance / 2) : Number.POSITIVE_INFINITY;
        const bDistanceBucket = Number.isFinite(bDistance) ? Math.floor(bDistance / 2) : Number.POSITIVE_INFINITY;
        if (aDistanceBucket !== bDistanceBucket) return aDistanceBucket - bDistanceBucket;

        const aDeparture = new Date(a.departureTime).getTime();
        const bDeparture = new Date(b.departureTime).getTime();
        if (aDeparture !== bDeparture) return aDeparture - bDeparture;

        if (aDistance !== bDistance) return aDistance - bDistance;

        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [availableRides, debouncedSearchQuery, location, womenOnlyFilter]);

  const validAvailableRidesCount = filteredRides.length;

  const routeSuggestions = useMemo(() => {
    const fromSearch = normalizeSearch(fromQuery);
    const toSearch = normalizeSearch(toQuery);
    const activeMode: 'pickup' | 'dropoff' = toSearch ? 'dropoff' : 'pickup';
    const activeQuery = activeMode === 'pickup' ? fromSearch : toSearch;
    if (activeQuery.length < 2) return [];

    const seen = new Set<string>();
    return availableRides
      .filter((ride) => {
        const fromText = normalizeSearch(ride.from || '');
        const toText = normalizeSearch(ride.to || '');
        return fromText.includes(activeQuery) || toText.includes(activeQuery);
      })
      .map((ride) => ({
        from: ride.from || '',
        to: ride.to || '',
        pickupDistanceKm: getPickupDistanceKm(ride, location),
        dropoffDistanceKm: getDropoffDistanceKm(ride, location),
        displayDistanceKm:
          activeMode === 'pickup'
            ? getPickupDistanceKm(ride, location)
            : getDropoffDistanceKm(ride, location),
        matchRank:
          activeMode === 'pickup'
            ? normalizeSearch(ride.from || '').includes(activeQuery)
              ? 0
              : 1
            : normalizeSearch(ride.to || '').includes(activeQuery)
              ? 0
              : 1,
      }))
      .filter((ride) => {
        const key = `${ride.from}->${ride.to}`;
        if (!ride.from || !ride.to || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;

        const aRawDistance = activeMode === 'pickup' ? a.pickupDistanceKm : a.dropoffDistanceKm;
        const bRawDistance = activeMode === 'pickup' ? b.pickupDistanceKm : b.dropoffDistanceKm;
        const aDistance = typeof aRawDistance === 'number' ? aRawDistance : Number.POSITIVE_INFINITY;
        const bDistance = typeof bRawDistance === 'number' ? bRawDistance : Number.POSITIVE_INFINITY;
        return aDistance - bDistance;
      })
      .slice(0, 3);
  }, [availableRides, fromQuery, location, toQuery]);

  useEffect(() => {
    let cancelled = false;
    const from = fromQuery.trim();
    const to = toQuery.trim();
    const activeField: 'pickup' | 'dropoff' = to ? 'dropoff' : 'pickup';
    const activeText = activeField === 'pickup' ? from : to;

    if (activeText.length < 2 || routeSuggestions.length > 0) {
      setFieldFallbackSuggestions([]);
      setFieldFallbackLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setFieldFallbackLoading(true);
        const targetLocation = await geocodeSearchPlace(activeText);
        if (!targetLocation || cancelled) return;

        const response = await getAvailableRideOffers({
          page: 1,
          limit: 3,
          lat: targetLocation.latitude,
          lng: targetLocation.longitude,
          distanceTo: activeField,
          ...(activeField === 'pickup' && to ? { to } : {}),
          ...(activeField === 'dropoff' && from ? { from } : {}),
        });

        if (cancelled) return;
        const nearest = Array.isArray(response.rideOffers)
          ? response.rideOffers
              .filter((ride: any) => ride.clerkId !== user?.id)
              .map((ride: any) => ({
                ...ride,
                rideType: 'offer' as const,
                pickupDistanceKm:
                  activeField === 'pickup'
                    ? getPickupDistanceKm(ride, targetLocation) ?? ride.pickupDistanceKm
                    : ride.pickupDistanceKm,
                dropoffDistanceKm:
                  activeField === 'dropoff'
                    ? getDropoffDistanceKm(ride, targetLocation) ?? ride.dropoffDistanceKm
                    : ride.dropoffDistanceKm,
              }))
          : [];

        setFieldFallbackMode(activeField);
        setFieldFallbackSuggestions(nearest);
      } catch {
        if (!cancelled) setFieldFallbackSuggestions([]);
      } finally {
        if (!cancelled) setFieldFallbackLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fromQuery, routeSuggestions.length, toQuery, user?.id]);

  useEffect(() => {
    const previousCount = previousRideCountRef.current;
    if (previousCount > 0 && validAvailableRidesCount > previousCount) {
      setRideDelta(validAvailableRidesCount - previousCount);
      deltaAnim.setValue(0);
      Animated.sequence([
        Animated.spring(deltaAnim, {
          toValue: 1,
          friction: 5,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.delay(1400),
        Animated.timing(deltaAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setRideDelta(0));
    }
    previousRideCountRef.current = validAvailableRidesCount;
  }, [deltaAnim, validAvailableRidesCount]);

  const deltaStyle = {
    opacity: deltaAnim,
    transform: [
      {
        translateY: deltaAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: deltaAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAvailableRides({ reset: true, query: debouncedSearchQuery });
    setRefreshing(false);
  };

  const handleLoadMore = useCallback(() => {
    if (loadingRides || loadingMoreRides || !hasMoreRides) return;
    fetchAvailableRides({ page: ridePage, query: debouncedSearchQuery });
  }, [debouncedSearchQuery, hasMoreRides, loadingMoreRides, loadingRides, ridePage]);

  const handleFeedScroll = ({ nativeEvent }: any) => {
    const distanceFromBottom =
      nativeEvent.contentSize.height -
      nativeEvent.layoutMeasurement.height -
      nativeEvent.contentOffset.y;

    if (distanceFromBottom < 450) {
      handleLoadMore();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleFeedScroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerCopy}>
              <Text style={styles.greetingLabel}>{getGreeting()}</Text>
              <Text style={styles.greetingName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>
                {userName}
              </Text>
              <Text style={styles.subtitle}>Nearby pickups first, then all rides</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/(tabs)/alerts')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open notifications">
              <Bell size={22} color={Colors.dark.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.locationContainer}
            onPress={hasPermission ? updateLocation : handleRequestLocation}
            activeOpacity={0.7}>
            <View style={styles.locationLeft}>
              <MapPin size={20} color={Colors.dark.gold} />
              <View style={styles.locationTextContainer}>
                <Text style={styles.currentLocation}>{currentLocation}</Text>
                {location && (
                  <Text style={styles.locationCoords}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </Text>
                )}
              </View>
            </View>
            {locationLoading ? (
              <ActivityIndicator size="small" color={Colors.dark.gold} />
            ) : !hasPermission ? (
              <Navigation size={20} color={Colors.dark.gold} />
            ) : null}
          </TouchableOpacity>

          <View style={styles.searchPanel}>
            <View style={styles.searchTitleRow}>
              <View style={styles.searchTitleCopy}>
                <Text style={styles.searchTitle}>Where are you going?</Text>
                <Text style={styles.searchHint}>Choose pickup and destination to match rides faster</Text>
              </View>
              {fromQuery || toQuery ? (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => {
                    setFromQuery('');
                    setToQuery('');
                  }}
                  activeOpacity={0.75}>
                  <X size={18} color={Colors.dark.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.routeSelector}>
              <View style={styles.routeRail}>
                <CircleDot size={16} color={Colors.dark.gold} />
                <View style={styles.routeRailLine} />
                <MapPin size={16} color={Colors.dark.pink} />
              </View>
              <View style={styles.routeInputs}>
                <View style={styles.routeInputRow}>
                  <Text style={styles.routeInputLabel}>From</Text>
                  <TextInput
                    style={styles.routeTextInput}
                    placeholder={currentLocation !== 'Location not available' ? currentLocation : 'Pickup location'}
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={fromQuery}
                    onChangeText={setFromQuery}
                    autoCorrect={false}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
                <View style={styles.routeInputDivider} />
                <View style={styles.routeInputRow}>
                  <Text style={styles.routeInputLabel}>To</Text>
                  <TextInput
                    style={styles.routeTextInput}
                    placeholder="Where to?"
                    placeholderTextColor={Colors.dark.textSecondary}
                    value={toQuery}
                    onChangeText={setToQuery}
                    autoCorrect={false}
                    autoCapitalize="words"
                    returnKeyType="search"
                  />
                </View>
              </View>
            </View>

            {routeSuggestions.length > 0 && (
              <View style={styles.routeSuggestions}>
                {routeSuggestions.map((suggestion) => (
                  <TouchableOpacity
                    key={`${suggestion.from}-${suggestion.to}`}
                    style={styles.routeSuggestionItem}
                    onPress={() => {
                      setFromQuery(suggestion.from);
                      setToQuery(suggestion.to);
                    }}
                    activeOpacity={0.78}>
                    <View style={styles.routeSuggestionDot} />
                    <Text style={styles.routeSuggestionText} numberOfLines={1}>
                      {suggestion.from} → {suggestion.to}
                    </Text>
                    {typeof suggestion.displayDistanceKm === 'number' && (
                      <Text style={styles.routeSuggestionMeta}>
                        {suggestion.displayDistanceKm.toFixed(1)} km
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {routeSuggestions.length === 0 && (fieldFallbackLoading || fieldFallbackSuggestions.length > 0) && (
              <View style={styles.routeSuggestions}>
                <Text style={styles.routeSuggestionHeader}>
                  {fieldFallbackMode === 'pickup'
                    ? 'Nearest boarding points'
                    : 'Nearest exit points'}
                </Text>
                {fieldFallbackLoading && fieldFallbackSuggestions.length === 0 ? (
                  <View style={styles.routeSuggestionItem}>
                    <ActivityIndicator size="small" color={Colors.dark.gold} />
                    <Text style={styles.routeSuggestionText}>Finding nearest points...</Text>
                  </View>
                ) : (
                  fieldFallbackSuggestions.map((suggestion) => {
                    const distance =
                      fieldFallbackMode === 'pickup'
                        ? suggestion.pickupDistanceKm
                        : suggestion.dropoffDistanceKm;
                    return (
                      <TouchableOpacity
                        key={`${fieldFallbackMode}-${suggestion.id}`}
                        style={styles.routeSuggestionItem}
                        onPress={() => {
                          setFromQuery(suggestion.from || '');
                          setToQuery(suggestion.to || '');
                        }}
                        activeOpacity={0.78}>
                        <View style={styles.routeSuggestionDot} />
                        <Text style={styles.routeSuggestionText} numberOfLines={1}>
                          {suggestion.from} â†’ {suggestion.to}
                        </Text>
                        {typeof distance === 'number' && (
                          <Text style={styles.routeSuggestionMeta}>
                            {distance.toFixed(1)} km
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.womenToggle, womenOnlyFilter && styles.womenToggleActive]}
              onPress={() => setWomenOnlyFilter(!womenOnlyFilter)}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.toggleIndicator,
                  womenOnlyFilter && styles.toggleIndicatorActive,
                ]}
              />
              <Text style={[styles.toggleText, womenOnlyFilter && styles.toggleTextActive]}>
                Women Only Rides
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createRideButton}
              onPress={() => setRideRequestModalVisible(true)}
              activeOpacity={0.7}>
              <Plus size={20} color={Colors.dark.background} />
              <Text style={styles.createRideButtonText}>Request Ride</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.ridesSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Available Rides</Text>
              <Text style={styles.sectionSubtitle}>Sorted by nearest pickup first</Text>
            </View>
            <View style={styles.rideCountContainer}>
              {validAvailableRidesCount > 0 && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveIndicator} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              )}
              <View style={styles.compactRideCountWrap}>
                {rideDelta > 0 && (
                  <Animated.View style={[styles.compactRideDeltaBadge, deltaStyle]}>
                    <Text style={styles.compactRideDeltaText}>+{rideDelta}</Text>
                  </Animated.View>
                )}
                <Text style={styles.rideCount}>
                  {filteredRides.length}/{Math.max(totalRideCount, filteredRides.length)} rides
                </Text>
              </View>
            </View>
          </View>

          {loadingRides && validAvailableRidesCount === 0 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.dark.gold} />
              <Text style={styles.loadingText}>Loading available rides...</Text>
            </View>
          ) : filteredRides.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No rides available</Text>
              <Text style={styles.emptySubtext}>
                {fromQuery || toQuery || womenOnlyFilter
                  ? 'Try adjusting your filters or check back later'
                  : 'Be the first to create a ride!'}
              </Text>
              {nearestBoardingRides.length > 0 && (
                <View style={styles.nearestBoardingBox}>
                  <Text style={styles.nearestBoardingTitle}>
                    {nearestFallbackMode === 'pickup' ? 'Nearest boarding points' : 'Nearest exit points'}
                  </Text>
                  <Text style={styles.nearestBoardingSubtitle}>
                    {nearestFallbackMode === 'pickup'
                      ? 'No exact pickup found. These boarding points are closest to your searched From location.'
                      : 'No exact destination found. These drop points are closest to your searched To location.'}
                  </Text>
                  {nearestBoardingRides.map((ride) => (
                    <TouchableOpacity
                      key={ride.id}
                      style={styles.nearestBoardingItem}
                      onPress={() => {
                        setFromQuery(ride.from || '');
                        setToQuery(ride.to || '');
                      }}
                      activeOpacity={0.78}>
                      <View style={styles.nearestBoardingPin}>
                        <MapPin size={14} color={Colors.dark.gold} />
                      </View>
                      <Text style={styles.nearestBoardingRoute} numberOfLines={1}>
                        {ride.from} → {ride.to}
                      </Text>
                      {typeof (nearestFallbackMode === 'pickup' ? ride.pickupDistanceKm : ride.dropoffDistanceKm) === 'number' && (
                        <Text style={styles.nearestBoardingDistance}>
                          {(nearestFallbackMode === 'pickup'
                            ? ride.pickupDistanceKm
                            : ride.dropoffDistanceKm
                          ).toFixed(1)} km
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setRideRequestModalVisible(true)}>
                <Plus size={20} color={Colors.dark.text} />
                <Text style={styles.emptyButtonText}>Request a Ride</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {filteredRides.map((ride, index) => (
                <RideCard
                  key={ride.id || `ride-${index}`}
                  ride={ride}
                  onPress={() => {
                    // Prevent booking completed or cancelled rides
                    if (ride.status === 'completed' || ride.status === 'cancelled') {
                      showAlert(
                        'Ride Unavailable',
                        `This ride has been ${ride.status}. You cannot book rides that have ended.`,
                        'error'
                      );
                      return;
                    }
                    setSelectedRide(ride);
                    setBookingModalVisible(true);
                  }}
                  isOwner={ride.clerkId === user?.id}
                  onHoldRequest={handleHoldRequest}
                  holding={holdingRideId === ride.id}
                />
              ))}
              {loadingMoreRides && (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={Colors.dark.gold} />
                  <Text style={styles.loadingMoreText}>Loading more rides...</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <BookingModal
        visible={bookingModalVisible}
        ride={selectedRide}
        onClose={() => setBookingModalVisible(false)}
      />

      <RideRequestModal
        visible={rideRequestModalVisible}
        onClose={() => setRideRequestModalVisible(false)}
        onRideCreated={() => {
          // Refresh rides list or show success message
          console.log('✅ Ride created successfully');
        }}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        alignItems: 'center',
      },
    }),
  },
  header: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 18 : 24,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  greetingLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  greetingName: {
    fontSize: width < 380 ? 24 : 27,
    lineHeight: width < 380 ? 30 : 33,
    fontWeight: '800',
    color: Colors.dark.text,
    marginTop: 1,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  ipText: {
    fontSize: 11,
    color: Colors.dark.gold,
    fontWeight: '600',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.dark.pink,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  badgeText: {
    color: Colors.dark.text,
    fontSize: 10,
    fontWeight: '700',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  currentLocation: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  locationCoords: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  searchPanel: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  searchTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  searchTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '800',
  },
  searchHint: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  routeSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  routeRail: {
    width: 24,
    alignItems: 'center',
    paddingTop: 6,
  },
  routeRailLine: {
    width: 1,
    flex: 1,
    minHeight: 34,
    backgroundColor: Colors.dark.border,
    marginVertical: 4,
  },
  routeInputs: {
    flex: 1,
    marginLeft: 8,
  },
  routeInputRow: {
    minHeight: 42,
    justifyContent: 'center',
  },
  routeInputLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  routeTextInput: {
    width: '100%',
    minWidth: 0,
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 0,
  },
  routeInputDivider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 8,
  },
  routeSuggestions: {
    marginTop: 10,
    gap: 7,
  },
  routeSuggestionHeader: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  routeSuggestionItem: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 8,
  },
  routeSuggestionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.dark.gold,
  },
  routeSuggestionText: {
    flex: 1,
    minWidth: 0,
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '700',
  },
  routeSuggestionMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 12,
    flexWrap: width < 390 ? 'wrap' : 'nowrap',
  },
  womenToggle: {
    flex: 1,
    minWidth: width < 390 ? '100%' : 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  womenToggleActive: {
    backgroundColor: Colors.dark.pink + '20',
    borderColor: Colors.dark.pink,
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.border,
    marginRight: 10,
  },
  toggleIndicatorActive: {
    backgroundColor: Colors.dark.pink,
  },
  toggleText: {
    flex: 1,
    minWidth: 0,
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.dark.pink,
  },
  createRideButton: {
    flex: width < 390 ? 1 : 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 6,
  },
  createRideButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '700',
  },
  compactRideCountWrap: {
    position: 'relative',
  },
  compactRideDeltaBadge: {
    position: 'absolute',
    top: -20,
    right: -4,
    backgroundColor: Colors.dark.success || '#10B981',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: Colors.dark.background,
  },
  compactRideDeltaText: {
    color: Colors.dark.background,
    fontSize: 12,
    fontWeight: '900',
  },
  ridesSection: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: width < 390 ? 'wrap' : 'nowrap',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  sectionSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rideCount: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  rideCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  loadingMoreText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  nearestBoardingBox: {
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '35',
    padding: 12,
    marginBottom: 18,
  },
  nearestBoardingTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '800',
  },
  nearestBoardingSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 10,
  },
  nearestBoardingItem: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  nearestBoardingPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold + '18',
  },
  nearestBoardingRoute: {
    flex: 1,
    minWidth: 0,
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '700',
  },
  nearestBoardingDistance: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  emptyButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
