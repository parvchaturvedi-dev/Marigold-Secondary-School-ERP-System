import axios from 'axios';

const normalizeApiBaseUrl = (value) => {
  const rawValue = String(value || '/api').trim().replace(/\/+$/, '');
  if (!rawValue) return '/api';

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const url = new URL(rawValue);
      if (!url.pathname || url.pathname === '/') {
        url.pathname = '/api';
      } else if (!url.pathname.replace(/\/+$/, '').endsWith('/api')) {
        url.pathname = `${url.pathname.replace(/\/+$/, '')}/api`;
      }
      return url.toString().replace(/\/$/, '');
    } catch {
      return rawValue;
    }
  }

  return rawValue.endsWith('/api') ? rawValue : `${rawValue}/api`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

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

export const api = axios.create({
  baseURL: API_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : ''),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const toResponseLike = (response) => ({
  ok: response.status >= 200 && response.status < 300,
  status: response.status,
  headers: {
    get: (name) => response.headers?.[String(name).toLowerCase()] || null,
  },
  json: async () => response.data,
  text: async () =>
    typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
  data: response.data,
});

const normalizeApiPath = (path) => {
  const value = String(path || '');
  if (!value) return '/api';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(API_BASE_URL)) return value;
  if (value.startsWith('/api/')) return value;
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${API_BASE_URL}${normalized}`;
};

export const authFetch = async (url, options = {}) => {
  const response = await api.request({
    url: normalizeApiPath(url),
    method: options.method || 'GET',
    data: options.body,
    params: options.params,
    headers: withAuthHeaders(options.headers || {}),
    validateStatus: () => true,
  });

  return toResponseLike(response);
};

export const apiFetch = async (path, options = {}) => {
  const response = await authFetch(path, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || `API request failed with status ${response.status}`);
  }

  return payload;
};

export default api;
