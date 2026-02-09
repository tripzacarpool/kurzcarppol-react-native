// List all collections in the database
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/kruzapp';

async function listCollections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📍 URI:', MONGODB_URI.replace(/\/\/.*:.*@/, '//*****:*****@'));
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📦 Database:', mongoose.connection.db.databaseName);

    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();

    console.log(`\n📋 Found ${collections.length} collections:\n`);

    for (const coll of collections) {
      const count = await mongoose.connection.db
        .collection(coll.name)
        .countDocuments();
      console.log(`   - ${coll.name}: ${count} documents`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listCollections();
