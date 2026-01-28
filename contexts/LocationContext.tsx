import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address?: string;
  city?: string;
  country?: string;
}

interface LocationContextType {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  updateLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType>({
  location: null,
  loading: false,
  error: null,
  hasPermission: false,
  requestPermission: async () => false,
  updateLocation: async () => {},
});

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const requestPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'web') {
        setError('Location is not available on web');
        return false;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);

      if (!granted) {
        setError('Location permission denied');
      }

      return granted;
    } catch (err) {
      setError('Failed to request permission');
      return false;
    }
  };

  const updateLocation = async () => {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setLoading(false);
          return;
        }
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy } = currentLocation.coords;

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      const addressData = reverseGeocode[0];

      const locationData: LocationData = {
        latitude,
        longitude,
        accuracy,
        address: addressData
          ? `${addressData.street || ''} ${addressData.name || ''}`.trim()
          : undefined,
        city: addressData?.city || undefined,
        country: addressData?.country || undefined,
      };

      setLocation(locationData);

      if (user) {
        // Update user location in MongoDB via backend API
        // NOTE: This is for user location tracking, NOT for live ride tracking
        // Live ride tracking uses WebSocket (see lib/locationSocket.ts)
        // NO Google Maps API calls here - just backend storage
        try {
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.102:5000';
          const locationUrl = `${API_URL}/api/users/location`;
          
          const locationPayload = {
            userId: user.id,
            latitude,
            longitude,
            city: locationData.city,
            country: locationData.country,
          };
          
          console.log('📍 Updating location to:', locationUrl);
          console.log('📦 Payload:', JSON.stringify(locationPayload));
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const locResponse = await fetch(locationUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(locationPayload),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!locResponse.ok) {
            console.error('❌ Location update failed:', locResponse.status);
          } else {
            console.log('✅ Location updated');
          }
        } catch (err) {
          console.warn('⚠️ Location update failed (non-critical):', err instanceof Error ? err.message : 'Unknown error');
          // Non-critical - app continues without location updates
        }
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const checkPermission = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted' && user) {
        updateLocation();
      }
    };

    checkPermission();
  }, [user]);

  useEffect(() => {
    if (!hasPermission || !user || Platform.OS === 'web') {
      return;
    }

    const interval = setInterval(() => {
      updateLocation();
    }, 30000);

    return () => clearInterval(interval);
  }, [hasPermission, user]);

  const value = {
    location,
    loading,
    error,
    hasPermission,
    requestPermission,
    updateLocation,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
