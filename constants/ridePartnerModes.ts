import { RidePartnerMode } from '@/types';

export interface RidePartnerModeMeta {
  title: string;
  badge: string;
  description: string;
  vehicleHint: string;
}

export const RIDE_PARTNER_MODES: Record<RidePartnerMode, RidePartnerModeMeta> =
  {
    daily: {
      title: 'Daily Ride Partner',
      badge: 'Travels regularly · Personal car',
      description:
        'Perfect for professionals who commute every day and open the remaining seats to the community.',
      vehicleHint:
        'Personal vehicle, consistent routes, morning + evening slots',
    },
    casual: {
      title: 'Casual Ride Partner',
      badge: 'Travels sometimes · Personal car',
      description:
        'Share rides only when you feel like it. Ideal for weekend plans or occasional inter-city runs.',
      vehicleHint: 'Personal vehicle, flexible timings, ad-hoc trips',
    },
    professional: {
      title: 'Professional Ride Partner',
      badge: 'Travels regularly · Cab / commercial permit',
      description:
        'Fleet owners or licensed cab drivers who want a verified passenger pipeline on TripZa.',
      vehicleHint: 'Commercial or cab vehicle, commercial permit required',
    },
  };
