import express from 'express';
import {
  createOrder,
  verifyPayment,
  getWalletBalance,
  getWalletTransactions,
  processWalletPayment,
  walletRecharge,
} from '../controllers/paymentController.js';

const router = express.Router();

// Debug route to test connectivity
router.get('/test', (req, res) => {
  res.json({ message: 'Payment routes are working!', timestamp: new Date() });
});

// POST /api/payments/create-order - Create Razorpay order
router.post('/create-order', createOrder);

// POST /api/payments/verify - Verify payment signature
router.post('/verify', verifyPayment);

// GET /api/payments/wallet-balance/:userId - Get wallet balance
router.get('/wallet-balance/:userId', getWalletBalance);

// GET /api/payments/wallet-transactions/:userId - Get wallet transactions
router.get('/wallet-transactions/:userId', getWalletTransactions);

// POST /api/payments/wallet-payment - Process wallet payment
router.post('/wallet-payment', processWalletPayment);

// POST /api/payments/wallet-recharge - Add money to wallet
router.post('/wallet-recharge', walletRecharge);

export default router;
