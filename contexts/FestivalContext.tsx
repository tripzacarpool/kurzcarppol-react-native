import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { FestivalPool, Festival } from '@/types';
import * as festivalAPI from '@/lib/api';

interface FestivalContextType {
  // Festival data
  availableFestivals: Festival[];
  festivalRides: FestivalPool[];
  selectedFestival: Festival | null;
  
  // Actions
  fetchFestivalRides: (festival: Festival) => Promise<void>;
  createFestivalRide: (data: {
    rideId: string;
    festival: Festival;
    verifiedLongRoute: boolean;
    groupBookingDiscount: number;
    smartPrice: number;
    returnRideAvailable: boolean;
    tier: string;
  }) => Promise<void>;
  bookReturnTrip: (originalRideId: string, userId: string, seatCount: number) => Promise<void>;
  selectFestival: (festival: Festival) => void;
  
  // Loading states
  loading: boolean;
  error: string | null;
}

const FestivalContext = createContext<FestivalContextType | undefined>(undefined);

export const FestivalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [availableFestivals] = useState<Festival[]>(['diwali', 'holi', 'eid', 'chhath', 'wedding']);
  const [festivalRides, setFestivalRides] = useState<FestivalPool[]>([]);
  const [selectedFestival, setSelectedFestival] = useState<Festival | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFestivalRides = useCallback(async (festival: Festival) => {
    try {
      setLoading(true);
      const data = await festivalAPI.getFestivalPoolRides(festival);
      if (data.success) {
        setFestivalRides(data.rides);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching festival rides:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createFestivalRide = useCallback(
    async (data: {
      rideId: string;
      festival: Festival;
      verifiedLongRoute: boolean;
      groupBookingDiscount: number;
      smartPrice: number;
      returnRideAvailable: boolean;
      tier: string;
    }) => {
      try {
        setLoading(true);
        const response = await festivalAPI.createFestivalPoolRide(data);
        if (response.success) {
          setFestivalRides([...festivalRides, response.pool]);
        }
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error('Error creating festival ride:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [festivalRides]
  );

  const bookReturnTrip = useCallback(
    async (originalRideId: string, userId: string, seatCount: number) => {
      try {
        setLoading(true);
        const response = await festivalAPI.bookReturnTrip({
          originalRideId,
          userId,
          seatCount,
        });
        if (response.success) {
          // Refresh festival rides to show updated return trip booking
          if (selectedFestival) {
            await fetchFestivalRides(selectedFestival);
          }
        }
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error('Error booking return trip:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selectedFestival, fetchFestivalRides]
  );

  const selectFestival = useCallback((festival: Festival) => {
    setSelectedFestival(festival);
  }, []);

  const value: FestivalContextType = {
    availableFestivals,
    festivalRides,
    selectedFestival,
    fetchFestivalRides,
    createFestivalRide,
    bookReturnTrip,
    selectFestival,
    loading,
    error,
  };

  return (
    <FestivalContext.Provider value={value}>
      {children}
    </FestivalContext.Provider>
  );
};

export const useFestival = () => {
  const context = useContext(FestivalContext);
  if (context === undefined) {
    throw new Error('useFestival must be used within a FestivalProvider');
  }
  return context;
};
