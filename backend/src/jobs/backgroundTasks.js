import {
  startApprovalBackgroundTasks,
  stopApprovalBackgroundTasks,
} from '../services/approvalService.js';
import {
  startDepartureNotificationService,
  stopDepartureNotificationService,
} from '../services/departureNotificationService.js';
import { cleanupExpiredRideRequests } from '../services/rideLifecycleService.js';
import { cleanupExpiredRideOffersJob } from '../services/rideOfferLifecycleService.js';
import { checkRideOfferExpiryNotifications } from '../services/rideOfferReadService.js';

let expiringRidesInterval;
let cleanupInterval;

async function checkExpiringRidesTask() {
  try {
    const result = await checkRideOfferExpiryNotifications();
    console.log(
      JSON.stringify({
        type: 'job_result',
        job: 'check_expiring_rides',
        notificationsSent: result.notificationsSent || 0,
      }),
    );
  } catch (error) {
    console.error('Expiring rides task failed:', error);
  }
}

async function cleanupExpiredRidesTask() {
  try {
    const requestResult = await cleanupExpiredRideRequests();
    const offerResult = await cleanupExpiredRideOffersJob();

    console.log(
      JSON.stringify({
        type: 'job_result',
        job: 'cleanup_expired_ride_requests',
        cancelledCount: requestResult.cancelledCount || 0,
        completedCount: requestResult.completedCount || 0,
      }),
    );
    console.log(
      JSON.stringify({
        type: 'job_result',
        job: 'cleanup_expired_ride_offers',
        cancelledCount: offerResult.cancelledCount || 0,
        completedCount: offerResult.completedCount || 0,
      }),
    );
  } catch (error) {
    console.error('Cleanup task failed:', error);
  }
}

export function startBackgroundTasks() {
  if (expiringRidesInterval || cleanupInterval) {
    return;
  }

  expiringRidesInterval = setInterval(checkExpiringRidesTask, 5 * 60 * 1000);
  cleanupInterval = setInterval(cleanupExpiredRidesTask, 10 * 60 * 1000);

  startDepartureNotificationService();
  startApprovalBackgroundTasks();

  setTimeout(checkExpiringRidesTask, 5000);
  setTimeout(cleanupExpiredRidesTask, 8000);

  console.log(
    JSON.stringify({
      type: 'background_tasks_started',
      jobs: [
        'check_expiring_rides',
        'cleanup_expired_rides',
        'departure_notifications',
        'approval_tasks',
      ],
    }),
  );
}

export function stopBackgroundTasks() {
  if (expiringRidesInterval) clearInterval(expiringRidesInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);
  expiringRidesInterval = null;
  cleanupInterval = null;
  stopDepartureNotificationService();
  stopApprovalBackgroundTasks();
}
