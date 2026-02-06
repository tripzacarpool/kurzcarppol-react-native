import { useState, useEffect } from 'react';

export interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  isExpired: boolean;
  percentage: number; // 0-100, how much time has passed
}

/**
 * Hook to track countdown timer for a ride
 */
export const useRideTimer = (departureTime: Date | string): TimeRemaining => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
    isExpired: false,
    percentage: 0,
  });

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const departure = new Date(departureTime).getTime();
      const difference = departure - now;

      if (difference <= 0) {
        setTimeRemaining({
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0,
          isExpired: true,
          percentage: 100,
        });
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      // Calculate percentage (assuming ride was created 2 hours ago as baseline)
      const twoHoursAgo = departure - 2 * 60 * 60 * 1000;
      const totalDuration = departure - twoHoursAgo;
      const elapsed = now - twoHoursAgo;
      const percentage = Math.min(
        100,
        Math.max(0, (elapsed / totalDuration) * 100),
      );

      setTimeRemaining({
        hours,
        minutes,
        seconds,
        total: difference,
        isExpired: false,
        percentage,
      });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [departureTime]);

  return timeRemaining;
};

/**
 * Format time remaining as a string
 */
export const formatTimeRemaining = (timeRemaining: TimeRemaining): string => {
  if (timeRemaining.isExpired) {
    return 'Expired';
  }

  const { hours, minutes } = timeRemaining;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return 'Less than 1m';
};

/**
 * Get color based on time remaining
 */
export const getTimeColor = (timeRemaining: TimeRemaining): string => {
  if (timeRemaining.isExpired) {
    return '#EF4444'; // Red
  }

  if (timeRemaining.total < 15 * 60 * 1000) {
    // Less than 15 minutes
    return '#F59E0B'; // Orange
  }

  return '#10B981'; // Green
};

/**
 * Check if a ride should be auto-removed
 */
export const shouldAutoRemove = (departureTime: Date | string): boolean => {
  const now = new Date().getTime();
  const departure = new Date(departureTime).getTime();

  // Auto-remove 5 minutes after departure time
  return now > departure + 5 * 60 * 1000;
};

/**
 * Check if ride is about to expire (within 30 minutes)
 */
export const isAboutToExpire = (departureTime: Date | string): boolean => {
  const now = new Date().getTime();
  const departure = new Date(departureTime).getTime();
  const difference = departure - now;

  return difference > 0 && difference < 30 * 60 * 1000;
};
