import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Layers,
  Search,
  UserRound,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { useNotificationsDatabase, formatNotificationTime } from '../../components/common/notificationStore';
import { getTeacherProfile } from './teacherPortalData';

const todayIso = () => new Date().toISOString().slice(0, 10);

const Dashboard = ({ session, setActivePage }) => {
  const profile = getTeacherProfile(session);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [timetable, setTimetable] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(true);
  const [timetableError, setTimetableError] = useState('');

  const [meeting, setMeeting] = useState(null);
  const [meetingLoading, setMeetingLoading] = useState(true);
  const [meetingError, setMeetingError] = useState('');

  const { notifications, error: notificationsError } = useNotificationsDatabase(session);
  const notices = notifications.slice(0, 2);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setSummaryLoading(true);
      setSummaryError('');
      try {
        const data = await apiFetch('/dashboard/summary');
        if (!alive) return;
        setSummary(data);
      } catch (err) {
        if (!alive) return;
        setSummaryError(err?.message || 'Unable to load dashboard summary right now.');
      } finally {
        if (alive) setSummaryLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setTimetableLoading(true);
      setTimetableError('');
      try {
        const data = await apiFetch(`/timetable?date=${encodeURIComponent(todayIso())}`);
        if (!alive) return;
        const record = data?.timetable;
        if (!record || !Array.isArray(record.periods) || !record.periods.length) {
          setTimetable([]);
          return;
        }

        const allottedClasses = Array.isArray(session?.allottedClasses) ? session.allottedClasses : [];
        const classTeacherFor = profile.classTeacherFor ? profile.classTeacherFor.split('-')[0] : '';
        const relevantClasses = record.classes.filter(
          (className) => allottedClasses.includes(className) || className === classTeacherFor
        );
        const classesToShow = relevantClasses.length ? relevantClasses : record.classes;

        const rows = record.periods.map((period) => {
          const match = classesToShow
            .map((className) => ({ className, cell: record.cells?.[`${period.id}__${className}`] }))
            .find((item) => item.cell && item.cell.subject);

          return {
            period: period.label,
            time: period.time,
            subject: match?.cell?.subject || 'Free',
            className: match?.className || '',
            room: match?.cell?.room || '',
          };
        });

        setTimetable(rows);
      } catch (err) {
        if (!alive) return;
        setTimetableError(err?.message || 'Unable to load today timetable right now.');
      } finally {
        if (alive) setTimetableLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.allottedClasses, profile.classTeacherFor]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setMeetingLoading(true);
      setMeetingError('');
      try {
        const params = new URLSearchParams({
          role: 'teacher',
          username: session?.username || '',
          allottedClasses: (session?.allottedClasses || []).join(','),
        });
        const data = await apiFetch(`/meetings?${params.toString()}`);
        if (!alive) return;
        const upcoming = Array.isArray(data)
          ? data
              .filter((item) => item.status !== 'ended')
              .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0]
          : null;
        setMeeting(upcoming || null);
      } catch (err) {
        if (!alive) return;
        setMeetingError(err?.message || 'Unable to load meetings right now.');
      } finally {
        if (alive) setMeetingLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [session?.username, session?.allottedClasses]);

  const quickLinks = [
    { label: 'My Class', page: 'My Class', icon: Layers },
    { label: 'Attendance', page: 'Attendance', icon: CheckCircle2 },
    { label: 'Assignments', page: 'Assignment', icon: ClipboardList },
    { label: 'Marks', page: 'Marks Management', icon: BarChart3 },
  ];

  const stats = summary?.stats || [];
  const statIcons = { Classes: GraduationCap, Assignments: ClipboardList, Notices: Search };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md">
              Teacher Portal
            </span>
            <span className="text-[10px] font-mono font-black bg-white/50 px-2.5 py-1 rounded-md">
              {profile.employeeId}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight text-gradient">{profile.displayName}</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {profile.designation} | {profile.department}
            </p>
          </div>

          <p className="text-xs text-slate-500 font-semibold max-w-2xl leading-relaxed">
            Your workspace is scoped to allotted classes, teaching load, attendance registers,
            assignment publishing, and examination review.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-full xl:min-w-[520px]">
          {quickLinks.map((link) => {
            const Icon = link.icon;

            return (
              <button
                key={link.label}
                type="button"
                onClick={() => setActivePage?.(link.page)}
                className="glass-soft glass-hover rounded-2xl p-3 text-left transition-colors"
              >
                <Icon className="w-4 h-4 mb-2 text-slate-900" />
                <span className="text-[11px] font-black block">{link.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {summaryLoading ? (
          [0, 1, 2].map((key) => <MetricSkeleton key={key} />)
        ) : summaryError ? (
          <div className="glass-card rounded-3xl p-4 md:col-span-2 xl:col-span-4 text-xs font-bold text-red-500">
            {summaryError}
          </div>
        ) : (
          <>
            {stats.map((stat) => (
              <MetricCard
                key={stat.title}
                icon={statIcons[stat.title] || GraduationCap}
                label={stat.title}
                value={stat.value}
                note={stat.subtitle}
              />
            ))}
            <MetricCard
              icon={CalendarDays}
              label={summary?.action?.label || 'Status'}
              value={summary?.action?.title || '—'}
              note={summary?.action?.subtitle || 'Not available'}
            />
          </>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <UserRound className="w-4 h-4" /> Profile Snapshot
            </h3>
            <span className="text-[10px] font-black text-slate-500">{profile.username}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoTile label="Class Teacher For" value={profile.classTeacherFor || 'Not assigned'} />
            <InfoTile
              label="Allotted Classes"
              value={profile.allottedClasses?.length ? profile.allottedClasses.join(', ') : 'Not assigned'}
            />
            <InfoTile label="Department" value={profile.department || 'Not assigned'} />
            <InfoTile label="Qualification" value={profile.qualification || 'Not updated'} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <BellRing className="w-4 h-4" /> Notices
            </h3>
            {notificationsError ? (
              <p className="text-[10px] font-bold text-red-500">{notificationsError}</p>
            ) : notices.length ? (
              notices.map((notice) => (
                <div key={notice._id || notice.id} className="glass-soft rounded-2xl p-3">
                  <p className="text-xs font-black">{notice.title}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">
                    {formatNotificationTime(notice.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-[10px] font-bold text-slate-500">No notices right now.</p>
            )}
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Next Meeting
            </h3>
            {meetingLoading ? (
              <p className="text-[10px] font-bold text-slate-500">Loading...</p>
            ) : meetingError ? (
              <p className="text-[10px] font-bold text-red-500">{meetingError}</p>
            ) : meeting ? (
              <div className="bg-indigo-100/60 border border-indigo-200 rounded-2xl p-3">
                <p className="text-xs font-black">{meeting.title}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  {meeting.date} | {meeting.time} | {meeting.scopeType}
                </p>
              </div>
            ) : (
              <p className="text-[10px] font-bold text-slate-500">No upcoming meetings.</p>
            )}
          </div>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
          <h3 className="text-sm font-black flex items-center gap-2">
            <UserRound className="w-4 h-4" /> Today Timetable
          </h3>
          <span className="text-[10px] font-black text-slate-500">Live faculty schedule</span>
        </div>

        {timetableLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 stagger">
            {[0, 1, 2, 3, 4].map((key) => (
              <div key={key} className="glass-soft rounded-2xl p-3 min-h-28 skeleton" />
            ))}
          </div>
        ) : timetableError ? (
          <p className="text-xs font-bold text-red-500">{timetableError}</p>
        ) : timetable.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 stagger">
            {timetable.map((period, index) => (
              <div key={`${period.period}-${index}`} className="glass-soft rounded-2xl p-3 min-h-28">
                <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-black flex items-center justify-center">
                  {period.period}
                </span>
                <p className="text-xs font-black mt-3">{period.subject}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  {period.className || '—'} | {period.time}
                </p>
                <p className="text-[10px] font-bold text-slate-500">{period.room || '—'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold text-slate-500">No timetable published for today.</p>
        )}
      </section>
    </div>
  );
};

const MetricCard = ({ icon, label, value, note }) => (
  <div className="glass-card glass-hover rounded-3xl p-4 min-h-32 flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center">
        {React.createElement(icon, { className: 'w-5 h-5' })}
      </span>
      <BarChart3 className="w-4 h-4 text-slate-400" />
    </div>
    <div>
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
      <p className="text-[10px] font-semibold text-slate-500 mt-1">{note}</p>
    </div>
  </div>
);

const MetricSkeleton = () => (
  <div className="glass-card rounded-3xl p-4 min-h-32 flex flex-col justify-between">
    <div className="w-10 h-10 rounded-2xl skeleton" />
    <div className="space-y-2">
      <div className="h-3 w-16 rounded skeleton" />
      <div className="h-6 w-12 rounded skeleton" />
    </div>
  </div>
);

const InfoTile = ({ label, value }) => (
  <div className="glass-soft rounded-2xl p-3">
    <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
    <p className="text-xs font-black mt-1 break-words">{value}</p>
  </div>
);

export default Dashboard;
