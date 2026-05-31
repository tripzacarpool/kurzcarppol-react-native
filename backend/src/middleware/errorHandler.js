import { isProduction } from '../config/env.js';

const isPublicHttpError = (statusCode) => statusCode >= 400 && statusCode < 500;

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || 500;
  const requestId = req.requestId;

  console.error(
    JSON.stringify({
      type: 'request_error',
      path: req.originalUrl || req.path,
      method: req.method,
      requestId,
      statusCode,
      message: err.message,
      code: err.code,
    }),
  );

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: Object.values(err.errors).map((e) => e.message),
      requestId,
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      error: `${field} already exists`,
      requestId,
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
      requestId,
    });
  }

  return res.status(statusCode).json({
    error:
      !isProduction || isPublicHttpError(statusCode)
        ? err.message || 'Internal server error'
        : 'Internal server error',
    code: err.code,
    requestId,
  });
};

export const notFound = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    requestId: req.requestId,
  });
};
