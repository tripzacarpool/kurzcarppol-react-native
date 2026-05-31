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

async function checkRides() {
  await mongoose.connect(env.mongodbUri, connectOptions);

  const RideOffer = mongoose.model(
    'RideOffer',
    new mongoose.Schema({}, { strict: false }),
  );

  console.log('\nChecking recent ride offers...\n');
  const allRides = await RideOffer.find({}).sort({ createdAt: -1 }).limit(10);
  console.log(`Total recent rides found: ${allRides.length}\n`);

  allRides.forEach((ride, index) => {
    console.log(`[${index + 1}] Ride:`, {
      id: ride._id.toString(),
      from: ride.from?.substring(0, 30),
      to: ride.to?.substring(0, 30),
      status: ride.status,
      departureTime: ride.departureTime,
      availableSeats: ride.availableSeats,
      availableSeatsLength: ride.availableSeats?.length,
      clerkId: ride.clerkId,
      totalSeats: ride.totalSeats,
    });
  });

  console.log('\nChecking waiting rides with available seats...\n');
  const waitingRides = await RideOffer.find({
    status: 'waiting',
    availableSeats: { $exists: true, $ne: [] },
  }).sort({ createdAt: -1 });

  console.log(`Waiting rides with seats: ${waitingRides.length}\n`);
  if (waitingRides.length > 0) {
    console.log('Sample waiting ride:', {
      id: waitingRides[0]._id.toString(),
      from: waitingRides[0].from,
      to: waitingRides[0].to,
      availableSeats: waitingRides[0].availableSeats,
      departureTime: waitingRides[0].departureTime,
    });
  }
}

checkRides()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
