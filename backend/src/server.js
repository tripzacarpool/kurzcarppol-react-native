import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import connectToDatabase from './config/database.js';
import {
  errorHandler,
  notFound,
  requestLogger,
  corsMiddleware,
} from './middleware/errorHandler.js';
import { clerkAuth } from './middleware/clerkAuth.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ridePartnerRoutes from './routes/ridePartnerRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Allowed origins for mobile/expo and local testing
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://192.168.0.100:5000',
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

// Clerk authentication middleware (must be after body parsers)
app.use(clerkAuth);

// Connect to MongoDB
let dbReady = false;

connectToDatabase()
  .then(() => {
    dbReady = true;
    console.log('✅ Database ready');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.warn('⚠️  API running in standalone mode (no database)');
    console.warn('📝 To fix: Check MONGODB_URI credentials in backend/.env');
  });

// Routes
app.use('/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ride-partners', ridePartnerRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'KruZ Backend API',
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

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 KruZ Backend Server`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 Environment: ${NODE_ENV}`);
  console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://192.168.0.100:${PORT}`);
  console.log(`💾 Database: ${dbReady ? '✅ Connected' : '⚠️  Disconnected'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📝 Available Endpoints:`);
  console.log(`   - GET  /              (API Info)`);
  console.log(`   - GET  /health        (Health Check)`);
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
