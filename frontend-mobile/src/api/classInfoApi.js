import { apiRequest } from "./apiClient";

/**
 * Fetch class info (roster + subject-teacher list).
 * For students, the backend auto-scopes to the caller's own class and
 * ignores/omits the className param. Teachers/admins/clerks must pass one.
 */
export function fetchClassInfo(className) {
  const query = className ? `?className=${encodeURIComponent(className)}` : "";
  return apiRequest(`/class-info${query}`);
}
