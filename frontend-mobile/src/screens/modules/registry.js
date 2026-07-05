// Central registry of bespoke module screens keyed by their (normalized) title.
// ConnectedModuleScreen looks a title up here first; anything not registered
// falls back to the generic data/list renderer.
import SettingsScreen from "./settings/SettingsScreen";
import AdminManagementScreen from "./users/AdminManagementScreen";
import UsersManagementScreen from "./users/UsersManagementScreen";
import StudentManagementScreen from "./students/StudentManagementScreen";
import SiblingAssigningScreen from "./students/SiblingAssigningScreen";
import ClerkManagementScreen from "./clerks/ClerkManagementScreen";
import SubjectManagementScreen from "./subjects/SubjectManagementScreen";
import DocumentsManagementScreen from "./documents/DocumentsManagementScreen";
import TeacherManagementScreen from "./faculty/TeacherManagementScreen";
import AcademicCalendarScreen from "./academic/AcademicCalendarScreen";
import ClassManagementScreen from "./classes/ClassManagementScreen";
import TimetableEditorScreen from "./timetable/TimetableEditorScreen";
import FinanceScreen from "./finance/FinanceScreen";
import PayrollScreen from "./payroll/PayrollScreen";
import ExaminationManageScreen from "./examinations/ExaminationManageScreen";
import VaultScreen from "./vault/VaultScreen";
import AiAssistantScreen from "./assistant/AiAssistantScreen";

export const moduleScreens = {
  Settings: SettingsScreen,
  "Admin Management": AdminManagementScreen,
  "Users Management": UsersManagementScreen,
  "Student Management": StudentManagementScreen,
  "Student Assigning": StudentManagementScreen,
  "Sibling Assigning": SiblingAssigningScreen,
  "Clerk Management": ClerkManagementScreen,
  "Subject Management": SubjectManagementScreen,
  "Documents Management": DocumentsManagementScreen,
  "Teacher Management": TeacherManagementScreen,
  "Academic Calendar": AcademicCalendarScreen,
  "Class Management": ClassManagementScreen,
  "Class Preferences": ClassManagementScreen,
  Timetable: TimetableEditorScreen,
  Finance: FinanceScreen,
  Payroll: PayrollScreen,
  "Exam Creation": ExaminationManageScreen,
  "Paper Creation": ExaminationManageScreen,
  "Marks Management": ExaminationManageScreen,
  Vault: VaultScreen,
  "Feature Page": AiAssistantScreen,
};

export function resolveModuleScreen(title) {
  return moduleScreens[title] || null;
}
