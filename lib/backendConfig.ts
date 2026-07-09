import Constants from 'expo-constants';
import { Platform } from 'react-native';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const WEB_API_URL = 'https://kurzcarppol-react-native-1.onrender.com';
const LOCAL_API_URL_PATTERN = /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/i;

function isLocalApiUrl(value?: string) {
  return Boolean(value && LOCAL_API_URL_PATTERN.test(value));
}

function getExpoExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getDefaultLocalApiUrl() {
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://127.0.0.1:5000';
}

export function getApiBaseUrl(): string {
  if (Platform.OS !== 'web') {
    return getDefaultLocalApiUrl();
  }

  const configuredApiUrl = getExpoExtra('apiUrl');
  const configured =
    !__DEV__ && isLocalApiUrl(configuredApiUrl)
      ? WEB_API_URL
      : configuredApiUrl || WEB_API_URL;

  if (!configured) {
    throw new Error(
      'API URL not configured. Set EXPO_PUBLIC_API_URL or expo.extra.apiUrl.',
    );
  }

  return trimTrailingSlash(configured);
}

export function getSocketBaseUrl(): string {
  if (Platform.OS !== 'web') {
    return getDefaultLocalApiUrl();
  }

  const configuredSocketUrl = getExpoExtra('socketUrl');
  const configured =
    !__DEV__ && isLocalApiUrl(configuredSocketUrl)
      ? WEB_API_URL
      : configuredSocketUrl || getApiBaseUrl();

  return trimTrailingSlash(configured);
}

export const backendEndpoints = {
  health: () => `${getApiBaseUrl()}/health`,
  readiness: () => `${getApiBaseUrl()}/health/ready`,
  api: (path: string) => `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`,
};

export type BackendReadiness = {
  status: 'ready' | 'not_ready';
  environment?: string;
  requestId?: string;
  checks?: Record<string, unknown>;
  timestamp?: string;
};

export async function fetchBackendReadiness(): Promise<BackendReadiness> {
  const response = await fetch(backendEndpoints.readiness());
  const data = await response.json();
  return data as BackendReadiness;
}
