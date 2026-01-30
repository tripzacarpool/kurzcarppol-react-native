import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Car, Users } from 'lucide-react-native';

export default function RedirectScreen() {
  const { user, isLoading } = useAuthContext();
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.5));
  const [rotateAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Animate entrance
    const rotationAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    rotationAnimation.start();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      rotationAnimation.stop();
      rotateAnim.setValue(0);
    };
  }, [fadeAnim, scaleAnim, rotateAnim]);

  useEffect(() => {
    if (isLoading || !user?.id) {
      return;
    }

    // Wait for role to be loaded from backend sync
    // Don't redirect until we know the actual role
    if (user.role === undefined) {
      console.log('⏳ Waiting for user role to load...');
      return;
    }

    console.log('✅ User role loaded:', user.role);

    // Wait for animation to complete, then redirect based on role
    const timer = setTimeout(() => {
      if (user.role === 'ride_partner') {
        console.log('🚗 Redirecting to driver dashboard...');
        router.replace('/driver/dashboard');
      } else {
        console.log('👤 Redirecting to passenger tabs...');
        router.replace('/(tabs)');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [user, user?.role, user?.id, isLoading, router]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isDriving = user?.role === 'ride_partner';

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { rotate: spin }],
          },
        ]}
      >
        {isDriving ? (
          <Car size={64} color={Colors.dark.gold} strokeWidth={2.5} />
        ) : (
          <Users size={64} color={Colors.dark.gold} strokeWidth={2.5} />
        )}
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.title}>
          {user?.role === undefined ? 'Welcome!' : isDriving ? 'Welcome Driver!' : 'Welcome Rider!'}
        </Text>
        <Text style={styles.subtitle}>
          {user?.role === undefined
            ? 'Setting up your account...'
            : isDriving
            ? 'Getting your dashboard ready...'
            : 'Finding rides for you...'}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.loadingBar,
          {
            opacity: fadeAnim,
            transform: [{ scaleX: scaleAnim }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 3,
    borderColor: Colors.dark.gold + '40',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  loadingBar: {
    width: 200,
    height: 4,
    backgroundColor: Colors.dark.gold,
    borderRadius: 2,
  },
});
