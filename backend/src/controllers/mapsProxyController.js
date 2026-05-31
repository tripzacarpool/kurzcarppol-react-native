import {
  autocompletePlaces,
  geocodeLocation,
  getDirections,
  getPlaceDetails,
} from '../services/mapsGeoService.js';

const sendMapsError = (req, res, error, fallbackCode) =>
  res.status(error.status || 500).json({
    error: error.message,
    details: error.details,
    code: error.code || fallbackCode,
    requestId: req.requestId,
  });

export const autocomplete = async (req, res) => {
  try {
    const result = await autocompletePlaces(req.query.input);
    return res.status(200).json(result);
  } catch (error) {
    return sendMapsError(req, res, error, 'MAPS_AUTOCOMPLETE_ERROR');
  }
};

export const placeDetails = async (req, res) => {
  try {
    const result = await getPlaceDetails(req.query.place_id);
    return res.status(200).json(result);
  } catch (error) {
    return sendMapsError(req, res, error, 'MAPS_PLACE_DETAILS_ERROR');
  }
};

export const geocode = async (req, res) => {
  try {
    const result = await geocodeLocation({
      latlng: req.query.latlng,
      address: req.query.address,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendMapsError(req, res, error, 'MAPS_GEOCODE_ERROR');
  }
};

export const directions = async (req, res) => {
  try {
    const result = await getDirections({
      origin: req.query.origin,
      destination: req.query.destination,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendMapsError(req, res, error, 'MAPS_DIRECTIONS_ERROR');
  }
};
