import express from 'express';
import { env } from './config/env.js';
import { clerkAuth } from './middleware/clerkAuth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { registerRoutes } from './routes/index.js';
import { getDependencyHealth as getDefaultDependencyHealth } from './services/dependencyHealthService.js';
import { requestContext } from './shared/http/requestContext.js';
import { requestLogger } from './shared/http/requestLogger.js';
import { metricsHandler, metricsMiddleware } from './shared/http/metrics.js';
import { securityMiddleware } from './shared/http/security.js';

export function createApp({
  getDatabaseReady = () => false,
  getDependencyHealth = getDefaultDependencyHealth,
} = {}) {
  const app = express();

  app.disable('x-powered-by');

  if (env.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(requestContext);
  app.use(metricsMiddleware);
  app.use(requestLogger);
  app.use(securityMiddleware());
  app.use(express.json({ limit: env.requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));

  app.get('/metrics', metricsHandler);

  app.use((req, res, next) => {
    if (req.path.startsWith('/health') || req.path === '/metrics') {
      return next();
    }

    return clerkAuth(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/health') || req.path === '/metrics') {
      return next();
    }

    if (!getDatabaseReady() && req.path.startsWith('/api/')) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database is still connecting. Please try again in a moment.',
        code: 'DB_NOT_READY',
      });
    }

    return next();
  });

  registerRoutes(app, {
    nodeEnv: env.nodeEnv,
    getDatabaseStatus: () => (getDatabaseReady() ? 'connected' : 'disconnected'),
    getDependencyStatus: getDependencyHealth,
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
