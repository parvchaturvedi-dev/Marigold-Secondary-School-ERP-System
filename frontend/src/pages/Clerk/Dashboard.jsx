import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  IdCard,
  Inbox,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../../components/common/api';
import { useAttendanceOverview } from '../../components/common/attendanceStore';
import { useMongoState } from '../../components/common/mongoState';
import { LEAVE_STATUS } from '../../components/common/leaveRequestStore';
import { getClerkProfile } from './clerkPortalData';

const PENDING_LEAVE_STATUSES = [
  LEAVE_STATUS.pendingAdmin,
  LEAVE_STATUS.pendingClassTeacher,
  LEAVE_STATUS.forwardedAdmin,
];

const asArray = (value) => (Array.isArray(value) ? value : []);
const asCount = (value) => (Array.isArray(value) ? value.length : 0);

const shortClassLabel = (className = '', section = '') => {
  const cls = String(className || '').replace(/^Class\s+/i, 'C').trim() || '—';
  return section ? `${cls}-${section}` : cls;
};

const Dashboard = ({ session, setActivePage }) => {
  const profile = getClerkProfile(session);

  // Real attendance overview (today, all classes) — same source the Attendance page uses.
  const { overview, isLoading: attendanceLoading, error: attendanceError } = useAttendanceOverview({});

  // Real headcounts straight from the shared module-state collections.
  const [students, , studentsMeta] = useMongoState('admin-student-management-students', []);
  const [teachers, , teachersMeta] = useMongoState('admin-teacher-management-list', []);
  const [clerks] = useMongoState('admin-clerk-management-list', []);
  const [requirements] = useMongoState('admin-document-requirements', { Student: [], Teacher: [] });

  // Real staff summary (notices unread, vault records) from the dashboard summary endpoint.
  const [summary, setSummary] = useState(null);

  // Real pending queues the clerk can act on.
  const [applications, setApplications] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [queueError, setQueueError] = useState('');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const params = new URLSearchParams({
        role: session?.role || 'clerk',
        username: session?.username || '',
      }).toString();

      const [summaryData, applicationData, leaveData] = await Promise.all([
        apiFetch('/dashboard/summary').catch(() => null),
        apiFetch(`/applications?${params}`).catch(() => []),
        apiFetch(`/leave-requests?${params}`).catch(() => []),
      ]);

      if (!alive) return;

      setSummary(summaryData || null);
      setApplications(asArray(applicationData));
      setLeaveRequests(asArray(leaveData));
      if (!summaryData) {
        setQueueError('Some live counters could not be loaded right now.');
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [session?.role, session?.username]);

  const stats = asArray(summary?.stats);
  const noticesStat = stats.find((stat) => stat.title === 'Notices');
  const documentsVaultStat = stats.find((stat) => stat.title === 'Documents');

  const studentCount = asCount(students);
  const teacherCount = asCount(teachers);
  const clerkCount = asCount(clerks);

  const requiredStudentDocs = asCount(requirements?.Student);
  const requiredTeacherDocs = asCount(requirements?.Teacher);
  // A real, cheap "documents to verify" figure: the number of required document
  // slots across the whole school (people x required doc types per role).
  const documentSlots = studentCount * requiredStudentDocs + teacherCount * requiredTeacherDocs;
  const requiredDocTypes = requiredStudentDocs + requiredTeacherDocs;

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === 'pending'),
    [applications]
  );
  const pendingLeaves = useMemo(
    () => leaveRequests.filter((request) => PENDING_LEAVE_STATUSES.includes(request.status)),
    [leaveRequests]
  );

  // Real attendance metrics from the overview endpoint.
  const attendance = useMemo(() => {
    const counts = overview?.counts || {};
    const roster = asArray(overview?.roster);
    const present = (counts.present || 0) + (counts.manual || 0);
    const late = counts['half-day'] || 0;
    const marked = present + late + (counts.absent || 0);
    const total = counts.total || roster.length || 0;
    const rate = marked ? Math.round((present / marked) * 100) : 0;

    // Per-class present/absent/late chart, built from the real roster.
    const byClass = new Map();
    roster.forEach((entry) => {
      const key = shortClassLabel(entry.className, entry.section);
      const bucket = byClass.get(key) || { name: key, Present: 0, Absent: 0, Late: 0 };
      const status = entry.todayLog?.status;
      if (status === 'present' || status === 'manual') bucket.Present += 1;
      else if (status === 'half-day') bucket.Late += 1;
      else bucket.Absent += 1;
      byClass.set(key, bucket);
    });
    const classChart = Array.from(byClass.values())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .slice(0, 12);

    return { rate, present, late, marked, total, classChart };
  }, [overview]);

  const roleSummary = overview?.roleSummary || {};

  const quickActions = [
    { label: 'Attendance', page: 'Attendance', icon: CheckCircle2 },
    { label: 'Notice', page: 'Notices', icon: BellRing },
    { label: 'ID Cards', page: 'Id Card', icon: IdCard },
    { label: 'Documents', page: 'Documents Management', icon: FileCheck2 },
  ];

  const attentionItems = [
    {
      key: 'applications',
      label: 'Applications pending review',
      count: pendingApplications.length,
      page: 'Application',
      icon: Send,
    },
    {
      key: 'leaves',
      label: 'Leave requests awaiting action',
      count: pendingLeaves.length,
      page: 'Leave Requests',
      icon: AlertCircle,
    },
    {
      key: 'attendance',
      label: 'Students not marked today',
      count: (overview?.counts?.unmarked || 0),
      page: 'Attendance',
      icon: CheckCircle2,
    },
    {
      key: 'documents',
      label: 'Document types to verify',
      count: requiredDocTypes,
      page: 'Documents Management',
      icon: FileCheck2,
    },
  ];

  const headcountsLoading = studentsMeta.isLoading || teachersMeta.isLoading;

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md">
              Clerk Portal
            </span>
            <span className="text-[10px] font-mono font-black bg-white/50 px-2.5 py-1 rounded-md">
              {profile.id}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight text-gradient">
              {summary?.profile?.displayName || profile.name}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {summary?.profile?.designation || profile.department} | {profile.shift} | {profile.deskWindow}
            </p>
          </div>

          <p className="text-xs text-slate-500 font-semibold max-w-2xl leading-relaxed">
            Monitor attendance, documents, notices, ID cards, meetings, and staff/student records from the main office desk.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-full xl:min-w-[520px]">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.label}
                type="button"
                onClick={() => setActivePage?.(action.page)}
                className="glass-soft glass-hover hover:bg-indigo-50/70 rounded-2xl p-3 text-left transition-colors min-h-24"
              >
                <Icon className="w-4 h-4 mb-2 text-indigo-600" />
                <span className="text-[11px] font-black block">{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {(queueError || attendanceError) && (
        <section className="glass-card rounded-3xl p-4 text-xs font-bold text-amber-600">
          {attendanceError || queueError}
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 stagger">
        <MetricCard
          icon={Users}
          label="Attendance"
          value={attendanceLoading ? '…' : `${attendance.rate}%`}
          note={
            attendanceLoading
              ? 'Loading today’s registers'
              : `${attendance.present}/${attendance.marked || 0} present today`
          }
        />
        <MetricCard
          icon={Users}
          label="Students"
          value={headcountsLoading ? '…' : studentCount}
          note="Enrolled on record"
        />
        <MetricCard
          icon={Users}
          label="Staff"
          value={headcountsLoading ? '…' : teacherCount + clerkCount}
          note={`${teacherCount} teachers | ${clerkCount} clerks`}
        />
        <MetricCard
          icon={Send}
          label="Applications"
          value={pendingApplications.length}
          note="Pending your review"
        />
        <MetricCard
          icon={AlertCircle}
          label="Leave Queue"
          value={pendingLeaves.length}
          note="Awaiting action"
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100/80 pb-3">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Today’s Attendance by Class
              </h3>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                Live student registers for {overview?.date || 'today'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage?.('Attendance')}
              className="px-3 py-2 btn-primary rounded-xl text-[10px] font-black"
            >
              Open Register
            </button>
          </div>

          <div className="h-72">
            {attendanceLoading ? (
              <div className="h-full rounded-2xl skeleton" />
            ) : attendance.classChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendance.classChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Present" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Absent" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="Late" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <Inbox className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">No student registers found for today.</p>
                <button
                  type="button"
                  onClick={() => setActivePage?.('Attendance')}
                  className="text-[11px] font-black text-indigo-600"
                >
                  Go to Attendance
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Users className="w-4 h-4" /> Staff Presence Today
            </h3>
            <span className="text-[10px] font-black text-slate-500">{overview?.date || 'Today'}</span>
          </div>

          {attendanceLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-16 rounded-2xl skeleton" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <RolePresenceRow label="Teachers" summary={roleSummary.teacher} />
              <RolePresenceRow label="Clerks" summary={roleSummary.clerk} />
              <RolePresenceRow label="Students" summary={roleSummary.student} />
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Needs Attention
            </h3>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              const isEmpty = !item.count;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActivePage?.(item.page)}
                  className="glass-soft glass-hover hover:bg-white/60 hover:border-indigo-200 rounded-2xl p-4 text-left transition-all min-h-28 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span
                      className={`text-lg font-black ${isEmpty ? 'text-slate-400' : 'text-slate-900'}`}
                    >
                      {item.count}
                    </span>
                  </div>
                  <p className="text-xs font-black leading-snug mt-2">{item.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <FileCheck2 className="w-4 h-4" /> Office Records
            </h3>
            <button
              type="button"
              onClick={() => setActivePage?.('Documents Management')}
              className="text-[10px] font-black text-indigo-600"
            >
              Manage
            </button>
          </div>

          <div className="space-y-3">
            <RecordRow label="Required document types" value={requiredDocTypes} hint={`${requiredStudentDocs} student · ${requiredTeacherDocs} staff`} />
            <RecordRow label="Document slots to track" value={documentSlots} hint="Across all students & teachers" />
            <RecordRow label="Vault records (yours)" value={documentsVaultStat ? documentsVaultStat.value : '—'} hint="Personal office vault" />
            <RecordRow label="Unread notices" value={noticesStat ? noticesStat.value : '—'} hint="For your desk" />
          </div>

          <button
            type="button"
            onClick={() => setActivePage?.('Documents Management')}
            className="w-full px-3 py-2.5 btn-primary rounded-xl text-[11px] font-black flex items-center justify-center gap-2"
          >
            <FileCheck2 className="w-4 h-4" /> Open Document Verification
          </button>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Office Broadcasts
          </h3>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Send quick class, parent, or staff updates from Notices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActivePage?.('Notices')}
          className="px-5 py-3 btn-primary rounded-2xl text-xs font-black flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" /> Open Notices
        </button>
      </section>
    </div>
  );
};

const MetricCard = ({ icon, label, value, note }) => (
  <div className="glass-card glass-hover rounded-3xl p-4 min-h-32 flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20 flex items-center justify-center">
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

const RolePresenceRow = ({ label, summary }) => {
  const total = summary?.total || 0;
  const present = (summary?.present || 0);
  const late = summary?.late || 0;
  const rate = total ? Math.round((present / total) * 100) : 0;

  return (
    <div className="glass-soft rounded-2xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black">{label}</p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">
            {present} present{late ? ` · ${late} late` : ''} of {total}
          </p>
        </div>
        <span className="text-sm font-black text-indigo-600">{rate}%</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
};

const RecordRow = ({ label, value, hint }) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-xs font-bold">{label}</p>
      {hint && <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{hint}</p>}
    </div>
    <span className="text-lg font-black">{value}</span>
  </div>
);

export default Dashboard;
