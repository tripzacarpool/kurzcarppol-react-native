import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { MessagesProvider } from '@/contexts/MessagesContext';
import { Platform } from 'react-native';
// Conditional imports for Clerk based on platform
import { ClerkProvider as ClerkProviderExpo } from '@clerk/clerk-expo';
import { ClerkProvider as ClerkProviderReact } from '@clerk/clerk-react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  testBackendConnectivity,
  testBackendReadiness,
} from '@/lib/connectivityHelper';
import { getApiBaseUrl } from '@/lib/backendConfig';
import NotificationToast from '@/components/NotificationToast';

// Use the appropriate ClerkProvider based on platform
const ClerkProvider = Platform.OS === 'web' ? ClerkProviderReact : ClerkProviderExpo;

// Token cache for native only (web uses cookies/localStorage automatically)
const tokenCache = Platform.OS === 'web' ? undefined : {
  async getToken(key: string) {
    try {
      console.log('🔑 Getting token from SecureStore:', key);
      const token = await SecureStore.getItemAsync(key);
      console.log('🔑 Token retrieved:', token ? 'exists' : 'null');
      return token;
    } catch (err) {
      console.error('❌ Error getting token:', err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      console.log('💾 Saving token to SecureStore:', key);
      await SecureStore.setItemAsync(key, value);
      console.log('✅ Token saved');
    } catch (err) {
      console.error('❌ Error saving token:', err);
    }
  },
};

function RootLayoutNav() {
  const { user, isLoading, isSignedIn } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  // Check for pending navigation from notification clicks
  useEffect(() => {
    const checkPendingNavigation = async () => {
      if (!isSignedIn) return;
      
      try {
        const pendingNavStr = await AsyncStorage.getItem('pendingNavigation');
        if (pendingNavStr) {
          const pendingNav = JSON.parse(pendingNavStr);
          console.log('🔗 Found pending navigation:', pendingNav);
          
          // Clear the pending navigation
          await AsyncStorage.removeItem('pendingNavigation');
          
          // Small delay to ensure navigation is ready
          setTimeout(() => {
            // Navigate based on screen type
            if (pendingNav.screen === 'ExtendTime') {
              router.push({
                pathname: '/extend-time',
                params: pendingNav.params,
              });
            }
          }, 500);
        }
      } catch (error) {
        console.error('Error checking pending navigation:', error);
      }
    };

    checkPendingNavigation();
  }, [isSignedIn, router]);

  // Determine if we're ready to show the app
  useEffect(() => {
    if (isLoading) {
      return;
    }

    const currentRoot = segments?.[0];
    const onDriverDashboard = currentRoot === 'driver';
    const onPassengerTabs = currentRoot === '(tabs)';
    const isDriver = user?.role === 'ride_partner';

    if (!isSignedIn) {
      const isPublicRoute = !currentRoot || currentRoot === '(auth)';
      if (!isPublicRoute) {
        router.replace('/(auth)/login');
      }
      return;
    }

    console.log('🔐 Route Protection Check:', {
      currentRoot,
      isDriver,
      onDriverDashboard,
      onPassengerTabs,
    });

    // Prevent drivers from accessing passenger tabs
    if (isDriver && onPassengerTabs) {
      console.log('🚗 Driver tried to access passenger tabs, blocking');
      router.replace('/driver/dashboard');
      return;
    }
    
    // Prevent passengers from accessing driver dashboard
    if (!isDriver && onDriverDashboard) {
      console.log('👤 Passenger tried to access driver dashboard, blocking');
      router.replace('/(tabs)');
      return;
    }
  }, [isLoading, isSignedIn, segments, user?.role, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="driver" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="redirect" />
        <Stack.Screen name="extend-time" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
      <NotificationToast />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  // Test backend connectivity on startup (non-blocking)
  useEffect(() => {
    const checkConnectivity = async () => {
      const apiUrl = getApiBaseUrl();
      // const apiUrl = 'http://10.238.194.123:5000'; // Local development URL
      console.log('🔗 Backend URL configured as:', apiUrl);
      const isReachable = await testBackendConnectivity(apiUrl);
      if (isReachable) {
        await testBackendReadiness();
      }
      if (isReachable) {
        console.log('✅ Backend connectivity verified');
      } else {
        console.warn('⚠️ Backend not reachable - app will work with limited features');
      }
    };
    checkConnectivity();
  }, []);

  const publishableKey =
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      'Missing Clerk publishable key. Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local',
    );
  }

  console.log('🔐 Clerk initialized with key:', publishableKey.substring(0, 20) + '...');
  console.log('🌐 Platform:', Platform.OS);
  console.log('📦 Using Clerk Provider:', Platform.OS === 'web' ? 'clerk-react (Web)' : 'clerk-expo (Native)');

  return (
    <ClerkProvider 
      publishableKey={publishableKey} 
      {...(tokenCache ? { tokenCache } : {})}
    >
      <AuthProvider>
        <NotificationProvider>
          <MessagesProvider>
            <LocationProvider>
              <RootLayoutNav />
            </LocationProvider>
          </MessagesProvider>
        </NotificationProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}

