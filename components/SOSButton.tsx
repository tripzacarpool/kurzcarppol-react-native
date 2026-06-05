import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface SOSButtonProps {
  rideId: string;
  onSOSActivated: (rideId: string) => Promise<any>;
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

  const openEmergencySms = async (response: any) => {
    const alertData = response?.data || response?.sosAlert || response;
    const emergencyContacts = Array.isArray(alertData?.emergencyContacts)
      ? alertData.emergencyContacts
      : [];
    const phones = [
      ...new Set(
        emergencyContacts
          .map((contact: any) => contact?.phone)
          .filter(Boolean),
      ),
    ];
    const route = [alertData?.pickupLocation?.name, alertData?.dropoffLocation?.name]
      .filter(Boolean)
      .join(' to ');
    const location =
      alertData?.currentLocation?.latitude && alertData?.currentLocation?.longitude
        ? ` Location: https://maps.google.com/?q=${alertData.currentLocation.latitude},${alertData.currentLocation.longitude}`
        : '';
    const body = `SOS ALERT: I need help during my Tripza ride${route ? ` (${route})` : ''}. Ride ID: ${rideId}.${location}`;

    if (phones.length === 0) {
      Alert.alert(
        'No emergency contacts',
        'SOS was sent to Tripza support and ride participants. Add emergency contacts in your safety settings for direct SMS alerts.',
        [
          { text: 'OK' },
          {
            text: 'Call 112',
            style: 'destructive',
            onPress: () => Linking.openURL('tel:112'),
          },
        ],
      );
      return;
    }

    const separator = Platform.OS === 'ios' ? ',' : ';';
    const smsUrl = `sms:${phones.join(separator)}?body=${encodeURIComponent(body)}`;

    try {
      if (await Linking.canOpenURL(smsUrl)) {
        await Linking.openURL(smsUrl);
        return;
      }
    } catch (error) {
      console.warn('Unable to open SMS composer:', error);
    }

    Alert.alert(
      'Emergency SMS ready',
      `Please message these emergency contacts now:\n${phones.join(', ')}`,
      [
        { text: 'OK' },
        {
          text: 'Call 112',
          style: 'destructive',
          onPress: () => Linking.openURL('tel:112'),
        },
      ],
    );
  };

  useEffect(() => {
    if (!sosActivated) return;

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
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
  }, [pulseAnim, sosActivated]);

  const activateSOSAlert = async () => {
    setLoading(true);
    try {
      const response = await onSOSActivated(rideId);
      setSosActivated(true);

      if (Platform.OS === 'web') {
        const sendSms =
          typeof window !== 'undefined'
            ? window.confirm(
                'SOS activated. Open emergency SMS to your saved contacts?',
              )
            : false;
        if (sendSms) {
          await openEmergencySms(response);
        }
        return;
      }

      Alert.alert(
        'SOS Activated',
        'Emergency alert has been sent. You can also message your saved emergency contacts now.',
        [
          {
            text: 'Send SMS',
            onPress: () => {
              openEmergencySms(response).catch((error) => {
                console.warn('Emergency SMS failed:', error);
              });
            },
          },
          {
            text: 'Call 112',
            style: 'destructive',
            onPress: () => Linking.openURL('tel:112'),
          },
        ],
      );
    } catch (error: any) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(error.message || 'Failed to activate SOS. Please try again.');
      } else {
        Alert.alert(
          'Error',
          error.message || 'Failed to activate SOS. Please try again.',
        );
      }
      console.error('SOS activation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSOSPress = () => {
    if (sosActivated) {
      if (Platform.OS === 'web') {
        const shouldCancel =
          typeof window !== 'undefined'
            ? window.confirm('Cancel SOS alert?')
            : false;
        if (shouldCancel) {
          setSosActivated(false);
        }
        return;
      }

      Alert.alert('Cancel SOS', 'Are you sure you want to cancel the SOS alert?', [
        { text: 'Keep SOS Active', style: 'cancel' },
        {
          text: 'Cancel SOS',
          onPress: () => setSosActivated(false),
          style: 'destructive',
        },
      ]);
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(
              `Activate SOS alert? This will immediately alert ${driverName}, Tripza support, and saved emergency contacts.`,
            )
          : true;
      if (confirmed) {
        activateSOSAlert();
      }
      return;
    }

    Alert.alert(
      'Activate SOS Alert?',
      `This will immediately alert ${driverName}, Tripza support, and saved emergency contacts.${driverPhone ? '\n\nDriver will be notified immediately.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Activate SOS',
          onPress: activateSOSAlert,
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
            style={styles.activeIcon}
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
        <Text style={styles.sosButtonText}>{loading ? 'Sending...' : 'SOS'}</Text>
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
    minWidth: 132,
    maxWidth: 240,
    paddingVertical: 12,
    paddingHorizontal: 18,
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
  activeIcon: {
    marginBottom: 4,
  },
});
