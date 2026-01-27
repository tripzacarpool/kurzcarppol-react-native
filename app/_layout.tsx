import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { ClerkProvider } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { fetchAndStoreUserIP } from '@/lib/ipService';
import { testBackendConnectivity } from '@/lib/connectivityHelper';

const tokenCache = {
  async getToken(key: string) {
    try {
      console.log('🔑 Getting token from secure store:', key);
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
      console.log('💾 Saving token to secure store:', key);
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

  // Determine if we're ready to show the app
  const isRoleLoaded = isSignedIn ? user?.role !== undefined : true;
  const isReady = !isLoading && isRoleLoaded;

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const currentRoot = segments?.[0];
    const onDriverDashboard = currentRoot === 'driver';
    const onPassengerTabs = currentRoot === '(tabs)';
    const isDriver = user?.role === 'ride_partner';

    // Only enforce route protection - don't handle initial redirects
    // Index screen handles initial routing
    if (!isSignedIn || !currentRoot) {
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
  }, [isReady, isSignedIn, segments, user?.role, router]);

  // Show loading screen until role is loaded
  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.gold} />
        <Text style={styles.loadingText}>
          {isLoading ? 'Loading...' : 'Setting up your account...'}
        </Text>
      </View>
    );
  }

  const isDriver = user?.role === 'ride_partner';

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="driver" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" options={{ href: null }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  // Test backend connectivity on startup (non-blocking)
  useEffect(() => {
    const checkConnectivity = async () => {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.102:5000';
      console.log('🔗 Backend URL configured as:', apiUrl);
      const isReachable = await testBackendConnectivity(apiUrl);
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

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AuthProvider>
        <LocationProvider>
          <RootLayoutNav />
        </LocationProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
});
