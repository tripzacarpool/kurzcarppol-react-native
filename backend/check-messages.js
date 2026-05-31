// Check for messages collection and search
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

async function checkMessages() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(env.mongodbUri, connectOptions);
    console.log(
      '✅ Connected to database:',
      mongoose.connection.db.databaseName,
    );

    const db = mongoose.connection.db;

    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📦 Collections:', collections.map((c) => c.name).join(', '));

    // Check if messages collection exists
    const hasMessages = collections.some((c) => c.name === 'messages');
    const hasConversations = collections.some(
      (c) => c.name === 'conversations',
    );

    console.log(`\n🔍 messages collection exists: ${hasMessages}`);
    console.log(`🔍 conversations collection exists: ${hasConversations}`);

    if (hasMessages) {
      const messagesCount = await db.collection('messages').countDocuments();
      console.log(`📨 Total messages: ${messagesCount}`);

      if (messagesCount > 0) {
        const recentMessages = await db
          .collection('messages')
          .find({})
          .sort({ sentAt: -1 })
          .limit(5)
          .toArray();

        console.log('\n📝 Recent messages:');
        recentMessages.forEach((msg, i) => {
          console.log(`\n${i + 1}. Message ID: ${msg._id}`);
          console.log(`   ConversationID: ${msg.conversationId}`);
          console.log(`   From: ${msg.senderId}`);
          console.log(`   Text: "${msg.messageText}"`);
          console.log(`   Sent: ${msg.sentAt}`);
        });
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMessages();
