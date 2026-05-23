import React from 'react';
import { Download, IdCard as IdCardIcon, ShieldCheck, UserRound } from 'lucide-react';
import { getClassLabel, getPortalStudent } from './studentPortalData';

const IdCard = ({ session }) => {
  const student = getPortalStudent(session);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <IdCardIcon className="w-5 h-5" /> Student ID Card
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            Identity details for {student.displayName} | {getClassLabel(student)}
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
                <h3 className="text-sm font-black">Student Identity Card</h3>
              </div>
              <ShieldCheck className="w-7 h-7 text-[#E1FA6C]" />
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-3xl bg-white border border-[#C8C8C8] flex items-center justify-center">
                  <UserRound className="w-12 h-12 text-[#555555]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-black truncate">{student.displayName}</h4>
                  <p className="text-xs font-bold text-[#555555] mt-1">{getClassLabel(student)} | Roll {student.rollNo}</p>
                  <p className="text-[10px] font-mono font-black bg-[#E1FA6C] inline-block px-2 py-1 rounded-md mt-2">
                    {student.admissionNumber}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <CardField label="Father" value={student.fatherName} />
                <CardField label="Mother" value={student.motherName} />
                <CardField label="DOB" value={student.dob} />
                <CardField label="Blood Group" value={student.bloodGroup} />
                <CardField label="Bus Route" value={student.busRoute} />
                <CardField label="Phone" value={student.guardianPhone} />
              </div>

              <div className="bg-white border border-[#C8C8C8] rounded-2xl p-3">
                <p className="text-[10px] font-black uppercase text-[#555555] mb-1">Address</p>
                <p className="text-xs font-bold">{student.address}</p>
              </div>
            </div>

            <div className="bg-[#E1FA6C] px-5 py-3 text-[10px] font-black flex items-center justify-between">
              <span>Valid Session: 2026-27</span>
              <span>{session?.isSiblingAccount ? 'Sibling scoped' : 'Solo scoped'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#C8C8C8] rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-black">Identity Scope Check</h3>
          <p className="text-xs font-semibold text-[#555555] leading-relaxed">
            Family accounts can keep each student identity separate with admission number, roll number, and
            class details shown below.
          </p>

          <div className="space-y-3">
            {(session?.studentProfiles || [student]).map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                  item.id === student.id
                    ? 'bg-[#E1FA6C] border-[#1A1A1A]/10'
                    : 'bg-[#F8F8F8] border-[#EAEAEA]'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{item.displayName}</p>
                  <p className="text-[10px] font-mono text-[#555555] truncate">
                    {item.admissionNumber} | {getClassLabel(item)}
                  </p>
                </div>
                <span className="text-[9px] font-black bg-white/70 px-2 py-1 rounded-md">
                  {item.id === student.id ? 'ACTIVE' : 'LINKED'}
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
