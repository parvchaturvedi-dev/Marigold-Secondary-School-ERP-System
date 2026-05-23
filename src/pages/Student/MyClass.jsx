import React from 'react';
import { BookOpen, Clock, GraduationCap, Layers, Users } from 'lucide-react';
import {
  getClassLabel,
  getClassRoster,
  getPortalStudent,
  getSubjectPlan,
  getTimetable,
} from './studentPortalData';

const MyClass = ({ session }) => {
  const student = getPortalStudent(session);
  const roster = getClassRoster(student);
  const subjects = getSubjectPlan(student);
  const timetable = getTimetable(student);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Layers className="w-5 h-5" /> My Class
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            {getClassLabel(student)} workspace for {student.displayName}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 min-w-full lg:min-w-[420px]">
          <ClassStat label="Class" value={getClassLabel(student)} icon={GraduationCap} />
          <ClassStat label="Roll" value={student.rollNo} icon={Users} />
          <ClassStat label="Subjects" value={subjects.length} icon={BookOpen} />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Clock className="w-4 h-4" /> Today Timetable
            </h3>
            <span className="text-[10px] font-black text-[#555555]">Room 201</span>
          </div>

          <div className="space-y-3">
            {timetable.map((period) => (
              <div key={period.period} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-[#1A1A1A] text-[#E1FA6C] font-black flex items-center justify-center">
                  {period.period}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{period.subject}</p>
                  <p className="text-[10px] font-bold text-[#555555]">{period.time} | {period.room}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-7 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Users className="w-4 h-4" /> Class Roster
            </h3>
            <span className="text-[10px] font-black text-[#555555]">{roster.length} students shown</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[680px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Admission No.</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {roster.map((item) => {
                  const isActive = item.id === student.id;

                  return (
                    <tr key={item.id} className={isActive ? 'bg-[#E1FA6C]/30' : 'hover:bg-[#F8F8F8]'}>
                      <td className="px-3 py-3 font-mono">{item.rollNo}</td>
                      <td className="px-3 py-3 font-black">{item.displayName}</td>
                      <td className="px-3 py-3 font-mono text-[#555555]">{item.admissionNumber}</td>
                      <td className="px-3 py-3">{getClassLabel(item)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                          isActive ? 'bg-[#1A1A1A] text-[#E1FA6C]' : 'bg-[#EAEAEA] text-[#555555]'
                        }`}>
                          {isActive ? 'ACTIVE USER' : 'CLASSMATE'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
        <h3 className="text-sm font-black mb-4">Subject Teachers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {subjects.map((subject) => (
            <div key={subject.subject} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4">
              <p className="text-xs font-black">{subject.subject}</p>
              <p className="text-[10px] font-bold text-[#555555] mt-1">{subject.teacher}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ClassStat = ({ label, value, icon }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
    {React.createElement(icon, { className: 'w-4 h-4 mb-2' })}
    <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
    <p className="text-sm font-black mt-0.5 truncate">{value}</p>
  </div>
);

export default MyClass;
