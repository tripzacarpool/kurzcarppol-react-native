import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'https://api.raaheasy.app';

export const options = {
  scenarios: {
    steady_smoke: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 3),
      duration: __ENV.DURATION || '2m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<750'],
    checks: ['rate>0.95'],
  },
};

export default function () {
  const ready = http.get(`${baseUrl}/health/ready`, {
    tags: { endpoint: 'health_ready' },
  });
  check(ready, {
    'ready is 200': (res) => res.status === 200,
  });

  const live = http.get(`${baseUrl}/health/live`, {
    tags: { endpoint: 'health_live' },
  });
  check(live, {
    'live is 200': (res) => res.status === 200,
  });

  sleep(1);
}
