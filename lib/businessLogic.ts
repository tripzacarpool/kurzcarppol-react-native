import {
  FESTIVAL_PRICING_TIERS,
  FESTIVAL_GROUP_BOOKING_BENEFITS,
  RETURN_TRIP_DISCOUNT,
} from '@/constants/festivals';
import { INSURANCE_PLANS } from '@/constants/insurance';
import {
  SAFE_DRIVER_TIER_CRITERIA,
  RIDE_STREAK_BENEFITS,
  CARBON_COUNTER_METRICS,
} from '@/constants/gamification';
import type { InsurancePlan, SafeDriverTier } from '@/types';

// ============================================================================
// FESTIVAL PRICING UTILITIES
// ============================================================================

export const calculateFestivalSmartPrice = (
  basePrice: number,
  distanceKm: number,
  groupSize: number = 1,
  surgeMultiplier: number = 1,
): number => {
  // Determine tier based on distance
  let margin = FESTIVAL_PRICING_TIERS.tier1.margin;
  if (distanceKm > 300) {
    margin = FESTIVAL_PRICING_TIERS.tier3.margin;
  } else if (distanceKm > 100) {
    margin = FESTIVAL_PRICING_TIERS.tier2.margin;
  }

  // Calculate base smart price
  let smartPrice = basePrice * (1 + margin) * surgeMultiplier;

  // Apply group booking discount
  if (groupSize >= 5) {
    smartPrice =
      smartPrice *
      (1 -
        FESTIVAL_GROUP_BOOKING_BENEFITS['5_plus_passengers']
          .discountPercentage /
          100);
  } else if (groupSize === 4) {
    smartPrice =
      smartPrice *
      (1 -
        FESTIVAL_GROUP_BOOKING_BENEFITS['4_passengers'].discountPercentage /
          100);
  } else if (groupSize === 3) {
    smartPrice =
      smartPrice *
      (1 -
        FESTIVAL_GROUP_BOOKING_BENEFITS['3_passengers'].discountPercentage /
          100);
  } else if (groupSize === 2) {
    smartPrice =
      smartPrice *
      (1 -
        FESTIVAL_GROUP_BOOKING_BENEFITS['2_passengers'].discountPercentage /
          100);
  }

  return Math.round(smartPrice);
};

export const calculateReturnTripDiscount = (originalPrice: number): number => {
  return Math.round(originalPrice * (RETURN_TRIP_DISCOUNT / 100));
};

// ============================================================================
// INSURANCE UTILITIES
// ============================================================================

export const getInsurancePremium = (plan: InsurancePlan): number => {
  return INSURANCE_PLANS[plan].premium;
};

export const getInsuranceCoverage = (plan: InsurancePlan): number => {
  return INSURANCE_PLANS[plan].coverage;
};

export const calculateClaimEligibility = (
  claimAmount: number,
  plan: InsurancePlan,
  alreadyClaimedAmount: number = 0,
): { eligible: boolean; reason?: string; approvalAmount?: number } => {
  const planDetails = INSURANCE_PLANS[plan];
  const remainingCoverage = planDetails.coverage - alreadyClaimedAmount;

  if (remainingCoverage <= 0) {
    return { eligible: false, reason: 'Coverage limit exceeded' };
  }

  if (claimAmount > remainingCoverage) {
    return {
      eligible: true,
      reason: 'Claim amount exceeds remaining coverage',
      approvalAmount: remainingCoverage,
    };
  }

  return { eligible: true, approvalAmount: claimAmount };
};

// ============================================================================
// GAMIFICATION UTILITIES
// ============================================================================

export const calculateSafeDriverTier = (
  ridesCount: number,
  cancellationRate: number,
  ratingAverage: number,
  incidentsCount: number,
): string => {
  const criteria = SAFE_DRIVER_TIER_CRITERIA;

  if (
    ridesCount >= criteria.platinum.minRidesCount &&
    cancellationRate <= criteria.platinum.maxCancellationRate &&
    ratingAverage >= criteria.platinum.minRating &&
    incidentsCount <= criteria.platinum.maxIncidents
  ) {
    return 'platinum';
  }

  if (
    ridesCount >= criteria.gold.minRidesCount &&
    cancellationRate <= criteria.gold.maxCancellationRate &&
    ratingAverage >= criteria.gold.minRating &&
    incidentsCount <= criteria.gold.maxIncidents
  ) {
    return 'gold';
  }

  if (
    ridesCount >= criteria.silver.minRidesCount &&
    cancellationRate <= criteria.silver.maxCancellationRate &&
    ratingAverage >= criteria.silver.minRating &&
    incidentsCount <= criteria.silver.maxIncidents
  ) {
    return 'silver';
  }

  return 'bronze';
};

export const calculateRideStreakBonus = (currentStreak: number): number => {
  const benefits = RIDE_STREAK_BENEFITS.bonusMultipliers;

  if (currentStreak >= 50) return benefits['50_rides'];
  if (currentStreak >= 20) return benefits['20_rides'];
  if (currentStreak >= 10) return benefits['10_rides'];
  if (currentStreak >= 5) return benefits['5_rides'];

  return 1.0; // no multiplier
};

export const calculateEmissionsSaved = (
  distanceKm: number,
  passengersCount: number = 1,
  isCarpooled: boolean = false,
): number => {
  if (isCarpooled) {
    return (
      distanceKm *
      CARBON_COUNTER_METRICS.emissionsPerKmCarpool *
      passengersCount
    );
  }
  return distanceKm * CARBON_COUNTER_METRICS.emissionsPerKmSoloTravel;
};

export const calculateGamificationScore = (data: {
  ridesCompleted: number;
  badgesCount: number;
  carbonSaved: number;
  safeDriverTierLevel: number;
  streakLength: number;
  groupPromoCount: number;
}): number => {
  const scoring = {
    ridesCompleted: 1,
    pointsFromBadges: 5,
    carbonSaved: 0.5,
    safeDriverBonus: 10,
    streakBonus: 2,
    groupBookingBonus: 3,
  };

  return (
    data.ridesCompleted * scoring.ridesCompleted +
    data.badgesCount * scoring.pointsFromBadges +
    data.carbonSaved * scoring.carbonSaved +
    data.safeDriverTierLevel * scoring.safeDriverBonus +
    data.streakLength * scoring.streakBonus +
    data.groupPromoCount * scoring.groupBookingBonus
  );
};

// ============================================================================
// REFERRAL UTILITIES
// ============================================================================

export const generateReferralCode = (userId: string): string => {
  return `RAAH${userId.toUpperCase()}`;
};

export const validateReferralCode = (code: string): boolean => {
  return /^RAAH[A-Z0-9]+$/.test(code);
};

// ============================================================================
// REVENUE CALCULATION UTILITIES
// ============================================================================

export const calculatePlatformCommission = (
  rideValue: number,
  type: 'normal' | 'festival' | 'surge' | 'long_route' = 'normal',
): number => {
  const commissionRates = {
    normal: 0.12, // 12%
    festival: 0.15, // 15%
    surge: 0.18, // 18%
    long_route: 0.1, // 10%
  };

  return Math.round(rideValue * commissionRates[type]);
};

export interface RevenueCalculationInput {
  totalRideValue: number;
  insuranceActivation: number;
  groupBookingCount: number;
  festivalSurgeMultiplier: number;
  longRouteMultiplier: number;
}

export const calculateTotalRevenue = (
  input: RevenueCalculationInput,
): {
  commissionFromRides: number;
  insuranceRevenue: number;
  surgeRevenue: number;
  totalRevenue: number;
} => {
  const baseCommission = calculatePlatformCommission(input.totalRideValue);
  const surgeRevenue =
    input.totalRideValue * (input.festivalSurgeMultiplier - 1) * 0.05; // platform takes 5% of surge
  const insuranceRevenue = input.insuranceActivation * 5; // ₹5 per ride insurance

  return {
    commissionFromRides: baseCommission,
    insuranceRevenue,
    surgeRevenue: Math.round(surgeRevenue),
    totalRevenue: Math.round(baseCommission + insuranceRevenue + surgeRevenue),
  };
};

// ============================================================================
// UNIT ECONOMICS UTILITIES
// ============================================================================

export interface UnitEconomicsInput {
  totalRides: number;
  totalRevenue: number;
  totalOperatingCost: number;
  userAcquisitionCost: number;
  activeUsers: number;
}

export const calculateUnitEconomics = (input: UnitEconomicsInput) => {
  const averageRideValue = Math.round(input.totalRevenue / input.totalRides);
  const platformCommissionPercentage = 0.12; // 12%
  const platformCommissionPerRide = Math.round(
    averageRideValue * platformCommissionPercentage,
  );
  const costPerRide = Math.round(input.totalOperatingCost / input.totalRides);
  const netMarginPerRide = platformCommissionPerRide - costPerRide;
  const netMarginPercentage = (netMarginPerRide / averageRideValue) * 100;
  const customerAcquisitionCost = Math.round(
    input.userAcquisitionCost / input.activeUsers,
  );
  const rideDecision = Math.ceil(customerAcquisitionCost / netMarginPerRide);
  const paybackPeriod = rideDecision / 30; // assuming 30 rides per month

  return {
    averageRideValue,
    platformCommissionPerRide,
    costPerRide,
    netMarginPerRide,
    netMarginPercentage: netMarginPercentage.toFixed(2),
    customerAcquisitionCost,
    ridesForBreakeven: rideDecision,
    paybackPeriodMonths: paybackPeriod.toFixed(1),
  };
};
// ============================================================================
// HYBRID RIDE APPROVAL SYSTEM
// ============================================================================

import {
  APPROVAL_MODE,
  SEAT_LOCK_STATUS,
  BOOKING_APPROVAL_STATUS,
  APPROVAL_SETTINGS,
  SEAT_LOCKING_RULES,
  CANCELLATION_RULES,
} from '@/constants/approvalSystem';
import type {
  Booking,
  Ride,
  SeatLockInfo,
  ApprovalMode,
  BookingApprovalStatus,
} from '@/types';

/**
 * Determines if booking should be auto-confirmed or require manual approval
 * Festival rides are ALWAYS auto-confirmed
 */
export const determineApprovalMode = (
  ride: Ride,
  passengerRating?: number,
  passengerTripCount?: number,
): { mode: ApprovalMode; reason: string } => {
  // Festival rides ALWAYS auto-confirm
  if (ride.isFestivalRide) {
    return {
      mode: APPROVAL_MODE.AUTO,
      reason: 'Festival rides auto-confirm',
    };
  }

  // If driver requires manual approval
  if (ride.requiresManualApproval) {
    // But override if passenger meets auto-approve threshold
    if (
      passengerRating &&
      passengerRating >= APPROVAL_SETTINGS.AUTO_APPROVE_RATING_THRESHOLD &&
      passengerTripCount &&
      passengerTripCount >= APPROVAL_SETTINGS.AUTO_APPROVE_MIN_TRIPS
    ) {
      return {
        mode: APPROVAL_MODE.AUTO,
        reason: `Passenger rating ${passengerRating}+ (trusted passenger)`,
      };
    }

    return {
      mode: APPROVAL_MODE.MANUAL,
      reason: 'Driver requires manual approval',
    };
  }

  // Default: auto-confirm for seamless experience
  return {
    mode: APPROVAL_MODE.AUTO,
    reason: 'Auto-confirm enabled (default)',
  };
};

/**
 * Determines initial approval status for a booking
 */
export const determineInitialApprovalStatus = (
  approvalMode: ApprovalMode,
): BookingApprovalStatus => {
  return approvalMode === APPROVAL_MODE.AUTO
    ? BOOKING_APPROVAL_STATUS.AUTO_ACCEPTED
    : BOOKING_APPROVAL_STATUS.PENDING_APPROVAL;
};

/**
 * Creates seat lock information for a booking
 */
export const createSeatLock = (
  seatNumber: number,
  userId: string,
  bookingId: string,
  approvalMode: ApprovalMode,
): SeatLockInfo => {
  const now = new Date();
  const lockDurationMs =
    approvalMode === APPROVAL_MODE.AUTO
      ? SEAT_LOCKING_RULES.CONFIRMATION_LOCK_DURATION
      : SEAT_LOCKING_RULES.MANUAL_APPROVAL_LOCK_DURATION;

  return {
    seatNumber,
    status: SEAT_LOCK_STATUS.LOCKED,
    userId,
    bookingId,
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lockDurationMs).toISOString(),
  };
};

/**
 * Checks if a seat is available (not locked/booked)
 */
export const isSeatAvailable = (
  seatLocks: SeatLockInfo[],
  seatNumber: number,
): boolean => {
  const seatLock = seatLocks.find((lock) => lock.seatNumber === seatNumber);

  if (!seatLock) return true; // No lock = available

  if (seatLock.status === SEAT_LOCK_STATUS.AVAILABLE) return true;

  // Check if lock has expired
  if (seatLock.expiresAt) {
    const expiryTime = new Date(seatLock.expiresAt).getTime();
    if (Date.now() > expiryTime) {
      return true; // Lock expired = available
    }
  }

  return false;
};

/**
 * Gets available seats from a ride
 */
export const getAvailableSeatsCount = (ride: Ride): number => {
  let availableCount = 0;
  for (let i = 1; i <= ride.totalSeats; i++) {
    if (isSeatAvailable(ride.seatLocks, i)) {
      availableCount++;
    }
  }
  return availableCount;
};

/**
 * Allocates optimal seats for a booking
 */
export const allocateSeats = (
  ride: Ride,
  requestedSeatCount: number,
): number[] => {
  const allocatedSeats: number[] = [];

  // Try to allocate contiguous seats
  for (
    let i = 1;
    i <= ride.totalSeats && allocatedSeats.length < requestedSeatCount;
    i++
  ) {
    if (isSeatAvailable(ride.seatLocks, i)) {
      allocatedSeats.push(i);
    }
  }

  return allocatedSeats.slice(0, requestedSeatCount);
};

/**
 * Validates if booking request is eligible for auto-approval
 */
export const validateAutoApprovalEligibility = (passenger: {
  rating: number;
  tripCount: number;
  cancellationRate: number;
}): { eligible: boolean; reason: string } => {
  if (passenger.rating < APPROVAL_SETTINGS.AUTO_APPROVE_RATING_THRESHOLD) {
    return {
      eligible: false,
      reason: `Rating too low: ${passenger.rating.toFixed(1)} (min: ${APPROVAL_SETTINGS.AUTO_APPROVE_RATING_THRESHOLD})`,
    };
  }

  if (passenger.tripCount < APPROVAL_SETTINGS.AUTO_APPROVE_MIN_TRIPS) {
    return {
      eligible: false,
      reason: `Not enough trips: ${passenger.tripCount} (min: ${APPROVAL_SETTINGS.AUTO_APPROVE_MIN_TRIPS})`,
    };
  }

  if (
    passenger.cancellationRate >
    APPROVAL_SETTINGS.AUTO_APPROVE_CANCELLATION_RATE
  ) {
    return {
      eligible: false,
      reason: `Cancellation rate too high: ${(passenger.cancellationRate * 100).toFixed(1)}%`,
    };
  }

  return {
    eligible: true,
    reason: 'Passenger meets all auto-approval criteria',
  };
};

/**
 * Calculates cancellation penalty for a booking
 */
export const calculateCancellationPenalty = (
  booking: Booking,
  departureTime: Date,
  cancelledBy: 'passenger' | 'driver',
): {
  deductionAmount: number;
  refundAmount: number;
  ratingPenalty?: number;
  cancellationPhase: string;
} => {
  const now = new Date();
  const minutesUntilDeparture =
    (departureTime.getTime() - now.getTime()) / (1000 * 60);

  let phase = 'unknown';
  let deductionPercent = 0;
  let refundPercent = 100;
  let ratingPenalty = 0;

  if (
    minutesUntilDeparture > CANCELLATION_RULES.FREE_CANCELLATION_BEFORE_MINUTES
  ) {
    // More than 60 minutes: free cancellation
    phase = 'early_cancellation';
    deductionPercent = 0;
    refundPercent = 100;
  } else if (
    minutesUntilDeparture > CANCELLATION_RULES.MODERATE_PENALTY_BEFORE_MINUTES
  ) {
    // 30-60 minutes: 25% penalty
    phase = 'moderate_cancellation';
    deductionPercent = 25;
    refundPercent = 75;
  } else if (
    minutesUntilDeparture > CANCELLATION_RULES.HIGH_PENALTY_BEFORE_MINUTES
  ) {
    // 5-30 minutes: 50% penalty
    phase = 'high_penalty_cancellation';
    deductionPercent = 50;
    refundPercent = 50;
  } else if (minutesUntilDeparture > -5) {
    // Within 5 minutes of departure: no refund
    phase = 'no_show_cancellation';
    deductionPercent = 100;
    refundPercent = 0;
    ratingPenalty = -0.5;
  }

  const deductionAmount = (booking.fare * deductionPercent) / 100;
  const refundAmount = (booking.fare * refundPercent) / 100;

  return {
    deductionAmount: Math.round(deductionAmount),
    refundAmount: Math.round(refundAmount),
    ratingPenalty,
    cancellationPhase: phase,
  };
};

/**
 * Checks if approval request has expired
 */
export const isApprovalExpired = (
  booking: Booking,
  approvalDeadlineMinutes: number = APPROVAL_SETTINGS.DEFAULT_APPROVAL_DEADLINE,
): boolean => {
  if (!booking.approvalRequestedAt) return false;

  const requestTime = new Date(booking.approvalRequestedAt).getTime();
  const deadlineTime = requestTime + approvalDeadlineMinutes * 60 * 1000;

  return Date.now() > deadlineTime;
};

/**
 * Auto-rejects expired approval requests
 */
export const handleExpiredApprovals = (bookings: Booking[]): Booking[] => {
  return bookings.map((booking) => {
    if (
      booking.approvalStatus === BOOKING_APPROVAL_STATUS.PENDING_APPROVAL &&
      isApprovalExpired(booking)
    ) {
      return {
        ...booking,
        approvalStatus: BOOKING_APPROVAL_STATUS.EXPIRED,
        rejectionReason: 'Approval request expired - auto-rejected',
      };
    }
    return booking;
  });
};

/**
 * Generates approval decision summary for driver
 */
export const generateApprovalSummary = (
  bookings: Booking[],
): {
  pendingCount: number;
  autoConfirmedCount: number;
  approvedCount: number;
  rejectedCount: number;
  expiredCount: number;
} => {
  return {
    pendingCount: bookings.filter(
      (b) => b.approvalStatus === BOOKING_APPROVAL_STATUS.PENDING_APPROVAL,
    ).length,
    autoConfirmedCount: bookings.filter(
      (b) => b.approvalStatus === BOOKING_APPROVAL_STATUS.AUTO_ACCEPTED,
    ).length,
    approvedCount: bookings.filter(
      (b) => b.approvalStatus === BOOKING_APPROVAL_STATUS.APPROVED,
    ).length,
    rejectedCount: bookings.filter(
      (b) => b.approvalStatus === BOOKING_APPROVAL_STATUS.REJECTED,
    ).length,
    expiredCount: bookings.filter(
      (b) => b.approvalStatus === BOOKING_APPROVAL_STATUS.EXPIRED,
    ).length,
  };
};

/**
 * Validates approval toggle - festival rides cannot disable auto-confirm
 */
export const validateApprovalModeChange = (
  isFestivalRide: boolean,
  newRequiresApproval: boolean,
): { valid: boolean; error?: string } => {
  if (isFestivalRide && newRequiresApproval) {
    return {
      valid: false,
      error:
        '🎪 Festival rides must auto-confirm - manual approval not allowed',
    };
  }

  return { valid: true };
};
