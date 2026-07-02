import React from 'react';
import { User, Mail, Phone, Shield, Calendar, Award, Building } from 'lucide-react';
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';

const Profile = ({ session }) => {
  const adminProfile = {
    id: session?.username || '',
    name: session?.displayName || session?.username || '',
    username: session?.username || '',
    email: session?.email || '',
    mobile: session?.mobile || '',
    role: session?.role || '',
    joiningDate: session?.joiningDate || '',
    department: session?.department || '',
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">

      {/* HEADER BANNER */}
      <div className="glass-card p-6 rounded-3xl mb-6 animate-fadeInUp">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <User className="w-5 h-5" /> Admin Security Profile
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Inspect root credentials, authorized nodes, and institutional ownership parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* LEFT SIDEBAR: AVATAR CARD WITH EDIT PHOTO TRACK */}
        <div className="glass-card rounded-3xl p-6 md:col-span-4 flex flex-col items-center text-center space-y-4">
          
          {/* HOVER INTERACTIVE PHOTO MATRIX BLOCK */}
          <ProfilePhotoUploader session={session} className="w-24 h-24" />

          <div>
            <span className="font-mono text-[10px] bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-3 py-1 rounded-md font-black uppercase tracking-wider">
              {adminProfile.id}
            </span>
            <h4 className="text-lg font-black text-slate-900 mt-3 leading-tight">{adminProfile.name}</h4>
            <p className="text-xs text-slate-500 font-bold mt-1">{adminProfile.role}</p>
          </div>
          
          <div className="w-full pt-4 border-t border-slate-100/80 text-[10px] text-left text-slate-500 font-bold space-y-2">
            <div className="flex items-center justify-between">
              <span>Security Access:</span>
              <span className="text-red-600 font-black tracking-tight">LEVEL-0 (ROOT)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>System Status:</span>
              <span className="text-emerald-600 font-black">ONLINE & ACTIVE</span>
            </div>
          </div>
        </div>

        {/* MAIN PROFILE BODY CARD */}
        <div className="glass-card rounded-3xl p-6 md:col-span-8 space-y-6 text-xs font-bold text-slate-900">
          
          {/* SECTION 1: ACCOUNT FIELDS */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100/80 pb-1.5 font-black">
              <Shield className="w-3.5 h-3.5 text-indigo-500" /> System Identification
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-soft p-3 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Immutable Username</span>
                <span className="text-sm font-mono text-slate-900 block mt-1">@{adminProfile.username}</span>
              </div>
              <div className="glass-soft p-3 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Assigned Node Dept</span>
                <span className="text-sm font-medium text-slate-900 flex items-center gap-1.5 mt-1">
                  <Building className="w-3.5 h-3.5 text-slate-500" /> {adminProfile.department}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: COMMUNICATIONS */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100/80 pb-1.5 font-black">
              <Mail className="w-3.5 h-3.5 text-indigo-500" /> Communication Profiles
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-soft p-3 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Primary Email Contact</span>
                <span className="text-sm font-medium text-slate-900 block mt-1 truncate">{adminProfile.email}</span>
              </div>
              <div className="glass-soft p-3 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Hotline Secure Mobile</span>
                <span className="text-sm font-mono text-slate-900 block mt-1">{adminProfile.mobile}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: TIMELINE AUDIT */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b border-slate-100/80 pb-1.5 font-black">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Registry Timeline Logs
            </h5>
            <div className="glass-soft p-3 rounded-xl flex items-center gap-2 text-slate-900">
              <Award className="w-4 h-4 flex-shrink-0" />
              <span>Root access token initialized on <span className="font-mono font-black">{adminProfile.joiningDate}</span> under school cloud registry server codes.</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Profile;
