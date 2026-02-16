import { RideBooking, RideOffer, UserProfile } from '../config/models.js';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

/**
 * Send push notification
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !expo.isExpoPushToken(pushToken)) {
    return null;
  }

  try {
    const response = await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        badge: 1,
        priority: 'high',
      },
    ]);

    return response;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return null;
  }
};

/**
 * Auto-reject approvals that have expired (5 minutes)
 * Runs every 1 minute
 */
export async function autoRejectExpiredApprovals() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Find pending approvals older than 5 minutes
    const expiredBookings = await RideBooking.find({
      approvalStatus: 'pending_approval',
      approvalRequestedAt: { $lt: fiveMinutesAgo },
    });

    if (expiredBookings.length === 0) {
      return { success: true, processedCount: 0 };
    }

    console.log(
      `⏱️ [AUTO-REJECT] Processing ${expiredBookings.length} expired approvals`,
    );

    const results = [];

    for (const booking of expiredBookings) {
      try {
        // Update booking status
        booking.approvalStatus = 'expired';
        booking.rejectionReason = 'Driver did not respond within 5 minutes';
        booking.rejectedAt = new Date();
        await booking.save();

        // Release seat locks
        const ride = await RideOffer.findById(booking.rideId);
        if (ride && ride.seatLocks) {
          ride.seatLocks = ride.seatLocks.filter(
            (lock) => !booking.seatNumbers.includes(lock.seatNumber),
          );
          await ride.save();
          console.log(`✅ Released seats for booking: ${booking._id}`);
        }

        // Send notification to passenger
        const passenger = await UserProfile.findOne({
          clerkId: booking.passengerId,
        });
        if (passenger?.pushToken) {
          await sendPushNotification(
            passenger.pushToken,
            '⏱️ Booking Request Expired',
            `Driver did not respond in time. Try another ride!`,
            {
              type: 'booking_expired',
              bookingId: booking._id.toString(),
            },
          );
        }

        results.push({
          bookingId: booking._id,
          status: 'auto-rejected',
        });
      } catch (error) {
        console.error(
          `❌ Error processing expired booking ${booking._id}:`,
          error,
        );
        results.push({
          bookingId: booking._id,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(
      `✅ [AUTO-REJECT] Completed: ${results.length} bookings processed`,
    );

    return {
      success: true,
      processedCount: results.length,
      results,
    };
  } catch (error) {
    console.error('❌ Error in autoRejectExpiredApprovals:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Clean up expired seat locks
 * Runs every 5 minutes
 */
export async function cleanupExpiredSeatLocks() {
  try {
    const now = new Date();
    const updatedRides = await RideOffer.updateMany(
      { 'seatLocks.expiresAt': { $lt: now } },
      {
        $pull: {
          seatLocks: { expiresAt: { $lt: now } },
        },
      },
    );

    if (updatedRides.modifiedCount > 0) {
      console.log(
        `✅ [CLEANUP] Cleared expired seat locks from ${updatedRides.modifiedCount} rides`,
      );
    }

    return {
      success: true,
      cleanedUpCount: updatedRides.modifiedCount,
    };
  } catch (error) {
    console.error('❌ Error in cleanupExpiredSeatLocks:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sync passenger cancellation rates and ratings
 * Used for trusted passenger determination
 * Runs every 1 hour
 */
export async function syncPassengerMetrics() {
  try {
    const passengers = await UserProfile.find();
    let updatedCount = 0;

    for (const passenger of passengers) {
      const bookings = await RideBooking.find({
        passengerId: passenger.clerkId,
      });
      const cancelledCount = bookings.filter(
        (b) => b.approvalStatus === 'cancelled',
      ).length;

      const cancellationRate =
        bookings.length > 0 ? cancelledCount / bookings.length : 0;

      // Update passenger metrics if needed
      if (passenger.totalTrips !== bookings.length) {
        passenger.totalTrips = bookings.length;
        await passenger.save();
        updatedCount++;
      }
    }

    console.log(`✅ [SYNC] Updated metrics for ${updatedCount} passengers`);

    return {
      success: true,
      updatedCount,
    };
  } catch (error) {
    console.error('❌ Error in syncPassengerMetrics:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Start all background approval tasks
 */
export function startApprovalBackgroundTasks() {
  try {
    console.log('🚀 Starting approval background tasks...');

    // Auto-reject expired approvals every 1 minute
    setInterval(autoRejectExpiredApprovals, 60 * 1000);
    console.log('⏱️ Auto-reject expired approvals job: every 1 minute');

    // Cleanup expired seat locks every 5 minutes
    setInterval(cleanupExpiredSeatLocks, 5 * 60 * 1000);
    console.log('🧹 Cleanup expired seat locks job: every 5 minutes');

    // Sync passenger metrics every 1 hour
    setInterval(syncPassengerMetrics, 60 * 60 * 1000);
    console.log('📊 Sync passenger metrics job: every 1 hour');

    console.log('✅ Approval background tasks started');
  } catch (error) {
    console.error('❌ Error starting approval background tasks:', error);
  }
}

export default {
  autoRejectExpiredApprovals,
  cleanupExpiredSeatLocks,
  syncPassengerMetrics,
  startApprovalBackgroundTasks,
};
