import Razorpay from 'razorpay';
import crypto from 'crypto';
import { UserProfile } from '../config/models.js';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_7kAotmP1o8JR8V',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'jPBuKq2CqukA4JxOXKfp8QU7',
});

/**
 * Create Razorpay Order
 * POST /api/payments/create-order
 */
export const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', userId, bookingDetails } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'amount and userId are required',
      });
    }

    // Create Razorpay order
    const options = {
      amount: amount, // amount in paise
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId,
        bookingDetails: JSON.stringify(bookingDetails),
      },
    };

    const order = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created:', order.id);

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('❌ Create order error:', error);
    next(error);
  }
};

/**
 * Verify Payment
 * POST /api/payments/verify
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orderId, paymentId, and signature are required',
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET || 'jPBuKq2CqukA4JxOXKfp8QU7',
      )
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const verified = generatedSignature === signature;

    if (verified) {
      console.log('✅ Payment verified successfully:', paymentId);
      res.status(200).json({
        verified: true,
        paymentId,
        orderId,
      });
    } else {
      console.warn('⚠️ Payment verification failed');
      res.status(400).json({
        verified: false,
        error: 'Invalid signature',
      });
    }
  } catch (error) {
    console.error('❌ Verify payment error:', error);
    next(error);
  }
};

/**
 * Get Wallet Balance
 * GET /api/payments/wallet-balance/:userId
 */
export const getWalletBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await UserProfile.findOne({ clerkId: userId });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.status(200).json({
      balance: user.walletBalance || 0,
      userId,
    });
  } catch (error) {
    console.error('❌ Get wallet balance error:', error);
    next(error);
  }
};

/**
 * Get Wallet Transactions
 * GET /api/payments/wallet-transactions/:userId
 */
export const getWalletTransactions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const user = await UserProfile.findOne({ clerkId: userId });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    const transactions = (user.walletTransactions || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.status(200).json({
      transactions,
      count: transactions.length,
      totalTransactions: (user.walletTransactions || []).length,
    });
  } catch (error) {
    console.error('❌ Get wallet transactions error:', error);
    next(error);
  }
};

/**
 * Process Wallet Payment
 * POST /api/payments/wallet-payment
 */
export const processWalletPayment = async (req, res, next) => {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('💰 WALLET PAYMENT REQUEST');
    console.log('📨 Method:', req.method);
    console.log('📍 Path:', req.path);
    console.log('📋 Body:', JSON.stringify(req.body, null, 2));
    console.log('='.repeat(60) + '\n');

    const { userId, amount, bookingDetails } = req.body;

    if (!userId || !amount) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'userId and amount are required',
      });
    }

    console.log(`🔍 Looking for user: ${userId}`);
    const user = await UserProfile.findOne({ clerkId: userId });

    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return res.status(404).json({
        error: 'User not found',
      });
    }

    console.log(`✅ User found: ${user.email}`);
    const currentBalance = user.walletBalance || 0;
    console.log(`💰 Current balance: ₹${currentBalance}`);
    console.log(`💸 Required amount: ₹${amount}`);

    if (currentBalance < amount) {
      console.log('❌ Insufficient balance');
      return res.status(400).json({
        error: 'Insufficient wallet balance',
        balance: currentBalance,
        required: amount,
      });
    }

    // Deduct from wallet
    user.walletBalance = currentBalance - amount;

    // Add transaction record
    if (!user.walletTransactions) {
      user.walletTransactions = [];
    }

    const transaction = {
      type: 'debit',
      amount,
      balance: user.walletBalance,
      description: 'Ride booking payment',
      bookingDetails: bookingDetails,
      timestamp: new Date(),
      transactionId: `txn_${Date.now()}`,
    };

    user.walletTransactions.push(transaction);
    await user.save();

    console.log('✅ Wallet payment processed successfully!');
    console.log('🆔 Transaction ID:', transaction.transactionId);
    console.log('💰 New balance: ₹' + user.walletBalance);
    console.log('='.repeat(60) + '\n');

    res.status(200).json({
      success: true,
      transactionId: transaction.transactionId,
      newBalance: user.walletBalance,
    });
  } catch (error) {
    console.error('❌ Wallet payment error:', error);
    next(error);
  }
};

/**
 * Add Money to Wallet (after successful payment)
 * POST /api/payments/wallet-recharge
 */
export const walletRecharge = async (req, res, next) => {
  try {
    const { userId, amount, paymentId, orderId } = req.body;

    if (!userId || !amount || !paymentId) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    const user = await UserProfile.findOne({ clerkId: userId });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Add to wallet
    const currentBalance = user.walletBalance || 0;
    user.walletBalance = currentBalance + amount;

    // Add transaction record
    if (!user.walletTransactions) {
      user.walletTransactions = [];
    }

    const transaction = {
      type: 'credit',
      amount,
      balance: user.walletBalance,
      description: 'Wallet recharge',
      paymentId,
      orderId,
      timestamp: new Date(),
      transactionId: `txn_${Date.now()}`,
    };

    user.walletTransactions.push(transaction);
    await user.save();

    console.log('✅ Wallet recharged:', transaction.transactionId);

    res.status(200).json({
      success: true,
      transactionId: transaction.transactionId,
      newBalance: user.walletBalance,
    });
  } catch (error) {
    console.error('❌ Wallet recharge error:', error);
    next(error);
  }
};
