import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import DocumentVault from '../../components/common/DocumentVault';

const emptyAdminForm = {
  username: '',
  displayName: '',
  email: '',
  mobile: '',
  designation: 'Administrator',
  password: '',
  isActive: true,
};

const getEmailForUser = (user = {}) => user.email || user.profile?.email || '';

const AdminManagement = ({ session }) => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyAdminForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [otpPrompts, setOtpPrompts] = useState({});
  const [revealedPasswords, setRevealedPasswords] = useState({});

  const admins = useMemo(() => users.filter((user) => user.role === 'admin'), [users]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');

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
    loadUsers();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const createAdmin = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const payload = await apiFetch('/auth/users/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setUsers(payload.users || []);
      setForm(emptyAdminForm);
      setSuccessMessage(payload.message || 'Admin user created.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAdmin = async (user) => {
    if (!window.confirm(`Remove ${user.username} from admin accounts?`)) return;
    setError('');
    setSuccessMessage('');

    try {
      const payload = await apiFetch(`/auth/users/${encodeURIComponent(user.username)}`, {
        method: 'DELETE',
      });
      setUsers(payload.users || []);
      setSuccessMessage(payload.message || 'Admin removed.');
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between animate-fadeInUp">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <UserCog className="h-5 w-5 text-indigo-500" />
            <h1 className="text-xl font-black">Admin Management</h1>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Add admin accounts here. General user controls stay in Users Management.
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          disabled={isLoading}
          className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-black disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <form onSubmit={createAdmin} className="glass-card rounded-lg p-5 text-xs font-bold text-slate-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
            <Plus className="h-4 w-4" />
            Add Admin
          </h2>

          <div className="space-y-3">
            <Field label="Admin ID">
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="ADM-002"
                className="w-full rounded-lg bg-white/60 border border-white/80 px-3 py-2 font-mono outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                required
              />
            </Field>
            <Field label="Display Name">
              <input
                name="displayName"
                value={form.displayName}
                onChange={handleChange}
                className="w-full rounded-lg bg-white/60 border border-white/80 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                required
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-white/60 border border-white/80 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              </Field>
              <Field label="Mobile">
                <input
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-white/60 border border-white/80 px-3 py-2 font-mono outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              </Field>
            </div>
            <Field label="Designation">
              <input
                name="designation"
                value={form.designation}
                onChange={handleChange}
                className="w-full rounded-lg bg-white/60 border border-white/80 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
              />
            </Field>
            <Field label="Initial Password">
              <input
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg bg-white/60 border border-white/80 px-3 py-2 font-mono outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                required
              />
            </Field>
            <label className="flex items-center gap-2 glass-soft rounded-lg px-3 py-2">
              <input name="isActive" type="checkbox" checked={Boolean(form.isActive)} onChange={handleChange} />
              Active account
            </label>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-black disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Create Admin'}
          </button>
        </form>

        <div className="glass-card rounded-lg p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              Admin Accounts
            </h2>
            <span className="rounded-md bg-white/50 px-2 py-1 text-[10px] font-black text-slate-500">
              {admins.length} admins
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-indigo-50/60 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Initial Password</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                      Loading admins...
                    </td>
                  </tr>
                ) : admins.length ? (
                  admins.map((user) => {
                    const isVisible = visiblePasswords[user.username];
                    return (
                      <tr key={user.username} className="hover:bg-white/60">
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-slate-900">{user.username}</p>
                          <p className="text-xs font-semibold text-slate-500">
                            {user.displayName || 'Unnamed admin'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                          {getEmailForUser(user) || 'Not linked'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-900">
                            <KeyRound className="h-3.5 w-3.5" />
                            {isVisible ? revealedPasswords[user.username] || 'Not available' : '********'}
                            <button
                              type="button"
                              onClick={() =>
                                isVisible
                                  ? setVisiblePasswords((current) => ({ ...current, [user.username]: false }))
                                  : requestPasswordOtp(user)
                              }
                              className="text-slate-500 hover:text-slate-900"
                              aria-label="Toggle password visibility"
                            >
                              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                                className="w-28 rounded-lg border border-white/70 px-2 py-1 text-xs font-bold outline-none"
                              />
                              <button type="submit" className="rounded-lg btn-primary px-2 py-1 text-[10px] font-black text-white">
                                Reveal
                              </button>
                            </form>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-[10px] font-black uppercase ${
                              user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {user.username !== session?.username && (
                              <button
                                type="button"
                                onClick={() => deleteAdmin(user)}
                                className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                                title="Remove admin"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                      No admin accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="border-t border-white/70 pt-8">
        <DocumentVault
          title="Admin Documents Vault"
          subtitle="Encrypted admin vault for sensitive notes, PDFs, and images. Only the signed-in admin can open it with the vault passphrase."
        />
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block space-y-1">
    <span>{label}</span>
    {children}
  </label>
);

export default AdminManagement;
