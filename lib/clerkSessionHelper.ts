import * as SecureStore from 'expo-secure-store';

export async function clearAllClerkSessions() {
  try {
    console.log('🧹 Clearing all Clerk sessions from storage...');

    // Clerk stores multiple keys, try to clear ALL known ones
    const keysToDelete = [
      '__clerk_db_jwt',
      'clerk_jwt_token',
      'clerk_session',
      '__clerk_session',
      '__clerk_user_data',
      'clerk_user_data',
      '__clerk_client_jwt', // Added: Client JWT token
      'clerk_token',
      '__clerk_user',
      'clerk_user',
      '__clerk_authstatus',
      'clerk_authstatus',
    ];

    let clearedCount = 0;
    for (const key of keysToDelete) {
      try {
        await SecureStore.deleteItemAsync(key);
        console.log(`  ✓ Cleared ${key}`);
        clearedCount++;
      } catch (err) {
        // Key might not exist, that's ok
      }
    }

    console.log(
      `✅ All Clerk sessions cleared (${clearedCount} tokens removed)`,
    );
  } catch (error) {
    console.error('❌ Error clearing sessions:', error);
  }
}

export async function clearSpecificClerkToken(key: string) {
  try {
    console.log(`🧹 Clearing Clerk token: ${key}`);
    await SecureStore.deleteItemAsync(key);
    console.log(`✅ Cleared ${key}`);
  } catch (error) {
    console.log(`ℹ️ Token ${key} not found (probably already cleared)`);
  }
}
