import { View, Text, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

type MapComponents = {
  MapView: any;
  Marker: any;
  Polyline: any;
  PROVIDER_GOOGLE: any;
};

const isNativePlatform = Platform.OS === 'ios' || Platform.OS === 'android';
const isExpoGoRuntime = Constants.appOwnership === 'expo';

const components: MapComponents = {
  MapView: null,
  Marker: null,
  Polyline: null,
  PROVIDER_GOOGLE: null,
};

if (isNativePlatform && !isExpoGoRuntime) {
  try {
    const mapsModule = require('react-native-maps');
    components.MapView = mapsModule.default ?? mapsModule;
    components.Marker = mapsModule.Marker;
    components.Polyline = mapsModule.Polyline;
    components.PROVIDER_GOOGLE = mapsModule.PROVIDER_GOOGLE;
  } catch (error) {
    console.warn('react-native-maps failed to load:', error);
  }
}

const isMapAvailable = Boolean(components.MapView);

export const MapView = components.MapView;
export const Marker = components.Marker;
export const Polyline = components.Polyline;
export const PROVIDER_GOOGLE = components.PROVIDER_GOOGLE;

export const checkMapAvailability = () => isMapAvailable;

export function MapPlaceholder({ message }: { message?: string }) {
  const defaultMessage = isExpoGoRuntime
    ? 'Install the development build to use interactive maps.'
    : 'Map component failed to load.';

  return (
    <View style={styles.placeholder}>
      <MapPin size={48} color={Colors.dark.textSecondary} />
      <Text style={styles.placeholderText}>{message ?? defaultMessage}</Text>
      {isExpoGoRuntime && (
        <Text style={styles.placeholderSubtext}>Run npx expo run:android</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    padding: 20,
  },
  placeholderText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  placeholderSubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
