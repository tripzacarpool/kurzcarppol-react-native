import mongoose from 'mongoose';

// Check if database connection is established
export const checkDatabaseConnection = async () => {
  try {
    const mongoState = mongoose.connection.readyState;
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    return mongoState === 1;
  } catch (error) {
    return false;
  }
};

// Validate email format
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate Clerk ID format
export const validateClerkId = (clerkId) => {
  // Clerk IDs are typically alphanumeric with underscores
  return clerkId && typeof clerkId === 'string' && clerkId.length > 0;
};

// Sanitize input
export const sanitizeUser = (data) => {
  return {
    clerkId: String(data.clerkId || '').trim(),
    email: String(data.email || '')
      .trim()
      .toLowerCase(),
    firstName: String(data.firstName || '').trim(),
    lastName: String(data.lastName || '').trim(),
    profileImage: String(data.profileImage || '').trim(),
  };
};

// Format user response
export const formatUserResponse = (user) => {
  return {
    id: user._id,
    clerkId: user.clerkId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    ridePartnerProfile: user.ridePartnerProfile || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
