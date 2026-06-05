import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Bell, CheckCheck, Calendar, CreditCard, Shield, Trash2, Car } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/lib/ipService';
import { setBadgeCount } from '@/lib/notificationService';
import { useRouter } from 'expo-router';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'ride_created':
    case 'offer_created':
      return Car;
    case 'ride_accepted':
    case 'offer_booked':
      return CheckCheck;
    case 'booking':
      return CheckCheck;
    case 'ride':
      return Calendar;
    case 'payment':
      return CreditCard;
    case 'alert':
      return Shield;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'ride_created':
    case 'offer_created':
      return Colors.dark.gold;
    case 'ride_accepted':
    case 'offer_booked':
      return '#4CAF50';
    case 'payment':
      return '#2196F3';
    case 'alert':
      return '#FF5722';
    default:
      return Colors.dark.gold;
  }
};

export default function AlertsScreen() {
  const { user, getAuthToken } = useAuth();
  const { notifications, unreadCount, markAsRead, clearNotification, clearAll } = useNotifications();
  const [userProfile, setUserProfile] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  useEffect(() => {
    // Update badge count when notifications change
    setBadgeCount(unreadCount);
  }, [unreadCount]);

  const loadUserProfile = async () => {
    if (user) {
      const token = await getAuthToken();
      const profile = await getUserProfile(user.id, token);
      setUserProfile(profile);
    }
  };

  const handleMarkAllRead = () => {
    notifications.forEach(n => {
      if (!n.read) markAsRead(n.id);
    });
  };

  const getNotificationDestination = (notification: any) => {
    const type = String(notification.type || notification.data?.type || '').toLowerCase();
    const action = String(notification.data?.action || '').toLowerCase();
    const data = notification.data || {};

    if (type.includes('chat') || type.includes('message')) {
      return '/(tabs)/messages';
    }

    if (type.includes('payment') || type.includes('wallet')) {
      return '/(tabs)/wallet';
    }

    if (type.includes('sos') || type.includes('emergency')) {
      return user?.role === 'admin' ? '/admin/dashboard' : '/(tabs)/trips';
    }

    if (action === 'extend_time' || type.includes('expiring') || type.includes('departure_reminder')) {
      return {
        pathname: '/extend-time',
        params: {
          offerId: data.offerId || data.rideId,
          rideId: data.rideId,
          from: data.from,
          to: data.to,
          departureTime: data.departureTime,
          action: data.action,
          hasBookings: data.hasBookings,
        },
      };
    }

    if (
      type.includes('booking') ||
      type.includes('ride') ||
      type.includes('offer') ||
      notification.data?.rideId ||
      notification.data?.offerId
    ) {
      return user?.role === 'ride_partner' ? '/driver/dashboard' : '/(tabs)/trips';
    }

    return '/(tabs)/trips';
  };

  const handleNotificationPress = (notificationId: string) => {
    const notification = notifications.find((item) => item.id === notificationId);
    markAsRead(notificationId);
    if (!notification) return;

    router.push(getNotificationDestination(notification) as any);
  };

  const handleDeleteNotification = (notificationId: string) => {
    clearNotification(notificationId);
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.firstName?.split(' ')[0] || 'there';

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>
              Hey {userName}! You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </Text>
          </View>
          {notifications.length > 0 && (
            <View style={styles.headerButtons}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead}>
                  <Text style={styles.markAllRead}>Mark all as read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={clearAll} style={styles.clearAllButton}>
                <Trash2 size={18} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={64} color={Colors.dark.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              You'll see ride updates and alerts here
            </Text>
          </View>
        ) : (
          notifications.map((notification) => {
            const Icon = getNotificationIcon(notification.type);
            const iconColor = getNotificationColor(notification.type);
            return (
              <View key={notification.id}>
                <TouchableOpacity
                  style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                  activeOpacity={0.7}
                  onPress={() => handleNotificationPress(notification.id)}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: `${iconColor}20` },
                    ]}>
                    <Icon size={20} color={iconColor} />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      {!notification.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationMessage}>{notification.message}</Text>
                    {notification.data?.from && notification.data?.to && (
                      <Text style={styles.notificationRoute}>
                        {notification.data.from} → {notification.data.to}
                      </Text>
                    )}
                    <Text style={styles.notificationTime}>
                      {formatTimestamp(notification.timestamp)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteNotification(notification.id)}>
                    <Trash2 size={18} color={Colors.dark.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <View style={styles.emptySpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerContainer: {
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  markAllRead: {
    color: Colors.dark.gold,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearAllButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.dark.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  unreadCard: {
    borderColor: Colors.dark.gold + '40',
    backgroundColor: Colors.dark.card + 'ee',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  notificationRoute: {
    fontSize: 13,
    color: Colors.dark.gold,
    marginBottom: 4,
    fontWeight: '500',
  },
  bookingIcon: {
    backgroundColor: Colors.dark.success + '30',
  },
  rideIcon: {
    backgroundColor: Colors.dark.gold + '30',
  },
  paymentIcon: {
    backgroundColor: Colors.dark.gold + '30',
  },
  alertIcon: {
    backgroundColor: Colors.dark.pink + '30',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  notificationTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.gold,
    marginLeft: 8,
  },
  notificationMessage: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  emptySpace: {
    height: 20,
  },
});
