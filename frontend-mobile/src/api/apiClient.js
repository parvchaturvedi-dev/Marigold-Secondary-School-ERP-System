import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_API_BASE_URL = "https://marigold-secondary-school-erp-system.onrender.com/api";

function normalizeApiBaseUrl(value) {
  const rawValue = String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
  if (!rawValue) return DEFAULT_API_BASE_URL;
  return rawValue.endsWith("/api") ? rawValue : `${rawValue}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

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

  const headers = {
    "Content-Type": "application/json",
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

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}
