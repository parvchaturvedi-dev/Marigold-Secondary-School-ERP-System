import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, authFetch, withAuthHeaders } from './api';

export const NOTIFICATIONS_UPDATED_EVENT = 'mgps-erp-notifications-updated';

const NOTIFICATIONS_API_URL = `${API_BASE_URL}/notifications`;

const getNotificationQuery = (session = {}) => {
  const activeStudent = session.activeStudent || session.studentProfiles?.[0] || {};
  const params = new URLSearchParams({
    role: session.role || '',
    username: session.username || '',
    className: activeStudent.className || '',
    studentId: activeStudent.id || activeStudent.admissionNumber || '',
  });

  return params.toString();
};

export const formatNotificationTime = (value) => {
  if (!value) return 'Now';

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const useNotificationsDatabase = (session = {}) => {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    if (!session?.username || !session?.role) return;
    setError('');

    try {
      const response = await authFetch(`${NOTIFICATIONS_API_URL}?${getNotificationQuery(session)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Notifications could not be loaded.');
      setNotifications(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [session]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, loadNotifications);
    return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, loadNotifications);
  }, [loadNotifications]);

  const markRead = useCallback(
    async (ids = []) => {
      const targetIds = ids.filter(Boolean);
      if (!targetIds.length) return;

      const response = await authFetch(`${NOTIFICATIONS_API_URL}/read`, {
        method: 'PATCH',
        headers: withAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ids: targetIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Notifications could not be marked read.');
      await loadNotifications();
    },
    [loadNotifications]
  );

  return { notifications, error, markRead, reloadNotifications: loadNotifications };
};
