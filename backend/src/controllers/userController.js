import { UserProfile } from '../config/models.js';
import {
  checkDatabaseConnection,
  validateEmail,
  validateClerkId,
  sanitizeUser,
  formatUserResponse,
} from '../utils/validation.js';

/**
 * Sync user from Clerk to MongoDB
 * POST /api/users/sync
 */
export const syncUser = async (req, res, next) => {
  try {
    // 1. Check Database Connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({
        error: 'Database connection failed',
        details: 'MongoDB is not connected. Please try again later.',
        code: 'DB_CONNECTION_ERROR',
      });
    }

    // 2. Validate Request Body
    const { clerkId, email, firstName, lastName, profileImage } = req.body;

    if (!clerkId || !email) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'clerkId and email are required',
        code: 'MISSING_FIELDS',
      });
    }

    // 3. Validate Clerk ID Format
    if (!validateClerkId(clerkId)) {
      return res.status(400).json({
        error: 'Invalid Clerk ID format',
        details: 'Clerk ID must be a non-empty string',
        code: 'INVALID_CLERK_ID',
      });
    }

    // 4. Validate Email Format
    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        details: 'Please provide a valid email address',
        code: 'INVALID_EMAIL',
      });
    }

    // 5. Sanitize Input
    const sanitized = sanitizeUser({
      clerkId,
      email,
      firstName,
      lastName,
      profileImage,
    });

    // 6. Check if Email is Already Used by Another User
    const existingEmailUser = await UserProfile.findOne({
      email: sanitized.email,
      clerkId: { $ne: sanitized.clerkId },
    });

    if (existingEmailUser) {
      return res.status(400).json({
        error: 'Email already in use',
        details: `This email is associated with another user (${existingEmailUser.clerkId})`,
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // 7. Check if User Exists
    let user = await UserProfile.findOne({ clerkId: sanitized.clerkId });
    let isNewUser = !user;

    if (!user) {
      // Create new user
      try {
        user = await UserProfile.create({
          clerkId: sanitized.clerkId,
          email: sanitized.email,
          firstName: sanitized.firstName,
          lastName: sanitized.lastName,
          profileImage: sanitized.profileImage || null,
          role: 'passenger',
          isActive: true,
        });
        console.log(
          `✅ New user created: ${sanitized.email} (${sanitized.clerkId})`,
        );
      } catch (createError) {
        if (createError.code === 11000) {
          return res.status(400).json({
            error: 'User already exists',
            details: 'This Clerk ID or email is already registered',
            code: 'DUPLICATE_USER',
          });
        }
        throw createError;
      }
    } else {
      // Update existing user
      try {
        user = await UserProfile.findOneAndUpdate(
          { clerkId: sanitized.clerkId },
          {
            email: sanitized.email,
            firstName: sanitized.firstName || user.firstName,
            lastName: sanitized.lastName || user.lastName,
            profileImage: sanitized.profileImage || user.profileImage,
            isActive: true,
          },
          { new: true, runValidators: true },
        );
        console.log(
          `✅ User updated: ${sanitized.email} (${sanitized.clerkId})`,
        );
      } catch (updateError) {
        if (updateError.code === 11000) {
          return res.status(400).json({
            error: 'Email conflict',
            details: 'This email cannot be used for this account',
            code: 'EMAIL_CONFLICT',
          });
        }
        throw updateError;
      }
    }

    // 8. Return Success Response
    res.status(isNewUser ? 201 : 200).json({
      success: true,
      message: isNewUser
        ? 'User created successfully'
        : 'User updated successfully',
      action: isNewUser ? 'created' : 'updated',
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('❌ Sync error:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });

    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: Object.values(error.errors).map((e) => e.message),
        code: 'VALIDATION_ERROR',
      });
    }

    res.status(500).json({
      error: 'Failed to sync user',
      details: error.message,
      code: 'SYNC_ERROR',
    });
  }
};

/**
 * Get user profile by Clerk ID
 * GET /api/users/:clerkId
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const { clerkId } = req.params;

    // Check Database Connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({
        error: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      });
    }

    // Validate Clerk ID
    if (!validateClerkId(clerkId)) {
      return res.status(400).json({
        error: 'Invalid Clerk ID format',
        code: 'INVALID_CLERK_ID',
      });
    }

    const user = await UserProfile.findOne({ clerkId });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        details: `No user found with Clerk ID: ${clerkId}`,
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('❌ Get user error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch user',
      details: error.message,
      code: 'FETCH_ERROR',
    });
  }
};

/**
 * Update user role (admin/driver/passenger)
 * PATCH /api/users/:clerkId/role
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { clerkId } = req.params;
    const { role } = req.body;

    // Check Database Connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({
        error: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      });
    }

    // Validate Clerk ID
    if (!validateClerkId(clerkId)) {
      return res.status(400).json({
        error: 'Invalid Clerk ID format',
        code: 'INVALID_CLERK_ID',
      });
    }

    // Validate role
    const validRoles = ['passenger', 'driver', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        details: `Role must be one of: ${validRoles.join(', ')}`,
        code: 'INVALID_ROLE',
      });
    }

    const user = await UserProfile.findOneAndUpdate(
      { clerkId },
      { role },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    console.log(`✅ User role updated: ${clerkId} → ${role}`);

    res.json({
      success: true,
      message: 'Role updated successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('❌ Update role error:', error.message);
    res.status(500).json({
      error: 'Failed to update role',
      details: error.message,
      code: 'UPDATE_ERROR',
    });
  }
};

/**
 * Get user stats (total users by role)
 * GET /api/users/stats
 */
export const getUserStats = async (req, res, next) => {
  try {
    // Check Database Connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({
        error: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      });
    }

    const stats = await UserProfile.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const total = await UserProfile.countDocuments();

    res.json({
      success: true,
      stats: {
        total,
        byRole: stats,
        activeUsers: await UserProfile.countDocuments({ isActive: true }),
      },
    });
  } catch (error) {
    console.error('❌ Get stats error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch stats',
      details: error.message,
      code: 'STATS_ERROR',
    });
  }
};

/**
 * Update user location
 * PUT /api/users/location
 */
export const updateUserLocation = async (req, res, next) => {
  try {
    const { userId, latitude, longitude, city, country } = req.body;

    if (!userId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'userId, latitude, and longitude are required',
        code: 'MISSING_FIELDS',
      });
    }

    // Check Database Connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({
        error: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      });
    }

    const user = await UserProfile.findOneAndUpdate(
      { clerkId: userId },
      {
        location: {
          latitude,
          longitude,
          city: city || null,
          country: country || null,
          updatedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('❌ Location update error:', error.message);
    res.status(500).json({
      error: 'Failed to update location',
      details: error.message,
      code: 'LOCATION_UPDATE_ERROR',
    });
  }
};

/**
 * Update user IP address
 * PUT /api/users/ip
 */
export const updateUserIP = async (req, res, next) => {
  try {
    const { userId, ipAddress } = req.body;

    if (!userId || !ipAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'userId and ipAddress are required',
        code: 'MISSING_FIELDS',
      });
    }

    // Check Database Connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({
        error: 'Database connection failed',
        code: 'DB_CONNECTION_ERROR',
      });
    }

    const user = await UserProfile.findOneAndUpdate(
      { clerkId: userId },
      {
        ipAddress,
        ipUpdatedAt: new Date(),
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      message: 'IP address updated successfully',
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('❌ IP update error:', error.message);
    res.status(500).json({
      error: 'Failed to update IP address',
      details: error.message,
      code: 'IP_UPDATE_ERROR',
    });
  }
};

/**
 * Logout user - Invalidate session on backend
 * POST /api/users/logout
 */
export const logoutUser = async (req, res, next) => {
  try {
    const { clerkId } = req.body;

    if (!clerkId) {
      return res.status(400).json({
        error: 'Missing required field',
        details: 'clerkId is required',
        code: 'MISSING_CLERK_ID',
      });
    }

    if (!validateClerkId(clerkId)) {
      return res.status(400).json({
        error: 'Invalid Clerk ID format',
        details: 'Clerk ID must be a non-empty string',
        code: 'INVALID_CLERK_ID',
      });
    }

    console.log(`🚪 Processing logout for user: ${clerkId}`);

    // Check Database Connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.warn(
        '⚠️ Database not connected, but logout proceeding (user will be logged out on client)',
      );
      // Don't fail logout if DB is down - client-side logout is still important
      return res.status(200).json({
        success: true,
        message: 'Logout processed (database unavailable)',
        code: 'LOGOUT_NO_DB',
      });
    }

    // Find user
    const user = await UserProfile.findOne({ clerkId });
    if (!user) {
      console.log(`ℹ️ User not found in database: ${clerkId}`);
      return res.status(200).json({
        success: true,
        message: 'User not found, but logout processed',
        code: 'USER_NOT_FOUND',
      });
    }

    // Update user status if tracking active sessions
    // You can add logic here to track last_logout, active_sessions, etc.
    user.lastLogout = new Date();
    await user.save();

    console.log(`✅ Logout successful for user: ${clerkId}`);
    res.status(200).json({
      success: true,
      message: 'User logged out successfully',
      clerkId,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    next(error);
  }
};
