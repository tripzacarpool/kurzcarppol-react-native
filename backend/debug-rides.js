import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { RideOffer } from './src/config/models.js';

dotenv.config();

/**
 * Debug script to check ride offers in database
 * Run with: node backend/debug-rides.js
 */

async function debugRides() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const now = new Date();
    console.log('\n📅 Current time:', now);
    console.log('='.repeat(60));

    // Get all rides with status 'waiting'
    const waitingRides = await RideOffer.find({
      status: 'waiting',
    }).sort({ departureTime: 1 });

    console.log(
      `\n🔍 Found ${waitingRides.length} rides with status 'waiting':\n`,
    );

    waitingRides.forEach((ride, index) => {
      const departureDate = new Date(ride.departureTime);
      const isFuture = departureDate >= now;
      const hasSeats = ride.availableSeats && ride.availableSeats.length > 0;
      const willShow = isFuture && hasSeats;

      console.log(`${index + 1}. Ride ${ride._id}`);
      console.log(`   From: ${ride.from}`);
      console.log(`   To: ${ride.to}`);
      console.log(`   Driver: ${ride.clerkId}`);
      console.log(`   Departure: ${departureDate.toLocaleString()}`);
      console.log(`   Is Future: ${isFuture ? '✅' : '❌'}`);
      console.log(
        `   Available Seats: [${ride.availableSeats.join(', ')}] (${ride.availableSeats.length} seats)`,
      );
      console.log(`   Has Seats: ${hasSeats ? '✅' : '❌'}`);
      console.log(`   Status: ${ride.status}`);
      console.log(
        `   Will show in available rides: ${willShow ? '✅ YES' : '❌ NO'}`,
      );
      console.log(`   Updated At: ${ride.updatedAt}`);
      console.log('');
    });

    // Check for rides that might be filtered out
    const allActiveRides = await RideOffer.find({
      status: { $in: ['waiting', 'accepted', 'booked'] },
    }).sort({ departureTime: 1 });

    const futureActiveRides = allActiveRides.filter(
      (r) => new Date(r.departureTime) >= now,
    );
    const pastActiveRides = allActiveRides.filter(
      (r) => new Date(r.departureTime) < now,
    );

    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(
      `   Total active rides (waiting/accepted/booked): ${allActiveRides.length}`,
    );
    console.log(`   Future active rides: ${futureActiveRides.length}`);
    console.log(
      `   Past active rides (should be cleaned up): ${pastActiveRides.length}`,
    );

    if (pastActiveRides.length > 0) {
      console.log('\n⚠️ Past rides that should be cleaned up:');
      pastActiveRides.forEach((ride) => {
        console.log(
          `   - ${ride._id}: ${ride.from} → ${ride.to} (Departure: ${new Date(ride.departureTime).toLocaleString()})`,
        );
      });
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

debugRides();
