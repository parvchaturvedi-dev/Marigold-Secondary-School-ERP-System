import { apiRequest } from "./apiClient";

export const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export function cellKey(periodId, className) {
  return `${periodId}__${className}`;
}

export function createEmptyTimetable() {
  return {
    name: "Default Timetable",
    mode: "default",
    fromDate: "",
    toDate: "",
    classes: ["Class 1", "Class 2", "Class 3"],
    periods: [
      { id: "period-1", label: "Period 1", time: "08:30 - 09:10" },
      { id: "period-2", label: "Period 2", time: "09:10 - 09:50" },
      { id: "period-3", label: "Period 3", time: "09:50 - 10:30" },
    ],
    cells: {},
  };
}

export async function fetchEffectiveTimetable(date = todayIsoDate(), className = "") {
  return apiRequest(`/timetable?date=${encodeURIComponent(date)}&className=${encodeURIComponent(className)}`);
}

export async function fetchTimetableTemplates() {
  return apiRequest("/timetable/templates");
}

export async function saveTimetableTemplate(payload) {
  return apiRequest("/timetable", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
