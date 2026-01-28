import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectToDatabase from './config/database.js';
import {
  errorHandler,
  notFound,
  requestLogger,
  corsMiddleware,
} from './middleware/errorHandler.js';
import { clerkAuth } from './middleware/clerkAuth.js';
import { setupLocationEvents } from './controllers/locationController.js';
import { setSocketIO } from './controllers/rideController.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ridePartnerRoutes from './routes/ridePartnerRoutes.js';
import rideRoutes from './routes/rideRoutes.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Socket.io setup for real-time location tracking
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Allowed origins for mobile/expo and local testing
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://192.168.0.102:5000',
      'http://10.0.2.2:5000',
    ];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Middleware
app.use(requestLogger);
app.use(cors(corsOptions));
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log Authorization header and decode JWT
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    console.log('\n' + '='.repeat(60));
    console.log(`📨 ${req.method} ${req.path}`);
    console.log(
      '🔑 Authorization header received:',
      authHeader.substring(0, 40) + '...',
    );

    // Decode the JWT to see what's in it
    try {
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        // console.log('🔐 JWT Payload (decoded):');
        // console.log(JSON.stringify(payload, null, 2));
      }
    } catch (err) {
      console.error('❌ Failed to decode token:', err.message);
    }
  } else {
    console.warn(
      '⚠️ No Authorization header in request to',
      req.method,
      req.path,
    );
  }
  next();
});

// Clerk authentication middleware (must be after body parsers)
app.use(clerkAuth);

// Connect to MongoDB and setup routes after connection
let dbReady = false;

// Middleware to check database readiness
app.use((req, res, next) => {
  // Skip DB check for health endpoint
  if (req.path.startsWith('/health')) {
    return next();
  }

  // For other routes, check if DB is ready
  if (!dbReady && req.path.startsWith('/api/')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database is still connecting. Please try again in a moment.',
      code: 'DB_NOT_READY',
    });
  }
  next();
});

// Initialize database connection
(async () => {
  try {
    await connectToDatabase();
    dbReady = true;
    console.log('✅ Database ready and routes are live');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.warn('⚠️  API running in standalone mode (no database)');
    console.warn('📝 To fix: Check MONGODB_URI credentials in backend/.env');
    dbReady = false;
  }
})();

// Routes
app.use('/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ride-partners', ridePartnerRoutes);
app.use('/api/rides', rideRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'TripZa Backend API',
    version: '1.0.0',
    environment: NODE_ENV,
    status: 'running',
    database: dbReady ? 'connected' : 'disconnected',
    endpoints: {
      health: '/health',
      users: '/api/users',
      payments: '/api/payments',
      ridePartners: '/api/ride-partners',
    },
    timestamp: new Date().toISOString(),
  });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Socket.io connection handling for real-time location tracking
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  // Setup location tracking events
  setupLocationEvents(io, socket);

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// Inject socket.io instance into ride controller
setSocketIO(io);

// Export io instance for use in controllers
export { io };

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 TripZa Backend Server`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://192.168.0.102:${PORT}`);
  console.log(`💾 Database: ${dbReady ? '✅ Connected' : '⚠️  Disconnected'}`);
  console.log(`🔌 WebSocket: ✅ Ready (real-time location tracking)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📝 Available Endpoints:`);
  console.log(`   - GET  /              (API Info)`);
  console.log(`   - GET  /health        (Health Check)`);
  console.log(`\n🔌 WebSocket Events:`);
  console.log(`   - driver:online       (Driver comes online)`);
  console.log(`   - driver:location     (Driver sends location every 2-3s)`);
  console.log(`   - driver:offline      (Driver goes offline)`);
  console.log(`   - rider:subscribe     (Rider subscribes to location)`);
  console.log(`   - rider:unsubscribe   (Rider unsubscribes)`);
  console.log(`   - ride:location-update (Rider receives location)`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`   - POST /api/users/sync`);
  console.log(`   - GET  /api/users/:clerkId`);
  console.log(`   - PATCH /api/users/:clerkId/role`);
  console.log(`   - POST /api/ride-partners/apply`);
  console.log(`   - POST /api/payments/create-order`);
  console.log(`   - POST /api/payments/verify`);
  console.log(`\n🔗 CORS Enabled for:`);
  allowedOrigins.forEach((origin) => console.log(`   - ${origin}`));
  console.log(`${'='.repeat(60)}\n`);
});

export default app;
