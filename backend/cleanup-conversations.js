// Quick script to cleanup broken conversations directly from MongoDB
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/kruzapp';

async function cleanup() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');

    // Find broken conversations (participant IDs that don't start with "user_")
    console.log('🔍 Searching for broken conversations...');
    const brokenConversations = await conversationsCollection
      .find({
        $or: [
          { participants: { $regex: /^(?!user_).*@.*/ } },
          { driverId: { $regex: /^(?!user_).*@.*/ } },
          { passengerId: { $regex: /^(?!user_).*@.*/ } },
        ],
      })
      .toArray();

    console.log(`📋 Found ${brokenConversations.length} broken conversations`);

    if (brokenConversations.length > 0) {
      const conversationIds = brokenConversations.map((c) => c._id);

      // Log what we're deleting
      brokenConversations.forEach((conv) => {
        console.log(
          `   - Conversation ${conv._id}: driverId="${conv.driverId}", passengerId="${conv.passengerId}"`,
        );
      });

      // Delete messages
      const messagesResult = await messagesCollection.deleteMany({
        conversationId: { $in: conversationIds },
      });
      console.log(`🗑️  Deleted ${messagesResult.deletedCount} messages`);

      // Delete conversations
      const convsResult = await conversationsCollection.deleteMany({
        _id: { $in: conversationIds },
      });
      console.log(`🗑️  Deleted ${convsResult.deletedCount} conversations`);

      console.log('✅ Cleanup complete!');
    } else {
      console.log('✅ No broken conversations found');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
