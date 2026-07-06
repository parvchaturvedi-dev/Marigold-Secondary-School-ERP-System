import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_API_BASE_URL = "https://marigold-secondary-school-erp-system.onrender.com/api";

function normalizeApiBaseUrl(value) {
  const rawValue = String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
  if (!rawValue) return DEFAULT_API_BASE_URL;
  return rawValue.endsWith("/api") ? rawValue : `${rawValue}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

// AuthContext registers a handler here so that any 401 (missing/expired/invalid
// session) auto-logs-out to the login screen instead of surfacing a raw
// "Authentication required" error that leaves the user stuck.
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function apiRequest(endpoint, options = {}) {
  let token = null;
  try {
    const sessionStr = await AsyncStorage.getItem("mgps_erp_auth_session");
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      token = session.token;
    }
  } catch (err) {
    console.error("Failed to fetch token", err);
  }

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { message: text };
        }
      })()
    : null;

  // 401 = not authenticated (missing/expired/invalid session). Clear the stale
  // session and trigger auto-logout so the app returns to Login instead of
  // showing an "Authentication required" error.
  if (response.status === 401) {
    try {
      await AsyncStorage.removeItem("mgps_erp_auth_session");
    } catch {
      /* noop */
    }
    if (onUnauthorized) {
      try {
        onUnauthorized();
      } catch {
        /* noop */
      }
    }
    throw new Error(data?.message || "Your session has expired. Please sign in again.");
  }

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}
