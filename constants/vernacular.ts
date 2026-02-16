import { VernacularOnboarding } from '@/types';

export interface LanguageMeta {
  label: string;
  nativeLabel: string;
  regions: string[];
  estimatedUsers: number;
  priority: number;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageMeta> = {
  hindi: {
    label: 'Hindi',
    nativeLabel: 'हिँदी',
    regions: [
      'Delhi',
      'NCR',
      'UP',
      'Madhya Pradesh',
      'Rajasthan',
      'Haryana',
      'Jharkhand',
      'Bihar',
    ],
    estimatedUsers: 350000000,
    priority: 1,
  },
  tamil: {
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    regions: ['Tamil Nadu', 'Puducherry'],
    estimatedUsers: 75000000,
    priority: 2,
  },
  telugu: {
    label: 'Telugu',
    nativeLabel: 'తెలుగు',
    regions: ['Telangana', 'Andhra Pradesh'],
    estimatedUsers: 85000000,
    priority: 2,
  },
  kannada: {
    label: 'Kannada',
    nativeLabel: 'ಕನ್ನಡ',
    regions: ['Karnataka'],
    estimatedUsers: 45000000,
    priority: 3,
  },
  marathi: {
    label: 'Marathi',
    nativeLabel: 'मराठी',
    regions: ['Maharashtra', 'Goa'],
    estimatedUsers: 85000000,
    priority: 2,
  },
  english: {
    label: 'English',
    nativeLabel: 'English',
    regions: ['All India', 'Urban areas'],
    estimatedUsers: 100000000,
    priority: 1,
  },
};

export const VERNACULAR_ONBOARDING_STEPS = [
  {
    step: 'welcome',
    label: 'Welcome',
    description: 'Language selection and greeting',
  },
  {
    step: 'language',
    label: 'Choose Language',
    description: 'Select preferred language for all interactions',
  },
  {
    step: 'kyc',
    label: 'Identity Verification',
    description: 'Vernacular KYC with local documents',
  },
  {
    step: 'documents',
    label: 'Document Upload',
    description: 'License, ID in local language',
  },
  {
    step: 'completed',
    label: 'Completed',
    description: 'Ready to book rides!',
  },
];

export const OFFLINE_AGENT_MODEL = {
  description:
    'On-ground agents in Tier 2/3 cities to drive vernacular onboarding',
  benefits: [
    'In-person KYC verification',
    'Document assistance',
    'Language support',
    'Trust building in local communities',
    'Offline payment handling',
  ],
  agentIncentives: {
    perRegistration: 50, // ₹50 per successful registration
    monthlyTarget: 100, // 100 registrations per month
    performanceBonus: {
      '100_to_150_registrations': 1000,
      '150_to_250_registrations': 2500,
      '250_plus_registrations': 5000,
    },
  },
  qualifications: [
    'Age 18-60',
    'Local resident (at least 2 years)',
    'Literate in local language',
    'Smartphone ownership',
    'Background check clearance',
  ],
  trainingProgram: {
    duration: '3 days',
    topics: [
      'Platform features & benefits',
      'KYC verification process',
      'Payment handling',
      'Conflict resolution',
      'Data privacy & GDPR compliance',
    ],
  },
};

export const VERNACULAR_CONTENT_AREAS = [
  {
    area: 'Onboarding flow',
    languages: ['hindi', 'tamil', 'telugu', 'kannada', 'marathi'],
    priority: 'critical',
  },
  {
    area: 'Help & Support',
    languages: ['hindi', 'tamil', 'telugu', 'kannada', 'marathi'],
    priority: 'high',
  },
  {
    area: 'Safety guidelines',
    languages: ['hindi', 'tamil', 'telugu', 'kannada', 'marathi'],
    priority: 'high',
  },
  {
    area: 'Booking flow',
    languages: ['hindi', 'tamil', 'telugu', 'kannada', 'marathi'],
    priority: 'medium',
  },
  {
    area: 'Gamification',
    languages: ['hindi'],
    priority: 'low',
  },
];

export const RURAL_USER_INSIGHTS = {
  averageSmartphoneUsageTime: '2-3 hours/day',
  preferredPaymentMethod: 'Cash/Offline',
  literacyRate: 0.65,
  internetConnectivity: 'Intermittent (2G/3G)',
  trustBuilding: [
    'Video verification',
    'Local agent presence',
    'Offline payments',
  ],
  expectedDAU: {
    tier2: 0.85,
    tier3: 0.65,
  },
};
