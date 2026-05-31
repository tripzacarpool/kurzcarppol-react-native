import { env } from '../config/env.js';

class MatchingClientError extends Error {
  constructor(message, { code = 'MATCHING_SERVICE_ERROR', status, details } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const buildUrl = (path) => {
  if (!env.matchingServiceUrl) {
    throw new MatchingClientError('Matching service URL is not configured', {
      code: 'MATCHING_SERVICE_NOT_CONFIGURED',
    });
  }

  return new URL(path, env.matchingServiceUrl).toString();
};

async function postJson(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.matchingServiceTimeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new MatchingClientError('Matching service request failed', {
        status: response.status,
        details: data,
      });
    }

    return data;
  } catch (error) {
    if (error instanceof MatchingClientError) {
      throw error;
    }

    throw new MatchingClientError('Matching service is unavailable', {
      code: error.name === 'AbortError'
        ? 'MATCHING_SERVICE_TIMEOUT'
        : 'MATCHING_SERVICE_UNAVAILABLE',
      details: error.message,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.matchingServiceTimeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      method: 'GET',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new MatchingClientError('Matching service request failed', {
        status: response.status,
        details: data,
      });
    }
    return data;
  } catch (error) {
    if (error instanceof MatchingClientError) {
      throw error;
    }

    throw new MatchingClientError('Matching service is unavailable', {
      code: error.name === 'AbortError'
        ? 'MATCHING_SERVICE_TIMEOUT'
        : 'MATCHING_SERVICE_UNAVAILABLE',
      details: error.message,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const isMatchingServiceConfigured = () => Boolean(env.matchingServiceUrl);

export const checkMatchingServiceHealth = () => getJson('/health');

export const rankRideMatches = (payload) => postJson('/match', payload);

export const calculateExternalFareSplit = (payload) =>
  postJson('/fare-split', payload);
