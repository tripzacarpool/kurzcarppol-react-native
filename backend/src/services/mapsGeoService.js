import axios from 'axios';
import { env } from '../config/env.js';

const getGoogleMapsApiKey = () => env.googleMapsApiKey;

const NOMINATIM_HEADERS = {
  'User-Agent': 'TripzaCarpool/1.0 (local-development)',
};

const LOCAL_NCR_PLACES = [
  {
    name: 'Greater Noida',
    address: 'Greater Noida, Gautam Buddha Nagar, Uttar Pradesh, India',
    lat: 28.4670734,
    lng: 77.5137649,
    aliases: ['gre', 'greater', 'greater noida', 'g noida'],
  },
  {
    name: 'Pari Chowk',
    address: 'Pari Chowk, Greater Noida, Uttar Pradesh, India',
    lat: 28.465608,
    lng: 77.510687,
    aliases: ['pari', 'pari chowk', 'parichowk'],
  },
  {
    name: 'Knowledge Park II',
    address: 'Knowledge Park II, Greater Noida, Uttar Pradesh, India',
    lat: 28.459497,
    lng: 77.499186,
    aliases: ['knowledge', 'knowledge park', 'knowledge park 2', 'kp2'],
  },
  {
    name: 'Alpha 1',
    address: 'Alpha 1, Greater Noida, Uttar Pradesh, India',
    lat: 28.474388,
    lng: 77.508553,
    aliases: ['alpha', 'alpha 1', 'alpha one'],
  },
  {
    name: 'Beta 1',
    address: 'Beta 1, Greater Noida, Uttar Pradesh, India',
    lat: 28.478788,
    lng: 77.521987,
    aliases: ['beta', 'beta 1', 'beta one'],
  },
  {
    name: 'Delta 1',
    address: 'Delta 1, Greater Noida, Uttar Pradesh, India',
    lat: 28.480873,
    lng: 77.531744,
    aliases: ['delta', 'delta 1', 'delta one'],
  },
  {
    name: 'Gaur City',
    address: 'Gaur City, Greater Noida West, Uttar Pradesh, India',
    lat: 28.612703,
    lng: 77.426991,
    aliases: ['gaur', 'gaur city', 'greater noida west'],
  },
  {
    name: 'Sector 18 Noida',
    address: 'Sector 18, Noida, Uttar Pradesh, India',
    lat: 28.570784,
    lng: 77.326139,
    aliases: ['sector 18', 'sec 18', 'atta', 'noida sector 18'],
  },
  {
    name: 'Noida City Centre',
    address: 'Noida City Centre, Sector 32, Noida, Uttar Pradesh, India',
    lat: 28.574385,
    lng: 77.35691,
    aliases: ['city centre', 'city center', 'sector 32', 'noida city centre'],
  },
  {
    name: 'New Delhi Railway Station',
    address: 'New Delhi Railway Station, New Delhi, Delhi, India',
    lat: 28.642936,
    lng: 77.219608,
    aliases: ['railway', 'new delhi station', 'ndls'],
  },
  {
    name: 'Indira Gandhi International Airport',
    address: 'IGI Airport, New Delhi, Delhi, India',
    lat: 28.556162,
    lng: 77.099958,
    aliases: ['airport', 'igi', 'igi airport', 'delhi airport'],
  },
];

class MapsGeoError extends Error {
  constructor(message, { status = 400, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const normalizeSearch = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toLocalPrediction = (place) => ({
  place_id: `local:${place.lat}:${place.lng}`,
  description: place.address,
  structured_formatting: {
    main_text: place.name,
    secondary_text: place.address.replace(`${place.name}, `, ''),
  },
});

const localAutocomplete = (input) => {
  const query = normalizeSearch(input);
  if (query.length < 2) return [];

  return LOCAL_NCR_PLACES.map((place) => {
    const names = [place.name, place.address, ...place.aliases].map(normalizeSearch);
    const startsWith = names.some((name) => name.startsWith(query));
    const includes = names.some((name) => name.includes(query));
    if (!startsWith && !includes) return null;

    return {
      score: startsWith ? 0 : 1,
      prediction: toLocalPrediction(place),
    };
  })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .map((item) => item.prediction);
};

const toOsmPrediction = (place) => ({
  place_id: `osm:${place.lat}:${place.lon}`,
  description: place.display_name,
  structured_formatting: {
    main_text: place.name || place.display_name?.split(',')[0] || 'Selected location',
    secondary_text: place.display_name?.split(',').slice(1).join(',').trim() || '',
  },
});

const dedupePredictions = (predictions) =>
  predictions
    .filter(
      (prediction, index, all) =>
        all.findIndex((item) => item.description === prediction.description) ===
        index,
    )
    .slice(0, 8);

const fallbackAutocomplete = async (input) => {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: input,
      format: 'jsonv2',
      addressdetails: 1,
      limit: 8,
      countrycodes: 'in',
      viewbox: '76.6,29.3,78.3,27.4',
      bounded: 0,
    },
    headers: NOMINATIM_HEADERS,
    timeout: 10000,
  });

  return {
    predictions: response.data.map(toOsmPrediction),
    status: response.data.length > 0 ? 'OK' : 'ZERO_RESULTS',
  };
};

const fallbackForwardGeocode = async (address) => {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: address,
      format: 'jsonv2',
      addressdetails: 1,
      limit: 1,
      countrycodes: 'in',
    },
    headers: NOMINATIM_HEADERS,
    timeout: 10000,
  });

  if (!response.data.length) {
    return { results: [], status: 'ZERO_RESULTS' };
  }

  const place = response.data[0];
  return {
    results: [
      {
        formatted_address: place.display_name,
        geometry: {
          location: {
            lat: Number(place.lat),
            lng: Number(place.lon),
          },
        },
      },
    ],
    status: 'OK',
  };
};

const fallbackReverseGeocode = async (latlng) => {
  const [lat, lon] = latlng.split(',');
  const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: {
      lat,
      lon,
      format: 'jsonv2',
      addressdetails: 1,
    },
    headers: NOMINATIM_HEADERS,
    timeout: 10000,
  });

  if (!response.data?.display_name) {
    return { results: [], status: 'ZERO_RESULTS' };
  }

  return {
    results: [
      {
        formatted_address: response.data.display_name,
        geometry: {
          location: {
            lat: Number(response.data.lat || lat),
            lng: Number(response.data.lon || lon),
          },
        },
      },
    ],
    status: 'OK',
  };
};

const requireGoogleKey = () => {
  if (!getGoogleMapsApiKey()) {
    throw new MapsGeoError('Google Maps API key is not configured', {
      status: 503,
      code: 'MAPS_API_KEY_MISSING',
    });
  }
};

export async function autocompletePlaces(input) {
  if (!input || input.length < 3) {
    return {
      predictions: [],
      status: 'ZERO_RESULTS',
    };
  }

  const localPredictions = localAutocomplete(input);
  if (getGoogleMapsApiKey()) {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json',
        {
          params: {
            input,
            key: getGoogleMapsApiKey(),
            components: 'country:in',
          },
        },
      );

      if (response.data.status === 'OK') {
        return {
          ...response.data,
          predictions: [...localPredictions, ...(response.data.predictions || [])].slice(0, 8),
        };
      }
    } catch {
      // Fall back below.
    }
  }

  try {
    const fallback = await fallbackAutocomplete(input);
    fallback.predictions = dedupePredictions([
      ...localPredictions,
      ...fallback.predictions,
    ]);
    fallback.status = fallback.predictions.length > 0 ? 'OK' : 'ZERO_RESULTS';
    return fallback;
  } catch {
    return {
      predictions: localPredictions.slice(0, 8),
      status: localPredictions.length > 0 ? 'OK' : 'ZERO_RESULTS',
    };
  }
}

export async function getPlaceDetails(placeId) {
  if (!placeId) {
    throw new MapsGeoError('place_id is required', {
      code: 'MISSING_PLACE_ID',
    });
  }

  if (placeId.startsWith('osm:') || placeId.startsWith('local:')) {
    const [, lat, lng] = placeId.split(':');
    return {
      result: {
        geometry: {
          location: {
            lat: Number(lat),
            lng: Number(lng),
          },
        },
      },
      status: 'OK',
    };
  }

  requireGoogleKey();
  const response = await axios.get(
    'https://maps.googleapis.com/maps/api/place/details/json',
    {
      params: {
        place_id: placeId,
        fields: 'geometry',
        key: getGoogleMapsApiKey(),
      },
    },
  );

  return response.data;
}

export async function geocodeLocation({ latlng, address }) {
  if (!latlng && !address) {
    throw new MapsGeoError('latlng or address is required', {
      code: 'MISSING_GEOCODE_INPUT',
    });
  }

  if (getGoogleMapsApiKey()) {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            ...(latlng ? { latlng } : { address }),
            key: getGoogleMapsApiKey(),
          },
        },
      );
      if (response.data.status === 'OK') {
        return response.data;
      }
    } catch {
      // Fall back below.
    }
  }

  return latlng
    ? fallbackReverseGeocode(latlng)
    : fallbackForwardGeocode(address);
}

export async function getDirections({ origin, destination }) {
  if (!origin || !destination) {
    throw new MapsGeoError('origin and destination are required', {
      code: 'MISSING_DIRECTIONS_INPUT',
    });
  }

  requireGoogleKey();
  const response = await axios.get(
    'https://maps.googleapis.com/maps/api/directions/json',
    {
      params: {
        origin,
        destination,
        key: getGoogleMapsApiKey(),
      },
    },
  );

  return response.data;
}
