import { Tabs } from 'expo-router';
import { Home, MapPin, Bell, Wallet, User } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Platform } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

function AnimatedTabIcon({ Icon, color, focused }: { Icon: any; color: string; focused: boolean }) {
  const scale = useSharedValue(focused ? 1.1 : 1);
  const opacity = useSharedValue(focused ? 1 : 0.7);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.1 : 1, {
      damping: 15,
      stiffness: 200,
    });
    opacity.value = withTiming(focused ? 1 : 0.7, { duration: 200 });
  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon size={24} color={color} />
    </Animated.View>
  );
}

export default function TabLayout() {
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
          tabBarBadge: 2,
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
