import React from 'react';
import { BadgeCheck, BriefcaseBusiness, Mail, Phone, UserRound } from 'lucide-react';
import { getClerkProfile } from './clerkPortalData';
import ProfilePhotoUploader from '../../components/common/ProfilePhotoUploader';

const Profile = ({ session }) => {
  const profile = getClerkProfile(session);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-center space-y-4">
          <ProfilePhotoUploader session={{ ...session, displayName: profile.name }} />
          <div>
            <h2 className="text-xl font-black text-gradient">{profile.name}</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">{profile.id}</p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100/80 pb-3">
            <UserRound className="w-4 h-4" />
            <h3 className="text-sm font-black">Office Profile</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold stagger">
            <Info label="Role" value={profile.role} icon={BriefcaseBusiness} />
            <Info label="Department" value={profile.department} icon={BadgeCheck} />
            <Info label="Email" value={profile.email} icon={Mail} />
            <Info label="Mobile" value={profile.mobile} icon={Phone} />
            <Info label="Shift" value={profile.shift} icon={BriefcaseBusiness} />
            <Info label="Desk Window" value={profile.deskWindow} icon={BadgeCheck} />
          </div>
        </div>
      </section>
    </div>
  );
};

const Info = ({ label, value, icon }) => (
  <div className="glass-soft rounded-2xl p-4">
    {React.createElement(icon, { className: 'w-4 h-4 mb-2 text-indigo-500' })}
    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">{label}</p>
    <p className="break-words">{value}</p>
  </div>
);

export default Profile;
