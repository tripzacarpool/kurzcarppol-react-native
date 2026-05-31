import mongoose from 'mongoose';
import { env } from './env.js';

let cached = {
  conn: null,
  promise: null,
};

export async function connectToDatabase() {
  if (!env.mongodbUri) {
    const err = new Error('MONGODB_URI not found in environment variables');
    console.error('❌', err.message);
    console.error('💡 Please check your backend/.env file');
    throw err;
  }

  console.log('📡 Connecting to MongoDB...');
  console.log('   Database:', env.mongodbDb);

  if (cached.conn) {
    console.log('✅ Using cached MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(env.mongodbUri, {
        dbName: env.mongodbDb,
        bufferCommands: true,
        maxPoolSize: env.mongodbMaxPoolSize,
        minPoolSize: env.mongodbMinPoolSize,
        serverSelectionTimeoutMS: env.mongodbServerSelectionTimeoutMs,
        socketTimeoutMS: env.mongodbSocketTimeoutMs,
        family: 4,
      })
      .then((mongoose) => {
        console.log('✅ MongoDB connected successfully');
        console.log('   Database:', mongoose.connection.name);
        return mongoose;
      })
      .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        cached.promise = null;
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('❌ MongoDB connection failed:', e.message);
    throw e;
  }

  return cached.conn;
}

export async function disconnectDatabase() {
  if (cached.conn || cached.promise) {
    await mongoose.disconnect();
  }

  cached = {
    conn: null,
    promise: null,
  };
}

export default connectToDatabase;
