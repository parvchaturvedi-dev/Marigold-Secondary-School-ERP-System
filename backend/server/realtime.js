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

export const realtimeRoleRoom = (role) => `role:${role}`;

export const emitRealtimeInvalidation = (eventName, roles) => {
  const rooms = [...new Set(roles)].map(realtimeRoleRoom);
  emitRealtimeEvent(eventName, { invalidate: true }, rooms);
};

export const emitRealtimeEvent = (eventName, detail = null, targetRooms = null) => {
  if (!realtimeServer) return;

  const payload = {
    eventName,
    detail,
    timestamp: new Date().toISOString(),
  };

  if (targetRooms !== null) {
    realtimeServer.to(targetRooms).emit('realtime:event', payload);
    return;
  }

  realtimeServer.emit('realtime:event', payload);
};
