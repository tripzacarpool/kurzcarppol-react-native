import http from 'http';
import { createApp } from '../src/app.js';

const requestJson = (port, path) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
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
    getDependencyHealth: async () => ({
      requiredSidecar: {
        required: true,
        configured: true,
        status: 'unhealthy',
      },
    }),
  }),
);

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();

  try {
    const response = await requestJson(port, '/health/ready');

    if (response.statusCode !== 503 || response.body?.status !== 'not_ready') {
      throw new Error('Expected required unhealthy dependency to block readiness');
    }

    console.log('Backend readiness dependency smoke passed');
    server.close(() => process.exit(0));
  } catch (error) {
    console.error(error);
    server.close(() => process.exit(1));
  }
});
