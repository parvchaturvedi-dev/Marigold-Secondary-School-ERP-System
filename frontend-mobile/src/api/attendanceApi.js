import { apiRequest } from "./apiClient";

function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      search.set(key, String(value));
    }
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function fetchAttendanceOverview(params = {}) {
  return apiRequest(`/attendance/overview${queryString(params)}`);
}

export function fetchAttendanceLogs(params = {}) {
  return apiRequest(`/attendance/logs${queryString(params)}`);
}

export function fetchAttendanceDirectory(params = {}) {
  return apiRequest(`/attendance/directory${queryString(params)}`);
}

export function saveAttendanceSettings(payload) {
  return apiRequest("/attendance/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function saveStudentAttendanceBatch(payload) {
  return apiRequest("/attendance/students/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function clockAttendance(payload) {
  return apiRequest("/attendance/clock", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
