import client from 'prom-client';

client.collectDefaultMetrics({
  prefix: 'raaheasy_api_',
});

const httpRequestsTotal = new client.Counter({
  name: 'raaheasy_http_requests_total',
  help: 'Total HTTP requests received by the API.',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'raaheasy_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const normalizeRoute = (req) => {
  if (req.route?.path) {
    const baseUrl = req.baseUrl || '';
    return `${baseUrl}${req.route.path}` || '/';
  }

  if (req.path.startsWith('/api/users/')) return '/api/users/:id';
  if (req.path.startsWith('/api/rides/')) return '/api/rides/:id';
  if (req.path.startsWith('/api/ride-offers/')) return '/api/ride-offers/:id';
  if (req.path.startsWith('/api/chat/')) return '/api/chat/:id';

  return req.path || 'unknown';
};

export const metricsMiddleware = (req, res, next) => {
  const endTimer = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: normalizeRoute(req),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    endTimer(labels);
  });

  next();
};

export const metricsHandler = async (req, res, next) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (error) {
    next(error);
  }
};
