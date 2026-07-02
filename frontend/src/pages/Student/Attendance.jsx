import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { fetchAttendanceLogs } from '../../components/common/attendanceStore';
import { getClassLabel, getPortalStudent, getStudentMetrics } from './studentPortalData';

const today = new Date();
const keyFromDate = (date) => date.toISOString().slice(0, 10);
const monthLabel = (date) => date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
const statusForLog = (log) => {
  if (!log) return 'holiday';
  if (log.status === 'absent') return 'absent';
  return 'present';
};

const Attendance = ({ session }) => {
  const student = getPortalStudent(session);
  const fallbackMetrics = getStudentMetrics(student);
  const [liveLogs, setLiveLogs] = useState([]);
  const [range, setRange] = useState({
    from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
    to: keyFromDate(today),
  });

  useEffect(() => {
    fetchAttendanceLogs({ entityType: 'student', entityId: student.admissionNumber || student.id, period: 'yearly' })
      .then((payload) => setLiveLogs(payload.logs || []))
      .catch(() => setLiveLogs([]));
  }, [student.admissionNumber, student.id]);

  const logsByDate = useMemo(
    () => new Map(liveLogs.map((log) => [log.attendanceDate, log])),
    [liveLogs]
  );

  const calendarDays = useMemo(() => {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const blanks = Array.from({ length: first.getDay() }, (_, index) => ({ id: `blank-${index}`, blank: true }));
    const days = Array.from({ length: last.getDate() }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), index + 1);
      const key = keyFromDate(date);
      const weekend = date.getDay() === 0 || date.getDay() === 6;
      return {
        id: key,
        day: index + 1,
        date: key,
        weekend,
        status: weekend ? 'holiday' : statusForLog(logsByDate.get(key)),
      };
    });
    return [...blanks, ...days];
  }, [logsByDate]);

  const currentMonthLogs = liveLogs.filter((log) => log.attendanceDate >= range.from && log.attendanceDate <= range.to);
  const metrics = liveLogs.length
    ? {
        workingDays: currentMonthLogs.length,
        presentDays: currentMonthLogs.filter((log) => log.status !== 'absent').length,
        absentDays: currentMonthLogs.filter((log) => log.status === 'absent').length,
      }
    : {
        workingDays: fallbackMetrics.workingDays,
        presentDays: fallbackMetrics.presentDays,
        absentDays: Math.max(0, fallbackMetrics.workingDays - fallbackMetrics.presentDays),
      };
  const attendance = Math.round((metrics.presentDays / Math.max(1, metrics.workingDays)) * 100);
  const rangedLogs = liveLogs
    .filter((log) => log.attendanceDate >= range.from && log.attendanceDate <= range.to)
    .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate));

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" /> Attendance Ledger
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {student.displayName} | {getClassLabel(student)} | {student.admissionNumber}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 min-w-full lg:min-w-[640px]">
          <Summary label="Working Days" value={metrics.workingDays} icon={Clock} tone="text-blue-700 bg-blue-50 border-blue-100" />
          <Summary label="Days Attended" value={metrics.presentDays} icon={CheckCircle2} tone="text-emerald-700 bg-emerald-50 border-emerald-100" />
          <Summary label="Days Absent" value={metrics.absentDays} icon={XCircle} tone="text-rose-700 bg-rose-50 border-rose-100" />
          <Summary
            label="Attendance"
            value={`${attendance}%`}
            icon={attendance >= 75 ? CheckCircle2 : AlertTriangle}
            tone={attendance >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-rose-700 bg-rose-50 border-rose-100'}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black">{monthLabel(today)}</h3>
            <span className="text-[10px] font-black text-slate-500">Read-only calendar</span>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase text-slate-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((day) =>
              day.blank ? (
                <span key={day.id} className="aspect-square" />
              ) : (
                <div key={day.id} className="aspect-square rounded-2xl glass-soft grid place-items-center">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-full text-xs font-black ${
                      day.status === 'present'
                        ? 'bg-emerald-600 text-white'
                        : day.status === 'absent'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {day.day}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="xl:col-span-5 glass-card rounded-3xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black">Historical Log</h3>
            <div className="flex flex-wrap gap-2">
              <input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="h-10 rounded-2xl bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all px-3 text-xs font-bold" />
              <input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="h-10 rounded-2xl bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all px-3 text-xs font-bold" />
            </div>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {rangedLogs.map((log) => (
              <div key={log._id || log.attendanceDate} className="rounded-2xl glass-soft p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black">{log.attendanceDate}</p>
                  <p className="text-[10px] font-bold text-slate-500">{log.source || 'manual'} | {log.recordedBy || 'School'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${log.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {log.status === 'absent' ? 'Absent' : 'Present'}
                </span>
              </div>
            ))}
            {!rangedLogs.length && (
              <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                No attendance records in this date range.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const Summary = ({ label, value, icon, tone }) => (
  <div className={`border rounded-2xl p-3 ${tone}`}>
    {React.createElement(icon, { className: 'w-4 h-4 mb-2' })}
    <p className="text-[10px] font-black uppercase">{label}</p>
    <p className="text-lg font-black mt-0.5">{value}</p>
  </div>
);

export default Attendance;
