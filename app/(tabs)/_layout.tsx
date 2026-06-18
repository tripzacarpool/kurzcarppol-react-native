import { Tabs } from 'expo-router';
import { Home, MapPin, Wallet, User, MessageSquare } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Animated, Platform, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { useMessages } from '@/contexts/MessagesContext';

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
  }, [focused, opacityAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}>
      <View
        style={{
          width: 34,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? Colors.dark.gold + '18' : 'transparent',
        }}>
        <Icon size={21} color={color} strokeWidth={focused ? 2.6 : 2.2} />
      </View>
    </Animated.View>
  );
}

export default function TabLayout() {
  const { totalUnreadMessages } = useMessages();

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
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingBottom: Platform.OS === 'ios' ? 26 : 18,
          paddingTop: 12,
          height: Platform.OS === 'ios' ? 98 : 88,
          ...Platform.select({
            web: { boxShadow: '0 -4px 10px rgba(0, 0, 0, 0.16)' },
            default: {
              elevation: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.16,
              shadowRadius: 10,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 13,
          fontWeight: '700',
          marginTop: 2,
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
        name="messages"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => <AnimatedTabIcon Icon={MessageSquare} color={color} focused={focused} />,
          tabBarBadge: totalUnreadMessages > 0 ? (totalUnreadMessages > 99 ? '99+' : totalUnreadMessages) : undefined,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
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
