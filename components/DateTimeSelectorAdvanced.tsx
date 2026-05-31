import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, Clock, X, Check, Zap, Timer, Sunrise, CalendarClock } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface DateTimeSelectorAdvancedProps {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  label?: string;
}

const QUICK_TIME_OPTIONS = [
  {
    id: 'now',
    label: 'Depart Now',
    subtitle: 'Immediate',
    getTime: () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 1);
      return now;
    },
    icon: 'zap',
  },
  {
    id: '30min',
    label: 'In 30 Minutes',
    subtitle: '30 mins',
    getTime: () => {
      const time = new Date();
      time.setMinutes(time.getMinutes() + 30);
      return time;
    },
    icon: 'timer',
  },
  {
    id: '1hour',
    label: 'In 1 Hour',
    subtitle: '1 hour',
    getTime: () => {
      const time = new Date();
      time.setHours(time.getHours() + 1);
      return time;
    },
    icon: 'clock',
  },
  {
    id: '2hours',
    label: 'In 2 Hours',
    subtitle: '2 hours',
    getTime: () => {
      const time = new Date();
      time.setHours(time.getHours() + 2);
      return time;
    },
    icon: 'clock',
  },
  {
    id: 'tomorrow',
    label: 'Tomorrow Morning',
    subtitle: '8:00 AM',
    getTime: () => {
      const time = new Date();
      time.setDate(time.getDate() + 1);
      time.setHours(8, 0, 0, 0);
      return time;
    },
    icon: 'sunrise',
  },
];

export default function DateTimeSelectorAdvanced({
  value,
  onChange,
  minimumDate = new Date(),
  label = 'When do you want to depart?',
}: DateTimeSelectorAdvancedProps) {
  const [showModal, setShowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value);

  const isWeb = Platform.OS === 'web';

  const handleQuickSelect = (timeGetter: () => Date) => {
    const newTime = timeGetter();
    onChange(newTime);
    setShowModal(false);
  };

  const handleDateChange = (event: any, selectedDateValue?: Date) => {
    if (Platform.OS === 'web') {
      if (selectedDateValue) {
        setSelectedDate(selectedDateValue);
        const newDateTime = new Date(selectedDateValue);
        newDateTime.setHours(value.getHours());
        newDateTime.setMinutes(value.getMinutes());
        onChange(newDateTime);
      }
    } else {
      setShowDatePicker(false);
      if (selectedDateValue) {
        setSelectedDate(selectedDateValue);
        const newDateTime = new Date(selectedDateValue);
        newDateTime.setHours(value.getHours());
        newDateTime.setMinutes(value.getMinutes());
        onChange(newDateTime);
      }
    }
  };

  const handleTimeChange = (event: any, selectedTimeValue?: Date) => {
    setShowTimePicker(false);
    if (selectedTimeValue) {
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(selectedTimeValue.getHours());
      newDateTime.setMinutes(selectedTimeValue.getMinutes());
      onChange(newDateTime);
    }
  };

  const formatDateDisplay = (date: Date) => {
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

  const formatTimeDisplay = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderQuickIcon = (icon: string) => {
    const iconProps = { size: 20, color: Colors.dark.gold };
    if (icon === 'zap') return <Zap {...iconProps} />;
    if (icon === 'timer') return <Timer {...iconProps} />;
    if (icon === 'sunrise') return <Sunrise {...iconProps} />;
    return <Clock {...iconProps} />;
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
      return { text: 'Scheduled ahead', color: Colors.dark.textSecondary };
    }
  };

  const timeStatus = getTimeStatus();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {/* Main Display Button */}
      <TouchableOpacity
        style={styles.mainButton}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.mainButtonContent}>
          <View style={styles.mainIconBox}>
            <CalendarClock size={22} color={Colors.dark.gold} />
          </View>
          <View style={styles.mainButtonText}>
            <Text style={styles.mainTime}>Departure</Text>
            <View style={styles.mainDateRow}>
              <Text style={styles.mainDateValue}>{formatDateDisplay(value)}</Text>
              <Text style={styles.mainTimeValue}>{formatTimeDisplay(value)}</Text>
            </View>
          </View>
          <Text style={styles.changeText}>Change</Text>
        </View>
      </TouchableOpacity>

      {/* Status Indicator */}
      <View style={[styles.statusPill, { borderColor: timeStatus.color }]}>
        <View style={[styles.statusDot, { backgroundColor: timeStatus.color }]} />
        <Text style={[styles.statusText, { color: timeStatus.color }]}>
          {timeStatus.text}
        </Text>
      </View>

      {/* Modal Picker */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>When do you depart?</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Quick Select Options */}
              <View style={styles.quickSelectSection}>
                <Text style={styles.sectionLabel}>Quick Select</Text>
                <View style={styles.quickSelectGrid}>
                  {QUICK_TIME_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={styles.quickSelectButton}
                      onPress={() => handleQuickSelect(option.getTime)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.quickSelectContent}>
                        <View style={styles.quickIconBox}>
                          {renderQuickIcon(option.icon)}
                        </View>
                        <Text style={styles.quickSelectLabel}>{option.label}</Text>
                        <Text style={styles.quickSelectSubtitle}>
                          {option.subtitle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Custom Date & Time */}
              <View style={styles.customSection}>
                <Text style={styles.sectionLabel}>Custom Time</Text>

                {/* Date Picker */}
                <View style={styles.pickerBox}>
                  <View style={styles.pickerLabel}>
                    <Calendar size={20} color={Colors.dark.gold} />
                    <Text style={styles.pickerLabelText}>Select Date</Text>
                  </View>

                  {isWeb ? (
                    <input
                      type="date"
                      value={selectedDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const [year, month, day] = e.target.value.split('-');
                        const newDate = new Date(
                          parseInt(year),
                          parseInt(month) - 1,
                          parseInt(day),
                          selectedDate.getHours(),
                          selectedDate.getMinutes()
                        );
                        handleDateChange(null, newDate);
                      }}
                      min={minimumDate.toISOString().split('T')[0]}
                      style={{
                        padding: '12px',
                        fontSize: '16px',
                        borderRadius: '8px',
                        border: `1px solid ${Colors.dark.border}`,
                        backgroundColor: Colors.dark.card,
                        color: Colors.dark.text,
                        fontFamily: 'system-ui',
                        width: '100%',
                        marginTop: 8,
                      } as any}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={styles.dateButtonText}>
                        {formatDateDisplay(selectedDate)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Time Picker */}
                <View style={styles.pickerBox}>
                  <View style={styles.pickerLabel}>
                    <Clock size={20} color={Colors.dark.gold} />
                    <Text style={styles.pickerLabelText}>Select Time</Text>
                  </View>

                  {isWeb ? (
                    <input
                      type="time"
                      value={selectedDate.toTimeString().slice(0, 5)}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':');
                        const newDateTime = new Date(selectedDate);
                        newDateTime.setHours(parseInt(hours));
                        newDateTime.setMinutes(parseInt(minutes));
                        handleTimeChange(null, newDateTime);
                      }}
                      step="300"
                      style={{
                        padding: '12px',
                        fontSize: '16px',
                        borderRadius: '8px',
                        border: `1px solid ${Colors.dark.border}`,
                        backgroundColor: Colors.dark.card,
                        color: Colors.dark.text,
                        fontFamily: 'system-ui',
                        width: '100%',
                        marginTop: 8,
                      } as any}
                    />
                  ) : (
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => setShowTimePicker(true)}
                    >
                      <Text style={styles.timeButtonText}>
                        {formatTimeDisplay(selectedDate)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Pre-set Time Slots */}
              <View style={styles.timeSlotsSection}>
                <Text style={styles.sectionLabel}>Or Choose a Time Slot</Text>
                <View style={styles.timeSlotsList}>
                  {['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '16:00', '18:00'].map(
                    (timeSlot) => (
                      <TouchableOpacity
                        key={timeSlot}
                        style={styles.timeSlotButton}
                        onPress={() => {
                          const [hours, minutes] = timeSlot.split(':');
                          const newDateTime = new Date(selectedDate);
                          newDateTime.setHours(parseInt(hours));
                          newDateTime.setMinutes(parseInt(minutes));
                          onChange(newDateTime);
                          setShowModal(false);
                        }}
                      >
                        <Text style={styles.timeSlotText}>{timeSlot}</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Confirm Button */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => setShowModal(false)}
                activeOpacity={0.8}
              >
                <Check size={20} color={Colors.dark.background} />
                <Text style={styles.confirmButtonText}>Confirm Departure Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Native DateTimePickers */}
      {!isWeb && showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          onChange={handleDateChange}
        />
      )}

      {!isWeb && showTimePicker && (
        <DateTimePicker
          value={selectedDate}
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
    marginVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  mainButton: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
    marginBottom: 12,
  },
  mainButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mainIconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: Colors.dark.gold + '18',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonText: {
    flex: 1,
  },
  mainTime: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  mainDateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  mainDateValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  mainTimeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.dark.gold,
  },
  changeText: {
    color: Colors.dark.gold,
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.dark.card,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  quickSelectSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  quickSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickSelectButton: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  quickSelectContent: {
    padding: 12,
    minHeight: 104,
  },
  quickIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.dark.gold + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickSelectLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  quickSelectSubtitle: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  customSection: {
    marginBottom: 24,
  },
  pickerBox: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pickerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
  },
  dateButton: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  timeButton: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.dark.text,
  },
  timeSlotsSection: {
    marginBottom: 24,
  },
  timeSlotsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotButton: {
    minWidth: '22%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 10,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
});
