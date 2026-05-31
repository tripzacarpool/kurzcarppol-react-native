import mongoose, { Schema } from 'mongoose';

const sectionStatusEnum = ['pending', 'submitted', 'approved', 'rejected'];
const ridePartnerStatusEnum = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
];
const driverPrivacyTypeEnum = ['full_detail', 'private_vehicle'];

const withVerificationMeta = (fields) => ({
  ...fields,
  status: { type: String, enum: sectionStatusEnum, default: 'pending' },
  verifiedAt: Date,
  rejectionReason: String,
});

const ridePartnerProfileSchema = new Schema(
  {
    status: {
      type: String,
      enum: ridePartnerStatusEnum,
      default: 'draft',
    },
    mode: {
      type: String,
      enum: ['daily', 'casual', 'professional'],
    },
    vehicleType: {
      type: String,
      enum: ['personal', 'cab'],
      default: 'personal',
    },
    driverPrivacyType: {
      type: String,
      enum: driverPrivacyTypeEnum,
      default: 'private_vehicle',
    },
    publicDisclosure: {
      showFullName: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showFullVehicleNumber: { type: Boolean, default: false },
      showProfilePhoto: { type: Boolean, default: false },
    },
    trustBatch: {
      type: String,
      enum: ['new', 'community', 'trusted', 'featured'],
      default: 'new',
      index: true,
    },
    trustScore: { type: Number, min: 0, max: 100, default: 50 },
    publicityScore: { type: Number, min: 0, max: 100, default: 40 },
    basicProfile: withVerificationMeta({
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      profilePhotoUrl: String,
    }),
    vehicleDetails: withVerificationMeta({
      vehicleType: { type: String, required: true },
      carModel: { type: String, required: true },
      vehicleNumber: { type: String, required: true },
      maxPassengers: { type: Number, required: true },
      vehiclePhotoUrl: String,
    }),
    licenseDetails: withVerificationMeta({
      licenseNumber: { type: String, required: true },
      licensePhotoUrl: String,
    }),
    kycDetails: withVerificationMeta({
      selfiePhoto: { type: String },
      digilockerDocument: String,
      digilockerStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'verified'],
        default: 'pending',
      },
    }),
    payoutDetails: withVerificationMeta({
      accountHolderName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
    }),
    professionalDetails: withVerificationMeta({
      commercialPermitUrl: String,
    }),
    declaration: {
      communityRulesAccepted: { type: Boolean, default: false },
      ownershipConsent: { type: Boolean, default: false },
      acceptedAt: Date,
    },
    timeline: [
      {
        status: { type: String, enum: ridePartnerStatusEnum, required: true },
        note: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    lastSubmittedAt: Date,
    reviewerNotes: String,
  },
  { _id: false },
);

const userProfileSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    profileImage: String,
    role: {
      type: String,
      enum: ['passenger', 'ride_partner', 'admin'],
      default: 'passenger',
      index: true,
    },
    location: {
      city: String,
      country: String,
      latitude: Number,
      longitude: Number,
      updatedAt: Date,
    },
    ipAddress: String,
    ipUpdatedAt: Date,
    lastLogout: Date,
    walletBalance: { type: Number, default: 0, min: 0 },
    walletTransactions: [
      {
        type: { type: String, enum: ['credit', 'debit'] },
        amount: Number,
        balance: Number,
        description: String,
        bookingDetails: mongoose.Schema.Types.Mixed,
        paymentId: String,
        orderId: String,
        idempotencyKey: String,
        timestamp: { type: Date, default: Date.now },
        transactionId: String,
      },
    ],
    phone: { type: String, sparse: true },
    pushToken: { type: String, sparse: true },
    pushTokenUpdatedAt: Date,
    isWomenOnly: { type: Boolean, default: false },
    rating: { type: Number, default: 5, min: 0, max: 5 },
    totalTrips: { type: Number, default: 0 },
    vehicleInfo: {
      model: String,
      color: String,
      licensePlate: { type: String, sparse: true },
      year: Number,
    },
    isActive: { type: Boolean, default: true },
    ridePartnerProfile: ridePartnerProfileSchema,
    // Driver Verification Batch System
    driverVerified: { type: Boolean, default: false, index: true },
    verificationBatch: { type: String, sparse: true, index: true },
    verificationStatus: {
      type: String,
      enum: ['pending', 'auto_approved', 'manual_review', 'rejected'],
      default: 'pending',
      index: true,
    },
    verificationScore: { type: Number, min: 0, max: 100 },
    verificationCompletedAt: Date,
    verificationData: mongoose.Schema.Types.Mixed, // Store verification checks, attempts, etc.
    licenseNumber: { type: String, sparse: true },
    // Women Safety Features
    isFemale: { type: Boolean, default: false, index: true },
    femaleSignup: { type: Boolean, default: false },
    safetyFeatures: {
      womenOnlyPreference: { type: Boolean, default: false },
      autoShareTrip: { type: Boolean, default: true },
      safetyAlertsEnabled: { type: Boolean, default: true },
      primaryEmergencyContact: {
        name: String,
        phone: String,
        relationship: String,
      },
      secondaryEmergencyContact: {
        name: String,
        phone: String,
        relationship: String,
      },
      emergencyContacts: [
        {
          id: mongoose.Schema.Types.ObjectId,
          name: String,
          phone: String,
          relationship: String,
          addedAt: { type: Date, default: Date.now },
        },
      ],
    },
  },
  { timestamps: true },
);

// Indexes for performance
userProfileSchema.index({ role: 1, createdAt: -1 });
userProfileSchema.index({ email: 1, clerkId: 1 });
userProfileSchema.index({ 'walletTransactions.paymentId': 1 }, { sparse: true });
userProfileSchema.index(
  { 'walletTransactions.idempotencyKey': 1 },
  { sparse: true },
);

export const UserProfile = mongoose.model('UserProfile', userProfileSchema);

// Ride Request Schema
const rideRequestSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
      index: true,
    },
    clerkId: { type: String, required: true, index: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    passengers: { type: Number, required: true, min: 1, max: 4 },
    vehicleType: {
      type: String,
      enum: ['two_wheeler', 'three_wheeler', 'four_wheeler'],
      default: 'four_wheeler',
    },
    notes: String,
    womenOnly: { type: Boolean, default: false },
    pickupLatitude: Number,
    pickupLongitude: Number,
    pickupCity: String,
    pickupCountry: String,
    dropoffLatitude: Number,
    dropoffLongitude: Number,
    dropoffCity: String,
    dropoffCountry: String,
    offeredByDriver: { type: Boolean, default: false },
    fare: { type: Number, default: 0 },
    requestedTotalFare: { type: Number, default: 0, min: 0 },
    driverGuaranteedFare: { type: Number, default: 0, min: 0 },
    maxSharedSeats: { type: Number, default: 4, min: 1, max: 6 },
    fareSplit: {
      totalFare: { type: Number, default: 0 },
      totalSeats: { type: Number, default: 0 },
      perSeatEstimate: { type: Number, default: 0 },
      driverGuaranteedFare: { type: Number, default: 0 },
      updatedAt: Date,
      participants: [
        {
          clerkId: String,
          userId: mongoose.Schema.Types.ObjectId,
          name: String,
          phone: String,
          seatCount: { type: Number, default: 1 },
          shareAmount: { type: Number, default: 0 },
          joinedAt: { type: Date, default: Date.now },
          role: {
            type: String,
            enum: ['requester', 'joiner'],
            default: 'joiner',
          },
          paymentMethod: {
            type: String,
            enum: ['wallet', 'upi', 'cash', 'unknown'],
            default: 'unknown',
          },
          status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled'],
            default: 'confirmed',
          },
        },
      ],
    },
    scheduledDeparture: Date,
    earliestDeparture: Date,
    latestDeparture: Date,
    timeFlexibilityMinutes: { type: Number, default: 60, min: 0, max: 720 },
    status: {
      type: String,
      enum: [
        'waiting',
        'accepted',
        'booked',
        'ongoing',
        'completed',
        'cancelled',
      ],
      default: 'waiting',
      index: true,
    },
    acceptedBy: {
      userId: mongoose.Schema.Types.ObjectId,
      clerkId: String,
      driverName: String,
      driverRating: Number,
    },
    bookingDetails: {
      confirmedAt: Date,
      seatNumbers: [Number],
      totalAmount: { type: Number, default: 0 },
      paymentMethod: {
        type: String,
        enum: ['wallet', 'upi', 'cash', 'unknown'],
        default: 'unknown',
      },
      customRequest: String,
      passengerName: String,
      passengerPhone: String,
      pickupEta: Date,
    },
    pickupStatus: {
      driverConfirmedAt: Date,
      passengerConfirmedAt: Date,
    },
    dropoffStatus: {
      passengerConfirmedAt: Date,
      completedAt: Date,
    },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    completedAt: Date,
    // SOS Alert System Fields
    sosActivated: { type: Boolean, default: false, index: true },
    sosActivatedAt: Date,
    sosActivatedBy: { type: String, index: true },
    sosReason: String,
    sosResolvedAt: Date,
    sosResolution: String, // 'resolved_by_admin', 'resolved_by_driver', 'false_alarm', etc.
    sosAdminNotes: String,
    sosResponseTime: Number, // milliseconds from activation to resolution
    // Women Safety Features
    ridePreference: {
      type: String,
      enum: ['normal', 'women_only', 'women_preferred'],
      default: 'normal',
    },
    tripSharedWith: [
      {
        contactId: String,
        contactName: String,
        contactPhone: String,
        sharedAt: { type: Date, default: Date.now },
        sharedVia: String, // 'whatsapp', 'sms', 'emergency_contact'
      },
    ],
    safetyCheckpoints: [
      {
        timestamp: Date,
        type: String, // 'trip_shared', 'emergency_call', 'sos_alert'
        details: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true },
);

// Indexes for ride queries
rideRequestSchema.index({ status: 1, createdAt: -1 });
rideRequestSchema.index({ userId: 1, createdAt: -1 });
rideRequestSchema.index({ clerkId: 1, createdAt: -1 });
rideRequestSchema.index({ scheduledDeparture: 1 });
rideRequestSchema.index({ earliestDeparture: 1, latestDeparture: 1 });
rideRequestSchema.index({ status: 1, scheduledDeparture: 1, createdAt: -1 });
rideRequestSchema.index({ status: 1, from: 1, to: 1, scheduledDeparture: 1 });
rideRequestSchema.index({ sosActivated: 1, sosActivatedAt: -1 });

export const RideRequest = mongoose.model('RideRequest', rideRequestSchema);

// Ride Offer Schema (for drivers/ride partners offering rides)
const rideOfferSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserProfile',
      required: true,
      index: true,
    },
    clerkId: { type: String, required: true, index: true },
    driverId: { type: String, required: true, index: true }, // Driver's clerkId
    from: { type: String, required: true },
    to: { type: String, required: true },
    totalSeats: { type: Number, required: true, min: 1, max: 6 },
    availableSeats: { type: [Number], required: true }, // e.g., [1, 2, 3, 4]
    farePerSeat: { type: Number, required: true, min: 0 },
    vehicleType: {
      type: String,
      enum: ['two_wheeler', 'four_wheeler'],
      default: 'four_wheeler',
    },
    driverMode: {
      type: String,
      enum: ['commuter', 'daily', 'casual', 'professional'],
      default: 'commuter',
    },
    driverPrivacyType: {
      type: String,
      enum: driverPrivacyTypeEnum,
      default: 'private_vehicle',
      index: true,
    },
    publicDisclosure: {
      showFullName: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      showFullVehicleNumber: { type: Boolean, default: false },
      showProfilePhoto: { type: Boolean, default: false },
    },
    trustBatch: {
      type: String,
      enum: ['new', 'community', 'trusted', 'featured'],
      default: 'new',
      index: true,
    },
    trustScore: { type: Number, min: 0, max: 100, default: 50 },
    publicityScore: { type: Number, min: 0, max: 100, default: 40 },
    notes: String,
    womenOnly: { type: Boolean, default: false },
    pickupLatitude: Number,
    pickupLongitude: Number,
    pickupCity: String,
    pickupCountry: String,
    dropoffLatitude: Number,
    dropoffLongitude: Number,
    dropoffCity: String,
    dropoffCountry: String,
    departureTime: { type: Date, required: true },
    scheduledDeparture: Date,
    earliestDeparture: Date,
    latestDeparture: Date,
    timeFlexibilityMinutes: { type: Number, default: 60, min: 0, max: 720 },
    status: {
      type: String,
      enum: [
        'waiting',
        'accepted',
        'booked',
        'ongoing',
        'completed',
        'cancelled',
      ],
      default: 'waiting',
      index: true,
    },
    // Festival Special Pool fields (optional - only for admin testing)
    festivalType: {
      type: String,
      enum: ['diwali', 'holi', 'eid', 'chhath', 'wedding'],
      default: null,
      required: false,
      index: true,
    },
    festivalConfig: {
      verifiedLongRouteDriver: { type: Boolean, default: false },
      returnDiscount: { type: Number, default: 0 },
      groupBooking: { type: Boolean, default: false },
      smartPricing: { type: Boolean, default: false },
      tier: {
        type: String,
        enum: ['Tier 1', 'Tier 2', 'Tier 3'],
        default: null,
        required: false,
      },
    },
    vehicle: {
      model: String,
      color: String,
      number: String,
    },
    driver: {
      name: String,
      profileImage: String,
      rating: { type: Number, default: 5 },
      ridesCompleted: { type: Number, default: 0 },
      gender: {
        type: String,
        enum: ['male', 'female', 'other'],
        default: 'other',
      },
    },
    bookings: [
      {
        passengerId: mongoose.Schema.Types.ObjectId,
        passengerClerkId: String,
        passengerName: String,
        passengerPhone: String,
        seatNumbers: [Number],
        totalAmount: Number,
        paymentMethod: {
          type: String,
          enum: ['wallet', 'upi', 'cash', 'unknown'],
          default: 'unknown',
        },
        status: {
          type: String,
          enum: ['pending', 'confirmed', 'cancelled'],
          default: 'pending',
        },
        bookedAt: { type: Date, default: Date.now },
        customRequest: String,
      },
    ],
    holdRequests: [
      {
        passengerClerkId: { type: String, required: true },
        passengerName: String,
        minutes: { type: Number, min: 1, max: 60, required: true },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
          index: true,
        },
        requestedAt: { type: Date, default: Date.now },
        respondedAt: Date,
      },
    ],
    pickupStatus: {
      driverConfirmedAt: Date,
      confirmedPassengers: [String], // Array of passenger clerkIds
    },
    dropoffStatus: {
      completedAt: Date,
      confirmedPassengers: [String], // Array of passenger clerkIds
    },
    // Approval system fields
    approvalMode: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'manual',
      index: true,
    },
    requiresManualApproval: { type: Boolean, default: true },
    seatLocks: [
      {
        seatNumber: Number,
        status: {
          type: String,
          enum: ['locked', 'confirmed'],
          default: 'locked',
        },
        userId: String,
        bookingId: mongoose.Schema.Types.ObjectId,
        lockedAt: { type: Date, default: Date.now },
        expiresAt: Date,
      },
    ],
    departureNotificationSent: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    completedAt: Date,
    // SOS Alert System Fields
    sosActivated: { type: Boolean, default: false, index: true },
    sosActivatedAt: Date,
    sosActivatedBy: { type: String, index: true },
    sosReason: String,
    sosResolvedAt: Date,
    sosResolution: String,
    sosAdminNotes: String,
    sosResponseTime: Number,
  },
  { timestamps: true },
);

// Indexes for ride offer queries
rideOfferSchema.index({ status: 1, createdAt: -1 });
rideOfferSchema.index({ userId: 1, createdAt: -1 });
rideOfferSchema.index({ clerkId: 1, createdAt: -1 });
rideOfferSchema.index({ departureTime: 1 });
rideOfferSchema.index({ scheduledDeparture: 1 });
rideOfferSchema.index({ earliestDeparture: 1, latestDeparture: 1 });
rideOfferSchema.index({ from: 1, to: 1, departureTime: 1 });
rideOfferSchema.index({ status: 1, scheduledDeparture: 1, createdAt: -1 });
rideOfferSchema.index({ status: 1, from: 1, to: 1, scheduledDeparture: 1 });
rideOfferSchema.index({ driverId: 1, status: 1, scheduledDeparture: -1 });
rideOfferSchema.index({
  'holdRequests.status': 1,
  'holdRequests.requestedAt': 1,
});
rideOfferSchema.index({ sosActivated: 1, sosActivatedAt: -1 });

export const RideOffer = mongoose.model('RideOffer', rideOfferSchema);

// ==================== BOOKING APPROVAL MODEL ====================

// Ride Booking Schema (for manual approval system)
const rideBookingSchema = new Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RideOffer',
      required: true,
      index: true,
    },
    passengerId: { type: String, required: true, index: true },
    driverId: { type: String, required: true, index: true },
    seatNumbers: [{ type: Number, required: true }],
    customRequest: String,
    approvalStatus: {
      type: String,
      enum: [
        'auto_accepted',
        'pending_approval',
        'pending_passenger',
        'approved',
        'confirmed',
        'rejected',
        'cancelled',
        'expired',
        'locked',
      ],
      default: 'pending_approval',
      index: true,
    },
    approvalRequestedAt: { type: Date, default: Date.now, index: true },
    approvedAt: Date,
    approvedBy: String,
    rejectedAt: Date,
    rejectionReason: String,
    approvalNotes: String,
    seatLockExpiry: Date,
    userDetails: {
      name: String,
      phone: String,
      rating: Number,
      avatar: String,
    },
    from: String,
    to: String,
    fare: Number,
    departureTime: Date,
    paymentId: String,
    paymentMethod: String,
    paymentStatus: String,
    paymentCompletedAt: Date,
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Indexes for booking queries
rideBookingSchema.index({ rideId: 1, approvalStatus: 1 });
rideBookingSchema.index({ passengerId: 1, approvalStatus: 1 });
rideBookingSchema.index({ driverId: 1, approvalStatus: 1 });
rideBookingSchema.index({ approvalRequestedAt: 1, approvalStatus: 1 });
rideBookingSchema.index({ paymentId: 1 }, { sparse: true });
rideBookingSchema.index({ driverId: 1, approvalStatus: 1, createdAt: -1 });
rideBookingSchema.index({ passengerId: 1, approvalStatus: 1, createdAt: -1 });

export const RideBooking = mongoose.model('RideBooking', rideBookingSchema);

// ==================== CHAT MODELS ====================

// Conversation Schema
const conversationSchema = new Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    participants: [{ type: String, required: true, index: true }], // Array of clerkIds
    driverId: { type: String, required: true, index: true },
    passengerId: { type: String, required: true, index: true },
    lastMessage: String,
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

conversationSchema.index({ rideId: 1, participants: 1 });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);

// Message Schema
const messageSchema = new Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Conversation',
      index: true,
    },
    senderId: { type: String, required: true, index: true },
    senderName: String,
    messageText: { type: String, required: true },
    messageType: { type: String, enum: ['text', 'system'], default: 'text' },
    readBy: [{ type: String }], // Array of clerkIds who have read this message
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, sentAt: 1 });
messageSchema.index({ conversationId: 1, readBy: 1 });

export const Message = mongoose.model('Message', messageSchema);

// ==================== RATING MODEL ====================

// Rating Schema - For rating drivers and passengers after rides
const ratingSchema = new Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RideOffer',
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RideBooking',
      index: true,
    },
    raterId: { type: String, required: true, index: true }, // Person giving the rating
    ratedId: { type: String, required: true, index: true }, // Person being rated
    raterRole: {
      type: String,
      enum: ['driver', 'passenger'],
      required: true,
    },
    ratedRole: {
      type: String,
      enum: ['driver', 'passenger'],
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: String,
    tags: [String], // e.g., ['punctual', 'friendly', 'safe_driver']
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

// Prevent duplicate ratings for same ride
ratingSchema.index({ rideId: 1, raterId: 1, ratedId: 1 }, { unique: true });
ratingSchema.index({ ratedId: 1, ratedRole: 1, createdAt: -1 });

export const Rating = mongoose.model('Rating', ratingSchema);
