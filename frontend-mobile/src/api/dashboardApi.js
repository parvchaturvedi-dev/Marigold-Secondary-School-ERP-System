import { apiRequest } from "./apiClient";

export function fetchDashboardSummary() {
  return apiRequest("/dashboard/summary");
}
