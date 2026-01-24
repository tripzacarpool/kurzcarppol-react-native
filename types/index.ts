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
  driverId: string;
  driver: {
    name: string;
    rating: number;
    gender: Gender;
    ridesCompleted: number;
  };
  vehicleId: string;
  vehicle: {
    model: string;
    number: string;
    color: string;
  };
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
  availableSeats: number[];
  totalSeats: number;
  farePerSeat: number;
  isWomenOnly: boolean;
  status: 'upcoming' | 'active' | 'completed';
  distance: string;
  duration: string;
  driverMode: DriverMode;
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
}
