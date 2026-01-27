import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import jwt from 'jsonwebtoken';

// Initialize Clerk middleware
export const clerkAuth = clerkMiddleware();

// Helper to extract userId from Bearer token JWT's 'sub' claim
export const getClerkUserId = (req) => {
  try {
    const auth = getAuth(req);
    if (auth?.userId) return auth.userId;

    // Fallback: Extract from Bearer token JWT
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);
      return decoded?.sub || null;
    }
    return null;
  } catch (err) {
    return null;
  }
};

// Middleware to require authentication
export const requireClerkAuth = requireAuth();
