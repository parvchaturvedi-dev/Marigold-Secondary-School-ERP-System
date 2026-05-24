import { apiFetch, authFetch } from './api';
import { AUTH_STORAGE_KEY, hydrateStudentSession } from './auth';

export const SESSION_UPDATED_EVENT = 'mgps-erp-session-updated';

export const publishSessionUpdate = (session) => {
  if (!session) return null;
  const hydratedSession = session.role === 'student' ? hydrateStudentSession(session) : session;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(hydratedSession));
  window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT, { detail: hydratedSession }));
  return hydratedSession;
};

export const uploadProfilePhoto = async (file) => {
  const formData = new FormData();
  formData.append('photo', file);

  const response = await authFetch('/auth/profile-photo', {
    method: 'PATCH',
    body: formData,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message || 'Profile photo could not be saved.');
  return publishSessionUpdate(payload);
};

export const refreshSessionFromDatabase = async () => {
  const session = await apiFetch('/auth/session');
  return publishSessionUpdate(session);
};
