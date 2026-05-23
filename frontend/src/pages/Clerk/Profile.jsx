import React from 'react';
import { BadgeCheck, BriefcaseBusiness, Mail, Phone, UserRound } from 'lucide-react';
import { getClerkProfile, getInitials } from './clerkPortalData';

const Profile = ({ session }) => {
  const profile = getClerkProfile(session);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 text-center space-y-4">
          <div className="w-28 h-28 mx-auto rounded-3xl border-2 border-[#1A1A1A] bg-[#E1FA6C] flex items-center justify-center text-3xl font-black">
            {getInitials(profile.name)}
          </div>
          <div>
            <h2 className="text-xl font-black">{profile.name}</h2>
            <p className="text-xs font-bold text-[#555555] mt-1">{profile.id}</p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <UserRound className="w-4 h-4" />
            <h3 className="text-sm font-black">Office Profile</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold">
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
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4">
    {React.createElement(icon, { className: 'w-4 h-4 mb-2 text-[#555555]' })}
    <p className="text-[10px] font-black uppercase text-[#555555] mb-1">{label}</p>
    <p className="break-words">{value}</p>
  </div>
);

export default Profile;
