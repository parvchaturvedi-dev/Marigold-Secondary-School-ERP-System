import React, { Suspense, useEffect, useState } from 'react';
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
  fetchCurrentSession,
  getDashboardPath,
  getStoredSession,
  logoutSession,
  saveSession,
  saveStudentSelection,
} from './components/common/auth';
import { useRealtimeBridge } from './components/common/realtime';
import { SESSION_UPDATED_EVENT } from './components/common/profileStore';
import AdminLayout from './layouts/AdminLayout';
import ClerkLayout from './layouts/ClerkLayout';
import StudentLayout from './layouts/StudentLayout';
import TeacherLayout from './layouts/TeacherLayout';
import Login from './pages/Auth/Login';
import { portalRoutes } from './routes/portalRoutes';

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
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== allowedRole) return <Navigate to={getDashboardPath(session.role)} replace />;

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
  if (session) return <Navigate to={getDashboardPath(session.role)} replace />;
  return <Login onLoginSuccess={onLoginSuccess} />;
}

function PortalShell({ role, session, onLogout, onStudentChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pages, defaultPage } = portalRoutes[role];
  const Layout = portalLayouts[role];
  const pageRoutes = buildPageRoutes(pages);
  const currentPath = location.pathname.split('/').filter(Boolean)[1];
  const matchedRoute = pageRoutes.find((page) => page.path === currentPath);
  const activePage = matchedRoute?.name || defaultPage;
  const ActivePage = pages[activePage] || pages[defaultPage];

  const handlePageChange = (pageName) => {
    const nextRoute = pageRoutes.find((page) => page.name === pageName);
    if (nextRoute) navigate(`/${role}/${nextRoute.path}`);
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
      <Suspense fallback={<div className="p-6 text-xs font-semibold text-[#555555]">Loading...</div>}>
        <ActivePage
          setActivePage={handlePageChange}
          session={session}
          role={role}
          activePage={activePage}
        />
      </Suspense>
    </Layout>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getStoredSession());

  useRealtimeBridge();

  useEffect(() => {
    let isActive = true;

    fetchCurrentSession().then((serverSession) => {
      if (!isActive || !serverSession) return;
      const nextSession = saveSession(serverSession);
      if (nextSession) setSession(nextSession);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const handleSessionUpdate = (event) => {
      if (event.detail?.username) setSession(event.detail);
    };

    window.addEventListener(SESSION_UPDATED_EVENT, handleSessionUpdate);
    return () => window.removeEventListener(SESSION_UPDATED_EVENT, handleSessionUpdate);
  }, []);

  const handleLoginSuccess = (authPayload) => {
    const nextSession = saveSession(authPayload);
    if (!nextSession) return;
    setSession(nextSession);
    navigate(getDashboardPath(nextSession.role), { replace: true });
  };

  const handleLogout = async () => {
    await logoutSession();
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
      <Route path="/login" element={<LoginRoute session={session} onLoginSuccess={handleLoginSuccess} />} />
      <Route
        path="/admin/*"
        element={<ProtectedPortal allowedRole="admin" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} />}
      />
      <Route
        path="/clerk/*"
        element={<ProtectedPortal allowedRole="clerk" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} />}
      />
      <Route
        path="/student/*"
        element={<ProtectedPortal allowedRole="student" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} />}
      />
      <Route
        path="/teacher/*"
        element={<ProtectedPortal allowedRole="teacher" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} />}
      />
      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
