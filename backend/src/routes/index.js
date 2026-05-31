import { createHealthRoutes } from './healthRoutes.js';
import userRoutes from './userRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import ridePartnerRoutes from './ridePartnerRoutes.js';
import rideRoutes from './rideRoutes.js';
import rideOfferRoutes from './rideOfferRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import chatRoutes from './chatRoutes.js';
import mapsProxyRoutes from './mapsProxyRoutes.js';
import approvalRoutes from './approvalRoutes.js';
import ratingRoutes from './ratingRoutes.js';

export function registerRoutes(app, context = {}) {
  const {
    getDatabaseStatus = () => 'unknown',
    getDependencyStatus = async () => ({}),
    nodeEnv = 'development',
  } = context;

  app.use(
    '/health',
    createHealthRoutes({ getDatabaseStatus, getDependencyStatus, nodeEnv }),
  );
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

  app.get('/', (req, res) => {
    res.json({
      message: 'RaahEasy Backend API',
      version: '1.0.0',
      environment: nodeEnv,
      status: 'running',
      database: getDatabaseStatus(),
      services: {
        users: '/api/users',
        payments: '/api/payments',
        ridePartners: '/api/ride-partners',
        rides: '/api/rides',
        rideOffers: '/api/ride-offers',
        notifications: '/api/notifications',
        chat: '/api/chat',
        maps: '/api/maps',
        ratings: '/api/ratings',
        health: '/health',
      },
      timestamp: new Date().toISOString(),
    });
  });
}
