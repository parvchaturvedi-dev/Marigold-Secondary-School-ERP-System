import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  Loader2,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { apiFetch } from './api';
import { useMongoState } from './mongoState';

/* ---------------------------------------------------------------- helpers */

const pad2 = (value) => String(value).padStart(2, '0');

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

// Normalise any ISO / date-ish value to a YYYY-MM-DD key (or '' if invalid).
const toDateKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

// ISO string -> local "hh:mm AM/PM" (or '—' when null / invalid).
const formatClockTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const STATUS_META = {
  present: { label: 'Present', chip: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  'half-day': { label: 'Half-day', chip: 'bg-amber-50 text-amber-700 border border-amber-100' },
  absent: { label: 'Absent', chip: 'bg-rose-50 text-rose-700 border border-rose-100' },
  unmarked: { label: 'Unmarked', chip: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const statusMeta = (status) => STATUS_META[status] || STATUS_META.unmarked;

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

/* ---------------------------------------------------------- staff normalise */

const normaliseStaff = (list, fallbackRole) =>
  (Array.isArray(list) ? list : [])
    .map((entry) => {
      if (!entry) return null;
      const id = entry.id || entry.teacherId || entry.empId || entry.clerkId || entry.entityId || '';
      const name = entry.name || entry.displayName || entry.fullName || 'Unnamed Staff';
      if (!id && !name) return null;
      return {
        entityId: String(id),
        displayName: name,
        role: entry.role || fallbackRole,
      };
    })
    .filter(Boolean);

/* ================================================================ component */

const StaffAttendanceReport = () => {
  const [teachers] = useMongoState('admin-teacher-management-list', []);
  const [clerks] = useMongoState('admin-clerk-management-list', []);

  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null); // { entityId, displayName, role }

  const staffList = useMemo(() => {
    const merged = [
      ...normaliseStaff(teachers, 'Teacher'),
      ...normaliseStaff(clerks, 'Clerk'),
    ];
    const seen = new Set();
    return merged.filter((person) => {
      const key = person.entityId || person.displayName;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [teachers, clerks]);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return staffList;
    return staffList.filter((person) =>
      `${person.displayName} ${person.role} ${person.entityId}`.toLowerCase().includes(term)
    );
  }, [staffList, search]);

  if (selectedStaff) {
    return <StaffReportView staff={selectedStaff} onBack={() => setSelectedStaff(null)} />;
  }

  /* ------------------------------------------------------------- staff grid */
  return (
    <section className="glass-card rounded-3xl p-5 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100/80 pb-4">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <UsersRound className="w-4 h-4 text-emerald-700" /> Staff Attendance
          </h3>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            Select a teacher or clerk to view their month-by-month attendance report.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search staff by name, role or ID"
            className="h-10 w-full md:w-72 rounded-2xl bg-white/60 border border-white/80 pl-9 pr-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
          />
        </div>
      </div>

      {filteredStaff.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 px-4 py-10 text-center">
          <UsersRound className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-black text-slate-500 mt-2">
            {staffList.length === 0 ? 'No staff records found yet.' : 'No staff match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((person) => {
            const isTeacher = String(person.role).toLowerCase().includes('teacher');
            return (
              <button
                key={person.entityId || person.displayName}
                type="button"
                onClick={() => setSelectedStaff(person)}
                className="glass-card glass-hover rounded-3xl p-4 text-left flex items-center gap-3 group transition-all"
              >
                <div className="w-11 h-11 shrink-0 rounded-2xl bg-white/60 border border-white/80 flex items-center justify-center text-sm font-black text-emerald-700">
                  {person.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[9px] bg-indigo-50/60 px-2 py-0.5 rounded border border-white/70 uppercase font-bold text-slate-600">
                    {person.entityId || '—'}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 truncate mt-1">{person.displayName}</h4>
                  <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                    {isTeacher ? <GraduationCap className="w-3 h-3" /> : <UserRound className="w-3 h-3" />}
                    <span className="capitalize">{person.role}</span>
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

/* ========================================================= staff report view */

const fetchStaffReport = ({ entityId, from, to }) => {
  const query = new URLSearchParams({ entityId });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return apiFetch(`/attendance/staff-report?${query.toString()}`);
};

const StaffReportView = ({ staff, onBack }) => {
  const [state, setState] = useState({ isLoading: true, error: '', report: null });
  const [selectedMonth, setSelectedMonth] = useState(null); // month object
  const [range, setRange] = useState({ from: '', to: todayKey() });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const isTeacher = String(staff.role).toLowerCase().includes('teacher');

  useEffect(() => {
    let active = true;
    setState({ isLoading: true, error: '', report: null });
    setSelectedMonth(null);
    fetchStaffReport({ entityId: staff.entityId })
      .then((report) => {
        if (!active) return;
        setState({ isLoading: false, error: '', report });
        const joinKey = toDateKey(report?.joinDate);
        setRange({ from: joinKey || todayKey(), to: todayKey() });
      })
      .catch((error) => {
        if (!active) return;
        setState({ isLoading: false, error: error.message || 'Could not load the report.', report: null });
      });
    return () => {
      active = false;
    };
  }, [staff.entityId]);

  const report = state.report;
  const displayName = report?.displayName || staff.displayName;
  const role = report?.role || staff.role;
  const joinKey = toDateKey(report?.joinDate);

  // Newest month first.
  const months = useMemo(() => {
    const list = Array.isArray(report?.months) ? [...report.months] : [];
    return list.sort((a, b) => String(b.month).localeCompare(String(a.month)));
  }, [report]);

  const handleExport = async () => {
    setExportError('');
    setIsExporting(true);
    try {
      const data = await fetchStaffReport({ entityId: staff.entityId, from: range.from, to: range.to });
      const rows = [];
      (data?.months || []).forEach((month) => {
        (month.days || []).forEach((day) => {
          const key = toDateKey(day.date);
          if (range.from && key && key < range.from) return;
          if (range.to && key && key > range.to) return;
          rows.push([
            key || day.date || '',
            day.weekday || '',
            statusMeta(day.status).label,
            formatClockTime(day.clockInAt),
            formatClockTime(day.clockOutAt),
          ]);
        });
      });
      rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

      const header = ['Date', 'Weekday', 'Status', 'Clock In', 'Clock Out'];
      const csv = [header, ...rows]
        .map((row) => row.map(csvCell).join(','))
        .join('\r\n');

      const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const safeName = String(displayName).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
      anchor.href = url;
      anchor.download = `attendance_${safeName || staff.entityId}_${range.from}_to_${range.to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  /* ----------------------------------------------------------- month detail */
  if (selectedMonth) {
    return (
      <MonthDetailView
        month={selectedMonth}
        staffName={displayName}
        onBack={() => setSelectedMonth(null)}
      />
    );
  }

  return (
    <section className="glass-card rounded-3xl p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-100/80 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="h-9 w-9 shrink-0 rounded-2xl bg-white/70 border border-white/80 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
              aria-label="Back to staff list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-11 h-11 shrink-0 rounded-2xl bg-white/60 border border-white/80 flex items-center justify-center text-sm font-black text-emerald-700">
              {String(displayName).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 truncate flex items-center gap-1.5">
                {isTeacher ? <GraduationCap className="w-4 h-4 text-slate-400" /> : <UserRound className="w-4 h-4 text-slate-400" />}
                {displayName}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                <span className="capitalize">{role}</span>
                <span className="font-mono text-slate-400"> · {staff.entityId}</span>
                {joinKey && <span> · Joined: {joinKey}</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Export control */}
        <div className="flex flex-wrap items-end gap-2 bg-white/40 border border-white/70 rounded-2xl p-3">
          <label className="text-[10px] font-black uppercase text-slate-500">
            From
            <input
              type="date"
              value={range.from}
              max={range.to || todayKey()}
              onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              className="mt-1 h-9 w-full rounded-xl bg-white/70 border border-white/80 px-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
          </label>
          <label className="text-[10px] font-black uppercase text-slate-500">
            To
            <input
              type="date"
              value={range.to}
              max={todayKey()}
              onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              className="mt-1 h-9 w-full rounded-xl bg-white/70 border border-white/80 px-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
          </label>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || state.isLoading}
            className="h-9 px-4 rounded-xl btn-primary text-xs font-black inline-flex items-center gap-2 disabled:opacity-40"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          {exportError && (
            <span className="text-[10px] font-black text-rose-600 self-center">{exportError}</span>
          )}
        </div>
      </div>

      {/* Body */}
      {state.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs font-black">Loading attendance report...</span>
        </div>
      ) : state.error ? (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-black text-rose-700">
          {state.error}
        </div>
      ) : months.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 px-4 py-10 text-center">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-black text-slate-500 mt-2">No attendance months recorded yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {months.map((month) => (
            <MonthCard key={month.month} month={month} onOpen={() => setSelectedMonth(month)} />
          ))}
        </div>
      )}
    </section>
  );
};

/* ---------------------------------------------------------------- month card */

const MonthCard = ({ month, onOpen }) => {
  const percent = clamp(month.percent);
  const absentPercent = clamp(100 - percent);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-card glass-hover rounded-3xl p-4 text-left space-y-3 group transition-all"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black text-slate-900">{month.label || month.month}</h4>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
        <Stat label="School Days" value={month.schoolDays} tone="text-slate-700" />
        <Stat label="Present" value={month.presentDays} tone="text-emerald-700" />
        <Stat label="Absent" value={month.absentDays} tone="text-rose-700" />
        <Stat label="Half-days" value={month.halfDays} tone="text-amber-700" />
      </div>

      {/* Split bar: green = present%, red = absent% */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-black uppercase text-slate-400">Attendance</span>
          <span className={`text-xs font-black ${percent >= 75 ? 'text-emerald-700' : percent >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
            {percent}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-100 flex">
          <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
          <div className="h-full bg-rose-500" style={{ width: `${absentPercent}%` }} />
        </div>
      </div>
    </button>
  );
};

const Stat = ({ label, value, tone }) => (
  <div className="rounded-xl bg-white/50 border border-white/70 px-2.5 py-1.5">
    <p className="text-[9px] font-black uppercase text-slate-400">{label}</p>
    <p className={`text-base font-black ${tone}`}>{value ?? 0}</p>
  </div>
);

/* -------------------------------------------------------------- month detail */

const MonthDetailView = ({ month, staffName, onBack }) => {
  const days = Array.isArray(month.days) ? month.days : [];

  return (
    <section className="glass-card rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-100/80 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="h-9 w-9 shrink-0 rounded-2xl bg-white/70 border border-white/80 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
          aria-label="Back to months"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-700" /> {month.label || month.month}
          </h3>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
            {staffName} · {clamp(month.percent)}% present · {month.presentDays ?? 0}/{month.schoolDays ?? 0} days
          </p>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/40 px-4 py-10 text-center">
          <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-black text-slate-500 mt-2">No day records for this month.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
          <table className="w-full min-w-160 text-left text-xs font-bold">
            <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Day</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Clock In</th>
                <th className="px-3 py-3">Clock Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {days.map((day) => {
                const meta = statusMeta(day.status);
                return (
                  <tr key={toDateKey(day.date) || day.date} className="hover:bg-white/60">
                    <td className="px-3 py-2.5 font-mono text-slate-700">{toDateKey(day.date) || day.date}</td>
                    <td className="px-3 py-2.5 text-slate-500">{day.weekday || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${meta.chip}`}>
                        {day.status === 'present' && <CheckCircle2 className="w-3 h-3" />}
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-emerald-700">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {formatClockTime(day.clockInAt)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-indigo-700">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" />
                        {formatClockTime(day.clockOutAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default StaffAttendanceReport;
