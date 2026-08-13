const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required Expo environment variable: ${key}`);
  }
  return value;
};

const isProductionBuild = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const productionApiUrl = 'https://kurzcarppol-react-native-1.onrender.com';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL;
const configuredSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
const isLocalUrl = (value) =>
  Boolean(value && /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/i.test(value));

const apiUrl =
  isProductionBuild && isLocalUrl(configuredApiUrl)
    ? productionApiUrl
    : configuredApiUrl || productionApiUrl;

const socketUrl =
  isProductionBuild && isLocalUrl(configuredSocketUrl)
    ? productionApiUrl
    : configuredSocketUrl || apiUrl;
const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const razorpayKeyId = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '';

if (isProductionBuild) {
  getRequiredEnv('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
  getRequiredEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  getRequiredEnv('EXPO_PUBLIC_RAZORPAY_KEY_ID');
}

module.exports = {
  expo: {
    name: 'RaahEasy',
    slug: 'raaheasy',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'raaheasyapp',
    userInterfaceStyle: 'dark',
    newArchEnabled: false,
    icon: './assets/icon.png',
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0A0A',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER || 'com.raaheasy.app',
      icon: './assets/icon.png',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'This app needs access to your location to show you nearby rides and track your trip.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'This app needs access to your location to show you nearby rides and track your trip.',
        ITSAppUsesNonExemptEncryption: false,
      },
      config: {
        googleMapsApiKey,
      },
    },
    android: {
      package: process.env.ANDROID_PACKAGE || 'com.raaheasy.app',
      icon: './assets/icon.png',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A0A',
      },
      splash: {
        image: './assets/icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0A0A0A',
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/icon.png',
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-web-browser',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow this app to use your location to show nearby rides and track trips.',
          locationWhenInUsePermission:
            'Allow this app to use your location to show nearby rides and track trips.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#FFD700',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: process.env.EAS_PROJECT_ID || '536fdb51-b385-47a4-a44d-52216a6aea36',
      },
      apiUrl,
      socketUrl,
      googleMapsApiKey,
      clerkPublishableKey,
      razorpayKeyId,
    },
  },
};
