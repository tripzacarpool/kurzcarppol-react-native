import * as SecureStore from 'expo-secure-store';

/**
 * Nuclear option: Clear ALL authentication data
 * Run this once, then restart the app
 */
export async function nukeAllAuth() {
  console.log('💣 NUKING ALL AUTH DATA...');

  const keysToDelete = [
    '__clerk_db_jwt',
    'clerk_jwt_token',
    'clerk_session',
    '__clerk_session',
    '__clerk_user_data',
    'clerk_user_data',
    '__clerk_client_jwt',
    'clerk_token',
    '__clerk_user',
    'clerk_user',
    '__clerk_authstatus',
    'clerk_authstatus',
    '__clerk_refresh_token',
    'clerk_refresh_token',
  ];

  let count = 0;
  for (const key of keysToDelete) {
    try {
      await SecureStore.deleteItemAsync(key);
      console.log(`  ✓ Deleted: ${key}`);
      count++;
    } catch (err) {
      // Ignore errors for non-existent keys
    }
  }

  console.log(`✅ Cleared ${count} auth tokens`);
  console.log('🔄 RESTART THE APP NOW');
}
