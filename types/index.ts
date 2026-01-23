export type UserRole = 'traveler' | 'driver' | 'admin';

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
  status: 'pending' | 'accepted' | 'rejected' | 'counter_offered' | 'active' | 'completed';
  otp?: string;
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
