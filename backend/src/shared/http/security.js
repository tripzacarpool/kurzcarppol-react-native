import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, isDevelopment } from '../../config/env.js';

export function securityMiddleware() {
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (env.allowedOrigins.includes(origin) || isDevelopment) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 204,
    maxAge: isDevelopment ? 0 : 600,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-Id',
      'Idempotency-Key',
    ],
    exposedHeaders: [
      'X-Request-Id',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
    ],
  };

  return [
    helmet({
      crossOriginResourcePolicy: false,
    }),
    cors(corsOptions),
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMax,
      skip: (req) =>
        req.path.startsWith('/health') || req.path === '/metrics',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMITED',
          requestId: req.requestId,
        }),
    }),
  ];
}
