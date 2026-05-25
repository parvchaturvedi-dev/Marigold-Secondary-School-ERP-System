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
import { apiFetch } from './components/common/api';
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

function ProtectedPortal({ allowedRole, session, onLogout, onStudentChange, onPasswordChanged }) {
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== allowedRole) return <Navigate to={getDashboardPath(session.role)} replace />;
  if (session.mustChangePassword) {
    return <PasswordChangeGate session={session} onPasswordChanged={onPasswordChanged} onLogout={onLogout} />;
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

function PasswordChangeGate({ session, onPasswordChanged, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (newPassword.length < 6) {
      setMessage('New password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('New password and confirm password do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      onPasswordChanged({ ...session, mustChangePassword: false });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#D9D9D9] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-neutral-300 bg-white p-8 shadow-2xl">
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Security required</p>
          <h1 className="mt-1 text-xl font-black text-neutral-950">Change your password now</h1>
          <p className="mt-2 text-xs font-semibold text-neutral-500">
            For security purpose, set a private password before opening the portal.
          </p>
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
            {message}
          </div>
        )}

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Current Password</span>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-xs font-bold outline-none focus:border-neutral-950"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">New Password</span>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-xs font-bold outline-none focus:border-neutral-950"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Confirm Password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-3 text-xs font-bold outline-none focus:border-neutral-950"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-xs font-black text-neutral-600"
          >
            Logout
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-xl bg-neutral-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Password'}
          </button>
        </div>
      </form>
    </div>
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
      if (!isActive) return;
      if (!serverSession) {
        clearSession();
        setSession(null);
        return;
      }
      const nextSession = saveSession(serverSession);
      if (nextSession) setSession(nextSession);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const handleSessionUpdate = (event) => {
      if (event.detail && event.detail.username) {
        setSession(event.detail);
      } else {
        setSession(null);
      }
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

  const handlePasswordChanged = (authPayload) => {
    const nextSession = saveSession(authPayload);
    if (!nextSession) return;
    setSession(nextSession);
    navigate(getDashboardPath(nextSession.role), { replace: true });
  };

  const homePath = session ? getDashboardPath(session.role) : '/login';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={homePath} replace />} />
      <Route path="/login" element={<LoginRoute session={session} onLoginSuccess={handleLoginSuccess} />} />
      <Route
        path="/admin/*"
        element={<ProtectedPortal allowedRole="admin" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} onPasswordChanged={handlePasswordChanged} />}
      />
      <Route
        path="/clerk/*"
        element={<ProtectedPortal allowedRole="clerk" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} onPasswordChanged={handlePasswordChanged} />}
      />
      <Route
        path="/student/*"
        element={<ProtectedPortal allowedRole="student" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} onPasswordChanged={handlePasswordChanged} />}
      />
      <Route
        path="/teacher/*"
        element={<ProtectedPortal allowedRole="teacher" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} onPasswordChanged={handlePasswordChanged} />}
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
