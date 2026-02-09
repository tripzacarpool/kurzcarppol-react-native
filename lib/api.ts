import axios from 'axios';
import { Platform } from 'react-native';
import type { RideVehicleType } from '@/types';
import {
  RidePartnerMode,
  RidePartnerVehicleType,
  RidePartnerProfile,
  RidePartnerApplicationStatus,
} from '@/types';

// Create axios instance with proper base URL
// Automatically detects if running on emulator or physical device
const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Android emulator uses 10.0.2.2 to access host's localhost
  if (Platform.OS === 'android' && __DEV__) {
    // Check if running on emulator by trying to detect common emulator IPs
    return 'http://10.0.2.2:5000'; // Android emulator
  }

  // Physical device or iOS simulator - use your PC's local IP
  return 'http://192.168.29.161:5000';
};

const API_BASE_URL = getApiBaseUrl();
console.log('🌐 API Base URL:', API_BASE_URL);

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
  const API_URL =
    process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.161:5000';
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
  const API_URL =
    process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.161:5000';
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

export async function passengerConfirmPickup(rideId: string) {
  try {
    const response = await apiClient.post(
      `/api/rides/${rideId}/pickup/passenger`,
      {},
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
  minSeats?: number;
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

/**
 * Book a ride offer (passenger booking)
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
    const response = await apiClient.post(
      `/api/ride-offers/${offerId}/book`,
      bookingData,
    );
    console.log('✅ Ride offer booked successfully');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error booking ride offer:',
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
      metadata,
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
  try {
    const response = await apiClient.get(`/api/chat/conversations/${userId}`);
    console.log('✅ Conversations retrieved');
    return response.data;
  } catch (error: any) {
    console.error(
      '❌ Error getting conversations:',
      error.response?.data || error.message,
    );
    return { success: true, conversations: [], count: 0 };
  }
}
