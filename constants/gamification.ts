import { BadgeType } from '@/types';

export interface BadgeMeta {
  displayName: string;
  description: string;
  emoji: string;
  bronzeThreshold: number;
  silverThreshold: number;
  goldThreshold: number;
  platinumThreshold: number;
  pointsAwarded: number;
}

export const BADGES: Record<BadgeType, BadgeMeta> = {
  campus: {
    displayName: 'Campus Hero',
    description: 'Frequent rides between educational institutions and hostels',
    emoji: '🎓',
    bronzeThreshold: 5,
    silverThreshold: 15,
    goldThreshold: 30,
    platinumThreshold: 60,
    pointsAwarded: 10,
  },
  safe_driver: {
    displayName: 'Safe Driver',
    description: 'Zero accidents, high ratings, perfect attendance',
    emoji: '⭐',
    bronzeThreshold: 20,
    silverThreshold: 50,
    goldThreshold: 100,
    platinumThreshold: 250,
    pointsAwarded: 25,
  },
  eco_warrior: {
    displayName: 'Eco Warrior',
    description: 'Saved 500+ kg CO2 through carpooling',
    emoji: '🌱',
    bronzeThreshold: 500,
    silverThreshold: 2500,
    goldThreshold: 5000,
    platinumThreshold: 10000,
    pointsAwarded: 15,
  },
  festival_pro: {
    displayName: 'Festival Pro',
    description: 'Completed 10+ rides during festival seasons',
    emoji: '🎉',
    bronzeThreshold: 10,
    silverThreshold: 25,
    goldThreshold: 50,
    platinumThreshold: 100,
    pointsAwarded: 20,
  },
  group_booking: {
    displayName: 'Group Master',
    description: 'Organized 5+ group bookings for 4+ passengers',
    emoji: '👥',
    bronzeThreshold: 5,
    silverThreshold: 15,
    goldThreshold: 30,
    platinumThreshold: 60,
    pointsAwarded: 12,
  },
};

export const SAFE_DRIVER_TIER_CRITERIA = {
  bronze: {
    minRidesCount: 10,
    maxCancellationRate: 0.2, // 20%
    minRating: 3.5,
    maxIncidents: 2,
  },
  silver: {
    minRidesCount: 50,
    maxCancellationRate: 0.1, // 10%
    minRating: 4.2,
    maxIncidents: 1,
  },
  gold: {
    minRidesCount: 100,
    maxCancellationRate: 0.05, // 5%
    minRating: 4.7,
    maxIncidents: 0,
  },
  platinum: {
    minRidesCount: 250,
    maxCancellationRate: 0.02, // 2%
    minRating: 4.9,
    maxIncidents: 0,
  },
};

export const RIDE_STREAK_BENEFITS = {
  bonusMultipliers: {
    '5_rides': 1.05, // 5% bonus
    '10_rides': 1.1, // 10% bonus
    '20_rides': 1.2, // 20% bonus
    '50_rides': 1.5, // 50% bonus
  },
  streakResetDays: 7, // break streak if no ride in 7 days
  streakBonus: {
    cashback: 0.05, // 5% cashback on every ride in streak
    points: 10, // +10 points per ride in streak
  },
};

export const CARBON_COUNTER_METRICS = {
  emissionsPerKmSoloTravel: 0.25, // kg CO2
  emissionsPerKmCarpool: 0.15, // kg CO2 (per passenger)
  pointsPerKgSaved: 2,
  milestoneBonuses: {
    '250_kg': { bonus: 100, badge: 'eco_warrior' },
    '500_kg': { bonus: 250, badge: 'eco_warrior' },
    '1000_kg': { bonus: 500, badge: 'eco_warrior' },
    '5000_kg': { bonus: 2000, badge: 'eco_warrior' },
  },
};

export const REFERRAL_PROGRAM_BENEFITS = {
  referrerDiscount: {
    firstReferral: 100, // ₹100 discount on next ride
    perReferral: 50, // ₹50 per successful referral
    maxMonthlyBonus: 1000, // ₹1000 max per month
  },
  referreeDiscount: {
    signupBonus: 100, // ₹100 on first ride
    minimumRideValue: 200, // minimum ride value to apply discount
  },
  referralCode: {
    format: 'RAAH[USER_ID]', // e.g., RAAH12345
    validityDays: 365,
    maxRedeemable: null, // unlimited
  },
};

export const LEADERBOARD_CONFIGURATION = {
  scoringSystem: {
    ridesCompleted: 1,
    pointsFromBadges: 5,
    carbonSaved: 0.5,
    safeDriverBonus: 10,
    streakBonus: 2,
    groupBookingBonus: 3,
  },
  resetCycle: 'monthly', // resets every month
  topPerformers: 100,
  rewardDistribution: {
    rank_1: { bonus: 500, badge: 'special_edition' },
    rank_2_10: { bonus: 200, badge: 'top_performer' },
    rank_11_50: { bonus: 100, badge: 'rising_star' },
    rank_51_100: { bonus: 50, badge: 'participator' },
  },
};

export const GAMIFICATION_FEATURES_PRIORITY = [
  {
    feature: 'Ride Streaks',
    complexity: 'low',
    userImpact: 'high',
    mvpPhase: 1,
  },
  {
    feature: 'Carbon Counter',
    complexity: 'low',
    userImpact: 'medium',
    mvpPhase: 1,
  },
  {
    feature: 'Safe Driver Tiers',
    complexity: 'medium',
    userImpact: 'high',
    mvpPhase: 1,
  },
  {
    feature: 'Badges',
    complexity: 'low',
    userImpact: 'medium',
    mvpPhase: 2,
  },
  {
    feature: 'Referral Program',
    complexity: 'low',
    userImpact: 'high',
    mvpPhase: 2,
  },
  {
    feature: 'Leaderboard',
    complexity: 'medium',
    userImpact: 'medium',
    mvpPhase: 2,
  },
];
