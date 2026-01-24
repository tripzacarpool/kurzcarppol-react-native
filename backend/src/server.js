import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (backend root)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import connectToDatabase from './config/database.js';
import {
  errorHandler,
  notFound,
  requestLogger,
  corsMiddleware,
} from './middleware/errorHandler.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import ridePartnerRoutes from './routes/ridePartnerRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(requestLogger);
app.use(cors());
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    endpoints: {
      health: '/health',
      users: '/api/users',
    },
  });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Backend running on http://0.0.0.0:${PORT}`);
  console.log(`\n📝 Available Endpoints:`);
  console.log(`   - GET  /health`);
  console.log(`   - POST /api/users/sync`);
  console.log(`   - GET  /api/users/:clerkId`);
  console.log(`   - PATCH /api/users/:clerkId/role`);
  console.log(`   - POST /api/ride-partners/apply`);
  console.log(`\n`);
});

export default app;
