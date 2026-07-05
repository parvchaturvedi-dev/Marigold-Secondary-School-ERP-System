export const studentModules = [
  { title: "Academic Calendar", icon: "calendar-outline", color: "#6366F1" },
  { title: "My Class", icon: "people-outline", color: "#2563EB" },
  { title: "Timetable", icon: "calendar-clear-outline", color: "#0F766E" },
  { title: "Application", icon: "document-text-outline", color: "#22C55E" },
  { title: "Assignment", icon: "clipboard-outline", color: "#F97316" },
  { title: "Attendance", icon: "shield-checkmark-outline", color: "#22C55E" },
  { title: "Events", icon: "calendar-number-outline", color: "#F43F5E" },
  { title: "Examinations", icon: "reader-outline", color: "#3B82F6" },
  { title: "Fees", icon: "wallet-outline", color: "#F59E0B" },
  { title: "ID Card", icon: "card-outline", color: "#06B6D4" },
  { title: "Leave Requests", icon: "airplane-outline", color: "#7C3AED" },
  { title: "Meetings", icon: "people-circle-outline", color: "#2563EB" },
  { title: "Notices", icon: "notifications-outline", color: "#F97316" },
  { title: "Profile", icon: "person-circle-outline", color: "#7C3AED" },
  { title: "Vault", icon: "shield-outline", color: "#3B82F6" },
  { title: "Certification", icon: "ribbon-outline", color: "#EAB308" },
  { title: "About Us", icon: "information-circle-outline", color: "#0EA5E9" },
  { title: "Settings", icon: "settings-outline", color: "#64748B" }
];

export const bottomTabs = [
  { key: "home", title: "Home", icon: "home-outline" },
  { key: "assignment", title: "Assignment", icon: "clipboard-outline" },
  { key: "notices", title: "Notices", icon: "notifications-outline" },
  { key: "profile", title: "Profile", icon: "person-outline" }
];

export const roleModules = {
  admin: ["Dashboard", "Students", "Finance", "Attendance", "Exams", "Reports"],
  teacher: ["Classes", "Attendance", "Assignments", "Exams", "Messages"],
  clerk: ["Fees", "Receipts", "Documents", "Students", "Reports"]
};
