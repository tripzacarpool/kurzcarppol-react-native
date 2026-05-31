import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  Animated,
  View,
  Text,
} from 'react-native';
import { AlertTriangle, Phone, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

interface SOSButtonProps {
  rideId: string;
  onSOSActivated: (rideId: string) => Promise<void>;
  driverName?: string;
  driverPhone?: string;
  disabled?: boolean;
}

export default function SOSButton({
  rideId,
  onSOSActivated,
  driverName = 'Driver',
  driverPhone,
  disabled = false,
}: SOSButtonProps) {
  const [sosActivated, setSosActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Pulse animation for SOS button
  useEffect(() => {
    if (sosActivated) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    }
  }, [sosActivated, pulseAnim]);

  const handleSOSPress = () => {
    if (sosActivated) {
      // Cancel SOS
      Alert.alert('Cancel SOS', 'Are you sure you want to cancel the SOS alert?', [
        { text: 'Keep SOS Active', onPress: () => {} },
        {
          text: 'Cancel SOS',
          onPress: () => setSosActivated(false),
          style: 'destructive',
        },
      ]);
      return;
    }

    // Activate SOS - Show confirmation
    Alert.alert(
      '🚨 Activate SOS Alert?',
      `This will immediately alert ${driverName} and nearby emergency contacts that you need help.${driverPhone ? '\n\nDriver will be notified immediately.' : ''}`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Yes, Activate SOS',
          onPress: async () => {
            setLoading(true);
            try {
              await onSOSActivated(rideId);
              setSosActivated(true);
              Alert.alert(
                '🚨 SOS Activated',
                'Emergency alert has been sent. Help is on the way.',
              );
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message || 'Failed to activate SOS. Please try again.',
              );
              console.error('SOS activation error:', error);
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  if (sosActivated) {
    return (
      <Animated.View
        style={[
          styles.sosContainer,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.sosButton, styles.sosButtonActive]}
          onPress={handleSOSPress}
          disabled={loading}
        >
          <AlertTriangle
            size={28}
            color="white"
            strokeWidth={2.5}
            style={{ marginBottom: 4 }}
          />
          <Text style={styles.sosButtonText}>SOS ACTIVE</Text>
          <Text style={styles.sosButtonSubtext}>Tap to cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <View style={styles.sosContainer}>
      <TouchableOpacity
        style={[styles.sosButton, disabled && styles.sosButtonDisabled]}
        onPress={handleSOSPress}
        disabled={loading || disabled}
        activeOpacity={0.7}
      >
        <AlertTriangle size={24} color="white" strokeWidth={2.5} />
        <Text style={styles.sosButtonText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  sosButton: {
    width: width * 0.35,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FF4444',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sosButtonActive: {
    backgroundColor: '#CC0000',
    shadowColor: '#CC0000',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sosButtonDisabled: {
    opacity: 0.5,
  },
  sosButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  sosButtonSubtext: {
    color: '#FFE5E5',
    fontSize: 11,
    position: 'absolute',
    bottom: 4,
    right: 8,
  },
});
