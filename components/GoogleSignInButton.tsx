import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

interface GoogleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  text?: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function GoogleSignInButton({ onPress, loading, text = "Continue with Google" }: GoogleSignInButtonProps) {
  const scale = useSharedValue(1);
  const shimmer = useSharedValue(0);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedShimmerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: interpolate(shimmer.value, [0, 1], [-300, 300]),
        },
      ],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.96, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 200,
    });

    shimmer.value = withSequence(
      withTiming(1, { duration: 600 }),
      withTiming(0, { duration: 0 })
    );
  };

  return (
    <AnimatedTouchable
      style={[styles.buttonWrapper, animatedButtonStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={loading}>
      <LinearGradient
        colors={[Colors.dark.gold + '15', Colors.dark.gold + '08']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}>
        <View style={styles.button}>
          {Platform.OS === 'web' ? (
            <View style={styles.glassEffect} />
          ) : (
            <BlurView intensity={20} tint="dark" style={styles.glassEffect} />
          )}

          <Animated.View style={[styles.shimmerOverlay, animatedShimmerStyle]}>
            <LinearGradient
              colors={['transparent', Colors.dark.gold + '20', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerGradient}
            />
          </Animated.View>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[Colors.dark.gold, Colors.dark.gold + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}>
                <Text style={styles.googleIcon}>G</Text>
              </LinearGradient>
            </View>
            {loading ? (
              <ActivityIndicator color={Colors.dark.gold} size="small" />
            ) : (
              <Text style={styles.buttonText}>{text}</Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  buttonWrapper: {
    marginBottom: 16,
  },
  gradientBorder: {
    borderRadius: 16,
    padding: 2,
    shadowColor: Colors.dark.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    backgroundColor: Colors.dark.backgroundSecondary + 'E6',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  glassEffect: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'web' ? Colors.dark.gold + '08' : 'transparent',
    borderRadius: 14,
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
    width: 100,
  },
  shimmerGradient: {
    width: 100,
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    shadowColor: Colors.dark.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.background,
  },
  buttonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
