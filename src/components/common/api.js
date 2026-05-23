export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '/api';

export const API_ORIGIN = (() => {
  if (typeof window === 'undefined') return '';

  if (!API_BASE_URL || API_BASE_URL.startsWith('/')) {
    return window.location.origin;
  }

  try {
    return new URL(API_BASE_URL, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
})();

const AUTH_STORAGE_KEY = 'mgps_erp_auth_session';

export const getAuthToken = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}')?.token || '';
  } catch {
    return '';
  }
};

export const withAuthHeaders = (headers = {}) => {
  const token = getAuthToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
};

export const authFetch = (url, options = {}) =>
  fetch(url, {
    ...options,
    credentials: 'include',
    headers: withAuthHeaders(options.headers || {}),
  });

export const apiFetch = async (path, options = {}) => {
  const response = await authFetch(`${API_BASE_URL}${path}`, options);
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || `API request failed with status ${response.status}`);
  }

  return payload;
};
