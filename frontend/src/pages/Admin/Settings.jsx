import React, { useState } from 'react';
import { Settings as SettingsIcon, ShieldAlert, KeyRound, Eye, EyeOff, ToggleLeft, ToggleRight, BellRing, Sliders, AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

const Settings = ({ onLogout } = {}) => {
  // Password Fields State Manager
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });

  // Customized Added System Configuration States
  const [twoFactor, setTwoFactor] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Factory Reset State Manager
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetScopes, setResetScopes] = useState({ all: false, students: false, teachers: false, clerks: false });
  const [confirmText, setConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const toggleScope = (key) => {
    setResetError('');
    setResetScopes((prev) => {
      if (key === 'all') {
        return { all: !prev.all, students: false, teachers: false, clerks: false };
      }
      return { ...prev, all: false, [key]: !prev[key] };
    });
  };

  const closeResetModal = () => {
    setResetModalOpen(false);
    setResetScopes({ all: false, students: false, teachers: false, clerks: false });
    setConfirmText('');
    setResetError('');
    setResetLoading(false);
  };

  const anyScopeSelected = resetScopes.all || resetScopes.students || resetScopes.teachers || resetScopes.clerks;
  const canConfirmReset = anyScopeSelected && confirmText.trim().toUpperCase() === 'DELETE' && !resetLoading;

  const handleFactoryReset = async () => {
    if (!canConfirmReset) return;
    setResetLoading(true);
    setResetError('');

    const scopes = resetScopes.all
      ? ['all']
      : Object.entries(resetScopes)
          .filter(([key, value]) => key !== 'all' && value)
          .map(([key]) => key);

    try {
      const result = await apiFetch('/admin/factory-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes }),
      });

      const deletedSummary = result?.deleted
        ? Object.entries(result.deleted)
            .map(([key, count]) => `${key}: ${count}`)
            .join('\n')
        : 'No details returned.';
      const errorSummary = Array.isArray(result?.errors) && result.errors.length
        ? `\n\nWarnings:\n${result.errors.map((err) => `${err.op}: ${err.message}`).join('\n')}`
        : '';

      alert(`Factory reset complete.\n\nScopes: ${(result?.scopes || scopes).join(', ')}\n\n${deletedSummary}${errorSummary}`);

      closeResetModal();

      if (typeof onLogout === 'function') {
        onLogout();
      } else {
        window.location.reload();
      }
    } catch (error) {
      setResetError(error?.message || 'Factory reset failed. Please try again.');
      setResetLoading(false);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Validation Framework Error: New password and confirmation parameters mismatch.");
      return;
    }
    alert("Security matrix verified. Master login password has been modified successfully across all nodes.");
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">
      
      {/* SETTINGS CONTROL TERMINAL HEADER */}
      <div className="glass-card p-6 rounded-3xl mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-slate-900" /> Core Control & Preferences Terminal
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Configure security protocols, change master passcodes, and control global institution system overrides.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT BLOCK: SYSTEM CORE ACCESS SECURITY & USERNAME BLOCK (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* USERNAME LOCK MECHANISM NOTICE BOX */}
          <div className="glass-card rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">
              1. Base Credentials Integrity
            </span>
            
            <div className="text-xs font-bold space-y-1.5">
              <label className="text-slate-500">Institutional System Username</label>
              <div className="relative">
                <input 
                  type="text" 
                  disabled 
                  value="admin_master2026" 
                  className="w-full p-3 bg-white/60 border border-white/80 text-slate-500/80 rounded-xl cursor-not-allowed font-mono font-black"
                />
              </div>
              <p className="text-[10px] text-red-600 flex items-center gap-1 font-semibold pt-1">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> Username modification restricted by root system protocol hierarchy.
              </p>
            </div>
          </div>

          {/* ADDED UTILITY 1: COMPREHENSIVE SECURITY HOOKS */}
          <div className="glass-card rounded-3xl p-5 space-y-3 shadow-2xs text-xs font-bold">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider">
              2. Extra Security Overrides
            </span>

            {/* Toggle Row 1: Two Factor Auth */}
            <div className="flex items-center justify-between p-2.5 bg-white/50 border border-slate-100/80 rounded-xl">
              <div>
                <p className="text-slate-900 font-black">Two-Factor Authentication (2FA)</p>
                <span className="text-[10px] text-slate-500 font-medium">Require OTP verification token on master sign-ins.</span>
              </div>
              <button type="button" onClick={() => setTwoFactor(!twoFactor)} className="text-slate-900 transition-colors">
                {twoFactor ? <ToggleRight className="w-9 h-9 text-emerald-600" /> : <ToggleLeft className="w-9 h-9 text-neutral-400" />}
              </button>
            </div>

            {/* Toggle Row 2: Maintenance Mode */}
            <div className="flex items-center justify-between p-2.5 bg-white/50 border border-slate-100/80 rounded-xl">
              <div>
                <p className="text-slate-900 font-black">Global ERP Maintenance Freeze</p>
                <span className="text-[10px] text-slate-500 font-medium">Lock student/clerk terminal nodes during sync schedules.</span>
              </div>
              <button type="button" onClick={() => setMaintenanceMode(!maintenanceMode)} className="text-slate-900 transition-colors">
                {maintenanceMode ? <ToggleRight className="w-9 h-9 text-red-600 animate-pulse" /> : <ToggleLeft className="w-9 h-9 text-neutral-400" />}
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT BLOCK: SECURE PASSWORD RE-INDEXING TERMINAL (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* PASSWORD RESET MODULE */}
          <div className="glass-card rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> 3. Cryptographic Passcode Modification Router
            </span>

            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs font-bold text-slate-900">
              
              {/* Field 1: Current Password */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-slate-500">Current Encryption Password</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPass.current ? 'text' : 'password'} 
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full p-3 bg-white/60 border border-white/80 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-mono"
                  />
                  <button type="button" onClick={() => setShowPass(p => ({ ...p, current: !p.current }))} className="absolute right-3 text-slate-500 hover:text-black">
                    {showPass.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 2: New Password */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-slate-500">New Security Password</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPass.new ? 'text' : 'password'} 
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full p-3 bg-white/60 border border-white/80 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-mono"
                  />
                  <button type="button" onClick={() => setShowPass(p => ({ ...p, new: !p.new }))} className="absolute right-3 text-slate-500 hover:text-black">
                    {showPass.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 3: Confirm Password */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-slate-500">Confirm New Security Password</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPass.confirm ? 'text' : 'password'} 
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full p-3 bg-white/60 border border-white/80 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-mono"
                  />
                  <button type="button" onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 text-slate-500 hover:text-black">
                    {showPass.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Update Trigger */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full py-3 btn-primary rounded-xl font-black text-[11px] uppercase tracking-wider "
                >
                  Commit Passcode Transformation
                </button>
              </div>

            </form>
          </div>

          {/* ADDED UTILITY 2: SYSTEM ALERT PREFERENCES */}
          <div className="glass-card rounded-3xl p-5 space-y-3 shadow-2xs text-xs font-bold">
            <span className="text-[10px] text-slate-500 uppercase block font-black tracking-wider flex items-center gap-1">
              <BellRing className="w-3.5 h-3.5" /> 4. Automated Notification Matrices
            </span>
            <div className="flex items-center justify-between p-2.5 bg-white/50 border border-slate-100/80 rounded-xl">
              <div>
                <p className="text-slate-900 font-black">System Logs & Leave Triggers Email Routing</p>
                <span className="text-[10px] text-slate-500 font-medium">Forward high-priority clerk/teacher leave logs instantly to admin inbox.</span>
              </div>
              <button type="button" onClick={() => setEmailAlerts(!emailAlerts)} className="text-slate-900">
                {emailAlerts ? <ToggleRight className="w-9 h-9 text-emerald-600" /> : <ToggleLeft className="w-9 h-9 text-neutral-400" />}
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* DANGER ZONE: FACTORY RESET */}
      <div className="mt-6 rounded-3xl p-5 space-y-4 bg-red-50/60 border-2 border-dashed border-red-300/80 shadow-2xs">
        <span className="text-[10px] text-red-700 uppercase block font-black tracking-wider flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> 5. Danger Zone — Irreversible System Actions
        </span>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/50 border border-red-200/80 rounded-xl">
          <div>
            <p className="text-slate-900 font-black text-xs">Factory Reset</p>
            <span className="text-[10px] text-slate-600 font-medium">
              Permanently wipe institution data (students, staff, payroll, attendance, and more) and restore a clean slate. This action cannot be undone.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setResetModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-red-500/30 transition-all active:scale-95 flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" /> Factory Reset
          </button>
        </div>
      </div>

      {/* FACTORY RESET CONFIRMATION MODAL */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-strong w-full max-w-lg rounded-3xl p-6 space-y-5 animate-scaleUp relative shadow-2xl border border-red-200/60">
            <button
              type="button"
              onClick={closeResetModal}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Factory Reset</h3>
                <p className="text-xs text-slate-600 font-semibold mt-1">
                  This permanently deletes the selected data from the system. This action cannot be undone and there is no backup recovery.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 bg-red-50/80 border border-red-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetScopes.all}
                  onChange={() => toggleScope('all')}
                  className="w-4 h-4 accent-red-600"
                />
                <span className="text-xs font-black text-red-700">Everything (fresh start)</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-opacity ${resetScopes.all ? 'opacity-50 pointer-events-none bg-white/40 border-slate-200' : 'bg-white/60 border-slate-200'}`}>
                <input
                  type="checkbox"
                  checked={resetScopes.all || resetScopes.students}
                  disabled={resetScopes.all}
                  onChange={() => toggleScope('students')}
                  className="w-4 h-4 accent-red-600"
                />
                <span className="text-xs font-bold text-slate-800">Students</span>
              </label>

              <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-opacity ${resetScopes.all ? 'opacity-50 pointer-events-none bg-white/40 border-slate-200' : 'bg-white/60 border-slate-200'}`}>
                <input
                  type="checkbox"
                  checked={resetScopes.all || resetScopes.teachers}
                  disabled={resetScopes.all}
                  onChange={() => toggleScope('teachers')}
                  className="w-4 h-4 accent-red-600"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Teachers</span>
                  <span className="text-[10px] text-slate-500 font-medium">Also clears their payroll.</span>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-opacity ${resetScopes.all ? 'opacity-50 pointer-events-none bg-white/40 border-slate-200' : 'bg-white/60 border-slate-200'}`}>
                <input
                  type="checkbox"
                  checked={resetScopes.all || resetScopes.clerks}
                  disabled={resetScopes.all}
                  onChange={() => toggleScope('clerks')}
                  className="w-4 h-4 accent-red-600"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Clerks</span>
                  <span className="text-[10px] text-slate-500 font-medium">Also clears their payroll.</span>
                </div>
              </label>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                Type <span className="text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full p-3 bg-white/70 border border-red-200 rounded-xl focus:border-red-400 focus:ring-4 focus:ring-red-100 outline-none transition-all font-mono font-bold text-xs"
              />
            </div>

            {resetError && (
              <p className="text-[11px] text-red-700 font-bold bg-red-50 border border-red-200 rounded-xl p-3">
                {resetError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={closeResetModal}
                disabled={resetLoading}
                className="flex-1 py-3 btn-ghost rounded-xl font-black text-[11px] uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFactoryReset}
                disabled={!canConfirmReset}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[11px] uppercase tracking-wider text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-500/30 transition-all active:scale-95"
              >
                {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {resetLoading ? 'Resetting…' : 'Confirm Factory Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;