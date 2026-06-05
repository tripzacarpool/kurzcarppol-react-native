import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'https://api.raaheasy.app';

export const options = {
  scenarios: {
    ramp_peak: {
      executor: 'ramping-vus',
      stages: [
        { duration: '3m', target: Number(__ENV.PEAK_VUS || 25) },
        { duration: '10m', target: Number(__ENV.PEAK_VUS || 25) },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    checks: ['rate>0.97'],
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
