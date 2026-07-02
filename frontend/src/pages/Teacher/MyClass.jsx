import React, { useEffect, useState } from 'react';
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
import { fetchEffectiveTimetable, getClassDayRows, todayIsoDate } from '../../components/common/timetableStore';
import { apiFetch } from '../../components/common/api';
import { sortClassNames } from '../../components/common/masterData';
import { getTeacherProfile } from './teacherPortalData';

const MyClass = ({ session }) => {
  const profile = getTeacherProfile(session);
  const allottedClasses = sortClassNames(
    Array.isArray(session?.allottedClasses) ? session.allottedClasses : []
  );
  const [selectedClass, setSelectedClass] = useState(allottedClasses[0] || '');

  useEffect(() => {
    if (!selectedClass && allottedClasses.length) {
      setSelectedClass(allottedClasses[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allottedClasses.join(',')]);

  const [classInfo, setClassInfo] = useState(null);
  const [classInfoLoading, setClassInfoLoading] = useState(false);
  const [classInfoError, setClassInfoError] = useState('');

  useEffect(() => {
    if (!selectedClass) {
      setClassInfo(null);
      return undefined;
    }
    let active = true;
    setClassInfoLoading(true);
    setClassInfoError('');
    apiFetch('/class-info?className=' + encodeURIComponent(selectedClass))
      .then((data) => {
        if (!active) return;
        setClassInfo(data);
      })
      .catch((err) => {
        if (!active) return;
        setClassInfo(null);
        setClassInfoError(err?.message || 'Unable to load class information right now.');
      })
      .finally(() => {
        if (active) setClassInfoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedClass]);

  const roster = classInfo?.roster || [];
  const subjects = classInfo?.subjects || [];

  const [liveTimetable, setLiveTimetable] = useState([]);
  const [timetableSource, setTimetableSource] = useState('default');
  const [timetableLoading, setTimetableLoading] = useState(false);

  useEffect(() => {
    if (!selectedClass) {
      setLiveTimetable([]);
      return undefined;
    }
    let active = true;
    setTimetableLoading(true);
    fetchEffectiveTimetable({ date: todayIsoDate(), className: selectedClass })
      .then((payload) => {
        if (!active) return;
        const rows = getClassDayRows(payload.timetable, selectedClass).filter((period) => period.subject);
        setLiveTimetable(rows);
        setTimetableSource(payload.source || 'default');
      })
      .catch(() => {
        if (active) setLiveTimetable([]);
      })
      .finally(() => {
        if (active) setTimetableLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedClass]);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Layers className="w-5 h-5" /> My Class Workspace
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {profile.displayName} | Class teacher charge: {profile.classTeacherFor}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 min-w-full lg:min-w-[420px]">
          <ClassStat label="Class" value={classInfo?.className || selectedClass || '—'} icon={GraduationCap} />
          <ClassStat label="Students" value={roster.length} icon={Users} />
          <ClassStat label="Subjects" value={subjects.length} icon={BookOpen} />
        </div>
      </section>

      {allottedClasses.length ? (
        <section className="glass-card rounded-3xl p-3 flex flex-wrap gap-2">
          {allottedClasses.map((className) => (
            <button
              key={className}
              type="button"
              onClick={() => setSelectedClass(className)}
              className={`px-4 py-2 rounded-2xl text-xs font-black border transition-colors ${
                selectedClass === className
                  ? 'btn-primary'
                  : 'bg-white/60 text-slate-500 border-slate-100/80 hover:text-slate-900'
              }`}
            >
              {className}
            </button>
          ))}
        </section>
      ) : (
        <section className="glass-card rounded-3xl p-5 text-xs font-bold text-slate-500">
          No classes are allotted to your account yet.
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Clock className="w-4 h-4" /> Today Periods
            </h3>
            <span className="text-[10px] font-black text-slate-500 uppercase">{timetableSource}</span>
          </div>

          <div className="space-y-3">
            {timetableLoading ? (
              <p className="text-xs font-bold text-slate-500 glass-soft rounded-2xl p-3">Loading today's periods…</p>
            ) : liveTimetable.length ? (
              liveTimetable.map((period) => (
                <div key={`${period.period}-${period.subject}`} className="glass-soft rounded-2xl p-3 flex items-center gap-3">
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
              ))
            ) : (
              <p className="text-xs font-bold text-slate-500 glass-soft rounded-2xl p-3">
                No periods scheduled for this class today.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-slate-100/80 pt-4">
            <h3 className="text-sm font-black mb-3">Subject Coverage</h3>
            <div className="space-y-2">
              {subjects.map((subject) => (
                <div key={subject.subject} className="flex items-center justify-between text-xs font-bold glass-soft rounded-2xl p-3">
                  <span>{subject.subject}</span>
                  <span className="text-slate-500">{subject.teacher || '—'}</span>
                </div>
              ))}
              {!subjects.length && (
                <p className="text-xs font-bold text-slate-500 glass-soft rounded-2xl p-3">
                  No dedicated subject load is mapped for this class yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-7 glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Users className="w-4 h-4" /> Class Roster
            </h3>
            <span className="text-[10px] font-black text-slate-500">{roster.length} students</span>
          </div>

          {classInfoLoading ? (
            <p className="text-xs font-bold text-slate-500 glass-soft rounded-2xl p-4">Loading class roster…</p>
          ) : classInfoError ? (
            <p className="text-xs font-bold text-red-500 glass-soft rounded-2xl p-4">{classInfoError}</p>
          ) : roster.length ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
              <table className="w-full min-w-[620px] text-left text-xs font-bold">
                <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Roll</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Admission No.</th>
                    <th className="px-3 py-2">Guardian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {roster.map((student) => (
                    <tr key={student.admissionNumber || student.rollNo} className="hover:bg-white/60">
                      <td className="px-3 py-3 font-mono">{student.rollNo}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-2xl bg-white/50 flex items-center justify-center shrink-0">
                            <UserRound className="w-4 h-4 text-slate-500" />
                          </span>
                          <span className="font-black">{student.displayName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-500">{student.admissionNumber || '—'}</td>
                      <td className="px-3 py-3 text-slate-500">
                        {student.guardianPhone ? (
                          <>
                            <Phone className="w-3.5 h-3.5 inline mr-1" /> {student.guardianPhone}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-500 glass-soft rounded-2xl p-4">
              No students found for this class yet.
            </p>
          )}
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4" /> Assigned Classes
        </h3>
        {allottedClasses.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {allottedClasses.map((className) => (
              <div key={className} className="glass-soft rounded-2xl p-4">
                <p className="text-xs font-black">{className}</p>
                {profile.classTeacherFor?.startsWith(className) && (
                  <p className="text-[10px] font-bold text-slate-500 mt-1">Class teacher charge</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold text-slate-500 glass-soft rounded-2xl p-4">
            No classes are allotted to your account yet.
          </p>
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
