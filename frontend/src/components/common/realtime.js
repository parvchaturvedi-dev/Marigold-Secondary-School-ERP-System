import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN } from './api';

let realtimeSocket = null;

export const getRealtimeSocket = () => {
  if (typeof window === 'undefined') return null;
  if (realtimeSocket) return realtimeSocket;

  realtimeSocket = io(API_ORIGIN || window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    timeout: 20000,
    reconnectionAttempts: 5,
  });

  return realtimeSocket;
};

export const useRealtimeBridge = () => {
  useEffect(() => {
    const handleRealtimeEvent = ({ eventName, detail }) => {
      if (!eventName) return;
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    };

    let socket = null;
    const setArchiveMode = (activeSession) => {
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

    if (window.mgpsDesktop?.archives) {
      const unsubscribe = window.mgpsDesktop.archives.onActiveChanged(setArchiveMode);
      window.mgpsDesktop.archives.getActive().then(setArchiveMode).catch((error) => {
        console.error('Unable to load desktop session for realtime mode:', error);
      });
      return () => {
        unsubscribe();
        socket?.off('realtime:event', handleRealtimeEvent);
      };
    }
    setArchiveMode(null);
    return () => socket?.off('realtime:event', handleRealtimeEvent);
  }, []);
};
