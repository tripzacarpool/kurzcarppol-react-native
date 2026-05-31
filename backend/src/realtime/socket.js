import { Server } from 'socket.io';
import { setupLocationEvents } from './locationEvents.js';
import { clearRealtimeServer, setRealtimeServer } from './realtimeBus.js';
import { env, isDevelopment } from '../config/env.js';

let io;

const allowedRoomPattern =
  /^(user|driver|passenger|ride|conversation|booking|admin)(:|_)[A-Za-z0-9_.:-]+$|^admin_room$/;

const joinRoom = (socket, room) => {
  if (typeof room !== 'string') return false;
  const trimmedRoom = room.trim().slice(0, 160);
  if (!trimmedRoom || !allowedRoomPattern.test(trimmedRoom)) return false;
  socket.join(trimmedRoom);
  return trimmedRoom;
};

export function createRealtimeServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: isDevelopment ? '*' : env.allowedOrigins,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log(
      JSON.stringify({
        type: 'socket_connected',
        socketId: socket.id,
      }),
    );

    setupLocationEvents(io, socket);

    socket.on('join:user', ({ userId }) => {
      if (!userId) return;
      joinRoom(socket, `user:${userId}`);
      joinRoom(socket, `passenger_${userId}`);
      joinRoom(socket, `driver_${userId}`);
    });

    socket.on('join:admin', ({ userId } = {}) => {
      if (!userId) return;
      joinRoom(socket, 'admin_room');
      joinRoom(socket, `user:${userId}`);
    });

    socket.on('join:room', (roomName, ack) => {
      const joinedRoom = joinRoom(socket, roomName);
      const response = joinedRoom
        ? { ok: true, room: joinedRoom }
        : { ok: false, error: 'Invalid room' };

      if (typeof ack === 'function') {
        ack(response);
      }
    });

    socket.on('leave:room', (roomName, ack) => {
      if (typeof roomName !== 'string') {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid room' });
        return;
      }

      const trimmedRoom = roomName.trim().slice(0, 160);
      if (!allowedRoomPattern.test(trimmedRoom)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid room' });
        return;
      }

      socket.leave(trimmedRoom);
      if (typeof ack === 'function') ack({ ok: true, room: trimmedRoom });
    });

    socket.on('disconnect', () => {
      console.log(
        JSON.stringify({
          type: 'socket_disconnected',
          socketId: socket.id,
        }),
      );
    });
  });

  setRealtimeServer(io);

  return io;
}

export function getRealtimeServer() {
  return io;
}

export function closeRealtimeServer() {
  if (!io) return;
  io.close();
  io = null;
  clearRealtimeServer();
}
