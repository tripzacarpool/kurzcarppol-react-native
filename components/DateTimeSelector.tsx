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

      {/* Status Indicator */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, { backgroundColor: timeStatus.color }]} />
        <Text style={[styles.statusText, { color: timeStatus.color }]}>
          {timeStatus.text}
        </Text>
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          onChange={handleDateChange}
        />
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
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
});