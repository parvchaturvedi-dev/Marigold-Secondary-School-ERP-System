import React, { useMemo } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  IdCard,
  MessageSquare,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { readApplications } from '../../components/common/applicationStore';
import { readAssignments } from '../../components/common/assignmentStore';
import { readEvents } from '../../components/common/eventStore';
import {
  LEAVE_STATUS,
  readLeaveRequests,
} from '../../components/common/leaveRequestStore';
import {
  CLERK_ATTENDANCE_REGISTERS,
  CLERK_DOCUMENT_QUEUE,
  CLERK_TASKS,
  formatShortDate,
  getClerkProfile,
} from './clerkPortalData';

const priorityTone = {
  High: 'bg-red-50 text-red-700 border-red-100',
  Normal: 'bg-blue-50 text-blue-700 border-blue-100',
};

const statusTone = {
  Submitted: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Review: 'bg-amber-50 text-amber-700 border-amber-100',
  Pending: 'bg-red-50 text-red-700 border-red-100',
};

const Dashboard = ({ session, setActivePage }) => {
  const profile = getClerkProfile(session);

  const metrics = useMemo(() => {
    const assignments = readAssignments();
    const events = readEvents();
    const leaveRequests = readLeaveRequests();
    const applications = readApplications();
    const pendingLeaveStatuses = [LEAVE_STATUS.pendingAdmin, LEAVE_STATUS.forwardedAdmin];
    const pendingDocuments = CLERK_DOCUMENT_QUEUE.filter((item) => item.status !== 'Verified');
    const totalStudents = CLERK_ATTENDANCE_REGISTERS.reduce((sum, item) => sum + item.total, 0);
    const presentStudents = CLERK_ATTENDANCE_REGISTERS.reduce((sum, item) => sum + item.present, 0);

    return {
      activeAssignments: assignments.length,
      upcomingEvents: events.length,
      pendingApplications: applications.filter((application) => application.status === 'pending').length,
      pendingLeaves: leaveRequests.filter((request) => pendingLeaveStatuses.includes(request.status)).length,
      documentPackets: pendingDocuments.length,
      attendanceRate: Math.round((presentStudents / totalStudents) * 100),
      attendanceChart: CLERK_ATTENDANCE_REGISTERS.map((item) => ({
        name: `${item.className.replace('Class ', 'C')}-${item.section}`,
        Present: item.present,
        Absent: item.absent,
        Late: item.late,
      })),
      documentChart: [
        { name: 'Verified', value: CLERK_DOCUMENT_QUEUE.filter((item) => item.status === 'Verified').length, color: '#10b981' },
        { name: 'Review', value: CLERK_DOCUMENT_QUEUE.filter((item) => item.status === 'Review').length, color: '#f59e0b' },
        { name: 'Hold', value: CLERK_DOCUMENT_QUEUE.filter((item) => item.status === 'Hold').length, color: '#f43f5e' },
      ],
    };
  }, []);

  const quickActions = [
    { label: 'Attendance', page: 'Attendance', icon: CheckCircle2 },
    { label: 'Notice', page: 'Notices', icon: BellRing },
    { label: 'ID Cards', page: 'Id Card', icon: IdCard },
    { label: 'Documents', page: 'Documents Management', icon: FileCheck2 },
  ];

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
            <h2 className="text-2xl font-black tracking-tight text-gradient">{profile.name}</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {profile.department} | {profile.shift} | {profile.deskWindow}
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

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 stagger">
        <MetricCard icon={Users} label="Attendance" value={`${metrics.attendanceRate}%`} note="Across submitted registers" />
        <MetricCard icon={ClipboardList} label="Assignments" value={metrics.activeAssignments} note="Visible to office desk" />
        <MetricCard icon={Send} label="Applications" value={metrics.pendingApplications} note="Pending admin review" />
        <MetricCard icon={AlertCircle} label="Leave Queue" value={metrics.pendingLeaves} note="Needs approval tracking" />
        <MetricCard icon={FileCheck2} label="Documents" value={metrics.documentPackets} note="Packets still open" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100/80 pb-3">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Attendance Registers
              </h3>
              <p className="text-[10px] font-bold text-slate-500 mt-1">Today&apos;s section submission health</p>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.attendanceChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="Present" fill="#6366f1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Absent" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Late" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <FileCheck2 className="w-4 h-4" /> Document Flow
            </h3>
            <span className="text-[10px] font-black text-slate-500">Live desk packets</span>
          </div>

          <div className="h-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.documentChart} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={4}>
                  {metrics.documentChart.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black">{CLERK_DOCUMENT_QUEUE.length}</span>
              <span className="text-[9px] font-black text-slate-500 uppercase">Packets</span>
            </div>
          </div>

          <div className="space-y-2">
            {metrics.documentChart.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Clerk Work Queue
            </h3>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CLERK_TASKS.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setActivePage?.(task.page)}
                className="glass-soft glass-hover hover:bg-white/60 hover:border-indigo-200 rounded-2xl p-4 text-left transition-all min-h-28"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[9px] font-mono font-black bg-white/60 border border-slate-100/80 px-2 py-0.5 rounded-md">
                    {task.id}
                  </span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${priorityTone[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>
                <p className="text-xs font-black leading-snug">{task.label}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-2">{task.owner}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Register Status
            </h3>
            <span className="text-[10px] font-black text-slate-500">{formatShortDate(new Date())}</span>
          </div>

          <div className="space-y-3">
            {CLERK_ATTENDANCE_REGISTERS.map((register) => (
              <div key={register.id} className="glass-soft rounded-2xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black">{register.className}-{register.section}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">{register.teacher}</p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${statusTone[register.status]}`}>
                    {register.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Office Broadcasts
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

export default Dashboard;
