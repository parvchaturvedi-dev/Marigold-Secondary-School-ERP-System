import React, { useState } from 'react';
import {
  BellRing,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Save,
  Settings as SettingsIcon,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { getClerkProfile } from './clerkPortalData';

const Settings = ({ session }) => {
  const profile = getClerkProfile(session);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [preferences, setPreferences] = useState({
    attendanceAlerts: true,
    documentAlerts: true,
    meetingReminders: true,
    printQueueLock: false,
    compactTables: false,
  });

  const togglePreference = (field) => {
    setPreferences((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const updatePasswordField = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordSubmit = (event) => {
    event.preventDefault();

    if (passwordForm.newPassword.length < 6) {
      alert('New password must contain at least 6 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New password and confirmation do not match.');
      return;
    }

    alert('Clerk password preferences saved.');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" /> Clerk Settings
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">
          Configure clerk desk notifications, security, print controls, and table preferences.
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <aside className="xl:col-span-4 space-y-6">
          <div className="glass-card rounded-3xl p-5 space-y-4">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">
              Desk Identity
            </span>

            <div className="space-y-2 text-xs font-bold">
              <label className="text-slate-500">Username</label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={profile.username}
                  className="w-full p-3 bg-white/50 border border-white/70 text-slate-500 rounded-2xl cursor-not-allowed font-mono font-black"
                />
              </div>
              <p className="text-[10px] text-red-600 flex items-center gap-1 font-semibold pt-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Username is locked by admin user management.
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-3">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">
              Desk Controls
            </span>

            <ToggleRow
              label="Print queue lock"
              description="Require confirmation before sending ID batches to printer."
              checked={preferences.printQueueLock}
              onClick={() => togglePreference('printQueueLock')}
            />
            <ToggleRow
              label="Compact tables"
              description="Use tighter rows on attendance and document screens."
              checked={preferences.compactTables}
              onClick={() => togglePreference('compactTables')}
            />
          </div>
        </aside>

        <div className="xl:col-span-8 space-y-6">
          <form
            onSubmit={handlePasswordSubmit}
            className="glass-card rounded-3xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100/80 pb-3">
              <KeyRound className="w-4 h-4" />
              <h3 className="text-sm font-black">Password Update</h3>
            </div>

            <PasswordField
              label="Current Password"
              value={passwordForm.currentPassword}
              visible={showPassword.current}
              onChange={(value) => updatePasswordField('currentPassword', value)}
              onToggle={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
            />
            <PasswordField
              label="New Password"
              value={passwordForm.newPassword}
              visible={showPassword.next}
              onChange={(value) => updatePasswordField('newPassword', value)}
              onToggle={() => setShowPassword((prev) => ({ ...prev, next: !prev.next }))}
            />
            <PasswordField
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              visible={showPassword.confirm}
              onChange={(value) => updatePasswordField('confirmPassword', value)}
              onToggle={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
            />

            <button
              type="submit"
              className="w-full btn-primary rounded-2xl py-3 text-xs font-black flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Password
            </button>
          </form>

          <div className="glass-card rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100/80 pb-3">
              <BellRing className="w-4 h-4" />
              <h3 className="text-sm font-black">Notifications</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <ToggleRow
                label="Attendance alerts"
                description="Notify when a class register is still pending."
                checked={preferences.attendanceAlerts}
                onClick={() => togglePreference('attendanceAlerts')}
              />
              <ToggleRow
                label="Document alerts"
                description="Notify when a packet is held for correction."
                checked={preferences.documentAlerts}
                onClick={() => togglePreference('documentAlerts')}
              />
              <ToggleRow
                label="Meeting reminders"
                description="Show reminders before office meetings."
                checked={preferences.meetingReminders}
                onClick={() => togglePreference('meetingReminders')}
              />
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Lock className="w-4 h-4" /> Clerk Permissions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold">
              {[
                'Create assignments and events',
                'Verify documents',
                'Generate ID cards',
                'Edit staff and student records',
                'Publish notices and meetings',
                'View but not delete restricted faculty records',
              ].map((permission) => (
                <div key={permission} className="glass-soft rounded-2xl p-3">
                  {permission}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const PasswordField = ({ label, value, visible, onChange, onToggle }) => (
  <label className="block space-y-1 text-xs font-bold">
    <span className="text-[10px] font-black uppercase text-slate-500">{label}</span>
    <span className="relative flex items-center">
      <input
        type={visible ? 'text' : 'password'}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter secure token"
        className="w-full bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-2xl px-3 py-3 pr-10 text-xs font-mono font-bold"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 text-slate-500 hover:text-indigo-600"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </span>
  </label>
);

const ToggleRow = ({ label, description, checked, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full glass-soft glass-hover rounded-2xl p-3 flex items-center justify-between gap-3 text-left min-h-24"
  >
    <span>
      <span className="block text-xs font-black">{label}</span>
      <span className="block text-[10px] font-semibold text-slate-500 mt-1 leading-relaxed">
        {description}
      </span>
    </span>
    {checked ? (
      <ToggleRight className="w-9 h-9 text-indigo-500 shrink-0" />
    ) : (
      <ToggleLeft className="w-9 h-9 text-slate-400 shrink-0" />
    )}
  </button>
);

export default Settings;
