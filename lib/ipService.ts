import { getApiBaseUrl } from '@/lib/backendConfig';

export async function fetchAndStoreUserIP(
  userId: string,
): Promise<string | null> {
  try {
    console.log('📡 Fetching IP from https://api.ipify.org...');
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    const ipAddress = data.ip;
    console.log('✅ Got IP:', ipAddress);

    if (ipAddress) {
      const API_URL = getApiBaseUrl();
      const ipUrl = `${API_URL}/api/users/ip`;
      console.log('💾 Storing IP to:', ipUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const storeResponse = await fetch(ipUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ipAddress,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!storeResponse.ok) {
        console.error('❌ Failed to store IP:', storeResponse.status);
      } else {
        console.log('✅ IP stored successfully');
      }
    }

    return ipAddress;
  } catch (error) {
    console.warn(
      '⚠️ IP service failed (non-critical):',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return null;
  }
}

export async function getUserProfile(userId: string, token?: string | null) {
  try {
    const API_URL = getApiBaseUrl();
    console.log('👤 Fetching profile from:', `${API_URL}/api/users/${userId}`);
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      console.error(
        '❌ Profile fetch failed:',
        response.status,
        response.statusText,
      );
      throw new Error('Failed to fetch user profile');
    }

    const data = await response.json();
    console.log('✅ Profile fetched successfully:', data);

    // Return the user object from the response
    return data.user || data;
  } catch (error) {
    console.error('❌ Failed to fetch user profile:', error);
    return null;
  }
}
