import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import {
  AlertTriangle,
  X,
  Share2,
  Phone,
  AlertCircle,
  Zap,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { SOS_POPUP_OPTIONS } from '@/constants/womenSafety';
import { activateSOS } from '@/lib/api';

interface SOSMenuProps {
  rideId: string;
  visible: boolean;
  onClose: () => void;
  onShareTrip: () => void;
  onReportIssue: () => void;
  driverName?: string;
  passengerName?: string;
}

export default function SOSMenu({
  rideId,
  visible,
  onClose,
  onShareTrip,
  onReportIssue,
  driverName = 'Driver',
  passengerName = 'Passenger',
}: SOSMenuProps) {
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const handleEmergencyCall = () => {
    Alert.alert(
      'Call Emergency Services',
      'Are you sure you want to call 112 (Emergency)?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Call 112',
          onPress: () => {
            Linking.openURL('tel:112');
            onClose();
          },
          style: 'destructive',
        },
      ],
    );
  };

  const handleSendSOS = async () => {
    try {
      setLoading(true);
      setSelectedAction('send_sos');
      await activateSOS(rideId, 'User sent emergency alert');
      Alert.alert(
        '🚨 Alert Sent',
        'Emergency alert has been sent to support team and your emergency contacts. Help is on the way.',
      );
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send alert');
    } finally {
      setLoading(false);
      setSelectedAction(null);
    }
  };

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case 'share_trip':
        onShareTrip();
        onClose();
        break;
      case 'emergency_call':
        handleEmergencyCall();
        break;
      case 'report_issue':
        onReportIssue();
        onClose();
        break;
      case 'send_sos':
        handleSendSOS();
        break;
      default:
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <AlertTriangle size={28} color={Colors.dark.error} />
            <Text style={styles.headerText}>Safety Options</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          {/* Message */}
          <Text style={styles.message}>
            What would you like to do?
          </Text>

          {/* Options */}
          <ScrollView
            style={styles.optionsContainer}
            scrollEnabled={false}>
            {SOS_POPUP_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  selectedAction === option.id && styles.optionButtonActive,
                ]}
                onPress={() => handleAction(option.id)}
                disabled={loading || selectedAction !== null}
                activeOpacity={0.7}>
                <View style={styles.optionContent}>
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                </View>
                {selectedAction === option.id && loading && (
                  <ActivityIndicator size="small" color={Colors.dark.error} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            💡 If you're in immediate danger, always call 112 first
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.dark.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
    marginLeft: 12,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  message: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 16,
    marginLeft: 4,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: Colors.dark.background,
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.error,
  },
  optionButtonActive: {
    backgroundColor: Colors.dark.error + '20',
    borderLeftColor: Colors.dark.error,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  optionDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  cancelButton: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cancelButtonText: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 14,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.dark.warning,
    textAlign: 'center',
    fontWeight: '500',
  },
});
