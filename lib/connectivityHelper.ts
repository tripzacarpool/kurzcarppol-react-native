export async function testBackendConnectivity(
  apiUrl: string,
): Promise<boolean> {
  try {
    console.log('🔗 Testing backend connectivity:', apiUrl);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log('✅ Backend is reachable');
      return true;
    } else {
      console.log('⚠️ Backend responded with status:', response.status);
      return true; // Still consider it reachable if we got any response
    }
  } catch (err) {
    console.warn(
      '⚠️ Backend connectivity test failed (non-critical):',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return false; // But don't block the app
  }
}

export async function getAvailableBackendUrl(): Promise<string> {
  if (!process.env.EXPO_PUBLIC_API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL environment variable is required');
  }

  const urls = [
    process.env.EXPO_PUBLIC_API_URL,
    // Local development URLs (uncomment to use):
    // 'http://10.0.2.2:5000', // Android emulator default
    // 'http://10.238.194.123:5000', // Local development
  ];

  for (const url of urls) {
    console.log(`🧪 Trying URL: ${url}`);
    if (await testBackendConnectivity(url)) {
      console.log(`✅ Will use: ${url}`);
      return url;
    }
  }

  console.warn('⚠️ No backend URL worked, using default');
  return process.env.EXPO_PUBLIC_API_URL;
  // return 'http://10.238.194.123:5000'; // Local development URL
}
