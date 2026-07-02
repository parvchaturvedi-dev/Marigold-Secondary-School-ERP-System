import { apiRequest } from "./apiClient";

export function fetchMyFees() {
  return apiRequest("/fees/me");
}

export function fetchStudentFees(admissionNumber) {
  return apiRequest(`/fees/student/${encodeURIComponent(admissionNumber)}`);
}
