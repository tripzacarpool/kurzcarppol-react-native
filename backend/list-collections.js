// List all collections in the database
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

async function listCollections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📍 URI:', env.mongodbUri.replace(/\/\/.*:.*@/, '//*****:*****@'));
    await mongoose.connect(env.mongodbUri, connectOptions);
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
