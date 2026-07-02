import React, { useEffect, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  IdCard,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { formatNotificationTime, useNotificationsDatabase } from '../../components/common/notificationStore';
import { getClassLabel, getPortalStudent } from './studentPortalData';

const normalizeAdmission = (value = '') => String(value || '').trim().toUpperCase();

const Dashboard = ({ session, setActivePage }) => {
  const student = getPortalStudent(session);
  const admissionNumber = normalizeAdmission(student.admissionNumber);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [feeRecord, setFeeRecord] = useState(null);
  const [meetings, setMeetings] = useState([]);

  const { notifications } = useNotificationsDatabase(session);
  const notices = Array.isArray(notifications) ? notifications.slice(0, 2) : [];

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [summaryData, feeData, meetingsData] = await Promise.all([
          apiFetch('/dashboard/summary'),
          apiFetch('/fees/me').catch(() => null),
          apiFetch(
            `/meetings?role=student&username=${encodeURIComponent(session?.username || '')}&className=${encodeURIComponent(student.className || '')}`
          ).catch(() => []),
        ]);

        if (!alive) return;

        setSummary(summaryData || null);

        const feeStudents = Array.isArray(feeData?.students) ? feeData.students : [];
        const matchedFee =
          feeStudents.find((entry) => normalizeAdmission(entry.admissionNumber) === admissionNumber) ||
          feeStudents[0] ||
          null;
        setFeeRecord(matchedFee);

        const upcomingMeetings = Array.isArray(meetingsData)
          ? meetingsData
              .filter((meeting) => meeting.status !== 'ended')
              .sort((a, b) => new Date(a.date) - new Date(b.date))
          : [];
        setMeetings(upcomingMeetings.slice(0, 1));
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Unable to load dashboard right now.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [admissionNumber, session?.username, student.className]);

  const stats = Array.isArray(summary?.stats) ? summary.stats : [];
  const attendanceStat = stats.find((stat) => stat.title === 'Attendance');
  const assignmentsStat = stats.find((stat) => stat.title === 'Assignments');
  const noticesStat = stats.find((stat) => stat.title === 'Notices');

  const hasFeeRecord = Boolean(feeRecord?.hasRecord);
  const feeSummary = feeRecord?.summary || null;

  const quickLinks = [
    { label: 'Profile', page: 'Profile', icon: UserRound },
    { label: 'Attendance', page: 'Attendance', icon: CheckCircle2 },
    { label: 'Assignments', page: 'Assignment', icon: ClipboardList },
    { label: 'Fees', page: 'Fees', icon: Wallet },
    { label: 'Id Card', page: 'Id Card', icon: IdCard },
  ];

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md">
              {session?.isSiblingAccount ? 'Sibling Account' : 'Solo Account'}
            </span>
            <span className="text-[10px] font-mono font-black bg-white/50 px-2.5 py-1 rounded-md">
              Active: {student.admissionNumber}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight">
              {summary?.profile?.displayName || student.displayName}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {summary?.profile?.classLabel || getClassLabel(student)} | Roll{' '}
              {summary?.profile?.rollNo || student.rollNo || '—'}
            </p>
          </div>

          <p className="text-xs text-slate-500 font-semibold max-w-2xl leading-relaxed">
            Academic year 2026-27 summary with attendance, assignments, notices, meetings, and fees.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 min-w-full xl:min-w-[620px]">
          {quickLinks.map((link) => {
            const Icon = link.icon;

            return (
              <button
                key={link.label}
                type="button"
                onClick={() => setActivePage?.(link.page)}
                className="glass-soft glass-hover hover:bg-white/70 rounded-2xl p-3 text-left transition-colors"
              >
                <Icon className="w-4 h-4 mb-2 text-indigo-600" />
                <span className="text-[11px] font-black block">{link.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {loading && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="glass-card rounded-3xl p-4 min-h-32 skeleton" />
          ))}
        </section>
      )}

      {!loading && error && (
        <section className="glass-card rounded-3xl p-6 text-center">
          <p className="text-sm font-bold text-rose-600">{error}</p>
        </section>
      )}

      {!loading && !error && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <MetricCard
            icon={CheckCircle2}
            label="Attendance"
            value={attendanceStat?.value || '—'}
            note={attendanceStat?.subtitle || 'Not available'}
            tone="bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-transparent shadow-lg shadow-emerald-500/20"
          />
          <MetricCard
            icon={ClipboardList}
            label="Assignments"
            value={assignmentsStat?.value || '—'}
            note={assignmentsStat?.subtitle || 'Not available'}
            tone="bg-gradient-to-br from-indigo-500 to-violet-500 text-white border-transparent shadow-lg shadow-indigo-500/20"
          />
          <MetricCard
            icon={BellRing}
            label="Notices"
            value={noticesStat?.value || '—'}
            note={noticesStat?.subtitle || 'Not available'}
            tone="bg-gradient-to-br from-sky-500 to-indigo-500 text-white border-transparent shadow-lg shadow-sky-500/20"
          />
          <MetricCard
            icon={Wallet}
            label="Fees"
            value={hasFeeRecord ? feeSummary?.status || '—' : 'No fee record'}
            note={
              hasFeeRecord && feeSummary?.pending
                ? `Pending Rs. ${Number(feeSummary.pending).toLocaleString('en-IN')}`
                : hasFeeRecord
                  ? 'Ledger clear'
                  : 'Not available'
            }
            tone={
              hasFeeRecord && feeSummary?.pending
                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-transparent shadow-lg shadow-amber-500/20'
                : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-transparent shadow-lg shadow-emerald-500/20'
            }
          />
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Today
            </h3>
            <span className="text-[10px] font-black text-slate-500">{getClassLabel(student)}</span>
          </div>

          {summary?.action ? (
            <div className="glass-soft rounded-2xl p-4">
              <span className="text-[9px] font-black uppercase bg-white/70 border border-white/70 px-2 py-1 rounded-md">
                {summary.action.label}
              </span>
              <p className="text-sm font-black mt-3">{summary.action.title}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">{summary.action.subtitle}</p>
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-500">Not available</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <BellRing className="w-4 h-4" /> Notices
            </h3>
            {notices.length === 0 && (
              <p className="text-[11px] font-semibold text-slate-500">No notices yet.</p>
            )}
            {notices.map((notice) => (
              <div key={notice.id || notice._id} className="glass-soft rounded-2xl p-3">
                <p className="text-xs font-black">{notice.title}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  {formatNotificationTime(notice.createdAt)}
                </p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Next Meeting
            </h3>
            {meetings.length === 0 && (
              <p className="text-[11px] font-semibold text-slate-500">No upcoming meetings.</p>
            )}
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-indigo-100/60 border border-indigo-200/70 rounded-2xl p-3">
                <p className="text-xs font-black">{meeting.title}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  {meeting.date} | {meeting.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({ icon, label, value, note, tone }) => (
  <div className="glass-card glass-hover rounded-3xl p-4 min-h-32 flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${tone}`}>
        {React.createElement(icon, { className: 'w-5 h-5' })}
      </span>
      <TrendingUp className="w-4 h-4 text-slate-500" />
    </div>
    <div>
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
      <p className="text-[10px] font-semibold text-slate-500 mt-1">{note}</p>
    </div>
  </div>
);

export default Dashboard;
