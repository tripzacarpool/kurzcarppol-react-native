/**
 * One-time migration script to fix validation issues in existing RideOffers
 * - Adds driverId field (set to clerkId) to rides missing it
 * - Fixes empty festivalConfig.tier values (converts '' to null)
 *
 * Run this script once: node migrate-driverId.js
 */

import './src/loadEnv.js';
import mongoose from 'mongoose';
import { env } from './src/config/env.js';
import { RideOffer } from './src/config/models.js';

const connectOptions = {
  dbName: env.mongodbDb,
  maxPoolSize: env.mongodbMaxPoolSize,
  minPoolSize: env.mongodbMinPoolSize,
  serverSelectionTimeoutMS: env.mongodbServerSelectionTimeoutMs,
  socketTimeoutMS: env.mongodbSocketTimeoutMs,
};

async function migrateDriverId() {
  try {
    console.log('🔄 Starting data migration...');

    // Connect to database
    await mongoose.connect(env.mongodbUri, connectOptions);
    console.log('✅ Connected to MongoDB');

    // Find all ride offers without driverId OR with invalid festivalConfig.tier
    const problematicRides = await RideOffer.find({
      $or: [{ driverId: { $exists: false } }, { 'festivalConfig.tier': '' }],
    });

    console.log(
      `📊 Found ${problematicRides.length} ride offers needing migration`,
    );

    if (problematicRides.length === 0) {
      console.log('✅ All ride offers are up to date. Nothing to migrate.');
      process.exit(0);
    }

    let updatedCount = 0;
    let errorCount = 0;

    // Update each ride offer
    for (const ride of problematicRides) {
      try {
        let hasChanges = false;

        // Fix missing driverId
        if (!ride.driverId && ride.clerkId) {
          ride.driverId = ride.clerkId;
          hasChanges = true;
          console.log(
            `✅ Updated ride ${ride._id}: driverId set to ${ride.clerkId}`,
          );
        }

        // Fix empty festivalConfig.tier
        if (ride.festivalConfig && ride.festivalConfig.tier === '') {
          ride.festivalConfig.tier = null;
          hasChanges = true;
          console.log(
            `✅ Updated ride ${ride._id}: festivalConfig.tier set to null`,
          );
        }

        if (hasChanges) {
          await ride.save({ validateBeforeSave: false }); // Skip validation for this update
          updatedCount++;
        } else {
          console.warn(`⚠️ Ride ${ride._id} matched query but no fixes needed`);
        }
      } catch (error) {
        console.error(`❌ Error updating ride ${ride._id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total found: ${problematicRides.length}`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('✅ Migration complete!');
    console.log('\nFixed issues:');
    console.log('   - Missing driverId fields');
    console.log('   - Empty festivalConfig.tier values');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run migration
migrateDriverId();
