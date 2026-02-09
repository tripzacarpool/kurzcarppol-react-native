import { RideOffer, UserProfile } from '../config/models.js';
import { sendPushNotification } from '../controllers/notificationController.js';

/**
 * Check for rides departing in the next 5 minutes and send notifications to drivers
 */
export async function checkDepartureNotifications() {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const twoMinutesFromNow = new Date(now.getTime() + 2 * 60 * 1000);

    console.log('🔔 Checking for rides departing soon...');

    // Find ride offers that:
    // 1. Have departure time between 2-5 minutes from now
    // 2. Are still in 'waiting' status (not yet started)
    // 3. Haven't been notified yet (we'll track this with a flag)
    const upcomingRides = await RideOffer.find({
      departureTime: {
        $gte: twoMinutesFromNow,
        $lte: fiveMinutesFromNow,
      },
      status: { $in: ['waiting', 'booked'] },
      departureNotificationSent: { $ne: true }, // Not yet notified
    });

    console.log(
      `⏰ Found ${upcomingRides.length} rides departing in 2-5 minutes`,
    );

    for (const ride of upcomingRides) {
      try {
        // Get driver details
        const driver = await UserProfile.findOne({ clerkId: ride.clerkId });
        if (!driver || !driver.expoPushToken) {
          console.log(`⏭️ Skipping ride ${ride._id} - no driver push token`);
          continue;
        }

        const minutesUntilDeparture = Math.round(
          (new Date(ride.departureTime).getTime() - now.getTime()) /
            (1000 * 60),
        );

        const hasBookings = ride.bookings && ride.bookings.length > 0;
        const bookedSeats = hasBookings
          ? ride.bookings.reduce(
              (sum, b) => sum + (b.seatNumbers?.length || 0),
              0,
            )
          : 0;

        // Customize message based on booking status
        let title, body, data;

        if (hasBookings) {
          title = `🚗 Ride Departing in ${minutesUntilDeparture} min`;
          body = `Your ride from ${ride.from} to ${ride.to} has ${bookedSeats} passenger(s) booked. Ready to depart?`;
          data = {
            type: 'departure_reminder',
            rideId: ride._id.toString(),
            action: 'extend_or_start',
            hasBookings: true,
          };
        } else {
          title = `⏰ No Bookings Yet - ${minutesUntilDeparture} min left`;
          body = `Your ride from ${ride.from} to ${ride.to} has no bookings. Extend time or cancel?`;
          data = {
            type: 'departure_reminder',
            rideId: ride._id.toString(),
            action: 'extend_or_cancel',
            hasBookings: false,
          };
        }

        // Send push notification
        await sendPushNotification({
          expoPushToken: driver.expoPushToken,
          title,
          body,
          data,
        });

        // Mark as notified
        ride.departureNotificationSent = true;
        await ride.save();

        console.log(
          `✅ Sent departure notification to driver for ride ${ride._id}`,
        );
      } catch (error) {
        console.error(
          `❌ Error sending notification for ride ${ride._id}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error('❌ Error in checkDepartureNotifications:', error);
  }
}

/**
 * Start the departure notification checker
 * Runs every minute to check for upcoming departures
 */
export function startDepartureNotificationService() {
  console.log('🚀 Starting departure notification service...');

  // Run immediately on start
  checkDepartureNotifications();

  // Run every minute
  const INTERVAL = 60 * 1000; // 1 minute
  setInterval(checkDepartureNotifications, INTERVAL);

  console.log(
    '✅ Departure notification service started (checking every minute)',
  );
}
