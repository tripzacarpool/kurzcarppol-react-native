import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  Animated,
  Easing,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';

interface GoogleSignInButtonProps {
  onPress?: () => void;
  loading?: boolean;
  text?: string;
}

export function GoogleSignInButton({ onPress, loading, text = "Continue with Google" }: GoogleSignInButtonProps) {
  const shimmerTranslate = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 200,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    animation.start();
    return () => animation.stop();
  }, [shimmerTranslate]);

  const animatedShimmerStyle: StyleProp<ViewStyle> = {
    transform: [{ translateX: shimmerTranslate }],
    opacity: loading ? 0.35 : 0.6,
  };

  return (
    <TouchableOpacity
      style={[styles.buttonWrapper]}
      onPress={onPress}
      activeOpacity={0.7}
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonWrapper: {
    marginBottom: 16,
  },
  gradientBorder: {
    borderRadius: 16,
    padding: 2,
    ...Platform.select({
      web: { boxShadow: `0 4px 12px ${Colors.dark.gold}4D` },
      default: {
        shadowColor: Colors.dark.gold,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
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
    ...Platform.select({
      web: { boxShadow: `0 2px 4px ${Colors.dark.gold}80` },
      default: {
        shadowColor: Colors.dark.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 4,
      },
    }),
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
