import http from 'http';
import express from 'express';
import { publishEvent } from '../src/shared/events/eventBus.js';
import { requestContext } from '../src/shared/http/requestContext.js';

const expectedRequestId = 'event-smoke-request-id';
const app = express();

app.use(requestContext);
app.get('/event-smoke', async (req, res, next) => {
  try {
    const event = await publishEvent('smoke.event.created.v1', {
      ok: true,
    });
    res.json(event);
  } catch (error) {
    next(error);
  }
});

const server = http.createServer(app);

const requestEvent = (port) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/event-smoke',
        method: 'GET',
        headers: {
          'X-Request-Id': expectedRequestId,
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

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();

  try {
    const response = await requestEvent(port);
    if (response.statusCode !== 200) {
      throw new Error(`Unexpected event smoke status: ${response.statusCode}`);
    }

    if (response.body?.correlationId !== expectedRequestId) {
      throw new Error('Expected event correlationId to inherit request ID');
    }

    console.log('Backend event correlation smoke passed');
    server.close(() => process.exit(0));
  } catch (error) {
    console.error(error);
    server.close(() => process.exit(1));
  }
});
