import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import jwt from 'jsonwebtoken';

// Initialize Clerk middleware without requiring auth globally
// This allows requests to pass through, and we validate in controllers
export const clerkAuth = clerkMiddleware();

// Helper to extract userId from Bearer token JWT's 'sub' claim
export const getClerkUserId = (req) => {
  try {
    console.log('🔍 getClerkUserId - Checking auth...');

    // First try Clerk's getAuth
    const auth = getAuth(req);
    if (auth?.userId) {
      console.log('✅ Found userId from Clerk middleware:', auth.userId);
      return auth.userId;
    }

    // Fallback: Manually decode Bearer token JWT
    const authHeader = req.headers.authorization;
    console.log('🔍 Auth header:', authHeader ? 'Present' : 'Missing');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Decode without verification (we trust Clerk's tokens)
      const decoded = jwt.decode(token);

      if (decoded?.sub) {
        console.log('✅ Found userId from JWT token:', decoded.sub);
        return decoded.sub;
      }

      console.log(
        '❌ JWT decoded but no sub claim found:',
        Object.keys(decoded || {}),
      );
    }

    console.log('❌ No userId found in request');
    return null;
  } catch (err) {
    console.error('❌ getClerkUserId error:', err.message);
    return null;
  }
};

// Middleware to require authentication
export const requireClerkAuth = requireAuth();
