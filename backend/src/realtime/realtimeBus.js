let realtimeServer = null;
let realtimePublisher = null;

export function setRealtimeServer(io) {
  realtimeServer = io;
  realtimePublisher = {
    emit: (eventName, payload) => realtimeServer.emit(eventName, payload),
    to: (roomName) => ({
      emit: (eventName, payload) =>
        realtimeServer.to(roomName).emit(eventName, payload),
    }),
  };
}

export function getRealtimeServer() {
  return realtimePublisher;
}

export function getRawRealtimeServer() {
  return realtimeServer;
}

export function clearRealtimeServer() {
  realtimeServer = null;
  realtimePublisher = null;
}
