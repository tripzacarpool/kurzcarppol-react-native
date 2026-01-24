import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Ensure dotenv is loaded
dotenv.config({ path: '../../.env' });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://upadhayayyogesh832:123freelanceproject123@cluster0.ga6zbb8.mongodb.net/kruzTestVersion?retryWrites=true&w=majority&appName=Cluster0';
const MONGODB_DB = process.env.MONGODB_DB || 'kruzapp';

let cached = {
  conn: null,
  promise: null,
};

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    const err = new Error('MONGODB_URI not found in environment or fallback');
    console.error('❌', err.message);
    throw err;
  }

  console.log('📡 Connecting to MongoDB...');
  console.log('   URI:', MONGODB_URI.substring(0, 50) + '...');

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: MONGODB_DB,
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4
      })
      .then((mongoose) => {
        console.log('✅ MongoDB connected successfully');
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

export default connectToDatabase;
