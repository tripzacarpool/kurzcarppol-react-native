import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Bell, CheckCheck, Calendar, CreditCard, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { mockNotifications } from '@/data/mockData';
import Animated from 'react-native-reanimated';
import { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/lib/ipService';

const getNotificationIcon = (type: string) => {
  switch (type) {
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

export default function AlertsScreen() {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (user) {
      const profile = await getUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  const userName = userProfile?.full_name?.split(' ')[0] || user?.user_metadata?.full_name?.split(' ')[0] || 'there';
  const unreadCount = mockNotifications.filter((n) => !n.read).length;

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
          <TouchableOpacity>
            <Text style={styles.markAllRead}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {mockNotifications.map((notification, index) => {
          const Icon = getNotificationIcon(notification.type);
          return (
            <Animated.View
              key={notification.id}
              entering={FadeInDown.delay(index * 50).springify()}>
              <TouchableOpacity
                style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                activeOpacity={0.7}>
                <View
                  style={[
                    styles.iconContainer,
                    notification.type === 'booking' && styles.bookingIcon,
                    notification.type === 'ride' && styles.rideIcon,
                    notification.type === 'payment' && styles.paymentIcon,
                    notification.type === 'alert' && styles.alertIcon,
                  ]}>
                  <Icon size={20} color={Colors.dark.text} />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    {!notification.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                  <Text style={styles.notificationTime}>{notification.createdAt}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

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
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
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
