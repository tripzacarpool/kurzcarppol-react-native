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
  const urls = [
    process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.100:5000',
    'http://10.0.2.2:5000', // Android emulator default
    'http://localhost:5000', // iOS simulator
  ];

  for (const url of urls) {
    console.log(`🧪 Trying URL: ${url}`);
    if (await testBackendConnectivity(url)) {
      console.log(`✅ Will use: ${url}`);
      return url;
    }
  }

  console.warn('⚠️ No backend URL worked, using default');
  return process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.100:5000';
}
