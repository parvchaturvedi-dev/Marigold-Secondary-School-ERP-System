import React from 'react';
import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Layers,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import {
  getTeacherMeetings,
  getTeacherMetrics,
  getTeacherNotices,
  getTeacherProfile,
  getTeacherSubjectLoad,
  getTeacherTimetable,
} from './teacherPortalData';

const Dashboard = ({ session, setActivePage }) => {
  const profile = getTeacherProfile(session);
  const metrics = getTeacherMetrics(session);
  const subjectLoad = getTeacherSubjectLoad(session).slice(0, 5);
  const timetable = getTeacherTimetable(session);
  const notices = getTeacherNotices(session).slice(0, 2);
  const meetings = getTeacherMeetings(session).slice(0, 1);

  const quickLinks = [
    { label: 'My Class', page: 'My Class', icon: Layers },
    { label: 'Attendance', page: 'Attendance', icon: CheckCircle2 },
    { label: 'Assignments', page: 'Assignment', icon: ClipboardList },
    { label: 'Marks', page: 'Marks Management', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase bg-[#E1FA6C] border border-[#1A1A1A]/10 px-2.5 py-1 rounded-md">
              Teacher Portal
            </span>
            <span className="text-[10px] font-mono font-black bg-[#EAEAEA] px-2.5 py-1 rounded-md">
              {profile.employeeId}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black tracking-tight">{profile.displayName}</h2>
            <p className="text-xs font-bold text-[#555555] mt-1">
              {profile.designation} | {profile.department}
            </p>
          </div>

          <p className="text-xs text-[#555555] font-semibold max-w-2xl leading-relaxed">
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
          icon={GraduationCap}
          label="Classes"
          value={metrics.classes}
          note={`${metrics.subjects} subject areas assigned`}
          tone="bg-blue-50 text-blue-700 border-blue-100"
        />
        <MetricCard
          icon={Users}
          label="Students"
          value={metrics.students}
          note={`Class teacher: ${metrics.classTeacherFor}`}
          tone="bg-emerald-50 text-emerald-700 border-emerald-100"
        />
        <MetricCard
          icon={CalendarDays}
          label="Periods Today"
          value={metrics.periodsToday}
          note={`${metrics.attendanceAverage}% attendance average`}
          tone="bg-purple-50 text-purple-700 border-purple-100"
        />
        <MetricCard
          icon={Search}
          label="Exam Review"
          value={metrics.pendingPapers}
          note={`${metrics.activeAssignments} active assignments visible`}
          tone={metrics.pendingPapers ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Teaching Load
            </h3>
            <span className="text-[10px] font-black text-[#555555]">{profile.username}</span>
          </div>

          <div className="space-y-3">
            {subjectLoad.map((item) => (
              <div key={`${item.className}-${item.subject}`} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{item.className}-{item.section} | {item.subject}</span>
                  <span className="text-[#555555]">{item.syllabusProgress}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#EAEAEA] overflow-hidden">
                  <div
                    className="h-full bg-[#1A1A1A] rounded-full"
                    style={{ width: `${item.syllabusProgress}%` }}
                  />
                </div>
                <p className="text-[10px] font-semibold text-[#555555]">
                  {item.weeklyPeriods} periods/week | {item.room}
                </p>
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

      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
          <h3 className="text-sm font-black flex items-center gap-2">
            <UserRound className="w-4 h-4" /> Today Timetable
          </h3>
          <span className="text-[10px] font-black text-[#555555]">Live faculty schedule</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {timetable.map((period) => (
            <div key={period.period} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 min-h-28">
              <span className="w-9 h-9 rounded-2xl bg-[#1A1A1A] text-[#E1FA6C] font-black flex items-center justify-center">
                {period.period}
              </span>
              <p className="text-xs font-black mt-3">{period.subject}</p>
              <p className="text-[10px] font-bold text-[#555555] mt-1">
                {period.className}-{period.section} | {period.time}
              </p>
              <p className="text-[10px] font-bold text-[#555555]">{period.room}</p>
            </div>
          ))}
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
      <BarChart3 className="w-4 h-4 text-[#555555]" />
    </div>
    <div>
      <p className="text-[11px] font-bold text-[#555555]">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
      <p className="text-[10px] font-semibold text-[#555555] mt-1">{note}</p>
    </div>
  </div>
);

export default Dashboard;
