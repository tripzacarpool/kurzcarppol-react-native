// List all conversations in the database
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/kruzapp';

async function listConversations() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const conversationsCollection = db.collection('conversations');

    const allConversations = await conversationsCollection.find({}).toArray();

    console.log(`\n📋 Found ${allConversations.length} conversations total:\n`);

    allConversations.forEach((conv, index) => {
      console.log(`${index + 1}. Conversation ID: ${conv._id}`);
      console.log(`   - RideID: ${conv.rideId}`);
      console.log(`   - DriverID: "${conv.driverId}"`);
      console.log(`   - PassengerID: "${conv.passengerId}"`);
      console.log(
        `   - Participants: [${conv.participants.map((p) => `"${p}"`).join(', ')}]`,
      );
      console.log(`   - Last Message: "${conv.lastMessage || 'none'}"`);
      console.log(`   - Created: ${conv.createdAt}`);
      console.log('');
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listConversations();
