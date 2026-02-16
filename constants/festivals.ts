import { Festival } from '@/types';

export interface FestivalMeta {
  title: string;
  emoji: string;
  description: string;
  upcomingDates: string[]; // ISO format dates
  commonRoutes: string[];
  discountPercentage: number;
  expectedSurge: number; // multiplier
}

export const FESTIVALS: Record<Festival, FestivalMeta> = {
  diwali: {
    title: 'Diwali',
    emoji: '🪔',
    description: 'Festival of lights - peak travel season',
    upcomingDates: ['2024-11-01', '2025-10-20'],
    commonRoutes: ['Delhi-Lucknow', 'Mumbai-Pune', 'Hyderabad-Bengaluru'],
    discountPercentage: 15,
    expectedSurge: 2.5,
  },
  holi: {
    title: 'Holi',
    emoji: '🎨',
    description: 'Festival of colors - massive travel demand',
    upcomingDates: ['2024-03-25', '2025-03-14'],
    commonRoutes: ['Delhi-Agra', 'NCR inter-district', 'UP-Rajasthan corridor'],
    discountPercentage: 12,
    expectedSurge: 2.0,
  },
  eid: {
    title: 'Eid-ul-Fitr',
    emoji: '🌙',
    description: 'Islamic festival - nationwide travel',
    upcomingDates: ['2024-04-10', '2025-03-30'],
    commonRoutes: ['Mumbai-Hyderabad', 'Delhi-Lucknow', 'Bangalore-Mysore'],
    discountPercentage: 10,
    expectedSurge: 1.8,
  },
  chhath: {
    title: 'Chhath Puja',
    emoji: '🙏',
    description: 'Bihar-specific festival - localized demand',
    upcomingDates: ['2024-11-08', '2025-10-29'],
    commonRoutes: ['Patna-Delhi', 'Bihar-NCR', 'Varanasi-Delhi'],
    discountPercentage: 8,
    expectedSurge: 1.5,
  },
  wedding: {
    title: 'Wedding Season',
    emoji: '💒',
    description: 'Peak wedding months - consistent demand',
    upcomingDates: ['2024-11-01', '2024-12-31', '2025-01-31'],
    commonRoutes: [
      'Inter-state corridors',
      'Rajasthan routes',
      'Union Territory routes',
    ],
    discountPercentage: 20,
    expectedSurge: 3.0,
  },
};

export const FESTIVAL_PRICING_TIERS = {
  tier1: { minDistance: 0, maxDistance: 100, margin: 0.15 }, // 15% margin
  tier2: { minDistance: 100, maxDistance: 300, margin: 0.12 }, // 12% margin
  tier3: { minDistance: 300, maxDistance: 999999, margin: 0.1 }, // 10% margin
};

export const FESTIVAL_GROUP_BOOKING_BENEFITS = {
  '2_passengers': { discountPercentage: 3, minRideValue: 200 },
  '3_passengers': { discountPercentage: 5, minRideValue: 300 },
  '4_passengers': { discountPercentage: 8, minRideValue: 400 },
  '5_plus_passengers': { discountPercentage: 12, minRideValue: 500 },
};

export const RETURN_TRIP_DISCOUNT = 15; // 15% discount on return trip booking
export const VERIFIED_LONG_ROUTE_DRIVER_BONUS = 50; // ₹50 bonus for verified drivers on long routes

// UI-friendly festival list for dropdowns / buttons
export const FESTIVAL_TYPES: Array<{ label: string; value: Festival }> =
  Object.keys(FESTIVALS).map((k) => ({
    label: FESTIVALS[k as Festival].title,
    value: k as Festival,
  }));
