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

// Request interceptor to log outgoing requests
apiClient.interceptors.request.use(
  (config) => {
    const authHeader = config.headers['Authorization'];
    const authHeaderStr = typeof authHeader === 'string' ? authHeader : '';
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    console.log(
      '   Authorization:',
      authHeaderStr
        ? `✅ Set (${authHeaderStr.substring(0, 30)}...)`
        : '❌ Not set',
    );
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  },
);

// Response interceptor to log responses
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(
      `❌ ${error.response?.status || 'Error'} ${error.config?.url}`,
      error.response?.data,
    );
    return Promise.reject(error);
  },
);

// Set authorization token for authenticated requests
export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('✅ Authorization header set, token length:', token.length);
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    console.log('❌ Authorization header cleared');
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
    console.log('📤 Creating driver ride offer with data:', rideData);
    console.log(
      '📨 Current auth header:',
      apiClient.defaults.headers.common['Authorization']
        ? '✅ Set'
        : '❌ Not set',
    );
    const response = await apiClient.post('/api/rides/driver-offer', rideData);
    console.log('✅ Ride offer created:', response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error creating driver ride offer:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// Cancel a ride request or driver offer
export async function cancelRide(rideId: string) {
  try {
    console.log('🗑️ Cancelling ride:', rideId);
    const response = await apiClient.delete(`/api/rides/${rideId}/cancel`);
    console.log('✅ Ride cancelled:', response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error cancelling ride:',
      error.response?.data || error.message,
    );
    throw error;
  }
}
