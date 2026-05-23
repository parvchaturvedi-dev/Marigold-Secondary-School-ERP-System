import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  clearSession,
  getDashboardPath,
  getStoredSession,
  saveStudentSelection,
  saveSession,
} from './components/common/auth';
import AdminLayout from './layouts/AdminLayout';
import ClerkLayout from './layouts/ClerkLayout';
import StudentLayout from './layouts/StudentLayout';
import TeacherLayout from './layouts/TeacherLayout';

import Login from './pages/Auth/Login';

import AdminDashboard from './pages/Admin/Dashboard';
import AdminAcademicCalender from './pages/Admin/AcademicCalender';
import AdminApplication from './pages/Admin/Application';
import AdminAssignment from './pages/Admin/Assignment';
import AdminAttendance from './pages/Admin/Attendance';
import AdminClassManagement from './pages/Admin/ClassManagement';
import AdminClerkManagement from './pages/Admin/ClerkManagement';
import AdminClerkProfile from './pages/Admin/ClerkProfile';
import AdminCommunication from './pages/Admin/Communication';
import AdminDocumentsManagement from './pages/Admin/DocumentsManagement';
import AdminEvents from './pages/Admin/Events';
import AdminExaminations from './pages/Admin/Examinations';
import AdminFeaturePage from './pages/Admin/FeaturePage';
import AdminFinance from './pages/Admin/Finance';
import AdminIdCard from './pages/Admin/IdCard';
import AdminLeaveRequests from './pages/Admin/LeaveRequests';
import AdminMeetings from './pages/Admin/Meetings';
import AdminNotices from './pages/Admin/Notices';
import AdminProfile from './pages/Admin/Profile';
import AdminStudentProfile from './pages/Admin/StudentProfile';
import AdminSubjectManagement from './pages/Admin/SubjectManagement';
import AdminTeacherManagement from './pages/Admin/TeacherManagement';
import AdminTeacherProfile from './pages/Admin/TeacherProfile';
import AdminClassPreferences from './pages/Admin/ClassPreferences';
import AdminTeacherAssignment from './pages/Admin/TeacherAssignment';
import AdminSettings from './pages/Admin/Settings';
import AdminStudentAssigning from './pages/Admin/StudentAssigning';
import AdminSiblingAssigning from './pages/Admin/SiblingAssigning';
import AdminStudentManagement from './pages/Admin/StudentManagement';
import AdminClassFinanceList from './pages/Admin/ClassFinanceList';
import AdminStudentLedger from './pages/Admin/StudentLedger';
import AdminFeesReceipt from './pages/Admin/FeesReceipt';
import AdminUsersManagement from './pages/Admin/UsersManagement';

import ClerkDashboard from './pages/Clerk/Dashboard';
import ClerkAcademicCalender from './pages/Clerk/AcademicCalender';
import ClerkApplication from './pages/Clerk/Application';
import ClerkAssignment from './pages/Clerk/Assignment';
import ClerkAttendance from './pages/Clerk/Attendance';
import ClerkClassManagement from './pages/Clerk/ClassManagement';
import ClerkClassPreferences from './pages/Clerk/ClassPreferences';
import ClerkCommunication from './pages/Clerk/Communication';
import ClerkDocumentsManagement from './pages/Clerk/DocumentsManagement';
import ClerkEvents from './pages/Clerk/Events';
import ClerkExaminations from './pages/Clerk/Examinations';
import ClerkIdCard from './pages/Clerk/IdCard';
import ClerkLeaveRequests from './pages/Clerk/LeaveRequests';
import ClerkMeetings from './pages/Clerk/Meetings';
import ClerkNotices from './pages/Clerk/Notices';
import ClerkProfile from './pages/Clerk/Profile';
import ClerkSettings from './pages/Clerk/Settings';
import ClerkSiblingAssigning from './pages/Clerk/SiblingAssigning';
import ClerkStudentAssigning from './pages/Clerk/StudentAssigning';
import ClerkStudentManagement from './pages/Clerk/StudentManagement';
import ClerkStudentProfile from './pages/Clerk/StudentProfile';
import ClerkSubjectManagement from './pages/Clerk/SubjectManagement';
import ClerkTeacherAssignment from './pages/Clerk/TeacherAssignment';
import ClerkTeacherManagement from './pages/Clerk/TeacherManagement';
import ClerkTeacherProfile from './pages/Clerk/TeacherProfile';

import StudentDashboard from './pages/Student/Dashboard';
import StudentAcademicCalender from './pages/Student/AcademicCalender';
import StudentApplication from './pages/Student/Application';
import StudentAssignment from './pages/Student/Assignment';
import StudentAttendance from './pages/Student/Attendance';
import StudentCommunication from './pages/Student/Communication';
import StudentEvents from './pages/Student/Events';
import StudentExaminations from './pages/Student/Examinations';
import StudentFees from './pages/Student/Fees';
import StudentIdCard from './pages/Student/IdCard';
import StudentLeaveRequests from './pages/Student/LeaveRequests';
import StudentMeetings from './pages/Student/Meetings';
import StudentMyClass from './pages/Student/MyClass';
import StudentNotices from './pages/Student/Notices';
import StudentProfile from './pages/Student/Profile';
import StudentSettings from './pages/Student/Settings';

import TeacherDashboard from './pages/Teacher/Dashboard';
import TeacherAcademicCalender from './pages/Teacher/AcademicCalender';
import TeacherApplication from './pages/Teacher/Application';
import TeacherAssignment from './pages/Teacher/Assignment';
import TeacherAttendance from './pages/Teacher/Attendance';
import TeacherCommunication from './pages/Teacher/Communication';
import TeacherEvents from './pages/Teacher/Events';
import TeacherExaminations from './pages/Teacher/Examinations';
import TeacherIdCard from './pages/Teacher/IdCard';
import TeacherLeaveRequests from './pages/Teacher/LeaveRequests';
import TeacherMeetings from './pages/Teacher/Meetings';
import TeacherMyClass from './pages/Teacher/MyClass';
import TeacherNotices from './pages/Teacher/Notices';
import TeacherProfile from './pages/Teacher/Profile';
import TeacherSettings from './pages/Teacher/Settings';

const adminPages = {
  Dashboard: AdminDashboard,
  'Academic Calender': AdminAcademicCalender,
  Application: AdminApplication,
  Assignment: AdminAssignment,
  Attendance: AdminAttendance,
  'Class Management': AdminClassManagement,
  'Clerk Management': AdminClerkManagement,
  'Clerk Profile': AdminClerkProfile,
  Communication: AdminCommunication,
  'Documents Management': AdminDocumentsManagement,
  Events: AdminEvents,
  Examinations: AdminExaminations,
  'Exam Creation': AdminExaminations,
  'Paper Creation': AdminExaminations,
  'Paper Analysis': AdminExaminations,
  'Paper Selected': AdminExaminations,
  'Report Card Management': AdminExaminations,
  'Marks Management': AdminExaminations,
  'Feature Page': AdminFeaturePage,
  Finance: AdminFinance,
  'Id Card': AdminIdCard,
  'Leave Requests': AdminLeaveRequests,
  Meetings: AdminMeetings,
  Notices: AdminNotices,
  Profile: AdminProfile,
  'Student Ledger': AdminStudentLedger,
  'Student Profile': AdminStudentProfile,
  'Subject Management': AdminSubjectManagement,
  'Teacher Management': AdminTeacherManagement,
  'Teacher Assignment': AdminTeacherAssignment,
  'Teacher Profile': AdminTeacherProfile,
  'Class Finance List': AdminClassFinanceList,
  Settings: AdminSettings,
  'Student Assigning': AdminStudentAssigning,
  'Student Management': AdminStudentManagement,
  'Sibling Assigning': AdminSiblingAssigning,
  'Class Preferences': AdminClassPreferences,
  'Fees Receipt': AdminFeesReceipt,
  'Users Management': AdminUsersManagement,
};

const clerkPages = {
  Dashboard: ClerkDashboard,
  'Academic Calender': ClerkAcademicCalender,
  Application: ClerkApplication,
  Assignment: ClerkAssignment,
  Attendance: ClerkAttendance,
  'Class Management': ClerkClassManagement,
  'Class Preferences': ClerkClassPreferences,
  Communication: ClerkCommunication,
  'Documents Management': ClerkDocumentsManagement,
  Events: ClerkEvents,
  Examinations: ClerkExaminations,
  'Exam Creation': ClerkExaminations,
  'Paper Creation': ClerkExaminations,
  'Paper Analysis': ClerkExaminations,
  'Paper Selected': ClerkExaminations,
  'Marks Management': ClerkExaminations,
  'Id Card': ClerkIdCard,
  'Leave Requests': ClerkLeaveRequests,
  Meetings: ClerkMeetings,
  Notices: ClerkNotices,
  Profile: ClerkProfile,
  Settings: ClerkSettings,
  'Sibling Assigning': ClerkSiblingAssigning,
  'Student Assigning': ClerkStudentAssigning,
  'Student Management': ClerkStudentManagement,
  'Student Profile': ClerkStudentProfile,
  'Subject Management': ClerkSubjectManagement,
  'Teacher Assignment': ClerkTeacherAssignment,
  'Teacher Management': ClerkTeacherManagement,
  'Teacher Profile': ClerkTeacherProfile,
};

const studentPages = {
  Dashboard: StudentDashboard,
  'Academic Calender': StudentAcademicCalender,
  'My Class': StudentMyClass,
  Application: StudentApplication,
  Assignment: StudentAssignment,
  Attendance: StudentAttendance,
  Communication: StudentCommunication,
  Events: StudentEvents,
  Examinations: StudentExaminations,
  Fees: StudentFees,
  'Id Card': StudentIdCard,
  'Leave Requests': StudentLeaveRequests,
  Meetings: StudentMeetings,
  Notices: StudentNotices,
  Profile: StudentProfile,
  Settings: StudentSettings,
};

const teacherPages = {
  Dashboard: TeacherDashboard,
  'Academic Calender': TeacherAcademicCalender,
  'My Class': TeacherMyClass,
  Application: TeacherApplication,
  Assignment: TeacherAssignment,
  Attendance: TeacherAttendance,
  Communication: TeacherCommunication,
  Events: TeacherEvents,
  Examinations: TeacherExaminations,
  'Paper Analysis': TeacherExaminations,
  'Marks Management': TeacherExaminations,
  'Id Card': TeacherIdCard,
  'Leave Requests': TeacherLeaveRequests,
  Meetings: TeacherMeetings,
  Notices: TeacherNotices,
  Profile: TeacherProfile,
  Settings: TeacherSettings,
};

const portalConfigs = {
  admin: { pages: adminPages, defaultPage: 'Dashboard' },
  clerk: { pages: clerkPages, defaultPage: 'Dashboard' },
  student: { pages: studentPages, defaultPage: 'Dashboard' },
  teacher: { pages: teacherPages, defaultPage: 'Dashboard' },
};

const portalLayouts = {
  admin: AdminLayout,
  clerk: ClerkLayout,
  student: StudentLayout,
  teacher: TeacherLayout,
};

const slugify = (pageName) =>
  pageName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const buildPageRoutes = (pages) =>
  Object.keys(pages).map((name) => ({
    name,
    path: slugify(name),
  }));

function ProtectedPortal({ allowedRole, session, onLogout, onStudentChange }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== allowedRole) {
    return <Navigate to={getDashboardPath(session.role)} replace />;
  }

  return (
    <PortalShell
      role={allowedRole}
      session={session}
      onLogout={onLogout}
      onStudentChange={onStudentChange}
    />
  );
}

function LoginRoute({ session, onLoginSuccess }) {
  if (session) {
    return <Navigate to={getDashboardPath(session.role)} replace />;
  }

  return <Login onLoginSuccess={onLoginSuccess} />;
}

function PortalShell({ role, session, onLogout, onStudentChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pages, defaultPage } = portalConfigs[role];
  const Layout = portalLayouts[role];
  const pageRoutes = buildPageRoutes(pages);
  const currentPath = location.pathname.split('/').filter(Boolean)[1];
  const matchedRoute = pageRoutes.find((page) => page.path === currentPath);
  const activePage = matchedRoute?.name || defaultPage;
  const ActivePage = pages[activePage] || pages[defaultPage];

  const handlePageChange = (pageName) => {
    const nextRoute = pageRoutes.find((page) => page.name === pageName);
    if (nextRoute) {
      navigate(`/${role}/${nextRoute.path}`);
    }
  };

  useEffect(() => {
    if (!matchedRoute) {
      navigate(`/${role}/${slugify(defaultPage)}`, { replace: true });
    }
  }, [defaultPage, matchedRoute, navigate, role]);

  return (
    <Layout
      session={session}
      onLogout={onLogout}
      onPageChange={handlePageChange}
      onStudentChange={onStudentChange}
      currentActive={activePage}
    >
      <ActivePage
        setActivePage={handlePageChange}
        session={session}
        role={role}
        activePage={activePage}
      />
    </Layout>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getStoredSession());

  const handleLoginSuccess = (authPayload) => {
    const nextSession = saveSession(authPayload);
    if (!nextSession) return;

    setSession(nextSession);
    navigate(getDashboardPath(nextSession.role), { replace: true });
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    navigate('/login', { replace: true });
  };

  const handleStudentChange = (studentId) => {
    const nextSession = saveStudentSelection(session, studentId);
    if (!nextSession) return;
    setSession(nextSession);
  };

  const homePath = session ? getDashboardPath(session.role) : '/login';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homePath} replace />} />
      <Route
        path="/login"
        element={<LoginRoute session={session} onLoginSuccess={handleLoginSuccess} />}
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedPortal
            allowedRole="admin"
            session={session}
            onLogout={handleLogout}
            onStudentChange={handleStudentChange}
          />
        }
      />
      <Route
        path="/clerk/*"
        element={
          <ProtectedPortal
            allowedRole="clerk"
            session={session}
            onLogout={handleLogout}
            onStudentChange={handleStudentChange}
          />
        }
      />
      <Route
        path="/student/*"
        element={
          <ProtectedPortal
            allowedRole="student"
            session={session}
            onLogout={handleLogout}
            onStudentChange={handleStudentChange}
          />
        }
      />
      <Route
        path="/teacher/*"
        element={
          <ProtectedPortal
            allowedRole="teacher"
            session={session}
            onLogout={handleLogout}
            onStudentChange={handleStudentChange}
          />
        }
      />
      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
