// Delete conversations with broken participant IDs from kruzapp database
import mongoose from 'mongoose';
import './src/loadEnv.js';
import { env } from './src/config/env.js';

const connectOptions = {
  dbName: env.mongodbDb,
  maxPoolSize: env.mongodbMaxPoolSize,
  minPoolSize: env.mongodbMinPoolSize,
  serverSelectionTimeoutMS: env.mongodbServerSelectionTimeoutMs,
  socketTimeoutMS: env.mongodbSocketTimeoutMs,
};

async function deleteBrokenConversations() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('   Database:', env.mongodbDb);

    await mongoose.connect(env.mongodbUri, connectOptions);

    console.log('✅ Connected to database:', mongoose.connection.name);

    const db = mongoose.connection.db;
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');

    // List current conversations
    const allConversations = await conversationsCollection.find({}).toArray();
    console.log(`\n📋 Total conversations: ${allConversations.length}\n`);

    if (allConversations.length > 0) {
      console.log('Current conversations:');
      allConversations.forEach((conv, i) => {
        console.log(`${i + 1}. ID: ${conv._id}`);
        console.log(`   driverId: "${conv.driverId}"`);
        console.log(`   passengerId: "${conv.passengerId}"`);
        console.log(
          `   participants: [${conv.participants.map((p) => `"${p}"`).join(', ')}]\n`,
        );
      });
    }

    // Find and delete broken conversations (IDs not starting with "user_")
    const brokenConversations = await conversationsCollection
      .find({
        $or: [
          { driverId: { $not: /^user_/ } },
          { passengerId: { $not: /^user_/ } },
        ],
      })
      .toArray();

    if (brokenConversations.length === 0) {
      console.log('✅ No broken conversations found!');
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    console.log(
      `\n🗑️  Found ${brokenConversations.length} broken conversations to delete:\n`,
    );

    const conversationIds = brokenConversations.map((c) => c._id);

    // Delete messages first
    const messagesResult = await messagesCollection.deleteMany({
      conversationId: { $in: conversationIds },
    });
    console.log(`   Deleted ${messagesResult.deletedCount} messages`);

    // Delete conversations
    const convsResult = await conversationsCollection.deleteMany({
      _id: { $in: conversationIds },
    });
    console.log(`   Deleted ${convsResult.deletedCount} conversations`);

    console.log(
      '\n✅ Cleanup complete! Old conversations with broken IDs have been removed.',
    );
    console.log(
      '💡 Now create a NEW conversation and it will use correct Clerk user IDs.\n',
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteBrokenConversations();
