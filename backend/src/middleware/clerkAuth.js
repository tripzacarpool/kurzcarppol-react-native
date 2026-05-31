import { clerkMiddleware, getAuth } from '@clerk/express';

export const clerkAuth = clerkMiddleware();

export const getClerkUserId = (req) => {
  try {
    const authUserId = getAuth(req)?.userId;
    if (authUserId) return authUserId;

    if (typeof req.auth === 'function') {
      return req.auth()?.userId || null;
    }

    return req.auth?.userId || null;
  } catch (err) {
    console.error('getClerkUserId error:', err.message);
    return null;
  }
};

export const requireClerkAuth = (req, res, next) => {
  const userId = getClerkUserId(req);

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication is required',
      code: 'AUTH_REQUIRED',
      requestId: req.requestId,
    });
  }

  return next();
};
