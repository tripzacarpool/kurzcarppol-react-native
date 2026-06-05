import axios from 'axios';
import type { RideVehicleType } from '@/types';
import {
  fetchBackendReadiness,
  getApiBaseUrl,
  type BackendReadiness,
} from '@/lib/backendConfig';
import {
  RidePartnerMode,
  RidePartnerVehicleType,
  RidePartnerProfile,
  RidePartnerApplicationStatus,
} from '@/types';

const API_BASE_URL = getApiBaseUrl();
console.log('🌐 API Base URL:', API_BASE_URL);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getBackendServiceStatus(): Promise<BackendReadiness> {
  return fetchBackendReadiness();
}

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
    const status = error.response?.status || 'Error';
    const url = error.config?.url || 'unknown-url';
    const details =
      error.response?.data ||
      error.message ||
      (error.request ? 'No response from server' : 'Unknown request error');

    console.error(`Error ${status} ${url}`, details);
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

// Helper function to refresh auth token before API calls
export async function ensureAuthToken(): Promise<void> {
  try {
    // Import dynamically to avoid circular dependencies
    const { useAuth } = await import('@clerk/clerk-expo');
    // Note: This won't work outside React components, but provides type safety
    console.log('⚠️ ensureAuthToken should be called from component context');
  } catch (error) {
    console.warn('Could not refresh token:', error);
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
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    console.error('❌ Error syncing user to database:', errorMessage);
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
  } catch (error: any) {
    const errorCode = error.response?.data?.code;
    const status = error.response?.status;

    // Re-throw critical errors that need user action
    if (errorCode === 'EMAIL_ALREADY_EXISTS' || status === 400) {
      console.error(
        '❌ Sync failed with status:',
        status,
        error.response?.data,
      );
      throw error;
    }

    // For non-critical errors, log and return mock response
    if (errorCode === 'NO_AUTH_USER') {
      console.log('⏳ User sync skipped - not authenticated yet');
    } else {
      console.warn(
        '⚠️ Sync failed (non-critical):',
        error.response?.data?.error || error.message,
      );
    }
    return {
      clerkId: userData.clerkId,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
    };
  }
}

// Check if email already exists in database
export async function checkEmailExists(email: string): Promise<boolean> {
  const API_URL = getApiBaseUrl();
  try {
    console.log('📡 Checking email in database:', email);
    const response = await axios.get(`${API_URL}/api/users/check-email`, {
      params: { email: email.trim().toLowerCase() },
      timeout: 5000,
    });
    console.log('✅ Email check response:', response.data);
    return response.data.exists;
  } catch (error: any) {
    console.error('❌ Error checking email:', error.message);
    console.error('❌ Error details:', error.response?.data);
    // If there's an error checking, return false to allow signup attempt
    // This prevents blocking signup if backend is down
    return false;
  }
}

// Backend logout - invalidate session on server
export async function logoutUserFromBackend(clerkId: string) {
  const API_URL = getApiBaseUrl();
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

export async function updateSafetySettings(settings: {
  isFemale: boolean;
  womenOnlyPreference: boolean;
  autoShareTrip: boolean;
  safetyAlertsEnabled: boolean;
  primaryEmergencyContact: {
    id?: string;
    name: string;
    phone: string;
    relationship: string;
  };
  secondaryEmergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  emergencyContacts: Array<{
    id?: string;
    name: string;
    phone: string;
    relationship: string;
  }>;
}) {
  const response = await apiClient.put('/api/users/safety-settings', settings);
  return response.data;
}

// Update driver verification status
export async function updateDriverVerification(verificationData: {
  verificationStatus:
    | 'pending'
    | 'auto_approved'
    | 'manual_review'
    | 'rejected';
  verificationScore: number;
  verificationData?: any;
  licenseNumber?: string;
}) {
  try {
    const response = await apiClient.post(
      '/api/users/driver-verification',
      verificationData,
    );
    return response.data;
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    console.error('❌ Error updating driver verification:', errorMessage);
    throw error;
  }
}

export interface RidePartnerApplicationPayload {
  clerkId: string;
  mode: RidePartnerMode;
  vehicleType: RidePartnerVehicleType;
  contactEmail?: string;
  basicProfile: {
    fullName: string;
    phone: string;
    profilePhotoUrl?: string;
  };
  vehicleDetails: {
    vehicleType: string;
    carModel: string;
    vehicleNumber: string;
    maxPassengers: number;
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
  kycDetails?: {
    selfiePhoto?: string;
    digilockerDocument?: string;
    digilockerStatus?: 'pending' | 'in_progress' | 'verified';
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

export async function getAdminOverview(): Promise<any> {
  const response = await apiClient.get('/api/users/admin/overview');
  return response.data;
}

export async function getAdminDrivers(params?: {
  status?: string;
  privacyType?: string;
  q?: string;
}): Promise<any> {
  const response = await apiClient.get('/api/users/admin/drivers', { params });
  return response.data;
}

export async function updateAdminDriver(
  clerkId: string,
  payload: {
    status?: string;
    isActive?: boolean;
    driverPrivacyType?: 'full_detail' | 'private_vehicle';
    publicDisclosure?: {
      showFullName?: boolean;
      showPhone?: boolean;
      showFullVehicleNumber?: boolean;
      showProfilePhoto?: boolean;
    };
    trustBatch?: 'new' | 'community' | 'trusted' | 'featured';
    trustScore?: number;
    publicityScore?: number;
    note?: string;
  },
): Promise<any> {
  const response = await apiClient.patch(
    `/api/users/admin/drivers/${clerkId}`,
    payload,
  );
  return response.data;
}
// Create ride request API
export async function createRideRequest(rideData: {
  clerkId: string;
  from: string;
  to: string;
  passengers: number;
  vehicleType?: RideVehicleType;
  notes?: string;
  womenOnly?: boolean;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupCity?: string;
  pickupCountry?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  dropoffCity?: string;
  dropoffCountry?: string;
  scheduledDeparture: string;
  timeFlexibilityMinutes?: number;
  requestedTotalFare?: number;
  maxSharedSeats?: number;
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
  options?: {
    targetTime?: string;
    windowMinutes?: number;
    joinable?: boolean;
  },
) {
  try {
    const params: Record<string, any> = {};
    if (clerkId) params.clerkId = clerkId;
    if (type) params.type = type;
    if (options?.targetTime) {
      params.targetTime = options.targetTime;
    }
    if (typeof options?.windowMinutes === 'number') {
      params.windowMinutes = options.windowMinutes;
    }
    if (options?.joinable) {
      params.joinable = 'true';
    }
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

export async function joinRideRequest(
  rideId: string,
  payload: {
    seatCount?: number;
    passengerPhone?: string;
    paymentMethod?: 'wallet' | 'upi' | 'cash' | 'unknown';
  } = {},
) {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/join`, payload);
    return response.data;
  } catch (error: any) {
    console.error(
      'Error joining ride request:',
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
  vehicleType?: RideVehicleType;
  fare?: number;
  notes?: string;
  womenOnly?: boolean;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupCity?: string;
  pickupCountry?: string;
  scheduledDeparture: string;
  timeFlexibilityMinutes?: number;
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
export async function cancelRide(
  rideId: string,
  rideType?: 'request' | 'offer',
) {
  try {
    console.log('🗑️ Cancelling ride:', rideId, 'type:', rideType);

    // Try to determine the type if not provided
    if (!rideType) {
      // First try as ride offer
      try {
        console.log('🔄 Attempting to cancel as ride offer...');
        const response = await apiClient.post(
          `/api/ride-offers/${rideId}/cancel`,
        );
        console.log('✅ Ride offer cancelled:', response.data);
        return response.data;
      } catch (offerError: any) {
        console.log('⚠️ Not a ride offer, trying as ride request...');

        // If that fails, try as ride request
        try {
          const response = await apiClient.delete(
            `/api/rides/${rideId}/cancel`,
          );
          console.log('✅ Ride request cancelled:', response.data);
          return response.data;
        } catch (requestError: any) {
          console.error('❌ Failed to cancel as both offer and request');
          throw requestError;
        }
      }
    } else if (rideType === 'offer') {
      const response = await apiClient.post(
        `/api/ride-offers/${rideId}/cancel`,
      );
      console.log('✅ Ride offer cancelled:', response.data);
      return response.data;
    } else {
      const response = await apiClient.delete(`/api/rides/${rideId}/cancel`);
      console.log('✅ Ride request cancelled:', response.data);
      return response.data;
    }
  } catch (error: any) {
    console.error(
      '❌ Error cancelling ride:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function confirmRideBooking(
  rideId: string,
  payload: {
    seatNumbers?: number[];
    totalAmount?: number;
    paymentMethod?: 'wallet' | 'upi' | 'cash' | 'unknown';
    customRequest?: string;
    pickupEta?: string;
    passengerPhone?: string;
  },
) {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/booking`,
      payload,
    );
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error confirming booking:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

//

export async function driverConfirmPickup(rideId: string) {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/pickup/driver`,
      {},
    );
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error confirming pickup (driver):',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function passengerConfirmPickup(rideId: string, clerkId?: string) {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/pickup/passenger`,
      clerkId ? { clerkId } : {},
    );
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error confirming pickup (passenger):',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function completeRide(rideId: string) {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/complete`, {});
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error completing ride:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Start a ride (passenger initiates)
 */
export async function startRide(rideId: string) {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/start`, {});
    console.log('✅ Ride start requested');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error starting ride:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Driver confirms seating and starts ride
 */
export async function driverConfirmStart(rideId: string) {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/confirm-start`,
      {},
    );
    console.log('✅ Driver confirmed ride start');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error confirming ride start:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Extend ride departure time
 */
export async function extendRideTime(
  rideId: string,
  newDepartureTime: Date,
): Promise<any> {
  try {
    const response = await apiClient.patch(`/api/rides/${rideId}/extend`, {
      newDepartureTime: newDepartureTime.toISOString(),
    });
    console.log('✅ Ride time extended successfully');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error extending ride time:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Activate SOS alert for safety during ride
 */
export async function activateSOS(
  rideId: string,
  reason?: string,
): Promise<any> {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/sos`, {
      reason: reason || 'User activated SOS alert',
    });
    console.log('🚨 SOS alert activated for ride:', rideId);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error activating SOS:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get all active SOS alerts (Admin)
 */
export async function getActiveSOSAlerts(): Promise<any> {
  try {
    const response = await apiClient.get('/api/rides/sos/alerts/active');
    console.log('📊 Active SOS alerts fetched:', response.data.count);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching SOS alerts:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Resolve SOS alert (Admin)
 */
export async function resolveSOSAlert(
  rideId: string,
  resolution: string,
  notes?: string,
  responseTime?: number,
): Promise<any> {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/sos/resolve`, {
      resolution,
      notes,
      responseTime,
    });
    console.log('✅ SOS alert resolved:', rideId);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error resolving SOS alert:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Dispatch emergency services (Admin)
 */
export async function dispatchEmergencyServices(
  rideId: string,
  serviceType: 'police' | 'ambulance' | 'fire' | 'disaster',
  notes?: string,
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/sos/dispatch-emergency`,
      {
        serviceType,
        notes,
      },
    );
    console.log('✅ Emergency services dispatched:', serviceType);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error dispatching emergency services:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get SOS history and analytics (Admin)
 */
export async function getSOSHistory(
  limit: number = 50,
  skip: number = 0,
  status: 'active' | 'resolved' = 'resolved',
): Promise<any> {
  try {
    const response = await apiClient.get('/api/rides/sos/history', {
      params: { limit, skip, status },
    });
    console.log('📊 SOS history fetched:', response.data.count, 'records');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching SOS history:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Cleanup expired rides (admin/cron)
 */
export async function cleanupExpiredRides(): Promise<any> {
  try {
    const response = await apiClient.get('/api/rides/cleanup-expired');
    console.log('✅ Expired rides cleaned up');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error cleaning up expired rides:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// ==================== RIDE OFFER APIs ====================

/**
 * Create a ride offer (driver offering ride)
 */
export async function createRideOffer(offerData: {
  from: string;
  to: string;
  totalSeats: number;
  farePerSeat: number;
  vehicleType?: RideVehicleType;
  driverMode?: string;
  notes?: string;
  womenOnly?: boolean;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupCity?: string;
  pickupCountry?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  dropoffCity?: string;
  dropoffCountry?: string;
  departureTime: string;
  scheduledDeparture?: string;
  timeFlexibilityMinutes?: number;
  availableSeats?: number[];
  vehicle?: {
    model: string;
    color: string;
    number: string;
  };
  driver?: {
    name: string;
    profileImage: string;
    rating: number;
    ridesCompleted: number;
    gender: string;
  };
}): Promise<any> {
  try {
    console.log('📤 Creating ride offer with auth token...');
    const response = await apiClient.post('/api/ride-offers/create', offerData);
    console.log('✅ Ride offer created:', response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error creating ride offer:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Update an existing ride offer
 */
export async function updateRideOffer(
  rideOfferId: string,
  updateData: {
    from?: string;
    to?: string;
    totalSeats?: number;
    availableSeats?: number;
    farePerSeat?: number;
    vehicleType?: RideVehicleType;
    driverMode?: string;
    notes?: string;
    womenOnly?: boolean;
    pickupLatitude?: number;
    pickupLongitude?: number;
    pickupCity?: string;
    pickupCountry?: string;
    dropoffLatitude?: number;
    dropoffLongitude?: number;
    dropoffCity?: string;
    dropoffCountry?: string;
    departureTime?: string;
    scheduledDeparture?: string;
    timeFlexibilityMinutes?: number;
    vehicle?: {
      model: string;
      color: string;
      number: string;
    };
  },
): Promise<any> {
  try {
    console.log('📤 Updating ride offer:', rideOfferId);
    const response = await apiClient.put(
      `/api/ride-offers/${rideOfferId}`,
      updateData,
    );
    console.log('✅ Ride offer updated:', response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error updating ride offer:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get available ride offers
 */
export async function getAvailableRideOffers(params?: {
  from?: string;
  to?: string;
  q?: string;
  minSeats?: number;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  distanceTo?: 'pickup' | 'dropoff';
}): Promise<any> {
  try {
    const response = await apiClient.get('/api/ride-offers/available', {
      params,
    });
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching ride offers:',
      error.response?.data || error.message,
    );
    return {
      success: true,
      rideOffers: [],
      count: 0,
    };
  }
}

/**
 * Get my ride offers (as driver)
 */
export async function getMyRideOffers(clerkId?: string): Promise<any> {
  try {
    const params = clerkId ? { clerkId } : {};
    const response = await apiClient.get('/api/ride-offers/my-offers', {
      params,
    });
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching my ride offers:',
      error.response?.data || error.message,
    );
    return {
      success: true,
      rideOffers: [],
      count: 0,
    };
  }
}

/**
 * Get a single ride offer by ID
 */
export async function getRideOfferById(offerId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/ride-offers/${offerId}`);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching ride offer:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Extend ride offer departure time
 */
export async function extendRideOfferTime(
  offerId: string,
  additionalMinutes: number,
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/ride-offers/${offerId}/extend-time`,
      {
        additionalMinutes,
      },
    );
    console.log('✅ Ride offer time extended successfully');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error extending ride offer time:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function requestRideOfferHold(
  offerId: string,
  minutes: number,
  clerkId?: string,
): Promise<any> {
  const response = await apiClient.post(`/api/ride-offers/${offerId}/hold-requests`, {
    minutes,
    ...(clerkId ? { clerkId } : {}),
  });
  return response.data;
}

export async function respondRideOfferHold(
  offerId: string,
  requestId: string,
  action: 'approve' | 'reject',
  clerkId?: string,
): Promise<any> {
  const response = await apiClient.post(
    `/api/ride-offers/${offerId}/hold-requests/${requestId}/respond`,
    {
      action,
      ...(clerkId ? { clerkId } : {}),
    },
  );
  return response.data;
}

/**
 * Book a ride offer (passenger booking) - Uses approval system
 * This creates a booking request that requires driver approval
 */
export async function bookRideOffer(
  offerId: string,
  bookingData: {
    seatNumbers: number[];
    paymentMethod?: string;
    customRequest?: string;
  },
): Promise<any> {
  try {
    // Use the approval system endpoint instead of direct booking
    const response = await apiClient.post(
      `/api/rides/${offerId}/book`,
      bookingData,
    );
    console.log('✅ Booking request sent - awaiting driver approval');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error creating booking request:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Cancel a ride offer (driver cancellation)
 */
export async function cancelRideOffer(offerId: string): Promise<any> {
  try {
    const response = await apiClient.post(`/api/ride-offers/${offerId}/cancel`);
    console.log('✅ Ride offer cancelled successfully');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error cancelling ride offer:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Cleanup expired ride offers
 */
export async function cleanupExpiredRideOffers(): Promise<any> {
  try {
    const response = await apiClient.post('/api/ride-offers/cleanup-expired');
    console.log('✅ Expired ride offers cleaned up');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error cleaning up expired ride offers:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Check for expiring rides and send notifications
 */
export async function checkExpiringRides(): Promise<any> {
  try {
    const response = await apiClient.post('/api/ride-offers/check-expiring');
    console.log('✅ Checked expiring rides');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error checking expiring rides:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get combined rides (both requests and offers)
 * This function combines data from both endpoints for backward compatibility
 */
export async function getAllRides(params?: {
  from?: string;
  to?: string;
  clerkId?: string;
}): Promise<any> {
  try {
    // Fetch both ride requests and offers in parallel
    const [requestsData, offersData] = await Promise.all([
      getAvailableRides(params?.clerkId),
      getAvailableRideOffers({ from: params?.from, to: params?.to }),
    ]);

    // Combine and tag with 'kind' field
    const requests = (requestsData.rides || []).map((ride: any) => ({
      ...ride,
      kind: 'request',
    }));

    const offers = (offersData.rideOffers || []).map((offer: any) => ({
      ...offer,
      kind: 'offer',
    }));

    return {
      success: true,
      rides: [...offers, ...requests], // Offers first as they're more likely to be ready
      requests,
      offers,
      totalCount: offers.length + requests.length,
    };
  } catch (error: any) {
    console.error(
      '❌ Error fetching all rides:',
      error.response?.data || error.message,
    );
    return {
      success: true,
      rides: [],
      requests: [],
      offers: [],
      totalCount: 0,
    };
  }
}

/**
 * Get wallet balance for a user
 */
export async function getWalletBalance(userId: string): Promise<number> {
  try {
    const response = await apiClient.get(
      `/api/payments/wallet-balance/${userId}`,
    );
    console.log('✅ Fetched wallet balance');
    return response.data.balance || 0;
  } catch (error: any) {
    console.error(
      '❌ Error fetching wallet balance:',
      error.response?.data || error.message,
    );
    return 0;
  }
}

/**
 * Get wallet transactions for a user
 */
export async function getWalletTransactions(userId: string): Promise<any[]> {
  try {
    const response = await apiClient.get(
      `/api/payments/wallet-transactions/${userId}`,
    );
    console.log('✅ Fetched wallet transactions');
    return response.data.transactions || [];
  } catch (error: any) {
    console.error(
      '❌ Error fetching wallet transactions:',
      error.response?.data || error.message,
    );
    return [];
  }
}

/**
 * Process wallet payment
 */
export async function processWalletPayment(
  userId: string,
  amount: number,
  metadata?: any,
): Promise<any> {
  try {
    const response = await apiClient.post('/api/payments/wallet-payment', {
      userId,
      amount,
      bookingDetails: metadata,
    });
    console.log('✅ Wallet payment processed');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error processing wallet payment:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Recharge wallet balance
 */
export async function walletRecharge(
  userId: string,
  amount: number,
  paymentId: string,
  orderId?: string,
): Promise<any> {
  try {
    const response = await apiClient.post(
      '/api/payments/wallet-recharge',
      {
        userId,
        amount,
        paymentId,
        orderId,
      },
      {
        headers: {
          'Idempotency-Key': paymentId,
        },
      },
    );
    console.log('âœ… Wallet recharged');
    return response.data;
  } catch (error: any) {
    console.error(
      'âŒ Error recharging wallet:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// ==================== CHAT APIs ====================

/**
 * Get or create conversation between driver and passenger
 */
export async function getOrCreateConversation(data: {
  rideId: string;
  driverId: string;
  passengerId: string;
  passengerName?: string;
}): Promise<any> {
  try {
    const response = await apiClient.post('/api/chat/conversation', data);
    console.log('✅ Conversation retrieved/created');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error getting conversation:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Send message in a conversation
 */
export async function sendMessage(data: {
  conversationId: string;
  senderId: string;
  senderName?: string;
  messageText: string;
  messageType?: 'text' | 'system';
}): Promise<any> {
  try {
    const response = await apiClient.post('/api/chat/message', data);
    console.log('✅ Message sent');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error sending message:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get messages for a conversation
 */
export async function getMessages(conversationId: string): Promise<any> {
  try {
    const response = await apiClient.get(
      `/api/chat/messages/${conversationId}`,
    );
    console.log('✅ Messages retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error getting messages:',
      error.response?.data || error.message,
    );
    return { success: true, messages: [], count: 0 };
  }
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(data: {
  conversationId: string;
  userId: string;
}): Promise<any> {
  try {
    const response = await apiClient.post('/api/chat/read', data);
    console.log('✅ Messages marked as read');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error marking messages as read:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get user's conversations
 */
export async function getUserConversations(userId: string): Promise<any> {
  const endpoint = `/api/chat/conversations/${userId}`;
  const maxAttempts = 2;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await apiClient.get(endpoint);
      console.log('✅ Conversations retrieved');
      return response.data;
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;

      // Retry only for network failures (no HTTP response)
      if (!status && attempt < maxAttempts) {
        console.warn(
          `⚠️ Conversations fetch failed (attempt ${attempt}/${maxAttempts}), retrying...`,
          {
            message: error?.message,
            code: error?.code,
          },
        );
        continue;
      }
      break;
    }
  }

  console.warn('⚠️ Using empty conversations fallback', {
    message: lastError?.message,
    code: lastError?.code,
    status: lastError?.response?.status,
    url: `${lastError?.config?.baseURL || ''}${lastError?.config?.url || endpoint}`,
  });

  return { success: true, conversations: [], count: 0 };
}

// ============================================================================
// FESTIVAL SPECIAL POOL API
// ============================================================================

export async function createFestivalPoolRide(data: {
  rideId: string;
  festival: string;
  verifiedLongRoute: boolean;
  groupBookingDiscount: number;
  smartPrice: number;
  returnRideAvailable: boolean;
  tier: string;
}): Promise<any> {
  try {
    const response = await apiClient.post('/api/festival-pool/create', data);
    console.log('✅ Festival pool ride created');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error creating festival pool:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function getFestivalPoolRides(festival: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/festival-pool/${festival}`);
    console.log('✅ Festival pool rides retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching festival rides:',
      error.response?.data || error.message,
    );
    return { success: true, rides: [] };
  }
}

export async function bookReturnTrip(data: {
  originalRideId: string;
  userId: string;
  seatCount: number;
}): Promise<any> {
  try {
    const response = await apiClient.post(
      '/api/festival-pool/book-return',
      data,
    );
    console.log('✅ Return trip booked with discount');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error booking return trip:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// ============================================================================
// INSURANCE API
// ============================================================================

export async function purchaseRideInsurance(data: {
  rideId: string;
  userId: string;
  plan: string;
}): Promise<any> {
  try {
    const response = await apiClient.post('/api/insurance/purchase', data);
    console.log('✅ Insurance purchased');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error purchasing insurance:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function getRideInsurance(rideId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/insurance/ride/${rideId}`);
    console.log('✅ Ride insurance retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching ride insurance:',
      error.response?.data || error.message,
    );
    return { success: false, insurance: null };
  }
}

export async function submitInsuranceClaim(data: {
  insuranceId: string;
  rideId: string;
  userId: string;
  claimType: string;
  amount: number;
  description: string;
  documents?: string[];
}): Promise<any> {
  try {
    const response = await apiClient.post('/api/insurance/claim/submit', data);
    console.log('✅ Insurance claim submitted');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error submitting claim:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function getUserInsurancePolicies(userId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/insurance/policies/${userId}`);
    console.log('✅ Insurance policies retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching policies:',
      error.response?.data || error.message,
    );
    return { success: true, policies: [] };
  }
}

// ============================================================================
// DISTRICT/VILLAGE/RAILWAY ROUTES API
// ============================================================================

export async function getDistrictRoutes(
  fromDistrict: string,
  toDistrict: string,
): Promise<any> {
  try {
    const response = await apiClient.get('/api/routes/district', {
      params: { fromDistrict, toDistrict },
    });
    console.log('✅ District routes retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching district routes:',
      error.response?.data || error.message,
    );
    return { success: true, routes: [] };
  }
}

export async function getVillagePickupPoints(
  lat: number,
  lng: number,
  radiusKm: number = 15,
): Promise<any> {
  try {
    const response = await apiClient.get('/api/routes/village-pickups', {
      params: { lat, lng, radiusKm },
    });
    console.log('✅ Village pickup points retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching village pickups:',
      error.response?.data || error.message,
    );
    return { success: true, pickupPoints: [] };
  }
}

export async function getRailwayConnectorRides(
  stationName: string,
  destination: string,
): Promise<any> {
  try {
    const response = await apiClient.get('/api/routes/railway-connector', {
      params: { stationName, destination },
    });
    console.log('✅ Railway connector rides retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching railway rides:',
      error.response?.data || error.message,
    );
    return { success: true, rides: [] };
  }
}

// ============================================================================
// VERNACULAR ONBOARDING API
// ============================================================================

export async function startVernacularOnboarding(data: {
  userId: string;
  preferredLanguage: string;
  offlineAgentId?: string;
}): Promise<any> {
  try {
    const response = await apiClient.post(
      '/api/vernacular/onboarding/start',
      data,
    );
    console.log('✅ Vernacular onboarding started');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error starting vernacular onboarding:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function getOfflineAgents(district: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/vernacular/agents/${district}`);
    console.log('✅ Offline agents retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching agents:',
      error.response?.data || error.message,
    );
    return { success: true, agents: [] };
  }
}

export async function registerOfflineAgent(data: {
  name: string;
  phone: string;
  areasCovered: string[];
  language: string;
}): Promise<any> {
  try {
    const response = await apiClient.post(
      '/api/vernacular/agents/register',
      data,
    );
    console.log('✅ Offline agent registered');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error registering agent:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// ============================================================================
// GAMIFICATION API
// ============================================================================

export async function getRideStreak(userId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/gamification/streak/${userId}`);
    console.log('✅ Ride streak retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching ride streak:',
      error.response?.data || error.message,
    );
    return { success: false, streak: { currentStreak: 0 } };
  }
}

export async function updateRideStreak(
  userId: string,
  ridesCount: number,
): Promise<any> {
  try {
    const response = await apiClient.post(`/api/gamification/streak/update`, {
      userId,
      ridesCount,
    });
    console.log('✅ Ride streak updated');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error updating streak:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function getCarbonCounter(userId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/gamification/carbon/${userId}`);
    console.log('✅ Carbon counter retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching carbon counter:',
      error.response?.data || error.message,
    );
    return { success: false, carbon: { totalRides: 0, emissionsSavedKg: 0 } };
  }
}

export async function getUserBadges(userId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/gamification/badges/${userId}`);
    console.log('✅ User badges retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching badges:',
      error.response?.data || error.message,
    );
    return { success: true, badges: [] };
  }
}

export async function getSafeDriverTier(userId: string): Promise<any> {
  try {
    const response = await apiClient.get(
      `/api/gamification/safe-driver-tier/${userId}`,
    );
    console.log('✅ Safe driver tier retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching driver tier:',
      error.response?.data || error.message,
    );
    return { success: false, tier: { tier: 'bronze' } };
  }
}

export async function generateReferralCode(userId: string): Promise<any> {
  try {
    const response = await apiClient.post(
      '/api/gamification/referral/generate',
      {
        userId,
      },
    );
    console.log('✅ Referral code generated');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error generating referral code:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function redeemReferralCode(
  userId: string,
  referralCode: string,
): Promise<any> {
  try {
    const response = await apiClient.post('/api/gamification/referral/redeem', {
      userId,
      referralCode,
    });
    console.log('✅ Referral code redeemed');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error redeeming code:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

export async function getLeaderboard(limit: number = 100): Promise<any> {
  try {
    const response = await apiClient.get('/api/gamification/leaderboard', {
      params: { limit },
    });
    console.log('✅ Leaderboard retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching leaderboard:',
      error.response?.data || error.message,
    );
    return { success: true, leaderboard: [] };
  }
}
// ============================================================================
// HYBRID RIDE APPROVAL SYSTEM APIs
// ============================================================================

/**
 * Update ride approval settings
 * Driver toggles manual approval on/off
 */
export async function updateRideApprovalSettings(
  rideId: string,
  requiresManualApproval: boolean,
  approvalSettings?: {
    autoApproveThreshold?: number;
    approvalDeadlineMinutes?: number;
    allowDirectConfirmation?: boolean;
  },
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/approval-settings`,
      {
        requiresManualApproval,
        approvalSettings,
      },
    );
    console.log('✅ Approval settings updated');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error updating approval settings:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get pending approval requests for a ride
 * Driver views all pending bookings that need approval
 */
export async function getPendingApprovals(rideId: string): Promise<any> {
  try {
    const response = await apiClient.get(
      `/api/rides/${rideId}/pending-approvals`,
    );
    console.log('✅ Pending approvals retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching pending approvals:',
      error.response?.data || error.message,
    );
    return { success: true, pendingBookings: [] };
  }
}

/**
 * Get ALL pending approval requests for a driver (batch endpoint)
 * Replaces multiple per-ride calls with a single batched query
 */
export async function getAllDriverPendingApprovals(): Promise<any> {
  try {
    const response = await apiClient.get('/api/approvals/driver/pending');
    console.log('✅ Driver pending approvals retrieved (batch)');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching driver pending approvals:',
      error.response?.data || error.message,
    );
    return { success: true, pendingBookings: [] };
  }
}

/**
 * Approve a booking request
 * Driver explicitly approves a passenger's booking
 */
export async function approveBooking(
  bookingId: string,
  driverId: string,
  notes?: string,
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/bookings/${bookingId}/approve`,
      {
        driverId,
        notes,
        approvedAt: new Date().toISOString(),
      },
    );
    console.log('✅ Booking approved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error approving booking:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Reject a booking request
 * Driver declines a passenger's booking
 */
export async function rejectBooking(
  bookingId: string,
  driverId: string,
  reason: string,
): Promise<any> {
  try {
    const response = await apiClient.post(`/api/bookings/${bookingId}/reject`, {
      driverId,
      rejectionReason: reason,
      rejectedAt: new Date().toISOString(),
    });
    console.log('✅ Booking rejected');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error rejecting booking:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Confirm payment after driver approval
 * Passenger confirms payment to finalize booking
 */
export async function confirmBookingPayment(
  bookingId: string,
  paymentId: string,
  paymentMethod: string = 'razorpay',
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/bookings/${bookingId}/confirm-payment`,
      {
        paymentId,
        paymentMethod,
        paymentStatus: 'paid',
      },
    );
    console.log('✅ Payment confirmed, booking complete');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error confirming payment:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Lock seats for a booking (temporary reservation)
 * System locks seats when passenger initiates booking
 */
export async function lockSeats(
  rideId: string,
  seatNumbers: number[],
  bookingId: string,
  userId: string,
  lockDurationMinutes: number = 2,
): Promise<any> {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/lock-seats`, {
      seatNumbers,
      bookingId,
      userId,
      lockDurationMinutes,
      lockedAt: new Date().toISOString(),
    });
    console.log(`✅ ${seatNumbers.length} seat(s) locked`);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error locking seats:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Unlock seats (release temporary reservation)
 * Called when booking is rejected or expired
 */
export async function unlockSeats(
  rideId: string,
  seatNumbers: number[],
  bookingId: string,
): Promise<any> {
  try {
    const response = await apiClient.post(`/api/rides/${rideId}/unlock-seats`, {
      seatNumbers,
      bookingId,
    });
    console.log(`✅ ${seatNumbers.length} seat(s) unlocked`);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error unlocking seats:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get available seats for a ride
 * Shows which seats are available/locked/booked
 */
export async function getAvailableSeats(rideId: string): Promise<any> {
  try {
    const response = await apiClient.get(
      `/api/rides/${rideId}/available-seats`,
    );
    console.log('✅ Available seats retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching available seats:',
      error.response?.data || error.message,
    );
    return { success: true, seats: [] };
  }
}

/**
 * Get booking approval status
 * Passenger checks if booking is approved/pending/rejected
 */
export async function getBookingApprovalStatus(
  bookingId: string,
): Promise<any> {
  try {
    const response = await apiClient.get(
      `/api/bookings/${bookingId}/approval-status`,
    );
    console.log('✅ Booking status retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching booking status:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get approval analytics for driver dashboard
 * Shows statistics about bookings and approvals
 */
export async function getApprovalAnalytics(
  driverId: string,
  dateRange?: {
    startDate: string;
    endDate: string;
  },
): Promise<any> {
  try {
    const response = await apiClient.get(
      `/api/driver/${driverId}/approval-analytics`,
      {
        params: dateRange,
      },
    );
    console.log('✅ Approval analytics retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching approval analytics:',
      error.response?.data || error.message,
    );
    return {
      success: true,
      analytics: {
        totalBookings: 0,
        autoConfirmed: 0,
        manualApproved: 0,
        rejected: 0,
      },
    };
  }
}

/**
 * Cancel booking with penalty calculation
 * Handles cancellation and refund/deduction logic
 */
export async function cancelBookingWithPenalty(
  bookingId: string,
  cancelledBy: 'passenger' | 'driver',
  rideId: string,
  departureTime: string,
): Promise<any> {
  try {
    const response = await apiClient.post(`/api/bookings/${bookingId}/cancel`, {
      cancelledBy,
      rideId,
      departureTime,
      cancelledAt: new Date().toISOString(),
    });
    console.log('✅ Booking cancelled with penalty calculation');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error cancelling booking:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Handle expired approval requests
 * Auto-rejects approvals that have expired
 */
export async function handleExpiredApprovals(rideId: string): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/handle-expired-approvals`,
    );
    console.log('✅ Expired approvals handled');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error handling expired approvals:',
      error.response?.data || error.message,
    );
    return { success: true, expiredCount: 0 };
  }
}

/**
 * Create ride with approval mode
 * Driver creates new ride with auto/manual approval setting
 */
export async function createRideWithApprovalMode(
  rideData: any,
  approvalMode: 'auto' | 'manual',
  approvalSettings?: any,
): Promise<any> {
  try {
    const response = await apiClient.post('/api/rides/create-with-approval', {
      ...rideData,
      approvalMode,
      requiresManualApproval: approvalMode === 'manual',
      isFestivalRide: rideData.isFestivalRide || false,
      approvalSettings,
    });
    console.log('✅ Ride created with approval mode:', approvalMode);
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error creating ride:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Driver initiates pickup for a specific passenger
 * POST /api/ride-offers/:rideId/pickup/initiate
 */
export async function driverInitiatePickup(
  rideId: string,
  bookingId: string,
  passengerClerkId: string,
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/ride-offers/${rideId}/pickup/initiate`,
      {
        bookingId,
        passengerClerkId,
      },
    );
    console.log('✅ Pickup initiated for passenger');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error initiating pickup:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Passenger confirms they have boarded (for ride offers)
 * POST /api/ride-offers/:rideId/pickup/confirm
 */
export async function passengerConfirmRideOfferPickup(
  rideId: string,
  bookingId: string,
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/api/ride-offers/${rideId}/pickup/confirm`,
      {
        bookingId,
      },
    );
    console.log('✅ Pickup confirmed by passenger');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error confirming pickup:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get passenger's ride offer bookings
 * GET /api/bookings/passenger/me
 */
export async function getPassengerBookings(): Promise<any> {
  try {
    const response = await apiClient.get('/api/bookings/passenger/me');
    console.log('✅ Passenger bookings fetched');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching passenger bookings:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Cancel a pending approval request
 * DELETE /api/bookings/:bookingId/cancel-approval
 * Allows passengers to cancel their booking while it's pending driver approval
 */
export async function cancelPendingApproval(bookingId: string): Promise<any> {
  try {
    const response = await apiClient.delete(
      `/api/bookings/${bookingId}/cancel-approval`,
    );
    console.log('✅ Pending approval cancelled successfully');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error cancelling pending approval:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

// ==================== RATING APIS ====================

/**
 * Submit a rating for a driver or passenger
 * POST /api/ratings
 */
export async function submitRating(ratingData: {
  rideId: string;
  bookingId?: string;
  raterId: string;
  ratedId: string;
  raterRole: 'driver' | 'passenger';
  ratedRole: 'driver' | 'passenger';
  rating: number;
  feedback?: string;
  tags?: string[];
}): Promise<any> {
  try {
    const response = await apiClient.post('/api/ratings', ratingData);
    console.log('✅ Rating submitted successfully');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error submitting rating:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get ratings for a user
 * GET /api/ratings/:userId
 */
export async function getUserRatings(
  userId: string,
  role?: 'driver' | 'passenger',
  limit?: number,
): Promise<any> {
  try {
    const params: any = {};
    if (role) params.role = role;
    if (limit) params.limit = limit;

    const response = await apiClient.get(`/api/ratings/${userId}`, { params });
    console.log('✅ User ratings fetched');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching ratings:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Check if user has rated a specific ride
 * GET /api/ratings/check/:rideId/:userId
 */
export async function checkRatingStatus(
  rideId: string,
  userId: string,
): Promise<any> {
  try {
    const response = await apiClient.get(
      `/api/ratings/check/${rideId}/${userId}`,
    );
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error checking rating status:',
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Get pending ratings for a user (rides that need rating)
 * GET /api/ratings/pending/:userId
 */
export async function getPendingRatings(userId: string): Promise<any> {
  try {
    const response = await apiClient.get(`/api/ratings/pending/${userId}`);
    console.log('✅ Pending ratings fetched');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error fetching pending ratings:',
      error.response?.data || error.message,
    );
    throw error;
  }
}
