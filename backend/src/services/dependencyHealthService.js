import {
  checkMatchingServiceHealth,
  isMatchingServiceConfigured,
} from './matchingClientService.js';
import { env } from '../config/env.js';

const dependency = ({
  configured,
  status,
  required = false,
  details = undefined,
}) => ({
  required,
  configured,
  status,
  ...(details ? { details } : {}),
});

export async function getDependencyHealth() {
  const checks = {
    eventBus: dependency({
      configured: false,
      status: 'not_configured',
      strict: env.eventBusStrict,
      details: {
        strict: env.eventBusStrict,
      },
    }),
    matchingService: dependency({
      configured: false,
      required: env.matchingServiceRequired,
      status: 'not_configured',
    }),
    redis: dependency({ configured: false, status: 'not_configured' }),
  };

  if (env.kafkaBrokers.length > 0) {
    checks.eventBus = dependency({
      configured: true,
      status: 'configured',
      details: {
        strict: env.eventBusStrict,
        brokers: env.kafkaBrokers.length,
      },
    });
  }

  if (env.redisUrl) {
    checks.redis = dependency({ configured: true, status: 'configured' });
  }

  if (isMatchingServiceConfigured()) {
    try {
      const health = await checkMatchingServiceHealth();
      checks.matchingService = dependency({
        configured: true,
        required: env.matchingServiceRequired,
        status: 'healthy',
        details: {
          service: health?.service,
        },
      });
    } catch (error) {
      checks.matchingService = dependency({
        configured: true,
        required: env.matchingServiceRequired,
        status: 'unhealthy',
        details: {
          code: error.code,
        },
      });
    }
  }

  return checks;
}
