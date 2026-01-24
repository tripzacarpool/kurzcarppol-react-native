import express from 'express';
import {
  createOrder,
  verifyPayment,
  getWalletBalance,
  processWalletPayment,
  walletRecharge,
} from '../controllers/paymentController.js';

const router = express.Router();

// POST /api/payments/create-order - Create Razorpay order
router.post('/create-order', createOrder);

// POST /api/payments/verify - Verify payment signature
router.post('/verify', verifyPayment);

// GET /api/payments/wallet-balance/:userId - Get wallet balance
router.get('/wallet-balance/:userId', getWalletBalance);

// POST /api/payments/wallet-payment - Process wallet payment
router.post('/wallet-payment', processWalletPayment);

// POST /api/payments/wallet-recharge - Add money to wallet
router.post('/wallet-recharge', walletRecharge);

export default router;
