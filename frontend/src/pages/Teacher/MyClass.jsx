import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  Phone,
  UserRound,
  Users,
} from 'lucide-react';
import {
  getTeacherClassSections,
  getTeacherProfile,
  getTeacherRoster,
  getTeacherSubjectLoad,
  getTeacherTimetable,
} from './teacherPortalData';

const MyClass = ({ session }) => {
  const sections = getTeacherClassSections(session);
  const profile = getTeacherProfile(session);
  const [selectedClass, setSelectedClass] = useState(sections[0]?.className || 'Class 9');
  const selectedSection = sections.find((item) => item.className === selectedClass) || sections[0];
  const roster = getTeacherRoster(session, selectedClass);
  const subjectLoad = getTeacherSubjectLoad(session).filter(
    (item) => item.className === selectedClass
  );
  const timetable = getTeacherTimetable(session).filter(
    (item) => item.className === selectedClass
  );
  const visibleTimetable = timetable.length ? timetable : getTeacherTimetable(session).slice(0, 3);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Layers className="w-5 h-5" /> My Class Workspace
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            {profile.displayName} | Class teacher charge: {profile.classTeacherFor}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 min-w-full lg:min-w-[420px]">
          <ClassStat label="Class" value={selectedSection?.label || selectedClass} icon={GraduationCap} />
          <ClassStat label="Students" value={roster.length} icon={Users} />
          <ClassStat label="Subjects" value={subjectLoad.length || selectedSection?.subjects.length || 0} icon={BookOpen} />
        </div>
      </section>

      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-3 flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setSelectedClass(section.className)}
            className={`px-4 py-2 rounded-2xl text-xs font-black border transition-colors ${
              selectedClass === section.className
                ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                : 'bg-[#F8F8F8] text-[#555555] border-[#EAEAEA] hover:text-[#1A1A1A]'
            }`}
          >
            {section.label}
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Clock className="w-4 h-4" /> Today Periods
            </h3>
            <span className="text-[10px] font-black text-[#555555]">{selectedSection?.room || 'Room 201'}</span>
          </div>

          <div className="space-y-3">
            {visibleTimetable.map((period) => (
              <div key={`${period.period}-${period.subject}`} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-center gap-3">
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

          <div className="mt-5 border-t border-[#EAEAEA] pt-4">
            <h3 className="text-sm font-black mb-3">Subject Coverage</h3>
            <div className="space-y-3">
              {(subjectLoad.length ? subjectLoad : []).map((subject) => (
                <div key={subject.subject} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{subject.subject}</span>
                    <span className="text-[#555555]">{subject.syllabusProgress}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#EAEAEA] overflow-hidden">
                    <div
                      className="h-full bg-[#1A1A1A] rounded-full"
                      style={{ width: `${subject.syllabusProgress}%` }}
                    />
                  </div>
                </div>
              ))}
              {!subjectLoad.length && (
                <p className="text-xs font-bold text-[#555555] bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
                  No dedicated subject load is mapped for this class yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Users className="w-4 h-4" /> Class Roster
            </h3>
            <span className="text-[10px] font-black text-[#555555]">{roster.length} students</span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[780px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Roll</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Admission No.</th>
                  <th className="px-3 py-2">Guardian</th>
                  <th className="px-3 py-2">Notebook</th>
                  <th className="px-3 py-2">Last Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {roster.map((student) => (
                  <tr key={student.id} className="hover:bg-[#F8F8F8]">
                    <td className="px-3 py-3 font-mono">{student.rollNo}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-2xl bg-[#EAEAEA] flex items-center justify-center shrink-0">
                          <UserRound className="w-4 h-4 text-[#555555]" />
                        </span>
                        <span className="font-black">{student.displayName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[#555555]">{student.admissionNumber}</td>
                    <td className="px-3 py-3 text-[#555555]">
                      <Phone className="w-3.5 h-3.5 inline mr-1" /> {student.guardianPhone}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                        student.notebookStatus === 'Checked'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {student.notebookStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono">{student.lastScore}/100</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4" /> Assigned Class Sections
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {sections.map((section) => (
            <div key={section.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4">
              <p className="text-xs font-black">{section.label}</p>
              <p className="text-[10px] font-bold text-[#555555] mt-1">{section.room} | {section.students} students</p>
              <p className="text-[10px] font-bold text-[#555555] mt-1">
                {section.subjects.join(', ')}
              </p>
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
