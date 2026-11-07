import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Inbox,
  Send,
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
import PortalStatCard from '../../components/common/PortalStatCard';
import PortalWelcomeCard from '../../components/common/PortalWelcomeCard';

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
  // Real attendance overview (today, all classes) — same source the Attendance page uses.
  const { overview, isLoading: attendanceLoading, error: attendanceError } = useAttendanceOverview({});

  // Real headcounts straight from the shared module-state collections.
  const [students, , studentsMeta] = useMongoState('admin-student-management-students', []);
  const [teachers, , teachersMeta] = useMongoState('admin-teacher-management-list', []);
  const [clerks] = useMongoState('admin-clerk-management-list', []);

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

      const [applicationResult, leaveResult] = await Promise.allSettled([
        apiFetch(`/applications?${params}`),
        apiFetch(`/leave-requests?${params}`),
      ]);

      if (!alive) return;

      const applicationsLoaded =
        applicationResult.status === 'fulfilled' && Array.isArray(applicationResult.value);
      const leavesLoaded =
        leaveResult.status === 'fulfilled' && Array.isArray(leaveResult.value);
      setApplications(applicationsLoaded ? applicationResult.value : []);
      setLeaveRequests(leavesLoaded ? leaveResult.value : []);
      if (!applicationsLoaded || !leavesLoaded) {
        setQueueError('Some live counters could not be loaded right now.');
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [session?.role, session?.username]);

  const studentCount = asCount(students);
  const teacherCount = asCount(teachers);
  const clerkCount = asCount(clerks);

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

  const headcountsLoading = studentsMeta.isLoading || teachersMeta.isLoading;

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <PortalWelcomeCard session={session} />
      {(queueError || attendanceError) && (
        <section className="glass-card rounded-3xl p-4 text-xs font-bold text-amber-600">
          {attendanceError || queueError}
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 stagger">
        <PortalStatCard
          icon={Users}
          label="Attendance"
          value={attendanceLoading ? '…' : `${attendance.rate}%`}
          note={
            attendanceLoading
              ? 'Loading today’s registers'
              : `${attendance.present}/${attendance.marked || 0} present today`
          }
          onClick={() => setActivePage?.('Attendance')}
        />
        <PortalStatCard
          icon={Users}
          label="Students"
          value={headcountsLoading ? '…' : studentCount}
          note="Enrolled on record"
          onClick={() => setActivePage?.('Student Management')}
        />
        <PortalStatCard
          icon={Users}
          label="Staff"
          value={headcountsLoading ? '…' : teacherCount + clerkCount}
          note={`${teacherCount} teachers | ${clerkCount} clerks`}
          onClick={() => setActivePage?.('Employee Management')}
        />
        <PortalStatCard
          icon={Send}
          label="Applications"
          value={pendingApplications.length}
          note="Pending your review"
          onClick={() => setActivePage?.('Application')}
        />
        <PortalStatCard
          icon={AlertCircle}
          label="Leave Queue"
          value={pendingLeaves.length}
          note="Awaiting action"
          onClick={() => setActivePage?.('Leave Requests')}
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

    </div>
  );
};

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

export default Dashboard;
