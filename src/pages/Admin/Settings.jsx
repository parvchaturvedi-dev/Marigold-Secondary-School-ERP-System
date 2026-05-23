import React, { useState } from 'react';
import { Settings as SettingsIcon, ShieldAlert, KeyRound, Eye, EyeOff, ToggleLeft, ToggleRight, BellRing, Sliders } from 'lucide-react';

const Settings = () => {
  // Password Fields State Manager
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });

  // Customized Added System Configuration States
  const [twoFactor, setTwoFactor] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

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
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* SETTINGS CONTROL TERMINAL HEADER */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[#1A1A1A]" /> Core Control & Preferences Terminal
        </h3>
        <p className="text-xs text-[#555555] mt-1">
          Configure security protocols, change master passcodes, and control global institution system overrides.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT BLOCK: SYSTEM CORE ACCESS SECURITY & USERNAME BLOCK (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* USERNAME LOCK MECHANISM NOTICE BOX */}
          <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider">
              1. Base Credentials Integrity
            </span>
            
            <div className="text-xs font-bold space-y-1.5">
              <label className="text-[#555555]">Institutional System Username</label>
              <div className="relative">
                <input 
                  type="text" 
                  disabled 
                  value="admin_master2026" 
                  className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] text-[#555555]/80 rounded-xl cursor-not-allowed font-mono font-black"
                />
              </div>
              <p className="text-[10px] text-red-600 flex items-center gap-1 font-semibold pt-1">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> Username modification restricted by root system protocol hierarchy.
              </p>
            </div>
          </div>

          {/* ADDED UTILITY 1: COMPREHENSIVE SECURITY HOOKS */}
          <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 space-y-3 shadow-2xs text-xs font-bold">
            <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider">
              2. Extra Security Overrides
            </span>

            {/* Toggle Row 1: Two Factor Auth */}
            <div className="flex items-center justify-between p-2.5 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl">
              <div>
                <p className="text-[#1A1A1A] font-black">Two-Factor Authentication (2FA)</p>
                <span className="text-[10px] text-[#555555] font-medium">Require OTP verification token on master sign-ins.</span>
              </div>
              <button type="button" onClick={() => setTwoFactor(!twoFactor)} className="text-[#1A1A1A] transition-colors">
                {twoFactor ? <ToggleRight className="w-9 h-9 text-emerald-600" /> : <ToggleLeft className="w-9 h-9 text-neutral-400" />}
              </button>
            </div>

            {/* Toggle Row 2: Maintenance Mode */}
            <div className="flex items-center justify-between p-2.5 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl">
              <div>
                <p className="text-[#1A1A1A] font-black">Global ERP Maintenance Freeze</p>
                <span className="text-[10px] text-[#555555] font-medium">Lock student/clerk terminal nodes during sync schedules.</span>
              </div>
              <button type="button" onClick={() => setMaintenanceMode(!maintenanceMode)} className="text-[#1A1A1A] transition-colors">
                {maintenanceMode ? <ToggleRight className="w-9 h-9 text-red-600 animate-pulse" /> : <ToggleLeft className="w-9 h-9 text-neutral-400" />}
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT BLOCK: SECURE PASSWORD RE-INDEXING TERMINAL (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* PASSWORD RESET MODULE */}
          <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 space-y-4 shadow-2xs">
            <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> 3. Cryptographic Passcode Modification Router
            </span>

            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs font-bold text-[#1A1A1A]">
              
              {/* Field 1: Current Password */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[#555555]">Current Encryption Password</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPass.current ? 'text' : 'password'} 
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono"
                  />
                  <button type="button" onClick={() => setShowPass(p => ({ ...p, current: !p.current }))} className="absolute right-3 text-[#555555] hover:text-black">
                    {showPass.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 2: New Password */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[#555555]">New Security Password</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPass.new ? 'text' : 'password'} 
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono"
                  />
                  <button type="button" onClick={() => setShowPass(p => ({ ...p, new: !p.new }))} className="absolute right-3 text-[#555555] hover:text-black">
                    {showPass.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Field 3: Confirm Password */}
              <div className="flex flex-col gap-1.5 relative">
                <label className="text-[#555555]">Confirm New Security Password</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPass.confirm ? 'text' : 'password'} 
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full p-3 bg-[#EAEAEA] border border-[#C8C8C8] rounded-xl outline-none focus:border-black font-mono"
                  />
                  <button type="button" onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 text-[#555555] hover:text-black">
                    {showPass.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Update Trigger */}
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full py-3 bg-[#E1FA6C] text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-xl font-black text-[11px] uppercase tracking-wider hover:bg-[#d4ee59] transition-all shadow-xs"
                >
                  Commit Passcode Transformation
                </button>
              </div>

            </form>
          </div>

          {/* ADDED UTILITY 2: SYSTEM ALERT PREFERENCES */}
          <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-5 space-y-3 shadow-2xs text-xs font-bold">
            <span className="text-[10px] text-[#555555] uppercase block font-black tracking-wider flex items-center gap-1">
              <BellRing className="w-3.5 h-3.5" /> 4. Automated Notification Matrices
            </span>
            <div className="flex items-center justify-between p-2.5 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl">
              <div>
                <p className="text-[#1A1A1A] font-black">System Logs & Leave Triggers Email Routing</p>
                <span className="text-[10px] text-[#555555] font-medium">Forward high-priority clerk/teacher leave logs instantly to admin inbox.</span>
              </div>
              <button type="button" onClick={() => setEmailAlerts(!emailAlerts)} className="text-[#1A1A1A]">
                {emailAlerts ? <ToggleRight className="w-9 h-9 text-emerald-600" /> : <ToggleLeft className="w-9 h-9 text-neutral-400" />}
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Settings;