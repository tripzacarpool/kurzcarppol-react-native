import { getAuth } from '@clerk/express';
import { UserProfile } from '../models/userProfile.model.js';

const readPath = (source, path) =>
  path.split('.').reduce((value, segment) => value?.[segment], source);

export const requireSelfOrRole =
  ({ userIdSources = ['params.userId', 'body.userId'], roles = ['admin'] } = {}) =>
  async (req, res, next) => {
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

      const targetUserId = userIdSources
        .map((source) => {
          const [root, ...segments] = source.split('.');
          return readPath(req[root], segments.join('.'));
        })
        .find(Boolean);

      if (targetUserId && targetUserId === clerkId) {
        return next();
      }

      const user = await UserProfile.findOne({ clerkId }).select('role');
      if (user && roles.includes(user.role)) {
        req.currentUser = user;
        return next();
      }

      return res.status(403).json({
        error: 'Forbidden',
        code: 'NOT_RESOURCE_OWNER',
        requestId: req.requestId,
      });
    } catch (error) {
      return next(error);
    }
  };
