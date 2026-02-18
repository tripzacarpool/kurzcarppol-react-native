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
import { setSocketIO as setOfferSocketIO } from './controllers/rideOfferController.js';
import { setSocketIO as setPickupSocketIO } from './controllers/rideOfferPickupController.js';
import { setChatSocketIO } from './controllers/chatController.js';
import { setApprovalSocketIO } from './controllers/approvalController.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ridePartnerRoutes from './routes/ridePartnerRoutes.js';
import rideRoutes from './routes/rideRoutes.js';
import rideOfferRoutes from './routes/rideOfferRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import mapsProxyRoutes from './routes/mapsProxyRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import { startDepartureNotificationService } from './services/departureNotificationService.js';
import { startApprovalBackgroundTasks } from './services/approvalService.js';

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
      // Local development IPs (uncomment as needed):
      // 'http://192.168.29.161:5000',
      // 'http://10.0.2.2:5000',
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

// Initialize database connection with a small delay to ensure readiness
(async () => {
  try {
    console.log('🔄 Connecting to database...');
    await connectToDatabase();

    // Small delay to ensure MongoDB connection is fully ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    dbReady = true;
    console.log('✅ Database ready and routes are live');

    // Start background tasks
    startBackgroundTasks();
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
app.use('/api/ride-offers', rideOfferRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/maps', mapsProxyRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api', approvalRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'RaahEasy Backend API',
    version: '1.0.0',
    environment: NODE_ENV,
    status: 'running',
    database: dbReady ? 'connected' : 'disconnected',
    endpoints: {
      health: '/health',
      users: '/api/users',
      payments: '/api/payments',
      ridePartners: '/api/ride-partners',
      rides: '/api/rides',
      rideOffers: '/api/ride-offers',
      notifications: '/api/notifications',
      chat: '/api/chat',
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
setOfferSocketIO(io);
setPickupSocketIO(io);
setChatSocketIO(io);
setApprovalSocketIO(io);

// Export io instance for use in controllers
export { io };

// Background task to check for expiring rides every 5 minutes
let expiringRidesInterval;
let cleanupInterval;

async function checkExpiringRidesTask() {
  try {
    const { checkExpiringRides } =
      await import('./controllers/rideOfferController.js');
    // Create a mock req/res for the controller function
    const mockReq = {};
    const mockRes = {
      status: () => mockRes,
      json: (data) => {
        console.log(
          `📊 Expiring rides check: ${data.notificationsSent || 0} notifications sent`,
        );
        return mockRes;
      },
    };
    const mockNext = (error) => {
      if (error) console.error('❌ Error in expiring rides task:', error);
    };
    await checkExpiringRides(mockReq, mockRes, mockNext);
  } catch (error) {
    console.error('❌ Expiring rides task failed:', error);
  }
}

// Background task to cleanup expired rides
async function cleanupExpiredRidesTask() {
  try {
    console.log('🧹 Running automatic cleanup of expired rides...');

    // Cleanup expired ride requests
    const { cleanupExpiredRides } =
      await import('./controllers/rideController.js');
    const mockReq1 = {};
    const mockRes1 = {
      status: () => mockRes1,
      json: (data) => {
        if (data.cancelledCount > 0 || data.completedCount > 0) {
          console.log(
            `🗑️ Ride Requests: ${data.cancelledCount} cancelled, ${data.completedCount} auto-completed`,
          );
        }
        return mockRes1;
      },
    };
    const mockNext1 = (error) => {
      if (error)
        console.error('❌ Error cleaning expired ride requests:', error);
    };
    await cleanupExpiredRides(mockReq1, mockRes1, mockNext1);

    // Cleanup expired ride offers
    const { cleanupExpiredRideOffers } =
      await import('./controllers/rideOfferController.js');
    const mockReq2 = {};
    const mockRes2 = {
      status: () => mockRes2,
      json: (data) => {
        if (data.cancelledCount > 0 || data.completedCount > 0) {
          console.log(
            `🗑️ Ride Offers: ${data.cancelledCount} cancelled, ${data.completedCount} auto-completed`,
          );
        }
        return mockRes2;
      },
    };
    const mockNext2 = (error) => {
      if (error) console.error('❌ Error cleaning expired ride offers:', error);
    };
    await cleanupExpiredRideOffers(mockReq2, mockRes2, mockNext2);
  } catch (error) {
    console.error('❌ Cleanup task failed:', error);
  }
}

// Start the background task when database is ready
function startBackgroundTasks() {
  // Check for expiring rides every 5 minutes
  expiringRidesInterval = setInterval(checkExpiringRidesTask, 5 * 60 * 1000);
  console.log(
    '⏰ Background task started: Checking for expiring rides every 5 minutes',
  );

  // Cleanup expired rides every 10 minutes
  cleanupInterval = setInterval(cleanupExpiredRidesTask, 10 * 60 * 1000);
  console.log(
    '🧹 Background task started: Cleaning up expired rides every 10 minutes',
  );

  // Start departure notification service (checks every minute)
  startDepartureNotificationService();
  console.log(
    '🔔 Background task started: Checking for upcoming departures every minute',
  );

  // Start approval system background tasks
  startApprovalBackgroundTasks();

  // Run immediately on startup
  setTimeout(checkExpiringRidesTask, 5000); // Wait 5 seconds after startup
  setTimeout(cleanupExpiredRidesTask, 8000); // Wait 8 seconds after startup
}
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down background tasks...');
  if (expiringRidesInterval) clearInterval(expiringRidesInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down background tasks...');
  if (expiringRidesInterval) clearInterval(expiringRidesInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
  process.exit(0);
});

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 RaahEasy Backend Server`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  // console.log(`🌐 Network: http://192.168.29.161:${PORT}`); // Add your local IP here
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
  console.log(`   - POST /api/payments/wallet-payment`);
  console.log(`   - POST /api/payments/wallet-recharge`);
  console.log(`   - GET  /api/payments/wallet-balance/:userId`);
  console.log(`\n🔗 CORS Enabled for:`);
  allowedOrigins.forEach((origin) => console.log(`   - ${origin}`));
  console.log(`${'='.repeat(60)}\n`);
});

export default app;
