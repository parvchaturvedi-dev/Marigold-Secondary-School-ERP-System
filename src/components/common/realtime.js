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
  });

  return realtimeSocket;
};

export const useRealtimeBridge = () => {
  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return undefined;

    const handleRealtimeEvent = ({ eventName, detail }) => {
      if (!eventName) return;
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    };

    socket.on('realtime:event', handleRealtimeEvent);

    return () => {
      socket.off('realtime:event', handleRealtimeEvent);
    };
  }, []);
};

