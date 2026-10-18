import axios from 'axios';

const PRODUCTION_API_BASE_URL = 'https://marigold-secondary-school-erp-system.onrender.com/api';

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

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const useProductionApiBaseUrl =
  import.meta.env.PROD &&
  (!configuredApiBaseUrl || configuredApiBaseUrl.trim().startsWith('/'));

export const API_BASE_URL = normalizeApiBaseUrl(
  useProductionApiBaseUrl
    ? PRODUCTION_API_BASE_URL
    : configuredApiBaseUrl || '/api'
);

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

// Turn a relative media path from the API ('/api/media/event/123?t=…') into an
// absolute URL. These links carry their own per-asset signed token, so they work
// in a plain <img src> / <a href>, which cannot send an Authorization header.
export const mediaUrl = (path) => (path ? `${API_ORIGIN}${path}` : '');

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

api.interceptors.request.use(async (config) => {
  const token = getAuthToken();
  const desktopArchives = typeof window !== 'undefined' ? window.mgpsDesktop?.archives : null;
  const activeArchive = desktopArchives ? await desktopArchives.getActive() : null;

  if (activeArchive) {
    const requestUrl = new URL(config.url || '/', config.baseURL || API_ORIGIN || window.location.origin);
    const pathname = requestUrl.pathname;
    const moduleStateMatch = pathname.match(/\/api\/module-state\/([^/]+)\/?$/);
    const isExamState = pathname === '/api/examinations/state';

    if (pathname.startsWith('/api/auth/')) {
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    }

    if (
      String(config.method || 'get').toLowerCase() === 'get' &&
      ['/api/desktop-sessions/current-session', '/api/desktop-sessions/rollover-preview'].includes(pathname)
    ) {
      return config;
    }

    if (
      (!moduleStateMatch && !isExamState) ||
      !['get', 'put'].includes(String(config.method || 'get').toLowerCase())
    ) {
      throw new Error(
        `This feature is not available in the local ${activeArchive.name} session. Online data was not changed.`
      );
    }

    const method = String(config.method || 'get').toLowerCase();
    if (method === 'put' && (activeArchive.kind !== 'past' || activeArchive.status !== 'draft')) {
      throw new Error('Archived snapshots are read-only.');
    }
    const namespace = isExamState ? 'desktop-examination-state' : decodeURIComponent(moduleStateMatch[1]);

    config.adapter = async (requestConfig) => {
      if (method === 'get') {
        const value = await desktopArchives.readCollection(activeArchive.id, namespace);
        return {
          data: isExamState ? value : { value },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: requestConfig,
          request: null,
        };
      }

      const body = typeof requestConfig.data === 'string'
        ? JSON.parse(requestConfig.data)
        : requestConfig.data;
      const value = body?.value ?? null;
      const collectionValue = isExamState ? body?.state ?? null : value;
      await desktopArchives.saveCollection(activeArchive.id, namespace, collectionValue);
      return {
        data: isExamState ? collectionValue : { value },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: requestConfig,
        request: null,
      };
    };
    return config;
  }

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response && response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('mgps-erp-session-updated', { detail: null }));
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('mgps-erp-session-updated', { detail: null }));
    }
    return Promise.reject(error);
  }
);

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
    const detail = payload?.detail ? ` ${payload.detail}` : '';
    throw new Error(`${payload?.message || `API request failed with status ${response.status}`}${detail}`);
  }

  return payload;
};

export default api;
