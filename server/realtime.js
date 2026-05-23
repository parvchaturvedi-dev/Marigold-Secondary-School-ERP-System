let realtimeServer = null;

export const setRealtimeServer = (io) => {
  realtimeServer = io;
};

export const emitRealtimeEvent = (eventName, detail = null) => {
  if (!realtimeServer) return;

  realtimeServer.emit('realtime:event', {
    eventName,
    detail,
    timestamp: new Date().toISOString(),
  });
};

