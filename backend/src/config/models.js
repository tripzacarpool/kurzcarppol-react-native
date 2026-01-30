import mongoose, { Schema } from 'mongoose';

const sectionStatusEnum = ['pending', 'submitted', 'approved', 'rejected'];
const ridePartnerStatusEnum = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
];

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
    basicProfile: withVerificationMeta({
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      profilePhotoUrl: String,
    }),
    vehicleDetails: withVerificationMeta({
      carModel: { type: String, required: true },
      vehicleNumber: { type: String, required: true },
      vehiclePhotoUrl: String,
    }),
    licenseDetails: withVerificationMeta({
      licenseNumber: { type: String, required: true },
      licensePhotoUrl: String,
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
        timestamp: { type: Date, default: Date.now },
        transactionId: String,
      },
    ],
    phone: { type: String, sparse: true },
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
  },
  { timestamps: true },
);

// Indexes for performance
userProfileSchema.index({ role: 1, createdAt: -1 });
userProfileSchema.index({ email: 1, clerkId: 1 });

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
      enum: ['two_wheeler', 'four_wheeler'],
      default: 'four_wheeler',
    },
    notes: String,
    womenOnly: { type: Boolean, default: false },
    pickupLatitude: Number,
    pickupLongitude: Number,
    pickupCity: String,
    pickupCountry: String,
    offeredByDriver: { type: Boolean, default: false },
    fare: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['waiting', 'accepted', 'ongoing', 'completed', 'cancelled'],
      default: 'waiting',
      index: true,
    },
    acceptedBy: {
      userId: mongoose.Schema.Types.ObjectId,
      clerkId: String,
      driverName: String,
      driverRating: Number,
    },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true },
);

// Indexes for ride queries
rideRequestSchema.index({ status: 1, createdAt: -1 });
rideRequestSchema.index({ userId: 1, createdAt: -1 });
rideRequestSchema.index({ clerkId: 1, createdAt: -1 });

export const RideRequest = mongoose.model('RideRequest', rideRequestSchema);
