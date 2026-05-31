import { getAuth } from '@clerk/express';
import { UserProfile } from '../models/userProfile.model.js';

export const requireRole = (...allowedRoles) => async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const clerkId = auth?.userId;

    if (!clerkId) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'NO_AUTH_USER',
        requestId: req.requestId,
      });
    }

    const user = await UserProfile.findOne({ clerkId }).select('clerkId role');

    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_ROLE',
        requestId: req.requestId,
      });
    }

    req.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
