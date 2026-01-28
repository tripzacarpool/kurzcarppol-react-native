/**
 * Route Info Component
 * Shows distance, duration, and estimated fare between two locations
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Navigation, Clock, DollarSign } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { fetchRouteFromGoogle, type RouteCoordinate } from '@/lib/routeService';

interface RouteInfoProps {
  pickupLocation: RouteCoordinate | null;
  dropoffLocation: RouteCoordinate | null;
  farePerKm?: number;
}

export default function RouteInfo({
  pickupLocation,
  dropoffLocation,
  farePerKm = 15,
}: RouteInfoProps) {
  const [distance, setDistance] = useState<string>('--');
  const [duration, setDuration] = useState<string>('--');
  const [fare, setFare] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      fetchRoute();
    } else {
      resetInfo();
    }
  }, [pickupLocation, dropoffLocation]);

  const fetchRoute = async () => {
    if (!pickupLocation || !dropoffLocation) return;

    try {
      setLoading(true);
      const result = await fetchRouteFromGoogle(pickupLocation, dropoffLocation);

      if (result.success) {
        setDistance(result.distance);
        setDuration(result.duration);

        // Calculate fare based on distance
        const distanceKm = parseFloat(result.distance.replace(/[^0-9.]/g, ''));
        const estimatedFare = Math.round(distanceKm * farePerKm);
        setFare(estimatedFare);
      } else {
        resetInfo();
      }
    } catch (error) {
      console.error('❌ Error fetching route:', error);
      resetInfo();
    } finally {
      setLoading(false);
    }
  };

  const resetInfo = () => {
    setDistance('--');
    setDuration('--');
    setFare(0);
  };

  if (!pickupLocation || !dropoffLocation) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Route Information</Text>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.dark.gold} />
          <Text style={styles.loadingText}>Calculating route...</Text>
        </View>
      ) : (
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Navigation size={18} color={Colors.dark.gold} />
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>{distance}</Text>
          </View>

          <View style={styles.infoCard}>
            <Clock size={18} color={Colors.dark.gold} />
            <Text style={styles.infoLabel}>Duration</Text>
            <Text style={styles.infoValue}>{duration}</Text>
          </View>

          <View style={styles.infoCard}>
            <DollarSign size={18} color={Colors.dark.gold} />
            <Text style={styles.infoLabel}>Est. Fare</Text>
            <Text style={styles.infoValue}>₹{fare}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    marginTop: 6,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
});
