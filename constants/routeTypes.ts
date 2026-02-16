import { RouteType, CoverageLevel } from '@/types';

export interface RouteTypeMeta {
  label: string;
  description: string;
  averageDistance: string;
  targetUserBase: string;
  revenueOpportunity: string;
}

export const ROUTE_TYPES: Record<RouteType, RouteTypeMeta> = {
  district: {
    label: 'District-to-District',
    description: 'Intra-state, inter-district routes (100-300 km)',
    averageDistance: '150-250 km',
    targetUserBase: 'Business travelers, job commuters, weekend trips',
    revenueOpportunity: 'High - frequent travelers in regional markets',
  },
  village: {
    label: 'Village Pickup',
    description: 'Rural-to-urban and inter-village routes',
    averageDistance: '30-150 km',
    targetUserBase: 'Rural population, daily workers, students',
    revenueOpportunity: 'Medium - underserved market with high demand',
  },
  railway: {
    label: 'Railway Connector',
    description: 'Airport/Station-to-home and station hub routes',
    averageDistance: '20-80 km',
    targetUserBase: 'Frequent travelers, business commuters, tourists',
    revenueOpportunity: 'Very High - premium pricing opportunity',
  },
  urban: {
    label: 'Urban Highway',
    description: 'Inter-city on major highways (200+ km)',
    averageDistance: '200-600 km',
    targetUserBase: 'Long-distance business, family trips, solo travelers',
    revenueOpportunity: 'High - premium margins on long routes',
  },
};

export const COVERAGE_EXPANSION_LEVELS: Record<
  CoverageLevel,
  { description: string; targetCities: number; tier2Strategy: string }
> = {
  tier1_cities: {
    description: 'Metro cities and major hubs',
    targetCities: 10,
    tier2Strategy:
      'Expansion to Tier 2 cities (Pune, Ahmedabad, Jaipur, Lucknow, Kanpur, etc.)',
  },
  tier2_expansion: {
    description: 'Secondary cities and business hubs',
    targetCities: 50,
    tier2Strategy:
      'Build critical mass with offline agents and vernacular onboarding',
  },
  tier3_villages: {
    description: 'Tier 3 cities and village connectors',
    targetCities: 200,
    tier2Strategy: 'Hyperlocal agent model with 1 agent per 50k population',
  },
};

export const TIER_2_3_EXPANSION_ROADMAP = {
  phase1: {
    duration: '0-30 days',
    cities: ['Pune', 'Ahmedabad', 'Jaipur'],
    offlineAgents: 15,
    expectedUsers: 2500,
  },
  phase2: {
    duration: '31-60 days',
    cities: ['Lucknow', 'Kanpur', 'Nagpur', 'Indore'],
    offlineAgents: 30,
    expectedUsers: 5000,
  },
  phase3: {
    duration: '61-90 days',
    cities: ['Bhopal', 'Surat', 'Vadodara', 'Ghaziabad', 'Ludhiana'],
    offlineAgents: 50,
    expectedUsers: 10000,
  },
};

export const RAILWAY_STATION_CONNECTOR_FEATURES = {
  description: 'Direct pickup from major railway stations with premium pricing',
  stationCategories: {
    category_A: {
      label: 'Major metros (Delhi, Mumbai, Bangalore, Chennai, Hyderabad)',
      targetStations: 15,
      surgeMultiplier: 1.5,
      commissionPercentage: 12,
    },
    category_B: {
      label: 'Tier 2 business hubs (Pune, Ahmedabad, Jaipur)',
      targetStations: 30,
      surgeMultiplier: 1.3,
      commissionPercentage: 11,
    },
    category_C: {
      label: 'Tier 3 railway junctions',
      targetStations: 100,
      surgeMultiplier: 1.2,
      commissionPercentage: 10,
    },
  },
};

export const VILLAGE_PICKUP_LOGISTICS = {
  pickupRadiusKm: 15,
  minimumRideValue: 250,
  surgeMultiplier: 1.2,
  batching: {
    description: 'Group multiple village pickups into efficient batches',
    minPassengersPerBatch: 2,
    maxDetourTime: 20, // minutes
  },
};
