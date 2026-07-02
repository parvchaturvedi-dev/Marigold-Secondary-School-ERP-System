import React from 'react';
import { Download, IdCard as IdCardIcon } from 'lucide-react';
import { getTeacherClassSections, getTeacherProfile } from './teacherPortalData';
import {
  IdCardStyles,
  ResponsiveIdCardPair,
  exportIdCardsPdf,
  normalizeStaffCard,
} from '../../components/common/idCardKit';

const IdCard = ({ session }) => {
  const profile = getTeacherProfile(session);
  const sections = getTeacherClassSections(session);
  const cardRecord = normalizeStaffCard(
    {
      username: profile.username,
      displayName: profile.displayName,
      profile: {
        email: profile.email,
        mobile: profile.phone,
        allottedClasses: profile.allottedClasses,
        teacherProfile: {
          ...profile,
          id: profile.employeeId || profile.username,
          role: profile.designation,
          address: profile.address,
        },
      },
    },
    'teacher'
  );

  return (
    <div className="space-y-6 pb-8 font-sans text-slate-900">
      <IdCardStyles />
      <section className="no-print glass-card rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <IdCardIcon className="w-5 h-5" /> Teacher ID Card
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Staff identity generated from the active teacher session.
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportIdCardsPdf([cardRecord], `${cardRecord.id}-id-card.pdf`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full btn-primary text-xs font-black"
        >
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="glass-card rounded-3xl p-6 flex justify-center">
          <div className="id-print-area w-full pb-2 bg-white">
            <ResponsiveIdCardPair record={cardRecord} />
          </div>
        </div>

        <div className="no-print glass-card rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-black">Teaching Scope</h3>
          <div className="space-y-3">
            {sections.map((section) => (
              <div
                key={section.id}
                className="p-3 rounded-2xl glass-soft flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{section.label}</p>
                  <p className="text-[10px] font-bold text-slate-500 truncate">
                    {section.subjects.join(', ')} | {section.students} students
                  </p>
                </div>
                <span className="text-[9px] font-black bg-white/70 px-2 py-1 rounded-md">
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

export default IdCard;
