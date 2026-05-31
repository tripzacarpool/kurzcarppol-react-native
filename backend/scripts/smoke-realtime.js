import http from 'http';
import { io as createSocketClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createRealtimeServer } from '../src/realtime/socket.js';

const httpServer = http.createServer(
  createApp({
    getDatabaseReady: () => true,
  }),
);
const realtime = createRealtimeServer(httpServer);

const waitForEvent = (socket, eventName) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${eventName}`)),
      5000,
    );
    socket.once(eventName, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });

const emitWithAck = (socket, eventName, payload) =>
  new Promise((resolve) => {
    socket.emit(eventName, payload, resolve);
  });

httpServer.listen(0, '127.0.0.1', async () => {
  const { port } = httpServer.address();
  const client = createSocketClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  try {
    await waitForEvent(client, 'connect');

    const userId = 'smoke-user';
    client.emit('join:user', { userId });

    const roomResponse = await emitWithAck(
      client,
      'join:room',
      `ride:smoke-ride`,
    );

    if (!roomResponse?.ok) {
      throw new Error('Expected join:room to acknowledge a valid room');
    }

    const invalidRoomResponse = await emitWithAck(
      client,
      'join:room',
      '../../invalid',
    );

    if (invalidRoomResponse?.ok) {
      throw new Error('Expected invalid realtime room to be rejected');
    }

    const directPayload = waitForEvent(client, 'smoke:direct-room');
    realtime.to(`user:${userId}`).emit('smoke:direct-room', { ok: true });
    const direct = await directPayload;

    if (!direct?.ok) {
      throw new Error('Expected user room event to be delivered');
    }

    const legacyPayload = waitForEvent(client, 'smoke:legacy-role-room');
    realtime
      .to(`passenger_${userId}`)
      .emit('smoke:legacy-role-room', { ok: true });
    const legacy = await legacyPayload;

    if (!legacy?.ok) {
      throw new Error('Expected passenger compatibility room event');
    }

    console.log('Backend realtime smoke passed');
    client.disconnect();
    realtime.close();
    httpServer.close(() => process.exit(0));
  } catch (error) {
    console.error(error);
    client.disconnect();
    realtime.close();
    httpServer.close(() => process.exit(1));
  }
});
