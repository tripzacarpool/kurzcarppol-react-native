// Error Handler Middleware
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  // Validation Error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  // Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      error: `${field} already exists`,
    });
  }

  // Cast Error
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID format',
    });
  }

  // Default Error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
};

// Not Found Middleware
export const notFound = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
};

// Request Logging Middleware
export const requestLogger = (req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
};

// CORS Middleware
export const corsMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  next();
};
