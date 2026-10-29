import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN, getAuthToken } from './api';

let realtimeSocket = null;

export const getRealtimeSocket = () => {
  if (typeof window === 'undefined') return null;
  if (realtimeSocket) return realtimeSocket;

  realtimeSocket = io(API_ORIGIN || window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: (callback) => callback({ token: getAuthToken() }),
    timeout: 20000,
    reconnectionAttempts: 5,
  });

  return realtimeSocket;
};

export const useRealtimeBridge = () => {
  useEffect(() => {
    let isArchiveMode = false;
    const handleRealtimeEvent = ({ eventName, detail, invalidate }) => {
      if (!eventName) return;
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: invalidate ? { __moduleStateInvalidation: true } : detail,
        })
      );
    };

    let socket = null;
    const handleSessionUpdate = (event) => {
      if (!socket || isArchiveMode) return;
      socket.disconnect();
      if (event.detail?.username) socket.connect();
    };
    const setArchiveMode = (activeSession) => {
      isArchiveMode = Boolean(activeSession);
      if (activeSession) {
        if (socket) {
          socket.off('realtime:event', handleRealtimeEvent);
          socket.disconnect();
          if (realtimeSocket === socket) realtimeSocket = null;
          socket = null;
        }
        return;
      }
      if (!socket) {
        socket = getRealtimeSocket();
        socket?.on('realtime:event', handleRealtimeEvent);
      }
    };

    window.addEventListener('mgps-erp-session-updated', handleSessionUpdate);
    if (window.mgpsDesktop?.archives) {
      const unsubscribe = window.mgpsDesktop.archives.onActiveChanged(setArchiveMode);
      window.mgpsDesktop.archives.getActive().then(setArchiveMode).catch((error) => {
        console.error('Unable to load desktop session for realtime mode:', error);
      });
      return () => {
        unsubscribe();
        window.removeEventListener('mgps-erp-session-updated', handleSessionUpdate);
        socket?.off('realtime:event', handleRealtimeEvent);
      };
    }
    setArchiveMode(null);
    return () => {
      window.removeEventListener('mgps-erp-session-updated', handleSessionUpdate);
      socket?.off('realtime:event', handleRealtimeEvent);
    };
  }, []);
};
