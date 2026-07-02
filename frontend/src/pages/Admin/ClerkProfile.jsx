import React from 'react';
import { ArrowLeft, User, Mail, Phone, ShieldCheck, FolderOpen, FileText } from 'lucide-react';

const ClerkProfile = ({ clerk, onBack }) => {
  // If no clerk data is mapped yet, safely fallback to prevent runtime breakdowns
  if (!clerk) {
    return (
      <div className="flex-1 min-h-screen p-6 text-center text-xs font-bold text-slate-500">
        No active clerk dossier selected for routing pipeline.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">

      {/* HEADER NAVIGATION STRIP */}
      <div className="glass-card p-4 rounded-3xl mb-6 flex items-center gap-4 animate-fadeInUp">
        <button
          type="button"
          onClick={onBack}
          className="p-2 btn-ghost rounded-xl transition-all"
          title="Return to Directory Workspace"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h3 className="text-md font-black">Clerk Master Profile View</h3>
          <p className="text-[10px] text-slate-500 font-semibold">
            System Audit Asset Snapshot Logs • Verification Node: Secured
          </p>
        </div>
      </div>

      {/* CORE PROFILE DOSSIER PACK SHEET LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* SIDE BAR CARD: IDENTITY BANNER */}
        <div className="glass-card rounded-3xl p-6 md:col-span-4 flex flex-col items-center text-center space-y-4">
          {/* Mock Avatar Node Profile Frame */}
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-indigo-500/30">
            {clerk.name ? clerk.name.charAt(0) : 'C'}
          </div>
          
          <div>
            <span className="font-mono text-[10px] bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-md font-black uppercase tracking-wider">
              {clerk.id}
            </span>
            <h4 className="text-lg font-black text-slate-900 mt-2.5 leading-tight">{clerk.name}</h4>
            <p className="text-xs text-slate-500 font-bold mt-1">Administrative & Clerical Ops Desk</p>
          </div>
          
          <div className="w-full pt-4 border-t border-slate-100/80 text-[10px] text-left text-slate-500 font-bold space-y-2">
            <div className="flex items-center justify-between">
              <span>Node Clearance:</span> 
              <span className="text-emerald-600 font-black tracking-tight">AUTHORIZED STAFF</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Work Environment:</span> 
              <span className="text-slate-900">Main Office Terminal</span>
            </div>
          </div>
        </div>

        {/* MAIN BODY WINDOW: SUBSTANTIVE LOG DATA FIELDS */}
        <div className="glass-card rounded-3xl p-6 md:col-span-8 space-y-6 text-xs font-bold text-slate-900">
          
          {/* SECTION BLOCK 1: BIOMETRIC & COMMUNICATIONS */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100/80 pb-1.5 font-black">
              <User className="w-3.5 h-3.5 text-indigo-500" /> Biometric Demographics & Connection Fields
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-soft p-3 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Official Email Address</span>
                <span className="text-sm font-medium text-slate-900 flex items-center gap-1.5 mt-1 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-500" /> {clerk.email}
                </span>
              </div>
              <div className="glass-soft p-3 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Registered Mobile Connection</span>
                <span className="text-sm font-mono text-slate-900 flex items-center gap-1.5 mt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" /> {clerk.mobile}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION BLOCK 2: LEGAL IDENTITY CARD MATRIX */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100/80 pb-1.5 font-black">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Legal Identity Verification Keys
            </h5>
            <div className="glass-soft p-4 rounded-xl flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-slate-500 block">Aadhaar Card Secure Identification Number</span>
                <span className="text-sm font-mono tracking-widest text-slate-900 block mt-1">
                  {clerk.aadharNumber || '12-Digit System Code'}
                </span>
              </div>
              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md font-black uppercase tracking-wider flex-shrink-0">
                UIDAI Validated
              </span>
            </div>
          </div>

          {/* SECTION BLOCK 3: ATTACHED DOCUMENTS DATA RECEPTACLE */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100/80 pb-1.5 font-black">
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500" /> Scanned Document Assets Vault Pack
            </h5>
            
            {!clerk.documentsAttached || clerk.documentsAttached.length === 0 ? (
              <p className="text-slate-500 text-xs font-semibold py-2">No verification files appended to this staff identity block.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {clerk.documentsAttached.map((file, idx) => (
                  <div 
                    key={idx} 
                    className="glass-soft p-3 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                      <span className="font-mono text-[11px] text-slate-900 truncate">{file}</span>
                    </div>
                    <span 
                      type="button"
                      onClick={() => alert(`Opening binary stream link for decryption pipeline: ${file}`)}
                      className="text-[9px] text-slate-500 font-black underline cursor-pointer hover:text-indigo-600 tracking-tight"
                    >
                      Inspect File
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};

export default ClerkProfile;