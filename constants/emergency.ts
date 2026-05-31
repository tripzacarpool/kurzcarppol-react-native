/**
 * Emergency Services Configuration
 * Emergency contacts for SOS incidents across different regions
 */

export interface EmergencyContact {
  category: string;
  name: string;
  number: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  icon?: string;
}

// Pan-India Emergency Contacts
export const EMERGENCY_CONTACTS: Record<string, EmergencyContact> = {
  POLICE: {
    category: 'police',
    name: 'Emergency Police',
    number: '100',
    description: 'Police Emergency - Crime, Safety Threats',
    priority: 'high',
    icon: '👮',
  },
  AMBULANCE: {
    category: 'ambulance',
    name: 'Emergency Ambulance',
    number: '102',
    description: 'Medical Emergency - Accidents, Health Issues',
    priority: 'high',
    icon: '🚑',
  },
  FIRE: {
    category: 'fire',
    name: 'Fire Department',
    number: '101',
    description: 'Fire Emergency',
    priority: 'high',
    icon: '🚒',
  },
  DISASTER: {
    category: 'disaster',
    name: 'Disaster Management',
    number: '108',
    description: 'All Emergency Services (Unified)',
    priority: 'high',
    icon: '🆘',
  },
  WOMEN_HELPLINE: {
    category: 'women_safety',
    name: 'Women Safety Helpline',
    number: '1091',
    description: 'Women Safety & Protection',
    priority: 'high',
    icon: '👩',
  },
};

// City-specific emergency numbers
export const CITY_EMERGENCY_CONTACTS: Record<string, Record<string, string>> = {
  Delhi: {
    police: '100',
    ambulance: '102',
    fire: '101',
    women_helpline: '1091',
    traffic: '9955085151',
  },
  Mumbai: {
    police: '100',
    ambulance: '102',
    fire: '101',
    women_helpline: '1091',
    traffic: '1968',
  },
  Bangalore: {
    police: '100',
    ambulance: '102',
    fire: '101',
    women_helpline: '1091',
    traffic: '080-22943456',
  },
  Hyderabad: {
    police: '100',
    ambulance: '102',
    fire: '101',
    women_helpline: '1091',
    traffic: '040-27951234',
  },
};

// SOS Priority Levels
export const SOS_PRIORITY = {
  CRITICAL: 'critical', // Requires immediate police response
  HIGH: 'high', // Serious concern, medical needed
  MEDIUM: 'medium', // Safety issue, driver concern
  LOW: 'low', // False alarm, resolved
};

// SOS Status
export const SOS_STATUS = {
  ACTIVE: 'active', // SOS alert is currently active
  RESOLVED: 'resolved', // Issue resolved
  CANCELLED: 'cancelled', // User cancelled SOS
  POLICE_RESPONDED: 'police_responded', // Police arrived
  MEDIC_RESPONDED: 'medic_responded', // Ambulance arrived
};

// SOS Incident Type
export const SOS_INCIDENT_TYPE = {
  UNSAFE_DRIVER: 'unsafe_driver', // Driver behavior concerning
  WRONG_ROUTE: 'wrong_route', // Driver going wrong way
  HARASSMENT: 'harassment', // Passenger being harassed
  ACCIDENT: 'accident', // Vehicle accident
  MEDICAL_EMERGENCY: 'medical_emergency', // Person is unwell
  THREAT: 'threat', // Direct threat/danger
  LOST: 'lost', // Passenger lost location
  OTHER: 'other', // Generic safety concern
};

export const INCIDENT_DESCRIPTIONS: Record<string, string> = {
  unsafe_driver: 'Driver behavior is unsafe or concerning',
  wrong_route: 'Driver is taking a suspicious or wrong route',
  harassment: 'Passenger is being harassed or threatened',
  accident: 'Vehicle has met with an accident',
  medical_emergency: 'Medical emergency - person unwell',
  threat: 'Direct threat to passenger safety',
  lost: 'Passenger lost or unsure of location',
  other: 'General safety concern',
};
