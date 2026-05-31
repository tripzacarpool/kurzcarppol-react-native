import express from 'express';
import {
  createOrder,
  verifyPayment,
  getWalletBalance,
  getWalletTransactions,
  processWalletPayment,
  walletRecharge,
} from '../controllers/paymentController.js';
import { requireClerkAuth } from '../middleware/clerkAuth.js';
import { requireSelfOrRole } from '../middleware/requireSelfOrRole.js';

const router = express.Router();

// Debug route to test connectivity
router.get('/test', (req, res) => {
  res.json({ message: 'Payment routes are working!', timestamp: new Date() });
});

router.use(requireClerkAuth);

// POST /api/payments/create-order - Create Razorpay order
router.post(
  '/create-order',
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  createOrder,
);

// POST /api/payments/verify - Verify payment signature
router.post('/verify', verifyPayment);

// GET /api/payments/wallet-balance/:userId - Get wallet balance
router.get(
  '/wallet-balance/:userId',
  requireSelfOrRole({ userIdSources: ['params.userId'] }),
  getWalletBalance,
);

// GET /api/payments/wallet-transactions/:userId - Get wallet transactions
router.get(
  '/wallet-transactions/:userId',
  requireSelfOrRole({ userIdSources: ['params.userId'] }),
  getWalletTransactions,
);

// POST /api/payments/wallet-payment - Process wallet payment
router.post(
  '/wallet-payment',
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  processWalletPayment,
);

// POST /api/payments/wallet-recharge - Add money to wallet
router.post(
  '/wallet-recharge',
  requireSelfOrRole({ userIdSources: ['body.userId'] }),
  walletRecharge,
);

export default router;
