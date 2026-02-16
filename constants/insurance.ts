import { InsurancePlan } from '@/types';

export interface InsurancePlanMeta {
  name: string;
  description: string;
  premium: number; // ₹ per ride
  coverage: number; // ₹ coverage amount
  deductible: number; // ₹ out of pocket
  maxClaimsPerMonth: number;
}

export const INSURANCE_PLANS: Record<InsurancePlan, InsurancePlanMeta> = {
  basic: {
    name: 'Basic Ride Protection',
    description: '₹5 per ride - Essential coverage for accidents and injuries',
    premium: 5,
    coverage: 50000,
    deductible: 500,
    maxClaimsPerMonth: 2,
  },
  premium: {
    name: 'Premium Protection',
    description: '₹15 per ride - Extended coverage with higher limits',
    premium: 15,
    coverage: 200000,
    deductible: 0,
    maxClaimsPerMonth: 5,
  },
  annual: {
    name: 'Annual Protection',
    description: '₹999/year - Unlimited rides covered (best value)',
    premium: 999,
    coverage: 500000,
    deductible: 0,
    maxClaimsPerMonth: 999,
  },
};

export const CLAIM_CATEGORIES = {
  accident: {
    label: 'Accident/Collision',
    maxCoverage: 200000,
    processingDays: 7,
  },
  injury: {
    label: 'Personal Injury',
    maxCoverage: 100000,
    processingDays: 5,
  },
  loss: {
    label: 'Baggage/Item Loss',
    maxCoverage: 25000,
    processingDays: 10,
  },
  damage: {
    label: 'Property Damage',
    maxCoverage: 50000,
    processingDays: 7,
  },
};

export const COMPLIANCE_DETAILS = {
  regulatoryBody:
    'IRDAI (Insurance Regulatory and Development Authority of India)',
  licenseNumber: 'IRDAI/LIC-001-2024',
  coverageType: 'Group Personal Accident Insurance',
  renewalCycle: 'Annual',
  claimProcessingTime: '5-10 working days',
};

export const INSURANCE_BADGE_BENEFITS = {
  displayName: 'Insured Ride',
  trustFactor: '+15% ride conversion',
  description: 'This ride is covered by ₹50,000 accident insurance',
};
