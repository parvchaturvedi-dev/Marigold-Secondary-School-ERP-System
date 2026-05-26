import { fetchDashboardSummary } from "./dashboardApi";

export async function getStudentDashboard() {
  return fetchDashboardSummary();
}
