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

export interface Booking {
  id: string;
  rideId: string;
  userId: string;
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

export type RideVehicleType = 'two_wheeler' | 'four_wheeler';

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
