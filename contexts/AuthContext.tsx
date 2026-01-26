import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import { clearAllClerkSessions } from '@/lib/clerkSessionHelper';
import { logoutUserFromBackend, fetchRidePartnerProfile } from '@/lib/api';
import { RidePartnerProfile, RidePartnerApplicationStatus, UserRole } from '@/types';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  role?: UserRole;
  ridePartnerProfile?: RidePartnerProfile | null;
  ridePartnerStatus?: RidePartnerApplicationStatus;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  error: string | null;
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isSignedIn, signOut, isLoaded, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔄 Raw Clerk state:', {
      isLoaded,
      isSignedIn,
      clerkUserId: clerkUser?.id,
      clerkUserEmail: clerkUser?.emailAddresses?.[0]?.emailAddress,
      hasClerkUser: !!clerkUser,
    });
  }, [isLoaded, isSignedIn, clerkUser]);

  useEffect(() => {
    console.log('🔄 AuthContext Effect:', {
      isLoaded,
      isSignedIn,
      clerkUserId: clerkUser?.id,
      clerkUserEmail: clerkUser?.emailAddresses?.[0]?.emailAddress,
    });

    if (!isLoaded) {
      console.log('⏳ Clerk still loading...');
      setIsLoading(true);
      return;
    }

    setIsLoading(false);

    if (clerkUser) {
      console.log('✅ Clerk user detected, setting AuthContext user');
      const authUser: AuthUser = {
        id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName || undefined,
        lastName: clerkUser.lastName || undefined,
        profileImage: clerkUser.profileImageUrl || undefined,
      };

      setUser(authUser);

      // Sync user with MongoDB on sign in
      syncUserWithDatabase(authUser);
    } else {
      console.log('❌ No Clerk user, clearing AuthContext user');
      setUser(null);
    }
  }, [isSignedIn, clerkUser, isLoaded]);

  const syncUserWithDatabase = async (authUser: AuthUser) => {
    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.100:5000';
      const syncUrl = `${API_URL}/api/users/sync`;
      console.log('🔗 Syncing to:', syncUrl);
      
      // Get Clerk session token
      const token = await getToken();
      if (!token) {
        console.warn('⚠️ No auth token available, skipping sync');
        return;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: authUser.email,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
          profileImage: authUser.profileImage,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Sync failed with status:', response.status, errorData);
        throw new Error(`Failed to sync: ${response.status}`);
      }

      const payload = await response.json();
      const syncedUser = payload.user || payload;

      setUser((prev) =>
        prev
          ? {
              ...prev,
              role: syncedUser?.role,
              ridePartnerProfile: syncedUser?.ridePartnerProfile || prev.ridePartnerProfile,
              ridePartnerStatus: syncedUser?.ridePartnerProfile?.status || prev.ridePartnerStatus,
            }
          : prev,
      );
      console.log('✅ User synced successfully, role:', syncedUser?.role);

      await hydrateRidePartnerProfile(authUser.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      console.warn('⚠️ Sync failed (non-critical):', errorMsg);
      // Don't block auth - user is already authenticated via Clerk
    }
  };

  const hydrateRidePartnerProfile = async (clerkId: string) => {
    try {
      const { profile } = await fetchRidePartnerProfile(clerkId);
      if (profile) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                ridePartnerProfile: profile,
                ridePartnerStatus: profile.status,
                role: profile.status === 'approved' ? 'ride_partner' : prev.role,
              }
            : prev,
        );
      }
    } catch (error) {
      console.warn('⚠️ Unable to load ride partner profile:', error instanceof Error ? error.message : error);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('🔐 Starting logout process...');
      const clerkUserId = user?.id;
      
      console.log('1️⃣ Clearing local user state...');
      setUser(null);
      setError(null);
      
      // Call backend logout to invalidate session server-side (non-blocking)
      if (clerkUserId) {
        console.log('2️⃣ Logging out from backend...');
        logoutUserFromBackend(clerkUserId).catch(err => {
          console.warn('⚠️ Backend logout failed but continuing:', err);
        });
      }
      
      console.log('3️⃣ Clearing Clerk session from secure storage...');
      await clearAllClerkSessions();
      
      console.log('4️⃣ Signing out from Clerk...');
      await signOut();
      
      console.log('✅ Logout successful, user cleared from state');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('❌ Error during logout:', errorMsg);
      // Force clear state even if Clerk signOut fails
      setUser(null);
      setError(null); // Don't set error on logout - just clear everything
      try {
        await clearAllClerkSessions();
      } catch (clearErr) {
        console.error('❌ Failed to clear sessions:', clearErr);
      }
    }
  };

  const getAuthToken = async () => {
    try {
      return await getToken();
    } catch (err) {
      console.error('❌ Failed to get auth token:', err);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSignedIn: !!clerkUser && isSignedIn,
        signOut: handleSignOut,
        error,
        getAuthToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

// Alias for backward compatibility
export const useAuth = useAuthContext;
