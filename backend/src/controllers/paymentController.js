import {
  createRazorpayOrder,
  creditWallet,
  debitWallet,
  getWalletSnapshot,
  verifyRazorpayPayment,
} from '../services/paymentWalletService.js';

const getIdempotencyKey = (req) =>
  req.get('Idempotency-Key') || req.body.idempotencyKey;

export const createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', userId, bookingDetails } = req.body;

    if (!amount || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'amount and userId are required',
        requestId: req.requestId,
      });
    }

    const order = await createRazorpayOrder({
      amount,
      currency,
      userId,
      bookingDetails,
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'orderId, paymentId, and signature are required',
        requestId: req.requestId,
      });
    }

    const verified = await verifyRazorpayPayment({
      orderId,
      paymentId,
      signature,
    });

    if (!verified) {
      return res.status(400).json({
        verified: false,
        error: 'Invalid signature',
        requestId: req.requestId,
      });
    }

    return res.status(200).json({
      verified: true,
      paymentId,
      orderId,
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return next(error);
  }
};

export const getWalletBalance = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const snapshot = await getWalletSnapshot(userId);

    if (!snapshot) {
      return res.status(404).json({
        error: 'User not found',
        requestId: req.requestId,
      });
    }

    return res.status(200).json({
      balance: snapshot.balance,
      userId,
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    return next(error);
  }
};

export const getWalletTransactions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;
    const snapshot = await getWalletSnapshot(userId);

    if (!snapshot) {
      return res.status(404).json({
        error: 'User not found',
        requestId: req.requestId,
      });
    }

    const transactions = snapshot.transactions
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit, 10));

    return res.status(200).json({
      transactions,
      count: transactions.length,
      totalTransactions: snapshot.transactions.length,
    });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    return next(error);
  }
};

export const processWalletPayment = async (req, res, next) => {
  try {
    const { userId, amount, bookingDetails } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'userId and amount are required',
        requestId: req.requestId,
      });
    }

    const result = await debitWallet({
      userId,
      amount,
      bookingDetails,
      idempotencyKey: getIdempotencyKey(req),
    });

    return res.status(200).json({
      success: true,
      transactionId: result.transaction.transactionId,
      newBalance: result.newBalance,
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error.status === 400 && error.details) {
      return res.status(400).json({
        error: error.message,
        ...error.details,
        requestId: req.requestId,
      });
    }

    if (error.status === 404) {
      return res.status(404).json({
        error: error.message,
        requestId: req.requestId,
      });
    }

    console.error('Wallet payment error:', error);
    return next(error);
  }
};

export const walletRecharge = async (req, res, next) => {
  try {
    const { userId, amount, paymentId, orderId } = req.body;

    if (!userId || !amount || !paymentId) {
      return res.status(400).json({
        error: 'Missing required fields',
        requestId: req.requestId,
      });
    }

    const result = await creditWallet({
      userId,
      amount,
      paymentId,
      orderId,
      idempotencyKey: getIdempotencyKey(req),
    });

    return res.status(200).json({
      success: true,
      transactionId: result.transaction.transactionId,
      newBalance: result.newBalance,
      idempotent: result.idempotent,
    });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({
        error: error.message,
        requestId: req.requestId,
      });
    }

    console.error('Wallet recharge error:', error);
    return next(error);
  }
};
