import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import PublicHomepage from '@/components/PublicHomepage';
import { Colors } from '@/constants/Colors';

export default function IndexScreen() {
  const router = useRouter();
  const { user, isLoading, isSignedIn } = useAuthContext();
  const isRoleLoaded = isSignedIn ? user?.role !== undefined : true;

  useEffect(() => {
    if (isLoading || !isRoleLoaded || !isSignedIn) {
      return;
    }

    const timer = setTimeout(() => {
      if (user?.role === 'ride_partner') {
        router.replace('/driver/dashboard');
      } else {
        router.replace('/(tabs)');
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isLoading, isRoleLoaded, isSignedIn, router, user?.role]);

  if (isLoading && !isSignedIn) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.dark.gold} />
        <Text style={styles.loadingText}>Loading homepage...</Text>
      </View>
    );
  }

  return <PublicHomepage />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    marginTop: 14,
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
