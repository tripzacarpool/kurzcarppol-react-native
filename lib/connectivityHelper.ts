import { backendEndpoints, fetchBackendReadiness, getApiBaseUrl } from '@/lib/backendConfig';

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

export async function testBackendReadiness(): Promise<boolean> {
  try {
    const readiness = await fetchBackendReadiness();
    const ok = readiness.status === 'ready';
    if (ok) {
      console.log('Backend services are ready:', readiness.checks);
    } else {
      console.warn('Backend services are not ready:', readiness.checks);
    }
    return ok;
  } catch (err) {
    console.warn(
      'Backend readiness test failed:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return false;
  }
}

export async function getAvailableBackendUrl(): Promise<string> {
  const urls = [getApiBaseUrl()];

  for (const url of urls) {
    console.log(`🧪 Trying URL: ${url}`);
    if (await testBackendConnectivity(url)) {
      console.log(`✅ Will use: ${url}`);
      return url;
    }
  }

  console.warn('⚠️ No backend URL worked, using default');
  return getApiBaseUrl();
}

export function getHealthUrl(): string {
  return backendEndpoints.health();
}
