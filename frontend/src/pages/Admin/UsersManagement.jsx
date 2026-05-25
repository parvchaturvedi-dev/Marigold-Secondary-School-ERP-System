import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Edit2,
  KeyRound,
  Lock,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
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

const UsersManagement = ({ session }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeRole, setActiveRole] = useState('all');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [otpPrompts, setOtpPrompts] = useState({});
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [isSendingCredentials, setIsSendingCredentials] = useState({});
  const [isSendingAllCredentials, setIsSendingAllCredentials] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [editingUser, setEditingUser] = useState(null);

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
    const email = getEmailForUser(user);
    const confirmed = window.confirm(
      `This password access process will send an 8-character OTP to ${email || 'the linked user email'}. Continue?`
    );
    if (!confirmed) return null;

    setError('');
    setSuccessMessage('');
    try {
      const payload = await apiFetch(`/auth/users/${encodeURIComponent(user.username)}/request-password-otp`, {
        method: 'POST',
      });
      setOtpPrompts((current) => ({ ...current, [user.username]: true }));
      setSuccessMessage(payload.message || 'OTP sent.');
      return payload;
    } catch (otpError) {
      setError(otpError.message);
      return null;
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

  const sendCredentialsToAll = async () => {
    setError('');
    setSuccessMessage('');
    setIsSendingAllCredentials(true);

    try {
      const payload = await apiFetch('/auth/users/send-credentials-all', {
        method: 'POST',
      });
      setSuccessMessage(payload.message || 'Credentials dispatched.');
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setIsSendingAllCredentials(false);
    }
  };

  const startEditUser = (user) => {
    setEditingUser({
      username: user.username,
      displayName: user.displayName || '',
      email: getEmailForUser(user),
      mobile: user.profile?.mobile || '',
      designation: user.profile?.designation || roleLabels[user.role] || user.role,
      password: '',
      passwordOtp: '',
      isActive: user.isActive,
      managedByIdentitySync: user.profile?.managedByIdentitySync,
      role: user.role,
    });
  };

  const updateUser = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (editingUser.password && !editingUser.passwordOtp.trim()) {
      setError('Send OTP to the user and enter the 8-character code before updating password.');
      return;
    }

    try {
      const payload = await apiFetch(`/auth/users/${encodeURIComponent(editingUser.username)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser),
      });
      setUsers(payload.users || []);
      setSuccessMessage(payload.message || 'User updated.');
      setEditingUser(null);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Remove ${user.username} from ERP users?`)) return;
    setError('');
    setSuccessMessage('');

    try {
      const payload = await apiFetch(`/auth/users/${encodeURIComponent(user.username)}`, {
        method: 'DELETE',
      });
      setUsers(payload.users || []);
      setSuccessMessage(payload.message || 'User removed.');
    } catch (deleteError) {
      setError(deleteError.message);
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

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={sendCredentialsToAll}
            disabled={isSendingAllCredentials || isLoading || !users.length}
            className="inline-flex items-center justify-center gap-2 border border-[#1A1A1A] bg-white px-4 py-2 rounded-lg text-xs font-black text-[#1A1A1A] hover:bg-[#EAEAEA] disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {isSendingAllCredentials ? 'Sending...' : 'Send Credentials to All'}
          </button>
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
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA]">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-sm font-bold text-[#555555]">
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
                          {isSendingCredentials[user.username] ? 'Sending...' : 'Send Credentials via Email'}
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
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEditUser(user)}
                            className="rounded-lg border border-[#C8C8C8] bg-white p-2 text-[#1A1A1A] hover:bg-[#EAEAEA]"
                            title={user.profile?.managedByIdentitySync && user.role !== 'admin' ? 'Only activation and password can be changed here' : 'Edit user'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!user.profile?.managedByIdentitySync && user.username !== session?.username && (
                            <button
                              type="button"
                              onClick={() => deleteUser(user)}
                              className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                              title="Remove user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-sm font-bold text-[#555555]">
                    No users found. Add students, teachers, or clerks to sync identities.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <UserFormModal
          title={`Edit ${editingUser.username}`}
          values={editingUser}
          onChange={(event) => {
            const { name, value, type, checked } = event.target;
            setEditingUser((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
          }}
          onClose={() => setEditingUser(null)}
          onSubmit={updateUser}
          submitLabel="Save Changes"
          isEdit
          lockProfileFields={editingUser.managedByIdentitySync && editingUser.role !== 'admin'}
          onRequestPasswordOtp={async () => {
            const payload = await requestPasswordOtp(editingUser);
            if (payload) {
              setEditingUser((current) => ({ ...current, passwordOtp: '' }));
            }
          }}
        />
      )}
    </div>
  );
};

const UserFormModal = ({
  title,
  values,
  onChange,
  onClose,
  onSubmit,
  submitLabel,
  isEdit = false,
  lockProfileFields = false,
  onRequestPasswordOtp,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
    <form onSubmit={onSubmit} className="w-full max-w-xl rounded-2xl border border-[#C8C8C8] bg-white p-5 text-xs font-bold text-[#1A1A1A] shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-[#EAEAEA] pb-3">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Lock className="w-4 h-4" /> {title}
        </h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[#EAEAEA]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {lockProfileFields && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          This user is synced from its source management page. Edit name/email/mobile there; password and active status can be managed here.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span>Admin/User ID</span>
          <input
            name="username"
            value={values.username}
            onChange={onChange}
            disabled={isEdit}
            placeholder="ADM-002"
            className="w-full rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 font-mono outline-none disabled:opacity-60"
            required
          />
        </label>
        <label className="space-y-1">
          <span>Display Name</span>
          <input
            name="displayName"
            value={values.displayName}
            onChange={onChange}
            disabled={lockProfileFields}
            className="w-full rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 outline-none disabled:opacity-60"
            required={!lockProfileFields}
          />
        </label>
        <label className="space-y-1">
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={values.email}
            onChange={onChange}
            disabled={lockProfileFields}
            className="w-full rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 outline-none disabled:opacity-60"
          />
        </label>
        <label className="space-y-1">
          <span>Mobile</span>
          <input
            name="mobile"
            value={values.mobile}
            onChange={onChange}
            disabled={lockProfileFields}
            className="w-full rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 font-mono outline-none disabled:opacity-60"
          />
        </label>
        <label className="space-y-1">
          <span>Designation</span>
          <input
            name="designation"
            value={values.designation}
            onChange={onChange}
            disabled={lockProfileFields}
            className="w-full rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 outline-none disabled:opacity-60"
          />
        </label>
        <label className="space-y-1">
          <span>{isEdit ? 'New Password (optional)' : 'Initial Password'}</span>
          <input
            name="password"
            value={values.password}
            onChange={onChange}
            placeholder={isEdit ? 'Leave blank to keep existing' : 'Minimum 6 characters'}
            className="w-full rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 font-mono outline-none"
            required={!isEdit}
          />
        </label>
        {isEdit && values.password && (
          <div className="space-y-1">
            <span>Password OTP</span>
            <div className="flex gap-2">
              <input
                name="passwordOtp"
                value={values.passwordOtp || ''}
                onChange={onChange}
                placeholder="E6HJK82D"
                maxLength={8}
                className="min-w-0 flex-1 rounded-xl border border-[#C8C8C8] bg-[#F8F8F8] px-3 py-2 font-mono uppercase outline-none"
              />
              <button
                type="button"
                onClick={onRequestPasswordOtp}
                className="shrink-0 rounded-xl border border-[#1A1A1A] bg-white px-3 py-2 text-[10px] font-black text-[#1A1A1A] hover:bg-[#EAEAEA]"
              >
                Send OTP
              </button>
            </div>
            <p className="text-[10px] font-semibold text-[#555555]">
              Password updates send OTP to the user and force password change at next login.
            </p>
          </div>
        )}
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-[#EAEAEA] bg-[#F8F8F8] px-3 py-2">
        <input name="isActive" type="checkbox" checked={Boolean(values.isActive)} onChange={onChange} />
        Active account
      </label>

      <div className="mt-5 flex justify-end gap-2 border-t border-[#EAEAEA] pt-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#C8C8C8] px-4 py-2 font-black text-[#555555]">
          Cancel
        </button>
        <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[#1A1A1A] px-4 py-2 font-black text-white">
          <Save className="w-4 h-4" /> {submitLabel}
        </button>
      </div>
    </form>
  </div>
);

export default UsersManagement;
