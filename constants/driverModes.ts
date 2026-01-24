import { DriverMode } from '../types';

interface DriverModeMeta {
  label: string;
  tagline: string;
  description: string;
}

export const DRIVER_MODE_META: Record<DriverMode, DriverModeMeta> = {
  all_access: {
    label: 'Open Fleet',
    tagline: 'Accepts every verified rider any time',
    description:
      'Full-time professionals who run KruZ rides throughout the day. They accept every verified passenger category and stay online beyond peak office hours.',
  },
  community: {
    label: 'Community First',
    tagline: 'Prefers curated, like-minded passengers',
    description:
      'Drivers who selectively accept riders that match their social preferences or community groups. Ideal for women-only pools, corporate circles, or gated societies.',
  },
  commuter: {
    label: 'Commute Only',
    tagline: 'Shares seats only on daily office routes',
    description:
      'Riders turned drivers who open seats only during their personal commute. Routes and timings stay fixed, and bookings are limited to matching pick-up and drop windows.',
  },
};
