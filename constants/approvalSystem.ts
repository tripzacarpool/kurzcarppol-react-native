// Hybrid Ride Confirmation System Constants

export const APPROVAL_MODE = {
  AUTO: 'auto',
  MANUAL: 'manual',
} as const;

export const SEAT_LOCK_STATUS = {
  AVAILABLE: 'available',
  LOCKED: 'locked',
  BOOKED: 'booked',
  RESERVED: 'reserved',
} as const;

export const BOOKING_APPROVAL_STATUS = {
  AUTO_ACCEPTED: 'auto_accepted',
  PENDING_APPROVAL: 'pending_approval',
  PENDING_PASSENGER: 'pending_passenger',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  LOCKED: 'locked',
} as const;

export const APPROVAL_SETTINGS = {
  // Default approval deadlines (in minutes)
  DEFAULT_APPROVAL_DEADLINE: 5, // 5 minutes to approve
  SEAT_LOCK_DURATION: 2, // 2 minutes to lock seat
  AUTO_REJECT_AFTER: 5, // Auto-reject if not approved within 5 min

  // Thresholds for auto-approval
  AUTO_APPROVE_RATING_THRESHOLD: 4.0, // Auto-approve if rating >= 4.0
  AUTO_APPROVE_MIN_TRIPS: 10, // Auto-approve if user has 10+ trips
  AUTO_APPROVE_CANCELLATION_RATE: 0.1, // Auto-approve if cancel rate < 10%

  // Business rules
  ALLOW_DIRECT_CONFIRMATION: true, // Allow passenger to directly confirm
  ENABLE_SEAT_LOCKING: true, // Enable seat locking mechanism
  SHOW_APPROVAL_REQUESTS: true, // Show pending approvals to driver
};

export const APPROVAL_MESSAGES = {
  // For passengers
  AUTO_ACCEPTED: '✅ Your booking is confirmed!',
  PENDING_APPROVAL: '⏳ Waiting for driver approval...',
  PENDING_PASSENGER: '👋 Please confirm to finalize booking',
  APPROVED: '🎉 Driver approved your booking!',
  REJECTED: '❌ Driver declined your booking',
  SEAT_LOCKED: '🔒 Seat is temporarily locked',
  EXPIRED: '⏱️ Your booking request expired',

  // For drivers
  MANUAL_APPROVAL_DISABLED: 'Auto-confirm enabled (seamless experience)',
  MANUAL_APPROVAL_ENABLED: 'Manual approval enabled (review each booking)',
  FESTIVAL_FORCED_AUTO: '🎪 Festival rides auto-confirm',
  NEW_BOOKING_REQUEST: 'New booking request for {seats} seat(s)',
  APPROVAL_DEADLINE: 'Approve within {minutes} minutes',
};

export const APPROVAL_WORKFLOW_STEPS = {
  // Auto-confirm workflow
  AUTO: [
    { step: 1, name: 'passenger_books', action: 'Passenger requests booking' },
    {
      step: 2,
      name: 'auto_verified',
      action: 'System verifies passenger eligibility',
    },
    { step: 3, name: 'auto_confirmed', action: '✅ Booking auto-confirmed' },
    { step: 4, name: 'seat_allocated', action: 'Seat allocated to passenger' },
    { step: 5, name: 'ride_starts', action: 'Ride begins' },
  ],

  // Manual approval workflow
  MANUAL: [
    { step: 1, name: 'passenger_books', action: 'Passenger requests booking' },
    {
      step: 2,
      name: 'system_locks_seat',
      action: 'System locks seat temporarily',
    },
    {
      step: 3,
      name: 'driver_notification',
      action: 'Driver notified of request',
    },
    {
      step: 4,
      name: 'driver_approval_pending',
      action: '⏳ Awaiting driver decision',
    },
    {
      step: 5,
      name: 'driver_approves_or_rejects',
      action: 'Driver approves/rejects',
    },
    {
      step: 6,
      name: 'passenger_confirmed',
      action: 'Passenger confirms (if needed)',
    },
    { step: 7, name: 'ride_starts', action: 'Ride begins' },
  ],
};

export const CANCELLATION_RULES = {
  // Cancellation penalties
  BEFORE_DRIVER_APPROVAL: {
    passenger: { deductWalletPercent: 0, refundPercent: 100 },
    driver: { penalty: 'none' },
  },
  AFTER_DRIVER_APPROVAL_BEFORE_PICKUP: {
    passenger: { deductWalletPercent: 25, refundPercent: 75 },
    driver: { penalty: 'none' },
  },
  AFTER_PICKUP_STARTED: {
    passenger: { deductWalletPercent: 50, refundPercent: 50 },
    driver: { bonus: 25 }, // 25% bonus for cancellation handling
  },
  NO_SHOW: {
    passenger: {
      deductWalletPercent: 100,
      refundPercent: 0,
      ratingPenalty: -0.5,
    },
    driver: { bonus: 100 }, // Full payment + no-show bonus
  },

  // Time windows for cancellation
  FREE_CANCELLATION_BEFORE_MINUTES: 60, // Free cancel if 60+ min before departure
  MODERATE_PENALTY_BEFORE_MINUTES: 30, // 25% deduction if 30-60 min
  HIGH_PENALTY_BEFORE_MINUTES: 5, // 50% deduction if within 5 min
};

export const SEAT_LOCKING_RULES = {
  // How long seats stay locked
  MANUAL_APPROVAL_LOCK_DURATION: 2 * 60 * 1000, // 2 minutes in milliseconds
  SYSTEM_VERIFICATION_LOCK_DURATION: 30 * 1000, // 30 seconds
  CONFIRMATION_LOCK_DURATION: 5 * 60 * 1000, // 5 minutes

  // Seat allocation
  MAX_SEATS_PER_BOOKING: 6, // Max 6 seats in one booking
  ALGORITHM: 'optimal_distribution', // How seats are allocated
};

export const APPROVAL_ANALYTICS = {
  // Track these metrics
  METRICS: [
    'total_bookings_requested',
    'auto_confirmed_count',
    'manual_approved_count',
    'manual_rejected_count',
    'approval_time_average',
    'rejection_reason_breakdown',
    'cancellation_rate_by_approval_type',
  ],
};
