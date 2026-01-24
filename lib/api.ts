import axios from 'axios';
import {
  RidePartnerMode,
  RidePartnerVehicleType,
  RidePartnerProfile,
  RidePartnerApplicationStatus,
} from '@/types';

// Create axios instance with proper base URL
// For development, this should point to your backend server
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.108:5000';
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
