import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { MapPin, Zap } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

export default function IndexScreen() {
  const { user, isLoading, isSignedIn } = useAuthContext();
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [rotateAnim] = useState(new Animated.Value(0));
  const [glowAnim] = useState(new Animated.Value(0.3));
  const [underlineAnim] = useState(new Animated.Value(0));
  const [dot1Anim] = useState(new Animated.Value(0.4));
  const [dot2Anim] = useState(new Animated.Value(0.4));
  const [dot3Anim] = useState(new Animated.Value(0.4));
  const particles = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(Math.random() * height),
      opacity: new Animated.Value(Math.random() * 0.5 + 0.3),
      scale: new Animated.Value(Math.random() * 0.5 + 0.5),
    }))
  ).current;

  useEffect(() => {
    // Main entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Underline slide-in animation
    Animated.timing(underlineAnim, {
      toValue: 1,
      duration: 600,
      delay: 200,
      useNativeDriver: false,
    }).start();

    // Pulsing glow effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Continuous rotation for icon
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    ).start();

    // Staggered loading dots animation
    const animateDots = () => {
      Animated.stagger(150, [
        Animated.sequence([
          Animated.timing(dot1Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot1Anim, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot2Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2Anim, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot3Anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3Anim, { toValue: 0.4, duration: 300, useNativeDriver: true }),
        ]),
      ]).start(() => animateDots());
    };
    animateDots();

    // Floating particles animation
    particles.forEach((particle, index) => {
      const animateParticle = () => {
        Animated.parallel([
          Animated.timing(particle.y, {
            toValue: Math.random() * height,
            duration: 2500 + Math.random() * 1500,
            useNativeDriver: true,
          }),
          Animated.timing(particle.x, {
            toValue: Math.random() * width,
            duration: 2500 + Math.random() * 1500,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: Math.random() * 0.6 + 0.4,
              duration: 1200,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: Math.random() * 0.3 + 0.1,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => animateParticle());
      };
      setTimeout(() => animateParticle(), index * 150);
    });
  }, []);

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) {
      console.log('⏳ Index: Auth loading...');
      return;
    }

    // Not signed in -> go to login
    if (!isSignedIn) {
      console.log('❌ Index: Not signed in, going to login');
      router.replace('/(auth)/login');
      return;
    }

    // Wait for role to load
    if (!user?.role) {
      console.log('⏳ Index: Waiting for role to load...');
      return;
    }

    setTimeout(() => {
      if (user.role === 'ride_partner') {
        router.replace('/driver/dashboard');
      } else {
        router.replace('/(tabs)');
      }
    }, 600);
  }, [isLoading, isSignedIn, user?.role, router]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const underlineWidth = underlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  return (
    <View style={styles.container}>
      {/* Animated background particles */}
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                { scale: particle.scale },
              ],
              opacity: particle.opacity,
            },
          ]}
        />
      ))}

      {/* Main content */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo container with animated ring */}
        <View style={styles.logoContainer}>
          <Animated.View
            style={[
              styles.rotatingRing,
              { transform: [{ rotate: spin }] },
            ]}
          >
            <View style={styles.ringSegment1} />
            <View style={styles.ringSegment2} />
            <View style={styles.ringSegment3} />
          </Animated.View>

          <View style={styles.iconWrapper}>
            <Animated.View style={[styles.iconInner, { opacity: glowOpacity }]}>
              <Zap size={40} color={Colors.dark.gold} fill={Colors.dark.gold} />
            </Animated.View>
          </View>
        </View>

        {/* Brand name with gradient effect */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandText}>KurzCarPool</Text>
          <Animated.View style={[styles.brandUnderline, { width: underlineWidth }]} />
        </View>

        {/* Status text */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.statusText}>Loading your journey...</Text>
        </Animated.View>

        {/* Modern loading indicator */}
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.loadingDot,
              { opacity: dot1Anim },
            ]}
          />
          <Animated.View
            style={[
              styles.loadingDot,
              { opacity: dot2Anim },
            ]}
          />
          <Animated.View
            style={[
              styles.loadingDot,
              { opacity: dot3Anim },
            ]}
          />
        </View>
      </Animated.View>

      {/* Bottom decoration */}
      <Animated.View style={[styles.bottomDecoration, { opacity: fadeAnim }]}>
        <MapPin size={16} color={Colors.dark.gold + '60'} />
        <Text style={styles.tagline}>Share rides, Save money, Save planet</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.gold,
  },
  content: {
    alignItems: 'center',
    zIndex: 10,
  },
  logoContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  rotatingRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringSegment1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: Colors.dark.gold,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  ringSegment2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.dark.pink,
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.6,
  },
  ringSegment3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.dark.gold + '40',
    borderTopColor: 'transparent',
    opacity: 0.4,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.dark.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.gold + '30',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandText: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.dark.text,
    letterSpacing: 1,
    textShadowColor: Colors.dark.gold + '30',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandUnderline: {
    height: 3,
    backgroundColor: Colors.dark.gold,
    marginTop: 8,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 30,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.gold,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagline: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    letterSpacing: 0.5,
  },
});
