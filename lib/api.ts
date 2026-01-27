import axios from 'axios';
import {
  RidePartnerMode,
  RidePartnerVehicleType,
  RidePartnerProfile,
  RidePartnerApplicationStatus,
} from '@/types';

// Create axios instance with proper base URL
// For development, this should point to your backend server
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.102:5000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set authorization token for authenticated requests
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

// User sync API
export async function syncUserToDatabase(userData: {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
}) {
  try {
    const response = await apiClient.post('/api/users/sync', userData);
    return response.data;
  } catch (error: any) {
    console.error('Error syncing user:', error.response?.data || error.message);
    throw error;
  }
}

// Suppress API errors in development (mock response)
export async function syncUserToDatabase_Safe(userData: {
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
}) {
  try {
    return await syncUserToDatabase(userData);
  } catch (error) {
    // In development, just log the error and continue
    console.warn('API sync skipped (development mode):', error);
    return {
      clerkId: userData.clerkId,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
    };
  }
}

// Backend logout - invalidate session on server
export async function logoutUserFromBackend(clerkId: string) {
  const API_URL =
    process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.102:5000';
  try {
    console.log('🔗 Calling backend logout for:', clerkId);
    console.log('📍 Backend URL:', `${API_URL}/api/users/logout`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${API_URL}/api/users/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clerkId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('⚠️ Backend logout failed with status:', response.status);
      return { success: false };
    }

    const data = await response.json();
    console.log('✅ Backend logout successful:', data.message);
    return data;
  } catch (error: any) {
    const errorMsg =
      error.name === 'AbortError' ? 'Request timeout' : error.message;
    console.warn('⚠️ Backend logout failed (non-critical):', errorMsg);
    // Don't throw - logout should proceed even if backend call fails
    return { success: false, error: errorMsg };
  }
}

export interface RidePartnerApplicationPayload {
  clerkId: string;
  mode: RidePartnerMode;
  vehicleType: RidePartnerVehicleType;
  basicProfile: {
    fullName: string;
    phone: string;
    profilePhotoUrl?: string;
  };
  vehicleDetails: {
    carModel: string;
    vehicleNumber: string;
    vehiclePhotoUrl?: string;
  };
  licenseDetails: {
    licenseNumber: string;
    licensePhotoUrl?: string;
  };
  payoutDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
  };
  professionalDetails?: {
    commercialPermitUrl?: string;
  };
  declaration: {
    communityRulesAccepted: boolean;
    ownershipConsent: boolean;
    acceptedAt?: string;
  };
}

export async function submitRidePartnerApplication(
  payload: RidePartnerApplicationPayload,
) {
  const response = await apiClient.post('/api/ride-partners/apply', payload);
  return response.data as { success: boolean; profile: RidePartnerProfile };
}

export async function fetchRidePartnerProfile(clerkId: string) {
  const response = await apiClient.get(`/api/ride-partners/${clerkId}`);
  return response.data as {
    success: boolean;
    profile: RidePartnerProfile | null;
    role: string;
  };
}

export async function updateRidePartnerStatus(
  clerkId: string,
  status: RidePartnerApplicationStatus,
  note?: string,
) {
  const response = await apiClient.patch(
    `/api/ride-partners/${clerkId}/status`,
    {
      status,
      note,
    },
  );
  return response.data as { success: boolean; profile: RidePartnerProfile };
}
// Create ride request API
export async function createRideRequest(rideData: {
  clerkId: string;
  from: string;
  to: string;
  passengers: number;
  notes?: string;
  womenOnly?: boolean;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupCity?: string;
  pickupCountry?: string;
}) {
  try {
    const response = await apiClient.post('/api/rides/create', rideData);
    return response.data;
  } catch (error: any) {
    console.error(
      'Error creating ride:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Get user's ride requests
export async function getUserRides(clerkId?: string) {
  try {
    const params = clerkId ? { clerkId } : {};
    const response = await apiClient.get('/api/rides/requests', { params });
    return response.data;
  } catch (error: any) {
    console.error(
      'Error fetching user rides:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Get available rides for drivers
export async function getAvailableRides(
  clerkId?: string,
  type?: 'offers' | 'requests',
) {
  try {
    const params: any = {};
    if (clerkId) params.clerkId = clerkId;
    if (type) params.type = type;
    const response = await apiClient.get('/api/rides/available', { params });
    return response.data;
  } catch (error: any) {
    return {
      success: true,
      rides: [],
      message: '0 rides found',
    };
  }
}
// Accept a ride
export async function acceptRide(rideId: string) {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/accept`);
    return response.data;
  } catch (error: any) {
    console.error(
      'Error accepting ride:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Create driver ride offer
export async function createDriverRideOffer(rideData: {
  from: string;
  to: string;
  passengers: number;
  fare?: number;
  notes?: string;
  womenOnly?: boolean;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupCity?: string;
  pickupCountry?: string;
}) {
  try {
    const response = await apiClient.post('/api/rides/driver-offer', rideData);
    return response.data;
  } catch (error: any) {
    console.error(
      'Error creating driver ride offer:',
      error.response?.data || error.message,
    );
    throw error;
  }
}
