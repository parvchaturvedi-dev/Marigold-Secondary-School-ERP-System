import React, { useState, useRef } from 'react';
import { User, Mail, Phone, Shield, Calendar, Award, Building, Camera, Check } from 'lucide-react';

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

  // Profile Picture File Target State Vector
  const [profilePic, setProfilePic] = useState(null);
  const fileInputRef = useRef(null);

  // File Upload Pipeline Trigger Handler
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file target type criteria
      if (!file.type.startsWith('image/')) {
        alert('Validation Error: Please select an authorized graphics image file format.');
        return;
      }
      
      const localImageUrl = URL.createObjectURL(file);
      setProfilePic(localImageUrl);
    }
  };

  // Programmatically trigger input target hook click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="flex-1 min-h-screen bg-[#D9D9D9] p-6 font-sans select-none text-[#1A1A1A]">
      
      {/* HEADER BANNER */}
      <div className="bg-[#ffffff] p-6 rounded-3xl border border-[#C8C8C8] mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <User className="w-5 h-5" /> Admin Security Profile
        </h3>
        <p className="text-xs text-[#555555] mt-1">
          Inspect root credentials, authorized nodes, and institutional ownership parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* LEFT SIDEBAR: AVATAR CARD WITH EDIT PHOTO TRACK */}
        <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-6 md:col-span-4 flex flex-col items-center text-center space-y-4 shadow-2xs">
          
          {/* HOVER INTERACTIVE PHOTO MATRIX BLOCK */}
          <div className="relative group w-24 h-24">
            <div className="w-24 h-24 bg-[#EAEAEA] border-2 border-black rounded-3xl flex items-center justify-center text-3xl font-black text-[#1A1A1A] overflow-hidden shadow-inner">
              {profilePic ? (
                <img 
                  src={profilePic} 
                  alt="Admin Identity Asset" 
                  className="w-full h-full object-cover select-none"
                />
              ) : (
                "SA"
              )}
            </div>

            {/* FLOATING ACTION OVERLAY FOR IMAGE MUTATION */}
            <button
              type="button"
              onClick={triggerFileInput}
              className="absolute inset-0 bg-black/60 rounded-3xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-[10px] font-black"
              title="Upload New Avatar Node"
            >
              <Camera className="w-5 h-5 text-[#E1FA6C] mb-0.5" />
              <span>EDIT PIC</span>
            </button>

            {/* HIDDEN INJECTIVE BROWSER INPUT ELEMENT */}
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div>
            <span className="font-mono text-[10px] bg-[#1A1A1A] text-[#E1FA6C] px-3 py-1 rounded-md font-black uppercase tracking-wider">
              {adminProfile.id}
            </span>
            <h4 className="text-lg font-black text-[#1A1A1A] mt-3 leading-tight">{adminProfile.name}</h4>
            <p className="text-xs text-[#555555] font-bold mt-1">{adminProfile.role}</p>
          </div>
          
          <div className="w-full pt-4 border-t border-[#EAEAEA] text-[10px] text-left text-[#555555] font-bold space-y-2">
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
        <div className="bg-[#ffffff] border border-[#C8C8C8] rounded-3xl p-6 md:col-span-8 space-y-6 text-xs font-bold text-[#1A1A1A] shadow-2xs">
          
          {/* SECTION 1: ACCOUNT FIELDS */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-[#555555] flex items-center gap-1.5 border-b border-[#EAEAEA] pb-1.5 font-black">
              <Shield className="w-3.5 h-3.5 text-black" /> System Identification
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-3 rounded-xl">
                <span className="text-[10px] text-[#555555] block">Immutable Username</span>
                <span className="text-sm font-mono text-[#1A1A1A] block mt-1">@{adminProfile.username}</span>
              </div>
              <div className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-3 rounded-xl">
                <span className="text-[10px] text-[#555555] block">Assigned Node Dept</span>
                <span className="text-sm font-medium text-[#1A1A1A] flex items-center gap-1.5 mt-1">
                  <Building className="w-3.5 h-3.5 text-[#555555]" /> {adminProfile.department}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: COMMUNICATIONS */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-[#555555] flex items-center gap-1.5 border-b border-[#EAEAEA] pb-1.5 font-black">
              <Mail className="w-3.5 h-3.5 text-black" /> Communication Profiles
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-3 rounded-xl">
                <span className="text-[10px] text-[#555555] block">Primary Email Contact</span>
                <span className="text-sm font-medium text-[#1A1A1A] block mt-1 truncate">{adminProfile.email}</span>
              </div>
              <div className="bg-[#EAEAEA]/40 border border-[#C8C8C8]/60 p-3 rounded-xl">
                <span className="text-[10px] text-[#555555] block">Hotline Secure Mobile</span>
                <span className="text-sm font-mono text-[#1A1A1A] block mt-1">{adminProfile.mobile}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: TIMELINE AUDIT */}
          <div className="space-y-3">
            <h5 className="text-[10px] uppercase tracking-wider text-[#555555] flex items-center gap-1.5 border-b border-[#EAEAEA] pb-1.5 font-black">
              <Calendar className="w-3.5 h-3.5 text-black" /> Registry Timeline Logs
            </h5>
            <div className="bg-[#EAEAEA]/20 p-3 rounded-xl border border-[#C8C8C8]/40 flex items-center gap-2 text-[#1A1A1A]">
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
