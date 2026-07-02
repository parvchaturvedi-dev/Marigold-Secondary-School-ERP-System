import React, { useEffect, useState } from 'react';
import { BookOpen, Clock, GraduationCap, Layers, Users } from 'lucide-react';
import { fetchEffectiveTimetable, getClassDayRows, todayIsoDate } from '../../components/common/timetableStore';
import { apiFetch } from '../../components/common/api';
import { getClassLabel, getPortalStudent, getTimetable } from './studentPortalData';

const MyClass = ({ session }) => {
  const student = getPortalStudent(session);
  const [liveTimetable, setLiveTimetable] = useState([]);
  const [timetableSource, setTimetableSource] = useState('default');
  const timetable = liveTimetable.length ? liveTimetable : getTimetable(student);

  const [classInfo, setClassInfo] = useState(null);
  const [classInfoLoading, setClassInfoLoading] = useState(true);
  const [classInfoError, setClassInfoError] = useState(null);

  const roster = classInfo?.roster || [];
  const subjects = classInfo?.subjects || [];

  useEffect(() => {
    let active = true;
    fetchEffectiveTimetable({ date: todayIsoDate(), className: student.className })
      .then((payload) => {
        if (!active) return;
        const rows = getClassDayRows(payload.timetable, student.className).filter((period) => period.subject);
        setLiveTimetable(rows);
        setTimetableSource(payload.source || 'default');
      })
      .catch(() => {
        if (active) setLiveTimetable([]);
      });
    return () => {
      active = false;
    };
  }, [student.className]);

  useEffect(() => {
    let active = true;
    setClassInfoLoading(true);
    setClassInfoError(null);

    apiFetch('/class-info')
      .then((payload) => {
        if (!active) return;
        setClassInfo(payload);
      })
      .catch((error) => {
        if (!active) return;
        setClassInfoError(error?.message || 'Unable to load class information.');
      })
      .finally(() => {
        if (active) setClassInfoLoading(false);
      });

    return () => {
      active = false;
    };
  }, [student.className]);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Layers className="w-5 h-5" /> My Class
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
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
        <div className="xl:col-span-5 glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Clock className="w-4 h-4" /> Today Timetable
            </h3>
            <span className="text-[10px] font-black text-slate-500 uppercase">{timetableSource}</span>
          </div>

          <div className="space-y-3">
            {timetable.map((period) => (
              <div key={period.period} className="glass-soft rounded-2xl p-3 flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-black flex items-center justify-center">
                  {period.period}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{period.subject}</p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {[period.time, period.teacher, period.room].filter(Boolean).join(' | ') || 'Timing not set'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-7 glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Users className="w-4 h-4" /> Class Roster
            </h3>
            <span className="text-[10px] font-black text-slate-500">{roster.length} students shown</span>
          </div>

          {classInfoLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((key) => (
                <div key={key} className="skeleton h-10 w-full rounded-2xl" />
              ))}
            </div>
          ) : classInfoError ? (
            <p className="text-xs font-bold text-rose-500 py-6 text-center">{classInfoError}</p>
          ) : roster.length === 0 ? (
            <p className="text-xs font-bold text-slate-500 py-6 text-center">No roster available yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
              <table className="w-full min-w-[680px] text-left text-xs font-bold">
                <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Roll</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Admission No.</th>
                    <th className="px-3 py-2">Class</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {roster.map((item) => {
                    const isActive =
                      item.admissionNumber && item.admissionNumber === student.admissionNumber;

                    return (
                      <tr
                        key={item.admissionNumber || item.rollNo}
                        className={isActive ? 'bg-indigo-100/60' : 'hover:bg-white/60'}
                      >
                        <td className="px-3 py-3 font-mono">{item.rollNo}</td>
                        <td className="px-3 py-3 font-black">{item.displayName}</td>
                        <td className="px-3 py-3 font-mono text-slate-500">{item.admissionNumber || '—'}</td>
                        <td className="px-3 py-3">
                          {[item.className, item.section].filter(Boolean).join('-') || '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                            isActive ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'bg-white/50 text-slate-500'
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
          )}
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <h3 className="text-sm font-black mb-4">Subject Teachers</h3>
        {classInfoLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {[0, 1, 2, 3, 4].map((key) => (
              <div key={key} className="skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : classInfoError ? (
          <p className="text-xs font-bold text-rose-500 py-6 text-center">{classInfoError}</p>
        ) : subjects.length === 0 ? (
          <p className="text-xs font-bold text-slate-500 py-6 text-center">No subject-teacher mapping available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {subjects.map((subject) => (
              <div key={subject.subject} className="glass-soft rounded-2xl p-4">
                <p className="text-xs font-black">{subject.subject}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">{subject.teacher || 'Not assigned'}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const ClassStat = ({ label, value, icon }) => (
  <div className="glass-soft rounded-2xl p-3">
    {React.createElement(icon, { className: 'w-4 h-4 mb-2' })}
    <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
    <p className="text-sm font-black mt-0.5 truncate">{value}</p>
  </div>
);

export default MyClass;
