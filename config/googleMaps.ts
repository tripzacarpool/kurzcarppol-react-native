/**
 * Google Maps Configuration
 *
 * COST OPTIMIZATION:
 * - Map rendering: Uses react-native-maps (FREE for static map display)
 * - Directions API: Called ONCE per ride for initial route
 * - Live tracking: Uses WebSocket to backend (NO Google API calls)
 *
 * IMPORTANT: Never call Google APIs during live tracking!
 */

// Centralized Google Maps API Key
export const GOOGLE_MAPS_API_KEY = 'AIzaSyAWpVF1UfbtUsUbdv7SM8jautI7Y0QWx0U';

// Map configuration
export const MAP_CONFIG = {
  // Default map region
  DEFAULT_REGION: {
    latitude: 28.6139, // Delhi, India
    longitude: 77.209,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },

  // Map update intervals (in milliseconds)
  DRIVER_LOCATION_UPDATE_INTERVAL: 3000, // Driver sends update every 3 seconds
  MAP_ANIMATION_DURATION: 500, // Smooth camera movement

  // Route path optimization
  MAX_ROUTE_POINTS: 50, // Keep only last 50 points for drawing route

  // Map style (for dark theme)
  MAP_STYLE: [
    {
      elementType: 'geometry',
      stylers: [{ color: '#242f3e' }],
    },
    {
      elementType: 'labels.text.fill',
      stylers: [{ color: '#746855' }],
    },
    {
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#242f3e' }],
    },
  ],
};

// Google API usage flags
export const GOOGLE_API_USAGE = {
  CALL_DIRECTIONS_API_ON_RIDE_START: true, // Only once per ride
  USE_GOOGLE_FOR_LIVE_TRACKING: false, // Never - use WebSocket
  ENABLE_AUTOCOMPLETE: true, // Enabled for location search/input
  ENABLE_PLACES_API: true, // Enabled for location search
  ENABLE_GEOCODING: true, // For address <-> coordinates conversion
};

// Cost information (for reference)
export const API_COSTS = {
  DIRECTIONS_API: '$5 per 1000 requests',
  PLACES_AUTOCOMPLETE: '$2.83 per 1000 requests (session-based)',
  PLACES_DETAILS: '$17 per 1000 requests',
  GEOCODING: '$5 per 1000 requests',
  MAP_DISPLAY: 'FREE (unlimited)',
};

export default {
  GOOGLE_MAPS_API_KEY,
  MAP_CONFIG,
  GOOGLE_API_USAGE,
};
