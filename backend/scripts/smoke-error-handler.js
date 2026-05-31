import http from 'http';

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';

const express = (await import('express')).default;
const { requestContext } = await import(
  '../src/shared/http/requestContext.js?smoke=error-handler'
);
const { errorHandler } = await import(
  '../src/middleware/errorHandler.js?smoke=error-handler'
);

const app = express();
app.use(requestContext);
app.get('/boom', () => {
  throw new Error('sensitive internal failure detail');
});
app.use(errorHandler);

const requestJson = (port) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/boom',
        method: 'GET',
        headers: {
          'X-Request-Id': 'error-handler-smoke-request-id',
        },
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

const server = http.createServer(app);

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();

  try {
    const response = await requestJson(port);

    if (response.statusCode !== 500) {
      throw new Error(`Unexpected error status: ${response.statusCode}`);
    }

    if (response.body?.error !== 'Internal server error') {
      throw new Error('Expected production 500 response to be sanitized');
    }

    if (response.body?.requestId !== 'error-handler-smoke-request-id') {
      throw new Error('Expected error response body to include requestId');
    }

    console.log('Backend error handler smoke passed');
    server.close(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.exit(0);
    });
  } catch (error) {
    console.error(error);
    server.close(() => {
      process.env.NODE_ENV = originalNodeEnv;
      process.exit(1);
    });
  }
});
