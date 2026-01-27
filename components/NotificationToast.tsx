import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { X, Bell } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useNotifications } from '@/contexts/NotificationContext';

const { width } = Dimensions.get('window');

export default function NotificationToast() {
  const { notifications, clearNotification, markAsRead } = useNotifications();
  const [currentNotification, setCurrentNotification] = useState<any>(null);
  const slideAnim = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Show the latest unread notification
    const unreadNotifications = notifications.filter((n) => !n.read);
    if (unreadNotifications.length > 0) {
      const latestNotification = unreadNotifications[0];
      setCurrentNotification(latestNotification);

      // Auto-hide after 5 seconds
      const timeout = setTimeout(() => {
        hideNotification(latestNotification.id);
      }, 5000);

      // Animate in
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();

      return () => clearTimeout(timeout);
    } else {
      // Animate out
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: false,
      }).start();
      setCurrentNotification(null);
    }
  }, [notifications]);

  const hideNotification = (id: string) => {
    markAsRead(id);
    clearNotification(id);
  };

  if (!currentNotification) {
    return null;
  }

  const getBackgroundColor = () => {
    switch (currentNotification.type) {
      case 'ride_created':
        return Colors.dark.gold;
      case 'offer_created':
        return Colors.dark.success;
      case 'ride_accepted':
        return Colors.dark.success;
      case 'offer_booked':
        return Colors.dark.success;
      default:
        return Colors.dark.gold;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}>
      <View style={[styles.notification, { backgroundColor: getBackgroundColor() }]}>
        <View style={styles.content}>
          <Bell size={20} color={Colors.dark.background} />
          <View style={styles.textContainer}>
            <Text style={styles.title}>{currentNotification.title}</Text>
            <Text style={styles.message} numberOfLines={2}>
              {currentNotification.message}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => hideNotification(currentNotification.id)}
          style={styles.closeButton}>
          <X size={18} color={Colors.dark.background} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  notification: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.background,
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    color: Colors.dark.background,
    opacity: 0.9,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
