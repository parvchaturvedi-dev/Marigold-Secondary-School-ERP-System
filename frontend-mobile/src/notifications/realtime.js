// Realtime socket manager (singleton). The backend broadcasts a single
// `realtime:event` to every connected socket whenever server state changes
// (notices, fees, leave, meetings, assignments, etc.). Mobile authenticates the
// socket handshake with the same Bearer token used for REST calls.
import { io } from "socket.io-client";
import { API_BASE_URL } from "../api/apiClient";

const SOCKET_ORIGIN = String(API_BASE_URL || "").replace(/\/api\/?$/, "");

let socket = null;
const listeners = new Set();

function notify(payload) {
  listeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (err) {
      console.warn("realtime listener error", err?.message || err);
    }
  });
}

export function connectRealtime(token) {
  if (!token || !SOCKET_ORIGIN) return;
  // Reconnect fresh if the token changed (new login).
  if (socket) {
    if (socket.auth?.token === token && socket.connected) return;
    disconnectRealtime();
  }

  socket = io(SOCKET_ORIGIN, {
    // Allow polling fallback — Render may block plain ws upgrades.
    transports: ["polling", "websocket"],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    timeout: 10000,
  });

  socket.on("connect", () => notify({ eventName: "socket:connected" }));
  socket.on("realtime:event", (payload) => notify(payload || { eventName: "realtime:event" }));
  // Silent — realtime is a nice-to-have; app works fine over pull refresh.
  socket.on("connect_error", () => {});
}

export function disconnectRealtime() {
  if (!socket) return;
  try {
    socket.removeAllListeners();
    socket.disconnect();
  } catch (err) {
    console.warn("realtime disconnect error", err?.message || err);
  }
  socket = null;
}

// Subscribe to realtime events. Returns an unsubscribe function.
export function onRealtimeEvent(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function isRealtimeConnected() {
  return Boolean(socket?.connected);
}
