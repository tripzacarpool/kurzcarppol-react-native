import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

// In Expo Go, maps are not available - export null components
// Maps will only work in a development build with: npx expo run:android

export const MapView: any = null;
export const Marker: any = null;
export const Polyline: any = null;
export const PROVIDER_GOOGLE: any = null;

export const checkMapAvailability = () => false;
export function MapPlaceholder({ message = "Maps require a development build" }: { message?: string }) {
  return (
    <View style={styles.placeholder}>
      <MapPin size={48} color={Colors.dark.textSecondary} />
      <Text style={styles.placeholderText}>{message}</Text>
      <Text style={styles.placeholderSubtext}>
        Run: npx expo run:android
      </Text>
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
