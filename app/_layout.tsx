import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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

  useEffect(() => {
    if (isLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    
    console.log('🔐 Auth Check:', { isSignedIn, inAuthGroup, inTabsGroup, isLoading, segments });

    // Redirect to tabs if signed in and in auth group
    if (isSignedIn && inAuthGroup) {
      console.log('✅ User signed in, redirecting to tabs...');
      router.replace('/(tabs)');
    } 
    // Redirect to login if NOT signed in and trying to access protected routes
    else if (!isSignedIn && !inAuthGroup) {
      console.log('❌ User not signed in, redirecting to login...');
      router.replace('/(auth)/login');
    }
    // If signed in and in tabs, stay there
    else if (isSignedIn && inTabsGroup) {
      console.log('✅ User signed in and in tabs - correct state');
    }
  }, [isSignedIn, isLoading, segments]);

//  useEffect(() => {
//   if (isSignedIn && user?.id) {
//     fetchAndStoreUserIP(user.id);
//   }
// }, [isSignedIn, user]);


  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.gold} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="driver" />
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
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.100:5000';
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
});
