import {
  registerUserPushToken,
  sendTestPushToUser,
} from './pushNotificationService.js';

export const registerPushTokenForUser = ({ clerkId, pushToken }) =>
  registerUserPushToken({ clerkId, pushToken });

export const sendUserTestPush = (clerkId) => sendTestPushToUser(clerkId);
