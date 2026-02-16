import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { RideInsurance, InsuranceClaim, InsurancePolicy } from '@/types';
import * as insuranceAPI from '@/lib/api';

interface InsuranceContextType {
  // Insurance data
  activeInsurance: RideInsurance | null;
  policies: InsurancePolicy[];
  claims: InsuranceClaim[];
  
  // Actions
  purchaseInsurance: (rideId: string, userId: string, plan: string) => Promise<void>;
  getRideInsurance: (rideId: string) => Promise<void>;
  submitClaim: (data: {
    insuranceId: string;
    rideId: string;
    userId: string;
    claimType: string;
    amount: number;
    description: string;
  }) => Promise<void>;
  fetchPolicies: (userId: string) => Promise<void>;
  
  // Loading states
  loading: boolean;
  error: string | null;
}

const InsuranceContext = createContext<InsuranceContextType | undefined>(undefined);

export const InsuranceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeInsurance, setActiveInsurance] = useState<RideInsurance | null>(null);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchaseInsurance = useCallback(
    async (rideId: string, userId: string, plan: string) => {
      try {
        setLoading(true);
        const data = await insuranceAPI.purchaseRideInsurance({
          rideId,
          userId,
          plan,
        });
        if (data.success) {
          setActiveInsurance(data.insurance);
        }
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error('Error purchasing insurance:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getRideInsurance = useCallback(async (rideId: string) => {
    try {
      setLoading(true);
      const data = await insuranceAPI.getRideInsurance(rideId);
      if (data.success && data.insurance) {
        setActiveInsurance(data.insurance);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching ride insurance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const submitClaim = useCallback(
    async (data: {
      insuranceId: string;
      rideId: string;
      userId: string;
      claimType: string;
      amount: number;
      description: string;
    }) => {
      try {
        setLoading(true);
        const response = await insuranceAPI.submitInsuranceClaim(data);
        if (response.success) {
          setClaims([...claims, response.claim]);
        }
        setError(null);
      } catch (err: any) {
        setError(err.message);
        console.error('Error submitting claim:', err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [claims]
  );

  const fetchPolicies = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const data = await insuranceAPI.getUserInsurancePolicies(userId);
      if (data.success) {
        setPolicies(data.policies);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching policies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const value: InsuranceContextType = {
    activeInsurance,
    policies,
    claims,
    purchaseInsurance,
    getRideInsurance,
    submitClaim,
    fetchPolicies,
    loading,
    error,
  };

  return (
    <InsuranceContext.Provider value={value}>
      {children}
    </InsuranceContext.Provider>
  );
};

export const useInsurance = () => {
  const context = useContext(InsuranceContext);
  if (context === undefined) {
    throw new Error('useInsurance must be used within an InsuranceProvider');
  }
  return context;
};
