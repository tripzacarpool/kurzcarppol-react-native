import { Tabs } from 'expo-router';
import { Home, MapPin, Bell, Wallet, User } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Platform, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';

function AnimatedTabIcon({ Icon, color, focused }: { Icon: any; color: string; focused: boolean }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.1 : 1)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.1 : 1,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0.7,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
      <Icon size={24} color={color} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.dark.gold,
        tabBarInactiveTintColor: Colors.dark.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.dark.backgroundSecondary,
          borderTopWidth: 1,
          borderTopColor: Colors.dark.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        animation: 'fade',
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon Icon={Home} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon Icon={MapPin} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon Icon={Bell} color={color} focused={focused} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon Icon={Wallet} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon Icon={User} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
