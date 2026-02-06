/**
 * Route Service
 *
 * Handles Google Directions API calls
 * IMPORTANT: Call Directions API ONLY ONCE per ride for initial route
 * Never use Google APIs for live tracking - use WebSocket instead!
 */

import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface DirectionsResponse {
  routes: RouteCoordinate[];
  distance: string;
  duration: string;
  distanceValue: number; // Distance in meters
  durationValue: number; // Duration in seconds
  success: boolean;
  error?: string;
}

/**
 * Fetch route from Google Directions API
 * Called ONCE at ride start for initial route polyline
 *
 * @param origin - Starting location {latitude, longitude}
 * @param destination - Ending location {latitude, longitude}
 * @returns Route coordinates, distance, and duration
 */
export async function fetchRouteFromGoogle(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
): Promise<DirectionsResponse> {
  try {
    console.log('🗺️ Fetching route from Google Directions API (ONE-TIME CALL)');

    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      console.error('❌ Google Directions API error:', data.status);
      return {
        routes: [],
        distance: 'Unknown',
        duration: 'Unknown',
        distanceValue: 0,
        durationValue: 0,
        success: false,
        error: data.status || 'No route found',
      };
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode polyline to get route coordinates
    const points = decodePolyline(route.overview_polyline.points);

    console.log(`✅ Route fetched: ${leg.distance.text}, ${leg.duration.text}`);
    console.log(`📍 Route has ${points.length} waypoints`);
    console.log(
      `📏 Distance Value: ${leg.distance.value}m, Duration Value: ${leg.duration.value}s`,
    );

    return {
      routes: points,
      distance: leg.distance.text,
      duration: leg.duration.text,
      distanceValue: leg.distance.value, // meters
      durationValue: leg.duration.value, // seconds
      success: true,
    };
  } catch (error: any) {
    console.error('❌ Error fetching route:', error);
    return {
      routes: [],
      distance: 'Unknown',
      duration: 'Unknown',
      distanceValue: 0,
      durationValue: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Decode Google polyline string to coordinates
 * This is a standard algorithm for decoding Google's encoded polylines
 */
function decodePolyline(encoded: string): RouteCoordinate[] {
  const points: RouteCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

/**
 * Calculate straight-line distance between two points (Haversine formula)
 * Used for ETA estimation without calling Google APIs
 */
export function calculateDistance(
  point1: RouteCoordinate,
  point2: RouteCoordinate,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance; // in km
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

/**
 * Estimate time to arrival based on distance
 * Uses average speed (not Google APIs)
 */
export function estimateETA(
  distanceKm: number,
  averageSpeedKmh: number = 30,
): string {
  const hours = distanceKm / averageSpeedKmh;
  const minutes = Math.round(hours * 60);

  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;

  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}
