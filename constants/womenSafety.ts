/**
 * Women Safety Configuration
 */

export const WOMEN_SAFETY = {
  ENABLED: true,
  FIELDS: {
    PRIMARY_EMERGENCY_CONTACT: 'primaryEmergencyContact',
    SECONDARY_EMERGENCY_CONTACT: 'secondaryEmergencyContact',
    WOMEN_ONLY_PREFERENCE: 'womenOnlyPreference',
    AUTO_SHARE_TRIP: 'autoShareTrip',
    SAFETY_ALERTS_ENABLED: 'safetyAlertsEnabled',
  },
};

export const SOS_POPUP_OPTIONS = [
  {
    id: 'share_trip',
    label: 'Share Trip',
    icon: '📍',
    description: 'Share ride details with emergency contacts',
    action: 'share_trip',
  },
  {
    id: 'emergency_call',
    label: 'Call Emergency (112)',
    icon: '📞',
    description: 'Call emergency services directly',
    action: 'call_emergency',
  },
  {
    id: 'report_issue',
    label: 'Report Issue',
    icon: '⚠️',
    description: 'Report incident without emergency call',
    action: 'report_issue',
  },
  {
    id: 'send_sos',
    label: 'Send Alert',
    icon: '🚨',
    description: 'Send SOS to support & emergency contacts',
    action: 'send_sos',
  },
];

export const EMERGENCY_NUMBERS = {
  UNIVERSAL: '112', // India universal emergency
  WOMEN_HELPLINE: '1091',
  POLICE: '100',
  AMBULANCE: '102',
};

export const SHARE_METHODS = [
  {
    id: 'emergency_contacts',
    label: 'Emergency Contacts',
    icon: '📱',
    description: 'Share to saved emergency contacts',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    description: 'Share on WhatsApp',
  },
  {
    id: 'sms',
    label: 'SMS',
    icon: '✉️',
    description: 'Share via SMS',
  },
  {
    id: 'call',
    label: 'Call Contact',
    icon: '☎️',
    description: 'Call emergency contact',
  },
];

export const RIDE_PREFERENCE_TYPES = {
  NORMAL: 'normal',
  WOMEN_ONLY: 'women_only',
  WOMEN_PREFERRED: 'women_preferred',
};

export const RELATIONSHIP_TYPES = [
  'Mother',
  'Father',
  'Sister',
  'Brother',
  'Spouse',
  'Best Friend',
  'Trusted Friend',
  'Other',
];
