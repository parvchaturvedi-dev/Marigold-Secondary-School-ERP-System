import { apiRequest } from "./apiClient";

const moduleNamespaces = {
  "Class Management": "admin-class-management-classes",
  "Class Preferences": "admin-class-preferences",
  "Clerk Management": "admin-clerk-management-list",
  "Communication": "admin-communication-messages",
  "Documents Management": "admin-document-requirements",
  "Feature Page": "admin-feature-page",
  "Finance": "admin-finance-class-ledgers",
  "Student Management": "admin-student-management-students",
  "Student Assigning": "admin-student-management-students",
  "Sibling Assigning": "admin-student-management-students",
  "Subject Management": "admin-subjects-global",
  "Teacher Management": "admin-teacher-management-list",
  "Teacher Assignment": "admin-teacher-management-list",
};

const endpointByModule = {
  "Academic Calendar": { endpoint: "/academic-calendar/latest", extractor: (payload) => (payload ? [payload] : []) },
  "Admin Management": { endpoint: "/auth/users", extractor: (payload) => payload?.users || payload || [] },
  "Application": { endpoint: "/applications" },
  "Assignment": { endpoint: "/assignments" },
  "Events": { endpoint: "/events" },
  "Examination Desk": { endpoint: "/examinations/state", extractor: flattenExamState },
  "Exam Creation": { endpoint: "/examinations/state", extractor: (payload) => payload?.exams || [] },
  "Paper Creation": { endpoint: "/examinations/state", extractor: (payload) => payload?.papers || [] },
  "Paper Analysis": { endpoint: "/examinations/state", extractor: (payload) => payload?.schedules || payload?.papers || [] },
  "Paper Selected": { endpoint: "/examinations/state", extractor: (payload) => payload?.deliveries || [] },
  "Report Card Management...": { endpoint: "/examinations/state", extractor: (payload) => payload?.boardResults || [] },
  "Marks Management": { endpoint: "/examinations/state", extractor: (payload) => payload?.marks || [] },
  "Id Card": { endpoint: "/dashboard/summary", extractor: (payload) => [payload?.profile || {}] },
  "ID Card": { endpoint: "/dashboard/summary", extractor: (payload) => [payload?.profile || {}] },
  "Leave Requests": { endpoint: "/leave-requests" },
  "Meetings": { endpoint: "/meetings" },
  "My Class": { endpoint: "/dashboard/summary", extractor: (payload) => [payload?.profile || {}] },
  "Notices": { endpoint: "/notifications" },
  "Profile": { endpoint: "/dashboard/summary", extractor: (payload) => [payload?.profile || {}] },
  "Settings": { endpoint: "/auth/session", extractor: (payload) => [payload || {}] },
  "Users Management": { endpoint: "/auth/users", extractor: (payload) => payload?.users || payload || [] },
  "Vault": { endpoint: "/vault", extractor: (payload) => payload?.items || [] },
};

function normalizeTitle(moduleName = "") {
  const parts = String(moduleName).split(">").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || String(moduleName).trim();
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

function getStudentProfile(user = {}) {
  return user.activeStudent || user.studentProfiles?.[0] || {};
}

function getClassName(user = {}) {
  const student = getStudentProfile(user);
  return student.className || user.assignedClassTeacherFor || user.teacherProfile?.assignedClassTeacherFor || "";
}

function getIdentityId(user = {}) {
  const student = getStudentProfile(user);
  return student.id || student.admissionNumber || user.username || "";
}

function getAllottedClasses(user = {}) {
  const raw = user.allottedClasses || user.teacherProfile?.allottedClasses || [];
  return Array.isArray(raw) ? raw.join(",") : raw;
}

function scopedParams(user = {}) {
  const student = getStudentProfile(user);
  return {
    role: user.role,
    username: user.username,
    className: getClassName(user),
    identityId: getIdentityId(user),
    identityName: student.displayName || user.displayName || user.name,
    studentId: getIdentityId(user),
    allottedClasses: getAllottedClasses(user),
  };
}

function flattenExamState(payload = {}) {
  return [
    ...(payload.exams || []).map((item) => ({ ...item, type: "Exam" })),
    ...(payload.papers || []).map((item) => ({ ...item, type: "Paper" })),
    ...(payload.schedules || []).map((item) => ({ ...item, type: "Schedule" })),
    ...(payload.marks || []).map((item) => ({ ...item, type: "Marks" })),
    ...(payload.deliveries || []).map((item) => ({ ...item, type: "Delivery" })),
    ...(payload.boardResults || []).map((item) => ({ ...item, type: "Board Result" })),
  ];
}

export function getModuleConfig(moduleName) {
  const title = normalizeTitle(moduleName);
  if (moduleNamespaces[title]) {
    return {
      title,
      endpoint: `/module-state/${encodeURIComponent(moduleNamespaces[title])}`,
      extractor: (payload) => payload?.value || [],
      namespace: moduleNamespaces[title],
    };
  }

  return {
    title,
    ...(endpointByModule[title] || {
      endpoint: "/dashboard/summary",
      extractor: (payload) => [payload?.profile || payload || {}],
    }),
  };
}

export async function fetchModuleData(moduleName, user) {
  const config = getModuleConfig(moduleName);
  const scoped = scopedParams(user);
  const endpointNeedsQuery = !config.endpoint.includes("/dashboard/summary") && !config.endpoint.includes("/auth/session");
  const payload = await apiRequest(`${config.endpoint}${endpointNeedsQuery ? buildQuery(scoped) : ""}`);
  const rows = config.extractor ? config.extractor(payload) : payload;
  return {
    config,
    payload,
    rows: Array.isArray(rows) ? rows : rows ? [rows] : [],
  };
}

export async function markNotificationsRead(ids = []) {
  return apiRequest("/notifications/read", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function participateInEvent(eventId, user = {}) {
  const student = getStudentProfile(user);
  return apiRequest(`/events/${eventId}/participate`, {
    method: "PATCH",
    body: JSON.stringify({
      admissionNumber: student.admissionNumber || student.id || user.username,
      name: student.displayName || user.displayName || user.name,
      fatherName: student.fatherName || "",
      className: student.className || "",
      username: user.username,
    }),
  });
}
