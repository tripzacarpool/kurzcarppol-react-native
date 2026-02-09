// Google Maps API Proxy to avoid CORS issues on web
import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAWpVF1UfbtUsUbdv7SM8jautI7Y0QWx0U';

/**
 * Proxy for Google Places Autocomplete API
 * GET /api/maps/autocomplete?input=query
 */
export const autocomplete = async (req, res, next) => {
  try {
    const { input } = req.query;

    if (!input || input.length < 3) {
      return res.status(200).json({
        predictions: [],
        status: 'ZERO_RESULTS',
      });
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input,
    )}&key=${GOOGLE_MAPS_API_KEY}&components=country:in`;

    const response = await axios.get(url);

    res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ Autocomplete proxy error:', error.message);
    res.status(200).json({
      predictions: [],
      status: 'ZERO_RESULTS',
    });
  }
};

/**
 * Proxy for Google Place Details API
 * GET /api/maps/place-details?place_id=xxx
 */
export const placeDetails = async (req, res, next) => {
  try {
    const { place_id } = req.query;

    if (!place_id) {
      return res.status(400).json({
        error: 'place_id is required',
      });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);

    res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ Place details proxy error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch place details',
    });
  }
};

/**
 * Proxy for Google Geocoding API (reverse geocoding)
 * GET /api/maps/geocode?latlng=28.123,77.456
 */
export const geocode = async (req, res, next) => {
  try {
    const { latlng } = req.query;

    if (!latlng) {
      return res.status(400).json({
        error: 'latlng is required',
      });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);

    res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ Geocode proxy error:', error.message);
    res.status(500).json({
      error: 'Failed to geocode location',
    });
  }
};

/**
 * Proxy for Google Directions API (route, distance, duration)
 * GET /api/maps/directions?origin=28.123,77.456&destination=28.789,77.012
 */
export const directions = async (req, res, next) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        error: 'origin and destination are required',
      });
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);

    res.status(200).json(response.data);
  } catch (error) {
    console.error('❌ Directions proxy error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch directions',
    });
  }
};
