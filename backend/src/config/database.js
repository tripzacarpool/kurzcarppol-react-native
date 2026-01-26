import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'kruzapp';

let cached = {
  conn: null,
  promise: null,
};

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    const err = new Error('MONGODB_URI not found in environment variables');
    console.error('❌', err.message);
    console.error('💡 Please check your backend/.env file');
    throw err;
  }

  console.log('📡 Connecting to MongoDB...');
  console.log('   Database:', MONGODB_DB);

  if (cached.conn) {
    console.log('✅ Using cached MongoDB connection');
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

export default connectToDatabase;
