/**
 * Route Info Component
 * Shows distance, duration, and estimated fare between two locations
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Navigation, Clock, DollarSign } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { fetchRouteFromGoogle, type RouteCoordinate } from '@/lib/routeService';

interface RouteInfoProps {
  pickupLocation: RouteCoordinate | null;
  dropoffLocation: RouteCoordinate | null;
  farePerKm?: number;
  onFareCalculated?: (fare: number) => void;
  onCalculationStart?: () => void;
}

export default function RouteInfo({
  pickupLocation,
  dropoffLocation,
  farePerKm = 15,
  onFareCalculated,
  onCalculationStart,
}: RouteInfoProps) {
  const [distance, setDistance] = useState<string>('--');
  const [duration, setDuration] = useState<string>('--');
  const [fare, setFare] = useState<number>(0);
  const [originalFare, setOriginalFare] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  // Reset when locations change
  useEffect(() => {
    if (pickupLocation && dropoffLocation) {
      // Don't auto-calculate, just reset
      resetInfo();
    } else {
      resetInfo();
    }
  }, [pickupLocation, dropoffLocation]);

  const fetchRoute = async () => {
    if (!pickupLocation || !dropoffLocation) return;

    try {
      setLoading(true);
      setCalculated(false);
      
      // Notify parent that calculation has started
      if (onCalculationStart) {
        onCalculationStart();
      }
      
      const result = await fetchRouteFromGoogle(pickupLocation, dropoffLocation);

      if (result.success && result.distanceValue > 0) {
        // Show exact Google Maps data
        setDistance(result.distance);
        setDuration(result.duration);

        // Calculate fare using actual Google distance value (in meters)
        const distanceKm = result.distanceValue / 1000; // Convert meters to km
        const baseFare = Math.round(distanceKm * farePerKm);
        const discountedFare = Math.round(baseFare * 0.9); // 10% discount
        setOriginalFare(baseFare);
        setFare(discountedFare);
        setCalculated(true);
        
        console.log(`📊 Google Maps Data: ${result.distance} (${result.distanceValue}m), ${result.duration} (${result.durationValue}s)`);
        console.log(`💰 Calculated: ₹${baseFare} → ₹${discountedFare} (10% off)`);
        
        // Notify parent component of calculated fare
        if (onFareCalculated) {
          onFareCalculated(discountedFare);
        }
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
    setOriginalFare(0);
    setCalculated(false);
  };

  if (!pickupLocation || !dropoffLocation) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Route Information</Text>
        {calculated && <Text style={styles.googleBadge}>🗺️ Google Maps</Text>}
      </View>
      
      {!calculated && !loading ? (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.calculateButton}
            onPress={fetchRoute}
          >
            <Text style={styles.calculateButtonText}>📍 Calculate Market Rate (Optional)</Text>
          </TouchableOpacity>
          <Text style={styles.optionalHint}>
            You can proceed without calculating, or tap above to see suggested pricing
          </Text>
        </View>
      ) : loading ? (
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
            <Text style={styles.infoLabel}>Market Rate</Text>
            <Text style={styles.infoValue}>₹{originalFare}</Text>
            {originalFare > 0 && (
              <>
                <View style={styles.dividerLine} />
                <Text style={styles.reducedLabel}>Your Price</Text>
                <Text style={styles.discountedValue}>₹{fare}</Text>
              </>
            )}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
  buttonContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  calculateButton: {
    backgroundColor: Colors.dark.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  calculateButtonText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '600',
  },
  optionalHint: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
    fontWeight: '600',
    color: Colors.dark.text,
  },
  googleBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.dark.gold,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
  dividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 8,
  },
  reducedLabel: {
    fontSize: 10,
    color: Colors.dark.gold,
    marginBottom: 2,
    fontWeight: '600',
  },
  discountedValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
});
