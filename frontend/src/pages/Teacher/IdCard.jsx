import React from 'react';
import { Download, IdCard as IdCardIcon, ShieldCheck, UserRound } from 'lucide-react';
import {
  getTeacherClassSections,
  getTeacherProfile,
} from './teacherPortalData';

const IdCard = ({ session }) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <IdCardIcon className="w-5 h-5" /> Teacher ID Card
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Staff identity generated from the active teacher session.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E1FA6C] border border-[#1A1A1A]/10 text-xs font-black"
        >
          <Download className="w-4 h-4" /> Print Card
        </button>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex justify-center">
          <div className="w-full max-w-md bg-[#F8F8F8] border-2 border-[#1A1A1A] rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-[#1A1A1A] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#E1FA6C]">MGPS ERP</p>
                <h3 className="text-sm font-black">Faculty Identity Card</h3>
              </div>
              <ShieldCheck className="w-7 h-7 text-[#E1FA6C]" />
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-3xl bg-white border border-[#C8C8C8] flex items-center justify-center">
                  <UserRound className="w-12 h-12 text-[#555555]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-black truncate">{profile.displayName}</h4>
                  <p className="text-xs font-bold text-[#555555] mt-1">{profile.designation}</p>
                  <p className="text-[10px] font-mono font-black bg-[#E1FA6C] inline-block px-2 py-1 rounded-md mt-2">
                    {profile.employeeId}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <CardField label="Department" value={profile.department} />
                <CardField label="Joined" value={profile.joiningDate} />
                <CardField label="Blood Group" value={profile.bloodGroup} />
                <CardField label="Phone" value={profile.phone} />
                <CardField label="Class Charge" value={profile.classTeacherFor} />
                <CardField label="Emergency" value={profile.emergencyContact} />
              </div>

              <div className="bg-white border border-[#C8C8C8] rounded-2xl p-3">
                <p className="text-[10px] font-black uppercase text-[#555555] mb-1">Email</p>
                <p className="text-xs font-bold break-words">{profile.email}</p>
              </div>
            </div>

            <div className="bg-[#E1FA6C] px-5 py-3 text-[10px] font-black flex items-center justify-between">
              <span>Valid Session: 2026-27</span>
              <span>{profile.username}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#C8C8C8] rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-black">Teaching Scope</h3>
          <p className="text-xs font-semibold text-[#555555] leading-relaxed">
            The teacher ID is linked with allotted classes, class teacher charge, examination
            permissions, and attendance register access.
          </p>

          <div className="space-y-3">
            {sections.map((section) => (
              <div
                key={section.id}
                className="p-3 rounded-2xl border bg-[#F8F8F8] border-[#EAEAEA] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{section.label}</p>
                  <p className="text-[10px] font-bold text-[#555555] truncate">
                    {section.subjects.join(', ')} | {section.students} students
                  </p>
                </div>
                <span className="text-[9px] font-black bg-white px-2 py-1 rounded-md">
                  {section.classTeacher ? 'CLASS TEACHER' : 'SUBJECT'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const CardField = ({ label, value }) => (
  <div className="bg-white border border-[#EAEAEA] rounded-2xl p-3 min-w-0">
    <p className="text-[9px] font-black uppercase text-[#555555]">{label}</p>
    <p className="text-xs font-black mt-1 truncate">{value}</p>
  </div>
);

export default IdCard;
