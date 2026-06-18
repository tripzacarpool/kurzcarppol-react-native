import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Clock, Plus, Minus, X, Check } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface TimeExtensionPickerProps {
  visible: boolean;
  currentTime: Date;
  onConfirm: (newTime: Date) => void;
  onCancel: () => void;
}

const { width } = Dimensions.get('window');

export default function TimeExtensionPicker({
  visible,
  currentTime,
  onConfirm,
  onCancel,
}: TimeExtensionPickerProps) {
  const [extensionMinutes, setExtensionMinutes] = useState(15);
  const scaleAnim = useState(new Animated.Value(0))[0];

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [scaleAnim, visible]);

  const quickOptions = [5, 10, 15, 30, 60];

  const handleIncrease = () => {
    setExtensionMinutes((prev) => Math.min(prev + 5, 120));
  };

  const handleDecrease = () => {
    setExtensionMinutes((prev) => Math.max(prev - 5, 5));
  };

  const handleConfirm = () => {
    const newTime = new Date(currentTime.getTime() + extensionMinutes * 60000);
    onConfirm(newTime);
  };

  const getNewTime = () => {
    const newTime = new Date(currentTime.getTime() + extensionMinutes * 60000);
    return newTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Clock size={24} color={Colors.dark.gold} />
            </View>
            <Text style={styles.title}>Extend Ride Time</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
              <X size={24} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Current Time */}
          <View style={styles.currentTimeContainer}>
            <Text style={styles.currentTimeLabel}>Current departure time</Text>
            <Text style={styles.currentTime}>
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </Text>
          </View>

          {/* Quick Options */}
          <View style={styles.quickOptionsContainer}>
            <Text style={styles.sectionLabel}>Quick extend by:</Text>
            <View style={styles.quickOptions}>
              {quickOptions.map((minutes) => (
                <TouchableOpacity
                  key={minutes}
                  style={[
                    styles.quickOption,
                    extensionMinutes === minutes && styles.quickOptionActive,
                  ]}
                  onPress={() => setExtensionMinutes(minutes)}>
                  <Text
                    style={[
                      styles.quickOptionText,
                      extensionMinutes === minutes && styles.quickOptionTextActive,
                    ]}>
                    {minutes}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Custom Time Picker */}
          <View style={styles.pickerContainer}>
            <Text style={styles.sectionLabel}>Or adjust manually:</Text>
            <View style={styles.picker}>
              <TouchableOpacity style={styles.pickerButton} onPress={handleDecrease}>
                <Minus size={24} color={Colors.dark.text} />
              </TouchableOpacity>

              <View style={styles.timeDisplay}>
                <Text style={styles.timeValue}>{extensionMinutes}</Text>
                <Text style={styles.timeUnit}>minutes</Text>
              </View>

              <TouchableOpacity style={styles.pickerButton} onPress={handleIncrease}>
                <Plus size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>

            {/* Range Slider Visual */}
            <View style={styles.rangeContainer}>
              <View style={styles.rangeLine} />
              <View
                style={[
                  styles.rangeIndicator,
                  { left: `${(extensionMinutes / 120) * 100}%` },
                ]}
              />
            </View>
          </View>

          {/* New Time Display */}
          <View style={styles.newTimeContainer}>
            <View style={styles.arrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>
            <View style={styles.newTimeBox}>
              <Text style={styles.newTimeLabel}>New departure time</Text>
              <Text style={styles.newTime}>{getNewTime()}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Check size={20} color={Colors.dark.text} />
              <Text style={styles.confirmButtonText}>Extend Time</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: width - 40,
    maxWidth: 400,
    backgroundColor: Colors.dark.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.gold + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 8,
  },
  currentTimeContainer: {
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  currentTimeLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  currentTime: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  quickOptionsContainer: {
    marginBottom: 24,
  },
  quickOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.background,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  quickOptionActive: {
    backgroundColor: Colors.dark.gold + '20',
    borderColor: Colors.dark.gold,
  },
  quickOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  quickOptionTextActive: {
    color: Colors.dark.gold,
  },
  pickerContainer: {
    marginBottom: 24,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.background,
    borderRadius: 16,
    padding: 8,
    marginBottom: 12,
  },
  pickerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  timeDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  timeUnit: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  rangeContainer: {
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    position: 'relative',
  },
  rangeLine: {
    height: '100%',
    borderRadius: 2,
  },
  rangeIndicator: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.dark.gold,
    borderWidth: 3,
    borderColor: Colors.dark.card,
    marginLeft: -8,
  },
  newTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  arrow: {
    marginRight: 12,
  },
  arrowText: {
    fontSize: 24,
    color: Colors.dark.gold,
  },
  newTimeBox: {
    flex: 1,
    backgroundColor: Colors.dark.gold + '20',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  newTimeLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  newTime: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
});
