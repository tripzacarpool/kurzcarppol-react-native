import http from 'http';
import { createApp } from '../src/app.js';

const requestJson = (port, path, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              requestId: res.headers['x-request-id'],
              headers: res.headers,
              body: body ? JSON.parse(body) : null,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on('error', reject);
    req.end();
  });

const server = http.createServer(
  createApp({
    getDatabaseReady: () => true,
  }),
);

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();

  try {
    const expectedRequestId = 'backend-smoke-request-id';
    const health = await requestJson(port, '/health', {
      'X-Request-Id': expectedRequestId,
    });
    const live = await requestJson(port, '/health/live');
    const ready = await requestJson(port, '/health/ready');
    const missing = await requestJson(port, '/health/missing-route');

    if (health.statusCode !== 200 || health.body?.status !== 'ok') {
      throw new Error(`Unexpected /health response: ${health.statusCode}`);
    }

    if (live.statusCode !== 200 || live.body?.status !== 'ok') {
      throw new Error(`Unexpected /health/live response: ${live.statusCode}`);
    }

    if (!health.requestId || !ready.requestId) {
      throw new Error('Expected X-Request-Id response headers');
    }

    if (health.requestId !== expectedRequestId) {
      throw new Error('Expected incoming X-Request-Id to be preserved');
    }

    if (health.body?.requestId !== health.requestId) {
      throw new Error('Expected /health body to include requestId');
    }

    if (ready.body?.requestId !== ready.requestId) {
      throw new Error('Expected /health/ready body to include requestId');
    }

    if (health.headers['x-powered-by']) {
      throw new Error('Expected X-Powered-By header to be disabled');
    }

    if (!health.headers['x-content-type-options']) {
      throw new Error('Expected Helmet security headers');
    }

    if (
      !health.headers['access-control-expose-headers']
        ?.toLowerCase()
        .includes('x-request-id')
    ) {
      throw new Error('Expected X-Request-Id to be exposed through CORS');
    }

    if (ready.statusCode !== 200 || ready.body?.status !== 'ready') {
      throw new Error(`Unexpected /health/ready response: ${ready.statusCode}`);
    }

    if (
      ready.body?.checks?.matchingService?.status !== 'not_configured' ||
      ready.body?.checks?.matchingService?.required !== false
    ) {
      throw new Error('Unexpected matching service readiness check');
    }

    if (
      ready.body?.checks?.eventBus?.status !== 'not_configured' ||
      ready.body?.checks?.eventBus?.required !== false
    ) {
      throw new Error('Unexpected event bus readiness check');
    }

    if (
      ready.body?.checks?.redis?.status !== 'not_configured' ||
      ready.body?.checks?.redis?.required !== false
    ) {
      throw new Error('Unexpected Redis readiness check');
    }

    if (missing.statusCode !== 404 || !missing.body?.requestId) {
      throw new Error('Expected 404 response to include requestId');
    }

    console.log('Backend app smoke passed');
    server.close(() => process.exit(0));
  } catch (error) {
    console.error(error);
    server.close(() => process.exit(1));
  }
});
