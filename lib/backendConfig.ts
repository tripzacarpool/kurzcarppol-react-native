import Constants from 'expo-constants';
import { Platform } from 'react-native';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const PRODUCTION_API_URL = 'https://api.raaheasy.app';

function getExpoExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getDefaultLocalApiUrl() {
  if (!__DEV__) return PRODUCTION_API_URL;
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://127.0.0.1:5000';
}

export function getApiBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_URL ||
    getExpoExtra('apiUrl') ||
    getDefaultLocalApiUrl();

  if (!configured) {
    throw new Error(
      'API URL not configured. Set EXPO_PUBLIC_API_URL or expo.extra.apiUrl.',
    );
  }

  return trimTrailingSlash(configured);
}

export function getSocketBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_SOCKET_URL ||
    getExpoExtra('socketUrl') ||
    getApiBaseUrl();

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
