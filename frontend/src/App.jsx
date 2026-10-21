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
import EmployeeLayout from './layouts/EmployeeLayout';
import Login from './pages/Auth/Login';
import AuroraBackground from './components/common/AuroraBackground';
import { portalRoutes } from './routes/portalRoutes';

const portalLayouts = {
  admin: AdminLayout,
  clerk: ClerkLayout,
  student: StudentLayout,
  teacher: TeacherLayout,
  employee: EmployeeLayout,
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
  if (window.mgpsDesktop?.isDesktop && session.role !== 'clerk') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-black text-slate-900">Clerk desktop app</h1>
          <p className="mt-3 text-sm font-semibold text-slate-600">
            This Windows application is restricted to Clerk accounts. Use the web app for other roles.
          </p>
          <button onClick={onLogout} className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
            Sign out
          </button>
        </div>
      </div>
    );
  }
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
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AuroraBackground />
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl glass-card p-8 animate-fadeInUp">
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
              className="w-full rounded-xl border border-white/80 bg-white/60 px-3 py-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">New Password</span>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-white/80 bg-white/60 px-3 py-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Confirm Password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-white/80 bg-white/60 px-3 py-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
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
            className="flex-1 btn-primary rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest"
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

function DesktopUpdateNotice() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    const updater = window.mgpsDesktop?.updates;
    if (!updater) return undefined;
    return updater.onStatus(setUpdate);
  }, []);

  useEffect(() => {
    if (update?.status !== 'downloaded') return undefined;
    const installTimer = setTimeout(() => {
      window.mgpsDesktop.updates.install().catch((error) => {
        setUpdate({ status: 'error', message: error.message });
      });
    }, 1000);
    return () => clearTimeout(installTimer);
  }, [update]);

  if (!update) return null;

  const downloadUpdate = async () => {
    setUpdate({ ...update, status: 'downloading', percent: 0 });
    try {
      await window.mgpsDesktop.updates.download();
    } catch (error) {
      setUpdate({ status: 'error', message: error.message });
    }
  };

  const checkForUpdates = async () => {
    setUpdate({ status: 'checking' });
    try {
      await window.mgpsDesktop.updates.check();
    } catch (error) {
      setUpdate({ status: 'error', message: error.message });
    }
  };

  const isUpdateAvailable = update.status === 'available';
  const isDownloading = update.status === 'downloading';
  const isDownloaded = update.status === 'downloaded';
  const isError = update.status === 'error';
  const isUpToDate = update.status === 'up-to-date';
  const isChecking = update.status === 'checking';

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border border-indigo-200 bg-white p-5 shadow-2xl"
      role={isError ? 'alert' : 'status'}
    >
      {!isDownloading && !isDownloaded && (
        <button
          aria-label="Dismiss update message"
          className="absolute right-3 top-3 text-lg font-bold text-slate-400 hover:text-slate-700"
          onClick={() => setUpdate(null)}
          type="button"
        >
          ×
        </button>
      )}
      <h2 className="pr-6 text-sm font-black text-slate-900">
        {isUpdateAvailable && `MGPS ERP update ${update.version} is ready`}
        {isChecking && 'Checking for MGPS ERP updates'}
        {isDownloading && 'Downloading MGPS ERP update'}
        {isDownloaded && 'Installing update'}
        {isError && 'Update could not be completed'}
        {isUpToDate && 'MGPS ERP is up to date'}
      </h2>
      <p className="mt-2 text-xs font-semibold text-slate-600">
        {isUpdateAvailable && 'Download the latest version now. Your local session archives are kept on this computer.'}
        {isChecking && 'Looking for a newer version…'}
        {isDownloading && `${update.percent || 0}% downloaded. You can keep using the app.`}
        {isDownloaded && `Version ${update.version} is ready. The app will restart to finish installing.`}
        {isError && update.message}
        {isUpToDate && `You are using the latest version${update.version ? ` (${update.version})` : ''}.`}
      </p>
      {isDownloading && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${Math.max(0, Math.min(100, update.percent || 0))}%` }}
          />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        {isUpdateAvailable && (
          <button className="btn-primary rounded-xl px-4 py-2 text-xs font-black" onClick={downloadUpdate} type="button">
            Update now
          </button>
        )}
        {(isError || isUpToDate) && (
          <button className="btn-secondary rounded-xl px-4 py-2 text-xs font-black" onClick={checkForUpdates} type="button">
            Check again
          </button>
        )}
      </div>
    </aside>
  );
}

function PortalShell({ role, session, onLogout, onStudentChange }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeDesktopSession, setActiveDesktopSession] = useState(null);
  const { pages, defaultPage } = portalRoutes[role];
  const Layout = portalLayouts[role];
  const pageRoutes = buildPageRoutes(pages);
  const currentPath = location.pathname.split('/').filter(Boolean)[1];
  const matchedRoute = pageRoutes.find((page) => page.path === currentPath);
  const activePage = matchedRoute?.name || defaultPage;
  const ActivePage = pages[activePage] || pages[defaultPage];

  useEffect(() => {
    const desktopArchives = window.mgpsDesktop?.archives;
    if (!desktopArchives) return undefined;
    desktopArchives.getActive().then(setActiveDesktopSession).catch((error) => {
      console.error('Unable to load active desktop session:', error);
    });
    return desktopArchives.onActiveChanged(setActiveDesktopSession);
  }, []);

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
    <>
      {activeDesktopSession && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-950">
          {activeDesktopSession.kind === 'snapshot' ? 'Read-only archived session' : 'Local archive mode'}: {activeDesktopSession.name}.
          {activeDesktopSession.kind === 'snapshot'
            ? ' Data is loaded from this computer; edits are disabled.'
            : ' Module data is stored on this computer; cloud API features are blocked to protect the current session.'}
        </div>
      )}
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
    </>
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
      <Route
        path="/employee/*"
        element={<ProtectedPortal allowedRole="employee" session={session} onLogout={handleLogout} onStudentChange={handleStudentChange} onPasswordChanged={handlePasswordChanged} />}
      />
      <Route path="*" element={<Navigate to={homePath} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <DesktopUpdateNotice />
    </BrowserRouter>
  );
}
