// Quick script to update wallet balance for testing
// Usage: node update-wallet.js <clerkId or email> <amount>
// Example: node update-wallet.js user_xyz 1000
// Or: node update-wallet.js test@example.com 500

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const userProfileSchema = new mongoose.Schema(
  {
    clerkId: String,
    email: String,
    walletBalance: Number,
    walletTransactions: Array,
  },
  { timestamps: true },
);

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

async function updateWallet(identifier, amount) {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/raaheasy';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find user by clerkId or email
    const user = await UserProfile.findOne({
      $or: [{ clerkId: identifier }, { email: identifier }],
    });

    if (!user) {
      console.error('❌ User not found with identifier:', identifier);
      console.log('💡 Tip: Use clerkId or email address');
      process.exit(1);
    }

    const oldBalance = user.walletBalance || 0;
    const newBalance = parseFloat(amount);

    // Update balance
    user.walletBalance = newBalance;

    // Add transaction record
    if (!user.walletTransactions) {
      user.walletTransactions = [];
    }

    const transaction = {
      type: 'credit',
      amount: newBalance - oldBalance,
      balance: newBalance,
      description: 'Manual test wallet update',
      timestamp: new Date(),
      transactionId: `test_${Date.now()}`,
    };

    user.walletTransactions.push(transaction);
    await user.save();

    console.log('✅ Wallet updated successfully!');
    console.log('📧 Email:', user.email);
    console.log('🆔 ClerkId:', user.clerkId);
    console.log('💰 Old Balance: ₹' + oldBalance);
    console.log('💰 New Balance: ₹' + newBalance);
    console.log('📝 Transaction ID:', transaction.transactionId);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const [, , identifier, amount] = process.argv;

if (!identifier || !amount) {
  console.log('Usage: node update-wallet.js <clerkId or email> <amount>');
  console.log('Example: node update-wallet.js user_xyz 1000');
  console.log('Or: node update-wallet.js test@example.com 500');
  process.exit(1);
}

if (isNaN(amount) || parseFloat(amount) < 0) {
  console.error('❌ Amount must be a positive number');
  process.exit(1);
}

updateWallet(identifier, amount);
