// Delete ALL conversations and messages from the database
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

async function deleteAllConversations() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('   Database:', env.mongodbDb);

    await mongoose.connect(env.mongodbUri, connectOptions);

    console.log('✅ Connected to database:', mongoose.connection.name);

    const db = mongoose.connection.db;
    const conversationsCollection = db.collection('conversations');
    const messagesCollection = db.collection('messages');

    // Count current conversations and messages
    const conversationCount = await conversationsCollection.countDocuments();
    const messageCount = await messagesCollection.countDocuments();

    console.log(`\n📋 Current state:`);
    console.log(`   Conversations: ${conversationCount}`);
    console.log(`   Messages: ${messageCount}`);

    if (conversationCount === 0 && messageCount === 0) {
      console.log('\n✅ Database is already clean!');
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    // Delete ALL messages
    console.log(`\n🗑️  Deleting all messages...`);
    const messagesResult = await messagesCollection.deleteMany({});
    console.log(`   ✅ Deleted ${messagesResult.deletedCount} messages`);

    // Delete ALL conversations
    console.log(`🗑️  Deleting all conversations...`);
    const convsResult = await conversationsCollection.deleteMany({});
    console.log(`   ✅ Deleted ${convsResult.deletedCount} conversations`);

    console.log(
      '\n✅ Cleanup complete! All conversations and messages removed.',
    );
    console.log(
      '💡 Now test with fresh ride data and chat should work correctly.\n',
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteAllConversations();
