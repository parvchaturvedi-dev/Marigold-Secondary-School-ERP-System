import React from 'react';
import {
  BellRing,
  BookOpen,
  BookOpenCheck,
  Bus,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  IdCard,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react';
import {
  getClassLabel,
  getFeeSummary,
  getLibraryRecords,
  getMeetings,
  getNotices,
  getPortalStudent,
  getStudentActionItems,
  getStudentMetrics,
  getSubjectPlan,
  getTransportDetails,
} from './studentPortalData';

const Dashboard = ({ session, setActivePage }) => {
  const student = getPortalStudent(session);
  const metrics = getStudentMetrics(student);
  const subjects = getSubjectPlan(student);
  const feeSummary = getFeeSummary(student);
  const notices = getNotices(student).slice(0, 2);
  const meetings = getMeetings(student).slice(0, 1);
  const actionItems = getStudentActionItems(student).slice(0, 4);
  const transport = getTransportDetails(student);
  const libraryRecords = getLibraryRecords(student);

  const quickLinks = [
    { label: 'Profile', page: 'Profile', icon: UserRound },
    { label: 'Attendance', page: 'Attendance', icon: CheckCircle2 },
    { label: 'Assignments', page: 'Assignment', icon: ClipboardList },
    { label: 'Fees', page: 'Fees', icon: Wallet },
    { label: 'Id Card', page: 'Id Card', icon: IdCard },
  ];

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase bg-[#E1FA6C] border border-[#1A1A1A]/10 px-2.5 py-1 rounded-md">
              {session?.isSiblingAccount ? 'Sibling Account' : 'Solo Account'}
            </span>
            <span className="text-[10px] font-mono font-black bg-[#EAEAEA] px-2.5 py-1 rounded-md">
              Active: {student.admissionNumber}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight">{student.displayName}</h2>
            <p className="text-xs font-bold text-[#555555] mt-1">
              {getClassLabel(student)} | Roll {student.rollNo} | {student.house}
            </p>
          </div>

          <p className="text-xs text-[#555555] font-semibold max-w-2xl leading-relaxed">
            Academic year 2026-27 summary with class work, attendance, notices, meetings, fees, and services.
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
                className="bg-[#F8F8F8] hover:bg-[#E1FA6C] border border-[#EAEAEA] rounded-2xl p-3 text-left transition-colors"
              >
                <Icon className="w-4 h-4 mb-2 text-[#1A1A1A]" />
                <span className="text-[11px] font-black block">{link.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={CheckCircle2}
          label="Attendance"
          value={`${metrics.attendance}%`}
          note={`${metrics.presentDays}/${metrics.workingDays} days present`}
          tone="bg-emerald-50 text-emerald-700 border-emerald-100"
        />
        <MetricCard
          icon={ClipboardList}
          label="Assignments"
          value={`${metrics.assignmentCompletion}%`}
          note={`${metrics.pendingAssignments} pending checks`}
          tone="bg-purple-50 text-purple-700 border-purple-100"
        />
        <MetricCard
          icon={GraduationCap}
          label="Exam Average"
          value={`${metrics.examAverage}%`}
          note={`Behavior score ${metrics.behaviorScore}/10`}
          tone="bg-blue-50 text-blue-700 border-blue-100"
        />
        <MetricCard
          icon={Wallet}
          label="Fees"
          value={feeSummary.status}
          note={feeSummary.pending ? `Pending Rs. ${feeSummary.pending.toLocaleString('en-IN')}` : 'Ledger clear'}
          tone={feeSummary.pending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Subject Progress
            </h3>
            <span className="text-[10px] font-black text-[#555555]">{getClassLabel(student)}</span>
          </div>

          <div className="space-y-3">
            {subjects.map((subject) => (
              <div key={subject.subject} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{subject.subject}</span>
                  <span className="text-[#555555]">{subject.progress}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#EAEAEA] overflow-hidden">
                  <div
                    className="h-full bg-[#1A1A1A] rounded-full"
                    style={{ width: `${subject.progress}%` }}
                  />
                </div>
                <p className="text-[10px] font-semibold text-[#555555]">{subject.teacher}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <BellRing className="w-4 h-4" /> Notices
            </h3>
            {notices.map((notice) => (
              <div key={notice.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
                <p className="text-xs font-black">{notice.title}</p>
                <p className="text-[10px] font-bold text-[#555555] mt-1">{notice.date} | {notice.scope}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Next Meeting
            </h3>
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-[#E1FA6C]/30 border border-[#1A1A1A]/10 rounded-2xl p-3">
                <p className="text-xs font-black">{meeting.title}</p>
                <p className="text-[10px] font-bold text-[#555555] mt-1">
                  {meeting.date} | {meeting.time} | {meeting.mode}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Priority Items
            </h3>
            <span className="text-[10px] font-black text-[#555555]">{actionItems.length} active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {actionItems.map((item) => (
              <div key={item.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4">
                <span className="text-[9px] font-black uppercase bg-white border border-[#C8C8C8] px-2 py-1 rounded-md">
                  {item.status}
                </span>
                <p className="text-xs font-black mt-3">{item.label}</p>
                <p className="text-[10px] font-bold text-[#555555] mt-1">{item.meta}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-black flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
            <Bus className="w-4 h-4" /> Services
          </h3>

          <ServiceRow icon={Bus} label="Transport" value={transport.route} meta={transport.pickupTime} />
          <ServiceRow
            icon={BookOpenCheck}
            label="Library"
            value={`${libraryRecords.length} books issued`}
            meta={libraryRecords.some((record) => record.status === 'Due Soon') ? 'Return due soon' : 'No fine'}
          />
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({ icon, label, value, note, tone }) => (
  <div className="bg-white border border-[#C8C8C8] rounded-3xl p-4 min-h-32 flex flex-col justify-between">
    <div className="flex items-center justify-between">
      <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${tone}`}>
        {React.createElement(icon, { className: 'w-5 h-5' })}
      </span>
      <TrendingUp className="w-4 h-4 text-[#555555]" />
    </div>
    <div>
      <p className="text-[11px] font-bold text-[#555555]">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
      <p className="text-[10px] font-semibold text-[#555555] mt-1">{note}</p>
    </div>
  </div>
);

const ServiceRow = ({ icon, label, value, meta }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 flex items-center gap-3">
    <span className="w-10 h-10 rounded-2xl bg-white border border-[#C8C8C8] flex items-center justify-center shrink-0">
      {React.createElement(icon, { className: 'w-4 h-4' })}
    </span>
    <span className="min-w-0">
      <span className="block text-xs font-black truncate">{label}</span>
      <span className="block text-[10px] font-bold text-[#555555] truncate">{value} | {meta}</span>
    </span>
  </div>
);

export default Dashboard;
