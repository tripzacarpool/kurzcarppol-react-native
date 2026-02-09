// Google Maps API Proxy Routes
import express from 'express';
import {
  autocomplete,
  placeDetails,
  geocode,
  directions,
} from '../controllers/mapsProxyController.js';

const router = express.Router();

// GET /api/maps/autocomplete - Proxy for Places Autocomplete
router.get('/autocomplete', autocomplete);

// GET /api/maps/place-details - Proxy for Place Details
router.get('/place-details', placeDetails);

// GET /api/maps/geocode - Proxy for Geocoding
router.get('/geocode', geocode);

// GET /api/maps/directions - Proxy for Directions (distance/fare)
router.get('/directions', directions);

export default router;
