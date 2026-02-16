import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { RideStreak, CarbonCounter, Badge, SafeDriverTier } from '@/types';
import * as gameAPI from '@/lib/api';

interface GamificationContextType {
  // Ride Streak
  rideStreak: RideStreak | null;
  fetchRideStreak: (userId: string) => Promise<void>;
  updateRideStreak: (userId: string, ridesCount: number) => Promise<void>;
  
  // Carbon Counter
  carbonCounter: CarbonCounter | null;
  fetchCarbonCounter: (userId: string) => Promise<void>;
  
  // Badges
  badges: Badge[];
  fetchBadges: (userId: string) => Promise<void>;
  
  // Safe Driver Tier
  safeDriverTier: SafeDriverTier | null;
  fetchSafeDriverTier: (userId: string) => Promise<void>;
  
  // Loading states
  loading: boolean;
  error: string | null;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export const GamificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rideStreak, setRideStreak] = useState<RideStreak | null>(null);
  const [carbonCounter, setCarbonCounter] = useState<CarbonCounter | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [safeDriverTier, setSafeDriverTier] = useState<SafeDriverTier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRideStreak = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const data = await gameAPI.getRideStreak(userId);
      if (data.success) {
        setRideStreak(data.streak);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching ride streak:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRideStreak = useCallback(async (userId: string, ridesCount: number) => {
    try {
      setLoading(true);
      const data = await gameAPI.updateRideStreak(userId, ridesCount);
      if (data.success) {
        setRideStreak(data.streak);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error updating ride streak:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCarbonCounter = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const data = await gameAPI.getCarbonCounter(userId);
      if (data.success) {
        setCarbonCounter(data.carbon);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching carbon counter:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBadges = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const data = await gameAPI.getUserBadges(userId);
      if (data.success) {
        setBadges(data.badges);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching badges:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSafeDriverTier = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const data = await gameAPI.getSafeDriverTier(userId);
      if (data.success) {
        setSafeDriverTier(data.tier);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching safe driver tier:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value: GamificationContextType = {
    rideStreak,
    fetchRideStreak,
    updateRideStreak,
    carbonCounter,
    fetchCarbonCounter,
    badges,
    fetchBadges,
    safeDriverTier,
    fetchSafeDriverTier,
    loading,
    error,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
};
