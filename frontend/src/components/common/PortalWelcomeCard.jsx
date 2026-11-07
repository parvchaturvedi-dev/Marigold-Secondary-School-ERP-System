import { useEffect, useState } from 'react';

const PortalWelcomeCard = ({ session }) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const studentProfiles = session?.studentProfiles || [];
  const activeStudent = session?.activeStudent || studentProfiles[0] || null;
  const isStudentPortal = session?.role === 'student';
  const displayName =
    activeStudent?.displayName ||
    session?.displayName ||
    session?.accountDisplayName ||
    session?.username ||
    'MGPS User';
  const roleLabels = {
    admin: 'Administrator',
    clerk: 'Office Clerk',
    student: 'Student',
    teacher: 'Teacher',
    employee: 'Staff Member',
  };
  const roleLabel = roleLabels[session?.role] || 'School Member';
  const profileDetails = isStudentPortal && activeStudent
    ? [
      activeStudent.className && activeStudent.section
        ? `Class ${activeStudent.className}-${activeStudent.section}`
        : '',
      activeStudent.admissionNumber ? `Admission No. ${activeStudent.admissionNumber}` : '',
    ].filter(Boolean).join('  ·  ')
    : session?.role === 'teacher' && session?.allottedClasses?.length
      ? `Faculty  ·  ${session.allottedClasses.length} assigned class${session.allottedClasses.length === 1 ? '' : 'es'}`
      : `${roleLabel} portal  ·  Marigold Secondary School`;
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(currentTime);
  const formattedTime = new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(currentTime);

  return (
    <section className="mb-6 flex min-h-[124px] items-center justify-between gap-4 rounded-2xl bg-[#17191b] px-5 py-5 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] sm:min-h-[138px] sm:rounded-[22px] sm:px-7 sm:py-6">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 sm:text-xs">
          {roleLabel}
        </p>
        <h2 className="mt-1 truncate text-xl font-extrabold tracking-tight sm:text-[27px]">
          Hello, {displayName}
        </h2>
        <p className="mt-1 truncate text-xs font-medium text-white/65 sm:text-sm">
          {profileDetails}
        </p>
      </div>
      <div className="shrink-0 border-l border-white/15 pl-4 text-right sm:pl-6">
        <p className="text-[10px] font-semibold text-white/60 sm:text-xs">Today</p>
        <p className="mt-1 text-xs font-semibold text-white sm:text-sm">{formattedDate}</p>
        <p className="mt-0.5 font-mono text-lg font-bold tabular-nums tracking-wide sm:text-xl">
          {formattedTime}
        </p>
      </div>
    </section>
  );
};

export default PortalWelcomeCard;
