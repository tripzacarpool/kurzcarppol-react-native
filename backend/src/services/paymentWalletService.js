import crypto from 'crypto';
import Razorpay from 'razorpay';
import { UserProfile } from '../models/userProfile.model.js';
import { env } from '../config/env.js';
import { publishEvent } from '../shared/events/eventBus.js';
import { EventTypes } from '../shared/events/eventTypes.js';

class PaymentWalletError extends Error {
  constructor(message, { status = 500, code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const assertRazorpayConfig = () => {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new PaymentWalletError('Razorpay credentials are not configured', {
      code: 'RAZORPAY_CONFIG_MISSING',
      details: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment',
    });
  }
};

const createRazorpayClient = () => {
  assertRazorpayConfig();
  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  });
};

export async function createRazorpayOrder({
  amount,
  currency = 'INR',
  userId,
  bookingDetails,
}) {
  const order = await createRazorpayClient().orders.create({
    amount,
    currency,
    receipt: `receipt_${Date.now()}`,
    notes: {
      userId,
      bookingDetails: JSON.stringify(bookingDetails),
    },
  });

  await publishEvent(EventTypes.PaymentOrderCreated, {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    userId,
  });

  return order;
}

export async function verifyRazorpayPayment({ orderId, paymentId, signature }) {
  assertRazorpayConfig();

  const generatedSignature = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const verified = generatedSignature === signature;

  if (verified) {
    await publishEvent(EventTypes.PaymentVerified, {
      paymentId,
      orderId,
    });
  }

  return verified;
}

export async function getWalletSnapshot(userId) {
  const user = await UserProfile.findOne({ clerkId: userId });
  if (!user) return null;

  return {
    user,
    balance: user.walletBalance || 0,
    transactions: user.walletTransactions || [],
  };
}

const getExistingWalletTransaction = (user, predicate) => {
  const transactions = user?.walletTransactions || [];
  return transactions.find(predicate);
};

const fetchWalletUser = (userId) =>
  UserProfile.findOne({ clerkId: userId }).select(
    'walletBalance walletTransactions',
  );

export async function debitWallet({
  userId,
  amount,
  bookingDetails,
  idempotencyKey,
}) {
  const user = await fetchWalletUser(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const existingTransaction = idempotencyKey
    ? getExistingWalletTransaction(
        user,
        (transaction) => transaction.idempotencyKey === idempotencyKey,
      )
    : null;

  if (existingTransaction) {
    return {
      transaction: existingTransaction,
      newBalance: user.walletBalance || 0,
      idempotent: true,
    };
  }

  const transaction = {
    type: 'debit',
    amount,
    description: 'Ride booking payment',
    bookingDetails,
    timestamp: new Date(),
    transactionId: `txn_${crypto.randomUUID()}`,
    idempotencyKey,
  };

  const duplicateGuards = idempotencyKey
    ? [{ 'walletTransactions.idempotencyKey': { $ne: idempotencyKey } }]
    : [];
  const updatedUser = await UserProfile.findOneAndUpdate(
    {
      $and: [
        { clerkId: userId },
        { walletBalance: { $gte: amount } },
        ...duplicateGuards,
      ],
    },
    {
      $inc: { walletBalance: -amount },
      $push: { walletTransactions: transaction },
    },
    { new: true },
  ).select('walletBalance walletTransactions');

  if (!updatedUser) {
    const latestUser = await fetchWalletUser(userId);
    const latestTransaction = idempotencyKey
      ? getExistingWalletTransaction(
          latestUser,
          (item) => item.idempotencyKey === idempotencyKey,
        )
      : null;

    if (latestTransaction) {
      return {
        transaction: latestTransaction,
        newBalance: latestUser.walletBalance || 0,
        idempotent: true,
      };
    }

    const error = new Error('Insufficient wallet balance');
    error.status = 400;
    error.details = {
      balance: latestUser?.walletBalance || 0,
      required: amount,
    };
    throw error;
  }

  transaction.balance = updatedUser.walletBalance;
  await UserProfile.updateOne(
    {
      clerkId: userId,
      'walletTransactions.transactionId': transaction.transactionId,
    },
    {
      $set: {
        'walletTransactions.$.balance': transaction.balance,
      },
    },
  );

  await publishEvent(EventTypes.WalletDebited, {
    userId,
    amount,
    balance: updatedUser.walletBalance,
    transactionId: transaction.transactionId,
    bookingDetails,
  });

  return {
    transaction,
    newBalance: updatedUser.walletBalance,
    idempotent: false,
  };
}

export async function creditWallet({
  userId,
  amount,
  paymentId,
  orderId,
  idempotencyKey,
}) {
  const user = await fetchWalletUser(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const transactionKey = idempotencyKey || paymentId;
  const existingTransaction = transactionKey
    ? getExistingWalletTransaction(
        user,
        (transaction) =>
          transaction.idempotencyKey === transactionKey ||
          transaction.paymentId === paymentId,
      )
    : null;

  if (existingTransaction) {
    return {
      transaction: existingTransaction,
      newBalance: user.walletBalance || 0,
      idempotent: true,
    };
  }

  const transaction = {
    type: 'credit',
    amount,
    description: 'Wallet recharge',
    paymentId,
    orderId,
    timestamp: new Date(),
    transactionId: `txn_${crypto.randomUUID()}`,
    idempotencyKey: transactionKey,
  };

  const duplicateGuards = [
    ...(transactionKey
      ? [{ 'walletTransactions.idempotencyKey': { $ne: transactionKey } }]
      : []),
    ...(paymentId ? [{ 'walletTransactions.paymentId': { $ne: paymentId } }] : []),
  ];
  const updatedUser = await UserProfile.findOneAndUpdate(
    {
      $and: [{ clerkId: userId }, ...duplicateGuards],
    },
    {
      $inc: { walletBalance: amount },
      $push: { walletTransactions: transaction },
    },
    { new: true },
  ).select('walletBalance walletTransactions');

  if (!updatedUser) {
    const latestUser = await fetchWalletUser(userId);
    const latestTransaction = getExistingWalletTransaction(
      latestUser,
      (item) =>
        item.idempotencyKey === transactionKey || item.paymentId === paymentId,
    );

    if (latestTransaction) {
      return {
        transaction: latestTransaction,
        newBalance: latestUser.walletBalance || 0,
        idempotent: true,
      };
    }

    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  transaction.balance = updatedUser.walletBalance;
  await UserProfile.updateOne(
    {
      clerkId: userId,
      'walletTransactions.transactionId': transaction.transactionId,
    },
    {
      $set: {
        'walletTransactions.$.balance': transaction.balance,
      },
    },
  );

  await publishEvent(EventTypes.WalletCredited, {
    userId,
    amount,
    balance: updatedUser.walletBalance,
    transactionId: transaction.transactionId,
    paymentId,
    orderId,
  });

  return {
    transaction,
    newBalance: updatedUser.walletBalance,
    idempotent: false,
  };
}
