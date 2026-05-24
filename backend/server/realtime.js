let realtimeServer = null;
const activeSocketsByUsername = new Map();

export const setRealtimeServer = (io) => {
  realtimeServer = io;
};

export const trackRealtimeSocket = (socket) => {
  const username = socket.data.auth?.username;
  if (!username) return;

  const socketIds = activeSocketsByUsername.get(username) || new Set();
  socketIds.add(socket.id);
  activeSocketsByUsername.set(username, socketIds);

  socket.on('disconnect', () => {
    const currentSocketIds = activeSocketsByUsername.get(username);
    if (!currentSocketIds) return;

    currentSocketIds.delete(socket.id);
    if (currentSocketIds.size === 0) {
      activeSocketsByUsername.delete(username);
    }
  });
};

export const isUserActiveOnErp = (username = '') =>
  Boolean(username && activeSocketsByUsername.has(username));

export const emitRealtimeEvent = (eventName, detail = null) => {
  if (!realtimeServer) return;

  realtimeServer.emit('realtime:event', {
    eventName,
    detail,
    timestamp: new Date().toISOString(),
  });
};
