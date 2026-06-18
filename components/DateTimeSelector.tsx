import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface DateTimeSelectorProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  label?: string;
}

export default function DateTimeSelector({
  value,
  onChange,
  minimumDate = new Date(),
  label = 'Departure Date & Time',
}: DateTimeSelectorProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Web-specific state for native HTML inputs
  const isWeb = Platform.OS === 'web';
  const [webDateString, setWebDateString] = useState(
    value.toISOString().split('T')[0]
  );
  const [webTimeString, setWebTimeString] = useState(
    value.toTimeString().slice(0, 5)
  );

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      // Keep the same time, just change the date
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(value.getHours());
      newDateTime.setMinutes(value.getMinutes());
      onChange(newDateTime);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      // Keep the same date, just change the time
      const newDateTime = new Date(value);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      onChange(newDateTime);
    }
  };

  // Web platform handlers
  const handleWebDateChange = (dateString: string) => {
    setWebDateString(dateString);
    if (dateString) {
      const [year, month, day] = dateString.split('-');
      const newDateTime = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        value.getHours(),
        value.getMinutes()
      );
      onChange(newDateTime);
    }
  };

  const handleWebTimeChange = (timeString: string) => {
    setWebTimeString(timeString);
    if (timeString) {
      const [hours, minutes] = timeString.split(':');
      const newDateTime = new Date(value);
      newDateTime.setHours(parseInt(hours));
      newDateTime.setMinutes(parseInt(minutes));
      onChange(newDateTime);
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeStatus = () => {
    const now = new Date();
    const diffInMinutes = (value.getTime() - now.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 30) {
      return { text: 'Departing soon', color: Colors.dark.error };
    } else if (diffInMinutes < 120) {
      return { text: 'Within 2 hours', color: Colors.dark.gold };
    } else if (diffInMinutes < 1440) {
      return { text: 'Today', color: Colors.dark.success };
    } else {
      return { text: 'Future', color: Colors.dark.textSecondary };
    }
  };

  const timeStatus = getTimeStatus();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      {isWeb ? (
        // Web Platform - Use HTML5 native inputs
        <View style={styles.selectorContainer}>
          {/* Date Input */}
          <View style={styles.webInputWrapper}>
            <View style={styles.inputLabelWeb}>
              <Calendar size={20} color={Colors.dark.gold} />
              <Text style={styles.inputLabelText}>Date</Text>
            </View>
            <input
              type="date"
              value={webDateString}
              onChange={(e) => handleWebDateChange(e.target.value)}
              min={minimumDate.toISOString().split('T')[0]}
              style={{
                ...styles.webInput,
                padding: '10px 12px',
                fontSize: '16px',
                borderRadius: '8px',
                border: `1px solid ${Colors.dark.border}`,
                backgroundColor: Colors.dark.card,
                color: Colors.dark.text,
                fontFamily: 'system-ui',
              } as any}
            />
          </View>

          {/* Time Input */}
          <View style={styles.webInputWrapper}>
            <View style={styles.inputLabelWeb}>
              <Clock size={20} color={Colors.dark.gold} />
              <Text style={styles.inputLabelText}>Time</Text>
            </View>
            <input
              type="time"
              value={webTimeString}
              onChange={(e) => handleWebTimeChange(e.target.value)}
              step="300"
              style={{
                ...styles.webInput,
                padding: '10px 12px',
                fontSize: '16px',
                borderRadius: '8px',
                border: `1px solid ${Colors.dark.border}`,
                backgroundColor: Colors.dark.card,
                color: Colors.dark.text,
                fontFamily: 'system-ui',
              } as any}
            />
          </View>
        </View>
      ) : (
        // Mobile Platforms (iOS/Android) - Use TouchableOpacity
        <View style={styles.selectorContainer}>
          {/* Date Selector */}
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.selectorContent}>
              <Calendar size={20} color={Colors.dark.gold} />
              <View style={styles.selectorText}>
                <Text style={styles.selectorValue}>{formatDate(value)}</Text>
                <Text style={styles.selectorLabel}>Date</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Time Selector */}
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowTimePicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.selectorContent}>
              <Clock size={20} color={Colors.dark.gold} />
              <View style={styles.selectorText}>
                <Text style={styles.selectorValue}>{formatTime(value)}</Text>
                <Text style={styles.selectorLabel}>Time</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Status Indicator */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: timeStatus.color }]} />
        <Text style={[styles.statusText, { color: timeStatus.color }]}>
          {timeStatus.text}
        </Text>
      </View>

      {/* Date Picker Modal - Only on Mobile */}
      {!isWeb && showDatePicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          onChange={handleDateChange}
        />
      )}

      {/* Time Picker Modal - Only on Mobile */}
      {!isWeb && showTimePicker && (
        <DateTimePicker
          value={value}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          minuteInterval={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  selectorContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  selectorButton: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectorText: {
    flex: 1,
  },
  selectorValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  selectorLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  webInputWrapper: {
    flex: 1,
  },
  webInput: {
    width: '100%',
  },
  inputLabelWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  inputLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
});
