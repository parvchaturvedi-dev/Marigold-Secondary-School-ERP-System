import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { MASTER_NAMESPACES } from '../../components/common/masterData';

const roleLabels = {
  admin: 'Admin',
  clerk: 'Clerk',
  student: 'Student',
  teacher: 'Teacher',
};

const roleOrder = ['admin', 'clerk', 'teacher', 'student'];
const identitySyncNamespaces = [
  MASTER_NAMESPACES.classPreferences,
  MASTER_NAMESPACES.classes,
  MASTER_NAMESPACES.students,
  MASTER_NAMESPACES.teachers,
  'admin-clerk-management-list',
];

const getEmailForUser = (user = {}) =>
  user.email ||
  user.profile?.email ||
  user.profile?.studentProfiles?.[0]?.guardianEmail ||
  '';

const getInitialPassword = (user = {}) =>
  user.initialPassword || 'Password not available';

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeRole, setActiveRole] = useState('all');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [otpPrompts, setOtpPrompts] = useState({});
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [isSendingCredentials, setIsSendingCredentials] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload = await apiFetch('/auth/users');
      setUsers(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    apiFetch('/auth/users')
      .then((payload) => {
        if (isMounted) setUsers(payload);
      })
      .catch((loadError) => {
        if (isMounted) setError(loadError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const requestPasswordOtp = async (user) => {
    setError('');
    setSuccessMessage('');
    try {
      const payload = await apiFetch(`/auth/users/${encodeURIComponent(user.username)}/request-password-otp`, {
        method: 'POST',
      });
      setOtpPrompts((current) => ({ ...current, [user.username]: true }));
      setSuccessMessage(payload.message || 'OTP sent.');
    } catch (otpError) {
      setError(otpError.message);
    }
  };

  const revealPassword = async (user, otp) => {
    if (!otp.trim()) return;
    setError('');
    try {
      const payload = await apiFetch(`/auth/users/${encodeURIComponent(user.username)}/reveal-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      setRevealedPasswords((current) => ({ ...current, [user.username]: payload.password || '' }));
      setVisiblePasswords((current) => ({ ...current, [user.username]: true }));
      setOtpPrompts((current) => ({ ...current, [user.username]: false }));
    } catch (revealError) {
      setError(revealError.message);
    }
  };

  const sendCredentials = async (user) => {
    setError('');
    setSuccessMessage('');
    setIsSendingCredentials((current) => ({ ...current, [user.username]: true }));
    try {
      const payload = await apiFetch(`/auth/users/${encodeURIComponent(user.username)}/send-credentials`, {
        method: 'POST',
      });
      setSuccessMessage(payload.message || 'Credentials sent.');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setIsSendingCredentials((current) => ({ ...current, [user.username]: false }));
    }
  };

  useEffect(() => {
    let timeoutId;
    const refreshGeneratedUsers = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(loadUsers, 250);
    };

    identitySyncNamespaces.forEach((namespace) => {
      window.addEventListener(`mgps-erp-module-state:${namespace}`, refreshGeneratedUsers);
    });

    return () => {
      window.clearTimeout(timeoutId);
      identitySyncNamespaces.forEach((namespace) => {
        window.removeEventListener(`mgps-erp-module-state:${namespace}`, refreshGeneratedUsers);
      });
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = activeRole === 'all' || user.role === activeRole;
      const haystack = [
        user.username,
        user.displayName,
        roleLabels[user.role],
        getEmailForUser(user),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesRole && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [activeRole, query, users]);

  const groupedCounts = useMemo(
    () =>
      users.reduce(
        (counts, user) => ({
          ...counts,
          [user.role]: (counts[user.role] || 0) + 1,
        }),
        {}
      ),
    [users]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#1A1A1A]">
            <Lock className="w-5 h-5" />
            <h1 className="text-xl font-black">Users Management</h1>
          </div>
          <p className="text-xs font-semibold text-[#555555] mt-1">
            Login identities for admin, clerk, teacher, and student portals.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 bg-[#1A1A1A] text-white px-4 py-2 rounded-lg text-xs font-black disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {['all', ...roleOrder].map((role) => (
          <button
            type="button"
            key={role}
            onClick={() => setActiveRole(role)}
            className={`border px-4 py-3 rounded-lg text-left transition ${
              activeRole === role
                ? 'bg-[#E1FA6C] border-[#1A1A1A] text-[#1A1A1A]'
                : 'bg-white border-[#C8C8C8] text-[#555555] hover:border-[#1A1A1A]'
            }`}
          >
            <p className="text-[10px] font-black uppercase">
              {role === 'all' ? 'All Users' : roleLabels[role]}
            </p>
            <p className="text-2xl font-black mt-1">
              {role === 'all' ? users.length : groupedCounts[role] || 0}
            </p>
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#C8C8C8] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search username, name, role, or email"
              className="w-full bg-[#F8F8F8] border border-[#D9D9D9] rounded-lg pl-9 pr-3 py-2 text-sm font-semibold outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-[#555555]">
            <Users className="w-4 h-4" />
            {filteredUsers.length} visible
          </div>
        </div>

        {error && (
          <div className="m-4 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-xs font-semibold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="m-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-xs font-semibold flex gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMessage}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F8F8F8] text-[10px] uppercase text-[#555555]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Initial Password</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA]">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-sm font-bold text-[#555555]">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length ? (
                filteredUsers.map((user) => {
                  const email = getEmailForUser(user);
                  const isPasswordVisible = visiblePasswords[user.username];

                  return (
                    <tr key={user.username} className="hover:bg-[#F8F8F8]">
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-[#1A1A1A]">{user.username}</p>
                        <p className="text-xs font-semibold text-[#555555]">
                          {user.displayName || 'Unnamed user'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-[#EAEAEA] px-2 py-1 text-[10px] font-black uppercase">
                          {roleLabels[user.role] || user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#555555]">
                        {email || 'Not linked'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#1A1A1A]">
                          <KeyRound className="w-3.5 h-3.5" />
                          {isPasswordVisible ? (revealedPasswords[user.username] || getInitialPassword(user)) : '********'}
                          <button
                            type="button"
                            onClick={() => (isPasswordVisible ? setVisiblePasswords((current) => ({ ...current, [user.username]: false })) : requestPasswordOtp(user))}
                            className="text-[#555555] hover:text-[#1A1A1A]"
                            aria-label="Toggle password visibility"
                          >
                            {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {otpPrompts[user.username] && (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              revealPassword(user, event.currentTarget.otp.value);
                            }}
                            className="mt-2 flex gap-2"
                          >
                            <input
                              name="otp"
                              placeholder="Enter OTP"
                              className="w-24 rounded-lg border border-[#C8C8C8] px-2 py-1 text-xs font-bold outline-none"
                            />
                            <button type="submit" className="rounded-lg bg-[#1A1A1A] px-2 py-1 text-[10px] font-black text-white">
                              Reveal
                            </button>
                          </form>
                        )}
                        <button
                          type="button"
                          onClick={() => sendCredentials(user)}
                          disabled={isSendingCredentials[user.username]}
                          className="mt-2 rounded-lg border border-[#C8C8C8] bg-white px-2 py-1 text-[10px] font-black text-[#1A1A1A] hover:bg-[#EAEAEA] disabled:opacity-60"
                        >
                          {isSendingCredentials[user.username] ? 'Sending...' : 'Send Credentials via Gmail'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-black uppercase ${
                            user.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-10 text-center text-sm font-bold text-[#555555]">
                    No users found. Add students, teachers, or clerks to sync identities.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersManagement;
