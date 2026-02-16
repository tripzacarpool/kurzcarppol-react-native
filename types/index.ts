export type UserRole = 'passenger' | 'ride_partner' | 'admin';

export type RidePartnerMode = 'daily' | 'casual' | 'professional';
export type RidePartnerVehicleType = 'personal' | 'cab';
export type RidePartnerApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface RidePartnerTimelineEvent {
  status: RidePartnerApplicationStatus;
  note?: string;
  timestamp: string;
}

export interface RidePartnerVerificationSection {
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  verifiedAt?: string;
  rejectionReason?: string;
}

export type RidePartnerKycStatus = 'pending' | 'in_progress' | 'verified';

export interface RidePartnerKycDetails extends RidePartnerVerificationSection {
  selfiePhoto?: string;
  digilockerDocument?: string;
  digilockerStatus: RidePartnerKycStatus;
}

export interface RidePartnerProfile {
  status: RidePartnerApplicationStatus;
  mode: RidePartnerMode;
  vehicleType: RidePartnerVehicleType;
  basicProfile: {
    fullName: string;
    phone: string;
    profilePhotoUrl?: string;
  } & RidePartnerVerificationSection;
  vehicleDetails: {
    carModel: string;
    vehicleNumber: string;
    vehiclePhotoUrl?: string;
  } & RidePartnerVerificationSection;
  licenseDetails: {
    licenseNumber: string;
    licensePhotoUrl?: string;
  } & RidePartnerVerificationSection;
  kycDetails?: RidePartnerKycDetails;
  payoutDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
  } & RidePartnerVerificationSection;
  professionalDetails?: {
    commercialPermitUrl?: string;
  } & RidePartnerVerificationSection;
  declaration: {
    communityRulesAccepted: boolean;
    ownershipConsent: boolean;
    acceptedAt: string;
  };
  timeline: RidePartnerTimelineEvent[];
  lastSubmittedAt?: string;
  reviewerNotes?: string;
}

export type DriverMode = 'all_access' | 'community' | 'commuter';

export type Gender = 'male' | 'female' | 'other';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  role: UserRole;
  rating: number;
  avatar?: string;
  walletBalance: number;
  ridePartnerProfile?: RidePartnerProfile;
  driverVerified?: boolean;
  verificationBatch?: string;
  verificationStatus?: DriverVerificationStatus;
  verificationScore?: number;
  verificationCompletedAt?: string;
  licenseNumber?: string;
}

export interface Vehicle {
  id: string;
  driverId: string;
  model: string;
  number: string;
  color: string;
  totalSeats: number;
  seatLayout: SeatLayout;
  verified: boolean;
}

export interface SeatLayout {
  rows: number;
  seatsPerRow: number[];
  availableSeats: number[];
}

export type ApprovalMode = 'auto' | 'manual';
export type SeatLockStatus = 'available' | 'locked' | 'booked' | 'reserved';

export interface SeatLockInfo {
  seatNumber: number;
  status: SeatLockStatus;
  userId?: string; // who locked/booked it
  bookingId?: string; // associated booking
  lockedAt?: string;
  expiresAt?: string; // expires if not confirmed within time
}

export interface Ride {
  id: string;
  rideType?: 'request' | 'offer'; // request = passenger created, offer = driver created
  driverId: string;
  driver: {
    name: string;
    rating: number;
    gender: Gender;
    ridesCompleted: number;
    driverVerified?: boolean;
    verificationBatch?: string;
  };
  vehicleId: string;
  vehicle: {
    model: string;
    number: string;
    color: string;
  };
  vehicleType?: RideVehicleType;
  from: string;
  to: string;
  pickupPoint: {
    name: string;
    lat: number;
    lng: number;
  };
  dropPoint: {
    name: string;
    lat: number;
    lng: number;
  };
  departureTime: string;
  scheduledDeparture?: string;
  earliestDeparture?: string;
  latestDeparture?: string;
  timeFlexibilityMinutes?: number;
  availableSeats: number[];
  totalSeats: number;
  farePerSeat: number;
  isWomenOnly: boolean;
  status:
    | 'upcoming'
    | 'active'
    | 'completed'
    | 'booked'
    | 'ongoing'
    | 'cancelled';
  distance: string;
  duration: string;
  driverMode: DriverMode;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  pickupCity?: string;
  pickupCountry?: string;
  dropoffCity?: string;
  dropoffCountry?: string;
  // ===== HYBRID CONFIRMATION SYSTEM =====
  approvalMode: ApprovalMode; // 'auto' = auto-confirm, 'manual' = driver approval
  requiresManualApproval: boolean; // toggle for driver preference
  isFestivalRide: boolean; // forced to auto-confirm if true
  seatLocks: SeatLockInfo[]; // track seat locks and booking states
  approvalSettings?: {
    autoApproveThreshold?: number; // approve if rating >= threshold
    approvalDeadlineMinutes?: number; // time to approve before auto-reject
    allowDirectConfirmation?: boolean; // passenger can directly confirm booking
  };
  bookingDetails?: {
    confirmedAt?: string;
    seatNumbers?: number[];
    totalAmount?: number;
    paymentMethod?: 'wallet' | 'upi' | 'cash' | 'unknown';
    customRequest?: string;
    passengerName?: string;
    passengerPhone?: string;
    pickupEta?: string;
  };
  pickupStatus?: {
    driverConfirmedAt?: string;
    passengerConfirmedAt?: string;
  };
  dropoffStatus?: {
    passengerConfirmedAt?: string;
    completedAt?: string;
  };
}

export type BookingApprovalStatus =
  | 'auto_accepted' // auto-confirmed by system
  | 'pending_approval' // waiting for driver approval
  | 'pending_passenger' // waiting for passenger confirmation
  | 'approved' // driver approved
  | 'rejected' // driver rejected
  | 'cancelled' // cancelled by either party
  | 'expired' // approval request expired
  | 'locked'; // seat is locked/reserved

export interface Booking {
  id: string;
  rideId: string;
  userId: string;
  userDetails?: {
    name: string;
    phone: string;
    rating: number;
    avatar?: string;
  };
  seatNumbers: number[];
  pickupPoint: string;
  dropPoint: string;
  fare: number;
  customRequest?: string;
  customFare?: number;
  status:
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'counter_offered'
    | 'active'
    | 'completed';
  // ===== HYBRID CONFIRMATION SYSTEM =====
  approvalStatus: BookingApprovalStatus; // new approval workflow
  approvalRequestedAt: string; // when booking request created
  approvedAt?: string; // when driver/system approved
  approvedBy?: string; // 'system' or driverId
  rejectedAt?: string; // when rejected
  rejectionReason?: string; // reason for rejection
  seatLockExpiry?: string; // when seat lock expires if not confirmed
  requiresDriverApproval: boolean; // was driver approval required
  driverApprovalDeadline?: string; // deadline for driver to approve
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking' | 'ride' | 'payment' | 'alert';
  read: boolean;
  createdAt: string;
}

export interface Trip {
  id: string;
  rideId: string;
  from: string;
  to: string;
  date: string;
  fare: number;
  status: 'completed' | 'cancelled';
  rating?: number;
  driver: {
    name: string;
    rating: number;
  };
  scheduledDeparture?: string;
  earliestDeparture?: string;
  latestDeparture?: string;
  timeFlexibilityMinutes?: number;
}

export type RideVehicleType = 'two_wheeler' | 'three_wheeler' | 'four_wheeler';

export type DriverVerificationStatus =
  | 'pending'
  | 'auto_approved'
  | 'manual_review'
  | 'rejected';

export interface DriverVerificationAttempt {
  attemptNumber: number;
  submittedAt: string;
  score: number;
  status: DriverVerificationStatus;
  notes?: string;
}

export interface DriverVerificationResult {
  licenseNumber: string;
  status: DriverVerificationStatus;
  score: number;
  attempts: DriverVerificationAttempt[];
  checks: {
    label: string;
    passed: boolean;
    weight: number;
    details?: string;
  }[];
  locked: boolean;
}

// ============================================================================
// FESTIVAL SPECIAL POOL FEATURE
// ============================================================================

export type Festival = 'diwali' | 'holi' | 'eid' | 'chhath' | 'wedding';

export interface FestivalPool {
  id: string;
  rideId: string;
  festival: Festival;
  verifiedLongRoute: boolean;
  groupBookingDiscount: number; // percentage
  smartPrice: number;
  returnRideAvailable: boolean;
  returnRideId?: string;
  returnDiscount: number; // percentage
  tier: 'tier1' | 'tier2' | 'tier3';
  createdAt: string;
}

export interface FestivalRideMetadata {
  festival?: Festival;
  festivalPoolId?: string;
  isLongRoute?: boolean;
  groupSize?: number;
  returnTripLinkId?: string;
  originalPrice?: number;
  smartPrice?: number;
  discountApplied?: number;
}

// ============================================================================
// INSURANCE FEATURE
// ============================================================================

export type InsurancePlan = 'basic' | 'premium' | 'annual';
export type InsuranceStatus = 'active' | 'claimed' | 'expired';
export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface RideInsurance {
  id: string;
  rideId: string;
  userId: string;
  plan: InsurancePlan;
  premium: number; // ₹5 for basic per-ride
  status: InsuranceStatus;
  coverageAmount: number;
  createdAt: string;
  expiresAt: string;
  claimId?: string;
}

export interface InsuranceClaim {
  id: string;
  insuranceId: string;
  userId: string;
  rideId: string;
  claimType: 'accident' | 'injury' | 'loss' | 'damage';
  status: ClaimStatus;
  amount: number;
  description: string;
  supportingDocuments?: string[];
  submittedAt: string;
  reviewedAt?: string;
  paidAt?: string;
  notes?: string;
}

export interface InsurancePolicy {
  id: string;
  userId: string;
  type: InsurancePlan;
  status: 'active' | 'inactive';
  startDate: string;
  endDate: string;
  totalCoverage: number;
  usedCoverage: number;
  ridesCovered: number;
}

// ============================================================================
// DISTRICT/VILLAGE/RAILWAY CONNECTOR FEATURE
// ============================================================================

export type RouteType = 'district' | 'village' | 'railway' | 'urban';
export type CoverageLevel =
  | 'tier1_cities'
  | 'tier2_expansion'
  | 'tier3_villages';

export interface RouteInfo {
  id: string;
  type: RouteType;
  fromLocation: {
    name: string;
    district: string;
    state: string;
    lat: number;
    lng: number;
  };
  toLocation: {
    name: string;
    district: string;
    state: string;
    lat: number;
    lng: number;
  };
  coverageLevel: CoverageLevel;
  isRailwayConnector: boolean;
  railwayStationName?: string;
}

export interface VernacularOnboarding {
  userId: string;
  preferredLanguage:
    | 'hindi'
    | 'tamil'
    | 'telugu'
    | 'kannada'
    | 'marathi'
    | 'english';
  onboardingStep: 'welcome' | 'language' | 'kyc' | 'documents' | 'completed';
  offlineAgentId?: string;
  agentVerified: boolean;
  verifiedAt?: string;
}

export interface OfflineAgent {
  id: string;
  name: string;
  phone: string;
  areasCovered: string[]; // district names
  language: string;
  status: 'active' | 'inactive';
  usersRegistered: number;
  rating: number;
  createdAt: string;
}

// ============================================================================
// GAMIFICATION FEATURE
// ============================================================================

export interface RideStreak {
  userId: string;
  currentStreak: number;
  lastRideDate: string;
  longestStreak: number;
  streakBonusMultiplier: number; // 1.0 -> 1.5x
}

export interface CarbonCounter {
  userId: string;
  totalRides: number;
  carpooledPassengers: number;
  emissionsSavedKg: number;
  contributePoints: number; // gamification points
}

export type BadgeType =
  | 'campus'
  | 'safe_driver'
  | 'eco_warrior'
  | 'festival_pro'
  | 'group_booking';

export interface Badge {
  id: string;
  userId: string;
  type: BadgeType;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
  awardedAt: string;
  displayName: string;
  description: string;
}

export interface SafeDriverTier {
  userId: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  safeRidesCount: number;
  cancellationRate: number;
  ratingAverage: number;
  incidentsCount: number;
}

export interface ReferralProgram {
  id: string;
  referrerId: string;
  referreeId?: string;
  referralCode: string;
  status: 'pending' | 'completed';
  discountOffered: number; // ₹ amount
  bonusEarned: number;
  referreeDiscountAmount: number;
  createdAt: string;
  completedAt?: string;
}

export interface GamificationLeaderboard {
  userId: string;
  userName: string;
  totalPoints: number;
  currentRank: number;
  badges: Badge[];
  rideStreak?: RideStreak;
  carbonFootprint?: number;
}

// ============================================================================
// EXTENDED USER PROFILE
// ============================================================================

export interface ExtendedUserProfile extends User {
  // Festival features
  festivalPreferences?: Festival[];
  lastFestivalRide?: string;

  // Insurance
  activeInsurance?: RideInsurance;
  insurancePolicy?: InsurancePolicy;

  // Gamification
  rideStreak?: RideStreak;
  carbonCounter?: CarbonCounter;
  badges?: Badge[];
  safeDriverTier?: SafeDriverTier;
  referralCode?: string;
  totalGamificationPoints?: number;

  // Vernacular
  vernacularOnboarding?: VernacularOnboarding;

  // District/Village expansion
  coveredDistrictRoutes?: string[]; // district IDs
}

// ============================================================================
// REVENUE MODEL & ANALYTICS
// ============================================================================

export interface RevenueBreakdown {
  totalRevenue: number;
  commissionFromRides: number; // 10-15% per ride
  insurancePremium: number;
  surgeCharges: number;
  festivalPremium: number;
  groupBookingFee: number;
}

export interface UnitEconomics {
  averageRideValue: number;
  platformCommission: number;
  netMargin: number;
  customerAcquisitionCost: number;
  lifetimeValue: number;
  paybackPeriod: number; // days
}

export interface DailyMetrics {
  date: string;
  activeRiders: number;
  activeDrivers: number;
  completedRides: number;
  totalRevenue: number;
  averageRating: number;
  insuranceClaims: number;
}
