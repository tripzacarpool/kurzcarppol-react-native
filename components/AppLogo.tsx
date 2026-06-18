import { Image, View, StyleSheet } from 'react-native';

interface AppLogoProps {
  size?: number;
  style?: any;
}

export default function AppLogo({ size = 120, style }: AppLogoProps) {
  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('@/assets/icon.png')}
        style={[styles.logo, { width: size, height: size }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
});
