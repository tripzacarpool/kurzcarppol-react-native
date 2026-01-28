/**
 * Manual Location Update Button (Development Mode)
 * 
 * Cost-effective for development:
 * - Button to manually send location updates
 * - Prevents continuous GPS tracking during development
 * - Save costs while testing
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Navigation, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { Colors } from '@/constants/Colors';
import { emitDriverLocation } from '@/lib/locationSocket';

interface ManualLocationButtonProps {
  rideId: string;
  enabled?: boolean;
}

export default function ManualLocationButton({
  rideId,
  enabled = true,
}: ManualLocationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handleSendLocation = async () => {
    if (!enabled || loading) return;

    try {
      setLoading(true);

      // Get current location
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== 'granted') {
          alert('Location permission denied');
          setLoading(false);
          return;
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // Send to backend via WebSocket
      emitDriverLocation(rideId, latitude, longitude);
      
      setLastUpdate(new Date());
      console.log('📍 Manual location update sent:', latitude, longitude);
    } catch (error) {
      console.error('❌ Error sending location:', error);
      alert('Failed to send location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, !enabled && styles.buttonDisabled]}
        onPress={handleSendLocation}
        disabled={!enabled || loading}
        activeOpacity={0.7}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.dark.background} />
        ) : (
          <>
            <Navigation size={20} color={Colors.dark.background} />
            <Text style={styles.buttonText}>Send Location Update</Text>
          </>
        )}
      </TouchableOpacity>

      {lastUpdate && (
        <View style={styles.lastUpdateContainer}>
          <MapPin size={14} color={Colors.dark.textSecondary} />
          <Text style={styles.lastUpdateText}>
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Text>
        </View>
      )}

      <View style={styles.devModeIndicator}>
        <Text style={styles.devModeText}>🛠️ Development Mode</Text>
        <Text style={styles.devModeHint}>
          Manual updates only - no continuous tracking
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    margin: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.background,
  },
  lastUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  lastUpdateText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  devModeIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    alignItems: 'center',
  },
  devModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.gold,
    marginBottom: 4,
  },
  devModeHint: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
});
