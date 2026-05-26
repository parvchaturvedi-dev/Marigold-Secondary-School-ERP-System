import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldAlert, ArrowRight, RefreshCw, GraduationCap, Award, ClipboardList, ShieldCheck } from 'lucide-react';
import { authenticateUser, detectRoleFromUsername } from '../../components/common/auth';
import { apiFetch } from '../../components/common/api';
import Logo from "../../assets/logo.png";

const Login = ({ onLoginSuccess }) => {
  // CORE FORM STATES
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FORCED RESET POPUP STATES
  const [forcedResetModal, setForcedResetModal] = useState({ isOpen: false, username: '', role: '' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const detectedRole = detectRoleFromUsername(username);

  // AUTHENTICATION MATRIX HANDLER
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const targetUser = username.trim();
    const targetPass = password.trim();
    const targetRole = detectRoleFromUsername(targetUser);

    if (!targetUser || !targetPass) {
      setErrorMessage('Please fill in all encrypted security protocols.');
      return;
    }

    if (targetRole.id === 'unknown') {
      setErrorMessage('Use a valid role ID prefix: ADM-, CLK-, TCH-, STD-, or FAM-.');
      return;
    }

    setIsSubmitting(true);
    try {
      const authSession = await authenticateUser({ username: targetUser, password: targetPass });

      if (authSession.mustChangePassword) {
        setForcedResetModal({ isOpen: true, username: authSession.username, role: authSession.role, session: authSession });
        return;
      }

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(authSession);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // EXTENDED FORCE PASSWORD CHANGEOVER HANDLER
  const handleForcedPasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Verification Error: Password parameters do not match.');
      return;
    }

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const nextSession = { ...(forcedResetModal.session || {}), mustChangePassword: false };
      setForcedResetModal({ isOpen: false, username: '', role: '', session: null });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(nextSession);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col lg:flex-row relative overflow-hidden font-sans select-none">

      {/* BACKGROUND INTERACTIVE ANIMATION (Professional Fluid Blob) */}
      <style>{`
        @keyframes floatEffect {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(30px, -40px) scale(1.1); }
        }
        .animate-blob { animation: floatEffect 14s infinite ease-in-out; }
      `}</style>

      {/* LEFT SECTION: Premium Decorative Brand Panel 
        RESPONSIVE BREAKPOINT: Hidden below 940px/1024px custom viewport (`hidden lg:flex`).
        Gives a gorgeous presentation of MGHUB and its 4 core modules.
      */}
      <div className="hidden lg:flex w-full lg:w-[48%] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-12 flex-col justify-between relative overflow-hidden shadow-2xl min-h-screen">

        {/* Animated Orbs for visual depth */}
        <div className="absolute -top-10 -left-10 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-blob pointer-events-none" />
        <div className="absolute bottom-10 right-[-10%] w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[140px] animate-blob pointer-events-none" style={{ animationDelay: '4s' }} />

        {/* Minimalist Top Tag */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase">
            Marigold Digital Ecosystem
          </span>
        </div>

        {/* MGHUB BRAND & MODULE EXP-PANEL */}
        <div className="relative z-10 my-auto space-y-8 max-w-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center bg-blue-500/10 backdrop-blur-md rounded-xl px-4 py-1.5 border border-blue-500/20 text-xs font-bold text-blue-400 tracking-wide uppercase">
              🚀 Welcome to the Future
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              MGHUB <br />
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent font-extrabold text-3xl lg:text-4xl">
                Smart Way Of Education
              </span>
            </h2>
            <p className="text-sm text-slate-400 max-w-md font-medium leading-relaxed">
              An all-in-one unified intelligence hub to track progress, streamline operations, and boost collaborative academic growth.
            </p>
          </div>

          {/* THE 4 CORE MODULES */}
          <div className="grid grid-cols-2 gap-4 pt-4">

            {/* Student Module */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 space-y-2 transition-all hover:bg-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">Student Portal</h3>
              <p className="text-xs text-slate-400 leading-normal">Track your daily progress, access report cards, and manage live assignments instantly.</p>
            </div>

            {/* Teacher Module */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 space-y-2 transition-all hover:bg-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">Teacher Suite</h3>
              <p className="text-xs text-slate-400 leading-normal">Simplify grading, capture instant attendance, and manage student analytics seamlessly.</p>
            </div>

            {/* Clerk Module */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 space-y-2 transition-all hover:bg-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">Clerk Office</h3>
              <p className="text-xs text-slate-400 leading-normal">Manage structured fees, process accounts, admissions, and fast documentation.</p>
            </div>

            {/* Admin Module */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 space-y-2 transition-all hover:bg-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">Admin Control</h3>
              <p className="text-xs text-slate-400 leading-normal">Total campus operational control, configuration setups, and overall high-level security.</p>
            </div>

          </div>
        </div>

        {/* Side Panel Footer */}
        <div className="relative z-10 text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider">
          &copy; {new Date().getFullYear()} Marigold School Behror. Powered by MGHUB.
        </div>
      </div>

      {/* RIGHT SECTION: Ultra-Clean Professional Interactive Login Form */}
      <div className="w-full lg:w-[52%] flex items-center justify-center p-6 sm:p-12 md:p-16 bg-white relative z-10">
        <div className="w-full max-w-[420px] space-y-8 animate-fadeIn">

          {/* SCHOOL LOGO AREA */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">

            {/* SCHOOL LOGO BOX */}
            <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center shadow-md transition-transform duration-300 hover:scale-105 p-2">
              <img
                src={Logo}
                alt="Marigold School Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentNode.innerHTML = '<div class="text-blue-950 font-black text-2xl font-serif tracking-tighter">M</div>';
                }}
              />
            </div>

            {/* Brand Title block */}
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Marigold School, Behror
              </h1>
              <p className="text-sm font-semibold text-slate-500 tracking-wide">
                ERP Access Gate &bull; Sign In Below
              </p>
            </div>
          </div>

          {/* DYNAMIC ROLE RECOGNITION BADGE */}
          {username.trim() && (
            <div className={`border text-xs font-mono font-bold uppercase px-4 py-3 rounded-xl transition-all duration-300 text-center tracking-wider shadow-inner ${detectedRole.color}`}>
              Role Identified: {detectedRole.label}
            </div>
          )}

          {/* DYNAMIC ERROR PROTOCOL BOX */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3.5 rounded-xl flex items-start gap-2.5 shadow-sm animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-900 mb-0.5">Authentication Failure</span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* CREDENTIAL FORM LAYER */}
          <form onSubmit={handleLoginSubmit} className="space-y-5">

            {/* USERNAME FIELD */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 tracking-wide block ml-0.5">
                User Access ID
              </label>
              <div className="relative bg-slate-50 border border-slate-200 rounded-xl focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all flex items-center px-4 py-3.5 group">
                <User className="w-5 h-5 text-slate-400 mr-3 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., STD-102, TCH-405, ADM-901"
                  className="bg-transparent text-sm text-slate-800 font-bold outline-none w-full uppercase placeholder:normal-case placeholder:font-medium placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* PASSWORD FIELD */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <label className="text-xs font-bold text-slate-700 tracking-wide block">
                  Private Password
                </label>
                <button
                  type="button"
                  onClick={() => alert("Please contact the computer department or system admin desk to manage encryption resets.")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-all"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative bg-slate-50 border border-slate-200 rounded-xl focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all flex items-center px-4 py-3.5 group">
                <Lock className="w-5 h-5 text-slate-400 mr-3 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="bg-transparent text-sm text-slate-800 font-mono font-bold outline-none w-full tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:font-medium placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-700 transition-colors ml-2"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* REMEMBER DEVICE SESSION TOGGLE */}
            <div className="flex items-center ml-0.5 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-700 select-none">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Keep me authenticated on this device
              </label>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold uppercase tracking-wider py-4 px-4 rounded-xl shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Initializing Secure Tunnel...
                </>
              ) : (
                <>
                  Authenticate Session <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* POLICY TERMS FOOTER */}
          <p className="text-[11px] text-slate-400 text-center lg:text-left leading-relaxed font-medium">
            By accessing this hub, you agree to our{' '}
            <a href="#terms" className="text-slate-600 hover:text-blue-600 font-semibold underline">Terms of Use</a>{' '}
            &{' '}
            <a href="#privacy" className="text-slate-600 hover:text-blue-600 font-semibold underline">Privacy Standards</a>.
          </p>
        </div>
      </div>

      {/* ====================================================================
          FORCED PASSWORD RESET POPUP COMPONENT (COMPROMISE FLOW OVERLAY)
          ==================================================================== */}
      {forcedResetModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-md text-left space-y-5 border-t-[6px] border-t-amber-500 transform scale-100 transition-all">

            <div className="flex items-start gap-3.5 text-amber-900">
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex-shrink-0">
                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-slate-900">First-Time Token Upgrade</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Security policy requires modifying temporary admin credentials before entry to MGHUB nodes.</p>
              </div>
            </div>

            <form onSubmit={handleForcedPasswordReset} className="space-y-4 pt-1">

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 ml-0.5 block">Current Temporary Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter temporary password token"
                  className="w-full text-sm font-mono font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

              {/* NEW CREDENTIAL */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 ml-0.5 block">New Personalized Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 alpha-numeric characters"
                  className="w-full text-sm font-mono font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

              {/* RE-ENTRY VERIFICATION */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 ml-0.5 block">Verify New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full text-sm font-mono font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white transition-all"
                />
              </div>

              {/* ACTION TRIGGER BUTTON */}
              <button
                type="submit"
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider py-3.5 px-4 rounded-xl shadow-lg transition-all"
              >
                Apply Custom Configuration
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Login;
