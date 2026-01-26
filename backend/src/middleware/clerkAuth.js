import { clerkMiddleware, requireAuth } from '@clerk/express';

// Initialize Clerk middleware with secret key from environment
export const clerkAuth = clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
});

// Middleware to require authentication
export const requireClerkAuth = requireAuth({
  signInUrl: '/api/auth/signin',
  unauthorizedUrl: '/api/auth/unauthorized',
});

// Optional: Custom middleware to extract and validate userId
export const validateClerkUser = (req, res, next) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid authentication required',
        code: 'NO_AUTH_USER',
      });
    }

    // Attach userId to request for easy access
    req.clerkUserId = userId;
    next();
  } catch (error) {
    console.error('❌ Clerk auth validation error:', error);
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to validate user credentials',
      code: 'AUTH_VALIDATION_ERROR',
    });
  }
};
