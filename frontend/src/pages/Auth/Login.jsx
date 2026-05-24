import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import { authenticateUser, detectRoleFromUsername } from '../../components/common/auth';
import { apiFetch } from '../../components/common/api';

const Login = ({ onLoginSuccess }) => {
  // CORE FORM STATES
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FORCED RESET POPUP STATES
  const [forcedResetModal, setForcedResetModal] = useState({ isOpen: false, username: '', role: '' });
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
        body: JSON.stringify({ newPassword }),
      });

      const nextSession = { ...(forcedResetModal.session || {}), mustChangePassword: false };
      setForcedResetModal({ isOpen: false, username: '', role: '', session: null });
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
    <div className="w-full min-h-screen bg-[#D9D9D9] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* BACKGROUND GRAPHIC INTERACTIVE ANIMATION */}
      <style>{`
        @keyframes pulseBg {
          0%, 100% { transform: scale(1) translate(0px, 0px); }
          33% { transform: scale(1.1) translate(30px, -50px); }
          66% { transform: scale(0.9) translate(-20px, 20px); }
        }
        .animate-mesh-1 { animation: pulseBg 12s infinite ease-in-out; }
        .animate-mesh-2 { animation: pulseBg 16s infinite ease-in-out 2s; }
      `}</style>

      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-mesh-1 pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-mesh-2 pointer-events-none" />

      {/* CORE LOGIN COMPONENT MODULE */}
      <div className="w-full max-w-md bg-white border border-neutral-300 rounded-3xl shadow-2xl overflow-hidden p-8 md:p-10 relative z-10 transition-all transform scale-100 hover:scale-[1.01]">
        
        {/* LOGO AREA */}
        <div className="text-center space-y-2 mb-8">
          <div className="w-14 h-14 bg-neutral-950 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg border border-neutral-800">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-neutral-900">MGPS TERMINAL</h1>
            <p className="text-[10px] font-mono font-black text-neutral-400 tracking-wider">SECURE ENDPOINT SIGN-IN CHANNEL</p>
          </div>
        </div>

        {/* INTERACTIVE DETECTION STATUS BAR */}
        <div className={`mb-6 border text-[11px] font-mono font-black uppercase px-4 py-2.5 rounded-xl transition-all duration-300 text-center tracking-wider ${detectedRole.color}`}>
          {detectedRole.label}
        </div>

        {/* ERROR METRIC RENDERER */}
        {errorMessage && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" /> {errorMessage}
          </div>
        )}

        {/* LOGIN INPUT CONTROLS */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          {/* USERNAME BOX */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-wider block ml-1">Access Identity ID</label>
            <div className="relative bg-neutral-50 border border-neutral-300 rounded-xl focus-within:border-neutral-950 transition-all flex items-center px-3.5 py-3">
              <User className="w-4 h-4 text-neutral-400 mr-2.5" />
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="FAM-104, TCH-401, ADM-901..."
                className="bg-transparent text-xs text-neutral-800 font-bold outline-none w-full uppercase placeholder:normal-case placeholder:font-medium"
              />
            </div>
          </div>

          {/* PASSWORD BOX */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-wider block ml-1">Secure Private Token</label>
            <div className="relative bg-neutral-50 border border-neutral-300 rounded-xl focus-within:border-neutral-950 transition-all flex items-center px-3.5 py-3">
              <Lock className="w-4 h-4 text-neutral-400 mr-2.5" />
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-transparent text-xs text-neutral-800 font-mono font-bold outline-none w-full tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:font-medium"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-neutral-400 hover:text-neutral-800 transition-colors ml-2"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* CONTROL MASTER BUTTON */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full mt-2 bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all group disabled:opacity-60"
          >
            {isSubmitting ? 'LOADING...' : 'INITIALIZE SESSION'} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {/* SECURITY SYSTEM LOG PRINT */}
        <p className="text-[9px] font-mono font-bold text-neutral-400 text-center mt-6 uppercase tracking-wider">
          * Unauthorized access attempts are monitored.
        </p>
      </div>

      {/* ====================================================================
          FORCED PASSWORD RESET POPUP COMPONENT (COMPROMISE FLOW OVERLAY)
          ==================================================================== */}
      {forcedResetModal.isOpen && (
        <div className="fixed inset-0 bg-neutral-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-neutral-300 p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-sm text-left space-y-4 border-t-4 border-t-amber-500 animate-fadeIn">
            
            <div className="flex items-start gap-3 text-amber-800">
              <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider font-mono text-neutral-900">Change Password</h3>
                <p className="text-[11px] text-neutral-500 font-medium mt-0.5">This login is using the shared password sent by the office. Please set a private password now.</p>
              </div>
            </div>

            <form onSubmit={handleForcedPasswordReset} className="space-y-3 pt-2">
              {/* NEW CREDENTIAL */}
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block">New Password</label>
                <input 
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full text-xs font-mono font-bold p-3 bg-neutral-50 border border-neutral-300 rounded-xl outline-none focus:border-neutral-950"
                />
              </div>

              {/* RE-ENTRY VERIFICATION */}
              <div className="space-y-1">
                <label className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block">Confirm Password</label>
                <input 
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter to confirm"
                  className="w-full text-xs font-mono font-bold p-3 bg-neutral-50 border border-neutral-300 rounded-xl outline-none focus:border-neutral-950"
                />
              </div>

              {/* ACTION TRIGGER BUTTON */}
              <button 
                type="submit" 
                className="w-full mt-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-all"
              >
                Save New Password
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Login;
