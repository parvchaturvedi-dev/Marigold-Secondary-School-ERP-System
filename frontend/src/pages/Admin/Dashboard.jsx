import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  CircleDollarSign,
  Filter,
  FileText,
  Clock3,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMasterData } from '../../components/common/masterData';
import { apiFetch } from '../../components/common/api';
import { fetchStaffAttendanceRecords, useAttendanceOverview } from '../../components/common/attendanceStore';
import { LEAVE_STATUS } from '../../components/common/leaveRequestStore';
import PortalStatCard from '../../components/common/PortalStatCard';
import PortalWelcomeCard from '../../components/common/PortalWelcomeCard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value || '').replace(/[^0-9.-]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
};

const getFirstAmount = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return parseAmount(source[key]);
    }
  }
  return 0;
};

const getYearlyFee = (student) => {
  const explicitFee = getFirstAmount(student, [
    'yearlyFee',
    'annualFee',
    'totalFees',
    'assignedFees',
    'feeAmount',
    'totalAssigned',
  ]);

  if (explicitFee > 0) return explicitFee;
  return getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid']) +
    getFirstAmount(student, ['pendingFees', 'feePending', 'balanceFees', 'unpaidFees']);
};

const getMonthlyEntries = (student) => [
  ...(Array.isArray(student.feeInstallments) ? student.feeInstallments : []),
  ...(Array.isArray(student.monthlyFees) ? student.monthlyFees : []),
  ...(Array.isArray(student.financeLedger) ? student.financeLedger : []),
  ...(Array.isArray(student.feeLedger) ? student.feeLedger : []),
  ...(Array.isArray(student.paymentHistory) ? student.paymentHistory : []),
  ...(Array.isArray(student.feePayments) ? student.feePayments : []),
  ...(Array.isArray(student.payments) ? student.payments : []),
  ...(Array.isArray(student.receipts) ? student.receipts : []),
];

const getEntryCollected = (entry) => {
  const explicit = getFirstAmount(entry, ['collected', 'collectedFees', 'paid', 'paidFees', 'amountPaid']);
  if (explicit > 0) return explicit;
  const amount = getFirstAmount(entry, ['amount', 'value']);
  const status = String(entry.status || entry.type || '').toLowerCase();
  return status.includes('paid') || status.includes('collect') || status.includes('receipt') ? amount : 0;
};

const getEntryPending = (entry) => {
  const explicit = getFirstAmount(entry, ['pending', 'pendingFees', 'due', 'dueAmount', 'balance', 'balanceFees']);
  if (explicit > 0) return explicit;
  const assigned = getFirstAmount(entry, ['assigned', 'assignedFees', 'totalFees', 'totalAssigned']);
  if (assigned > 0) return Math.max(0, assigned - getFirstAmount(entry, ['paid', 'paidFees', 'collected', 'amountPaid']));
  const amount = getFirstAmount(entry, ['amount', 'value']);
  const status = String(entry.status || entry.type || '').toLowerCase();
  return status.includes('pending') || status.includes('due') || status.includes('balance') ? amount : 0;
};

const formatCurrency = (amount) => `Rs. ${Math.round(Number(amount || 0)).toLocaleString('en-IN')}`;
const getDateKey = (date = new Date(), timezone = 'Asia/Kolkata') =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
const getMonthKey = (entry, fallbackDate) => {
  const dateValue = entry.date || entry.paidAt || entry.createdAt || entry.receiptDate || entry.dueDate;
  if (dateValue) {
    const raw = String(dateValue);
    if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
    const date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  const month = entry.month || entry.monthName || entry.feeMonth || entry.period;
  if (month) {
    const index = MONTHS.findIndex((name) => name.toLowerCase() === String(month).slice(0, 3).toLowerCase());
    if (index >= 0) return `${fallbackDate.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`;
  }
  return fallbackDate.slice(0, 7);
};

const getFinanceChartData = (students, from, to, selectedClass) => {
  if (!from || !to || from > to) return [];
  const first = new Date(`${from.slice(0, 7)}-01T00:00:00`);
  const last = new Date(`${to.slice(0, 7)}-01T00:00:00`);
  const rows = [];
  for (const cursor = new Date(first); cursor <= last; cursor.setMonth(cursor.getMonth() + 1)) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    rows.push({
      key,
      month: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      Collected: 0,
      Pending: 0,
    });
  }
  const rowByMonth = new Map(rows.map((row) => [row.key, row]));
  const currentMonth = getDateKey().slice(0, 7);

  students.forEach((student) => {
    const studentClass = student.className || student.class || student.rawProfile?.targetClass || 'Unassigned';
    const entries = getMonthlyEntries(student);
    if (entries.length) {
      entries.forEach((entry) => {
        const className = entry.className || entry.class || studentClass;
        if (selectedClass !== 'all' && className !== selectedClass) return;
        const row = rowByMonth.get(getMonthKey(entry, currentMonth));
        if (!row) return;
        row.Collected += getEntryCollected(entry);
        row.Pending += getEntryPending(entry);
      });
      return;
    }
    if (selectedClass !== 'all' && studentClass !== selectedClass) return;
    const row = rowByMonth.get(currentMonth);
    if (row) {
      row.Collected += getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid']);
      row.Pending += getFirstAmount(student, ['pendingFees', 'feePending', 'balanceFees', 'unpaidFees']);
    }
  });

  return rows.map((row) => ({ ...row, Total: row.Collected + row.Pending }));
};

const formatShortCurrency = (amount) => {
  const value = Number(amount || 0);
  if (value >= 10000000) return `Rs.${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `Rs.${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `Rs.${(value / 1000).toFixed(0)}k`;
  return `Rs.${Math.round(value)}`;
};

const getNextHoliday = (settings, today) => {
  if (!settings) return null;

  const offDays = Array.isArray(settings.offDays) ? settings.offDays : [];
  const weeklyOffDays = [
    ...(Array.isArray(settings.studentWeeklyOffDays) ? settings.studentWeeklyOffDays : []),
    ...(Array.isArray(settings.teacherWeeklyOffDays) ? settings.teacherWeeklyOffDays : []),
  ].map(Number);
  const currentDate = new Date(`${today}T00:00:00.000Z`);

  for (let offset = 1; offset <= 370; offset += 1) {
    const date = new Date(currentDate);
    date.setUTCDate(date.getUTCDate() + offset);
    const dateKey = date.toISOString().slice(0, 10);
    const explicitHoliday = offDays.find(
      (entry) =>
        entry?.date === dateKey &&
        ['both', 'student', 'teacher'].includes(entry?.scope)
    );

    if (explicitHoliday || weeklyOffDays.includes(date.getUTCDay())) {
      return {
        date: date.toLocaleDateString('en-IN', {
          timeZone: 'UTC',
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        }),
        note: explicitHoliday?.reason || 'School holiday',
      };
    }
  }

  return null;
};

const FinanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((item) => ['Collected', 'Pending'].includes(item.dataKey));

  return (
    <div className="min-w-52 rounded-2xl border border-slate-100 bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-black text-slate-900">{label}</p>
      <div className="space-y-2">
        {rows.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-5 font-bold">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.dataKey}
            </span>
            <span className="text-slate-900">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-black text-slate-900">
        <span>Total</span>
        <span>{formatCurrency(payload[0]?.payload?.Total)}</span>
      </div>
    </div>
  );
};

const getLocalMinutes = (timezone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60 +
    Number(parts.find((part) => part.type === 'minute')?.value || 0);
};

const getTeacherStatus = (teacher, date, settings) => {
  const timezone = settings?.timezone || 'Asia/Kolkata';
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const weeklyOff = (Array.isArray(settings?.teacherWeeklyOffDays)
    ? settings.teacherWeeklyOffDays
    : []
  ).map(Number).includes(weekday);
  const declaredOff = (settings?.offDays || []).some(
    (entry) => entry?.date === date && ['both', 'teacher'].includes(entry?.scope)
  );
  const outsideSession =
    (settings?.teacherSessionStart && date < settings.teacherSessionStart) ||
    (settings?.teacherSessionEnd && date > settings.teacherSessionEnd);
  if (weeklyOff || declaredOff || outsideSession) return 'Holiday';

  const day = teacher.days?.find((entry) => entry.date === date);
  if (day?.status === 'absent') return 'Absent';
  if (day?.status === 'half-day') return 'Half day';
  if (day?.clockInAt || day?.clockOutAt || ['present', 'manual'].includes(day?.status)) return 'Present';

  const [hours, minutes] = String(settings?.closeAfter || '11:00').split(':').map(Number);
  return getLocalMinutes(timezone) >= (hours || 0) * 60 + (minutes || 0) ? 'Absent' : 'Not marked';
};

const formatAttendanceTime = (value, timezone) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', {
    timeZone: timezone || 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const Dashboard = ({ session, setActivePage }) => {
  const { students, classNames, isLoading, errors } = useMasterData();
  const {
    overview: attendanceOverview,
    isLoading: holidaysLoading,
    error: holidaysError,
  } = useAttendanceOverview({});
  const [applications, setApplications] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [staffAttendance, setStaffAttendance] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const [financeFrom, setFinanceFrom] = useState(`${getDateKey().slice(0, 4)}-01-01`);
  const [financeTo, setFinanceTo] = useState(getDateKey());
  const [financeClass, setFinanceClass] = useState('all');
  const [financeMeasure, setFinanceMeasure] = useState('all');
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      role: session?.role || 'admin',
      username: session?.username || '',
    }).toString();

    const loadQueues = async () => {
      setQueueLoading(true);
      setQueueError('');
      const [applicationsResult, leavesResult] = await Promise.allSettled([
        apiFetch(`/applications?${params}`),
        apiFetch(`/leave-requests?${params}`),
      ]);

      if (!active) return;
      if (applicationsResult.status === 'fulfilled' && Array.isArray(applicationsResult.value)) {
        setApplications(applicationsResult.value);
      } else {
        setApplications([]);
        setQueueError('Some live counters could not be loaded right now.');
      }
      if (leavesResult.status === 'fulfilled' && Array.isArray(leavesResult.value)) {
        setLeaveRequests(leavesResult.value);
      } else {
        setLeaveRequests([]);
        setQueueError('Some live counters could not be loaded right now.');
      }
      setQueueLoading(false);
    };

    loadQueues();
    return () => {
      active = false;
    };
  }, [session?.role, session?.username]);

  const attendanceDate = attendanceOverview?.date || getDateKey();
  useEffect(() => {
    let active = true;
    setStaffLoading(true);
    setStaffError('');
    fetchStaffAttendanceRecords({ from: attendanceDate, to: attendanceDate })
      .then((result) => {
        if (active) setStaffAttendance(Array.isArray(result?.staff) ? result.staff : []);
      })
      .catch((error) => {
        if (!active) return;
        setStaffAttendance([]);
        setStaffError(error?.message || 'Unable to load today’s teacher attendance.');
      })
      .finally(() => {
        if (active) setStaffLoading(false);
      });

    return () => {
      active = false;
    };
  }, [attendanceDate, attendanceRefreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setAttendanceRefreshKey((key) => key + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const pendingApplications = applications.filter((application) => application.status === 'pending');
  const pendingLeaves = leaveRequests.filter((request) =>
    [LEAVE_STATUS.pendingAdmin, LEAVE_STATUS.pendingClassTeacher, LEAVE_STATUS.forwardedAdmin]
      .includes(request.status)
  );
  const today = attendanceOverview?.date ||
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const nextHoliday = getNextHoliday(attendanceOverview?.settings, today);
  const financeSummary = useMemo(() => {
    const yearlyFees = students.map(getYearlyFee);
    const positiveFees = yearlyFees.filter((fee) => fee > 0);
    const totalYearlyFees = yearlyFees.reduce((total, fee) => total + fee, 0);
    const totalCollected = students.reduce(
      (total, student) => total + getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid']),
      0
    );
    const totalPending = students.reduce((total, student) => {
      const explicitPending = getFirstAmount(student, [
        'pendingFees',
        'feePending',
        'balanceFees',
        'unpaidFees',
      ]);
      const collected = getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid']);
      return total + (explicitPending || Math.max(0, getYearlyFee(student) - collected));
    }, 0);
    return {
      totalYearlyFees,
      totalCollected,
      totalPending,
      maxFee: positiveFees.length ? Math.max(...positiveFees) : 0,
      minFee: positiveFees.length ? Math.min(...positiveFees) : 0,
      averageFee: students.length ? totalYearlyFees / students.length : 0,
    };
  }, [students]);

  const financeChartData = useMemo(
    () => getFinanceChartData(students, financeFrom, financeTo, financeClass),
    [students, financeFrom, financeTo, financeClass]
  );
  const visibleFinanceData = financeChartData.map((row) => ({
    ...row,
    Collected: financeMeasure === 'pending' ? 0 : row.Collected,
    Pending: financeMeasure === 'collected' ? 0 : row.Pending,
    Total:
      financeMeasure === 'collected'
        ? row.Collected
        : financeMeasure === 'pending'
          ? row.Pending
          : row.Total,
  }));
  const financeRangeTotal = financeChartData.reduce((total, row) => {
    if (financeMeasure === 'collected') return total + row.Collected;
    if (financeMeasure === 'pending') return total + row.Pending;
    return total + row.Total;
  }, 0);
  const teachersToday = staffAttendance.filter((entry) => entry.role === 'teacher');
  const attendanceTimezone = attendanceOverview?.settings?.timezone || 'Asia/Kolkata';
  const teacherCounts = teachersToday.reduce((counts, teacher) => {
    const status = getTeacherStatus(teacher, attendanceDate, attendanceOverview?.settings);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const overviewCards = [
    {
      label: 'Total Students',
      value: students.length.toLocaleString('en-IN'),
      note: isLoading ? 'Loading database' : 'Student database',
      icon: Users,
      page: 'Student Management',
    },
    {
      label: 'Upcoming Holiday',
      value: holidaysLoading ? 'Loading…' : holidaysError ? 'Unavailable' : nextHoliday?.date || 'Not scheduled',
      note: holidaysLoading ? 'Checking school calendar' : holidaysError ? 'Calendar unavailable' : nextHoliday?.note || 'No upcoming holiday',
      icon: CalendarDays,
      page: 'Academic Calender',
    },
    {
      label: 'Finance',
      value: formatCurrency(financeSummary.totalYearlyFees),
      note: `${formatCurrency(financeSummary.totalPending)} pending`,
      icon: CircleDollarSign,
      page: 'Finance',
    },
    {
      label: 'Leave Requests',
      value: queueLoading ? '…' : pendingLeaves.length.toLocaleString('en-IN'),
      note: 'Awaiting action',
      icon: ClipboardCheck,
      page: 'Leave Requests',
    },
    {
      label: 'Applications',
      value: queueLoading ? '…' : pendingApplications.length.toLocaleString('en-IN'),
      note: 'Pending review',
      icon: FileText,
      page: 'Application',
    },
  ];

  return (
    <div className="space-y-6 pb-8 select-none">
      <PortalWelcomeCard session={session} />
      {errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 text-xs font-bold">
          Database sync warning: {errors.join(' | ')}
        </div>
      )}
      {queueError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
          {queueError}
        </div>
      )}
      {holidaysError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
          The school calendar could not be loaded.
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 stagger">
        {overviewCards.map((card) => (
          <PortalStatCard
            key={card.label}
            {...card}
            onClick={() => setActivePage?.(card.page)}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="min-w-0 rounded-[28px] border border-slate-100 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.07)] sm:p-7 xl:col-span-8">
          <div className="flex flex-col gap-5">
            <div className="flex min-w-0 flex-nowrap items-center justify-between gap-3">
              <div className="flex shrink-0 items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <h2 className="whitespace-nowrap text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                  Finance Analytics
                </h2>
              </div>

              <div className="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-2 overflow-x-auto">
                <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-2 text-[11px] text-slate-500 sm:gap-2 sm:px-2.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="sr-only">Start date</span>
                  <input
                    type="date"
                    value={financeFrom}
                    max={financeTo || undefined}
                    onChange={(event) => setFinanceFrom(event.target.value)}
                    className="w-[94px] bg-transparent font-semibold text-slate-700 outline-none sm:w-[102px]"
                  />
                  <span className="text-slate-300">–</span>
                  <span className="sr-only">End date</span>
                  <input
                    type="date"
                    value={financeTo}
                    min={financeFrom || undefined}
                    max={getDateKey()}
                    onChange={(event) => setFinanceTo(event.target.value)}
                    className="w-[94px] bg-transparent font-semibold text-slate-700 outline-none sm:w-[102px]"
                  />
                </label>

                <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 sm:gap-2 sm:px-2.5 sm:text-xs">
                  <Filter className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="sr-only">Finance category</span>
                  <select
                    value={financeMeasure}
                    onChange={(event) => setFinanceMeasure(event.target.value)}
                    className="max-w-[108px] bg-transparent outline-none sm:max-w-32"
                  >
                    <option value="all">Revenue · All</option>
                    <option value="collected">Collected</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>

                <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 sm:gap-2 sm:px-2.5 sm:text-xs">
                  <span className="sr-only">Class filter</span>
                  <select
                    value={financeClass}
                    onChange={(event) => setFinanceClass(event.target.value)}
                    className="max-w-[92px] bg-transparent outline-none sm:max-w-36"
                  >
                    <option value="all">All classes</option>
                    {classNames.map((className) => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                    {!classNames.includes('Unassigned') && (
                      <option value="Unassigned">Unassigned</option>
                    )}
                  </select>
                </label>

              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
              <p className="text-4xl font-black tracking-tight text-[#17191b] sm:text-5xl">
                {formatCurrency(financeRangeTotal)}
              </p>
              <p className="pb-1 text-xs font-semibold text-slate-500">
                {financeMeasure === 'all' ? 'Collected + pending' : financeMeasure === 'collected' ? 'Collected' : 'Pending'} in this range
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
              {financeMeasure !== 'pending' && (
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#4338e8]" /> Collected
                </span>
              )}
              {financeMeasure !== 'collected' && (
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#aaa5f5]" /> Pending
                </span>
              )}
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#d7d5fb]" /> Monthly total
              </span>
              <span className="ml-auto text-[11px] text-slate-400">
                {financeClass === 'all' ? 'All classes' : financeClass}
              </span>
            </div>

            {financeFrom && financeTo && financeFrom > financeTo ? (
              <div className="flex h-[330px] items-center justify-center rounded-2xl bg-slate-50 text-sm font-semibold text-rose-600">
                Start date must be on or before end date.
              </div>
            ) : visibleFinanceData.length ? (
              <div className="h-[330px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={visibleFinanceData} margin={{ top: 22, right: 8, left: 3, bottom: 2 }}>
                    <CartesianGrid vertical={false} stroke="#eef0f5" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9299a7', fontSize: 11, fontWeight: 600 }}
                      minTickGap={12}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#a3aab6', fontSize: 10, fontWeight: 600 }}
                      tickFormatter={formatShortCurrency}
                      width={58}
                    />
                    <Tooltip content={<FinanceTooltip />} cursor={{ fill: '#f5f5fb' }} />
                    {financeMeasure !== 'pending' && (
                      <Bar dataKey="Collected" stackId="finance" fill="#4338e8" radius={[0, 0, 7, 7]} maxBarSize={54} />
                    )}
                    {financeMeasure !== 'collected' && (
                      <Bar dataKey="Pending" stackId="finance" fill="#aaa5f5" radius={[8, 8, 0, 0]} maxBarSize={54} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[330px] items-center justify-center rounded-2xl bg-slate-50 text-sm font-semibold text-slate-500">
                No finance records found for this date range.
              </div>
            )}
          </div>
        </div>

        <aside className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.07)] xl:col-span-4">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                  <Clock3 className="h-5 w-5 text-indigo-600" />
                  Today’s Teachers Attendance
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  {new Date(`${attendanceDate}T00:00:00.000Z`).toLocaleDateString('en-IN', {
                    timeZone: 'UTC',
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceRefreshKey((key) => key + 1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                title="Refresh teacher attendance"
                aria-label="Refresh teacher attendance"
              >
                <RefreshCw className={`h-4 w-4 ${staffLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ['Present', teacherCounts.Present || 0, 'text-emerald-700 bg-emerald-50'],
                ['Not marked', teacherCounts['Not marked'] || 0, 'text-amber-700 bg-amber-50'],
                ['Absent', teacherCounts.Absent || 0, 'text-rose-700 bg-rose-50'],
              ].map(([label, count, tone]) => (
                <div key={label} className={`rounded-xl px-2.5 py-2 ${tone}`}>
                  <p className="text-[9px] font-bold">{label}</p>
                  <p className="mt-0.5 text-lg font-black">{count}</p>
                </div>
              ))}
            </div>
          </div>

          {staffError && (
            <p className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              {staffError}
            </p>
          )}
          <div className="max-h-[300px] min-h-[240px] divide-y divide-slate-100 overflow-y-auto">
            {staffLoading && teachersToday.length === 0 ? (
              <p className="p-6 text-center text-xs font-semibold text-slate-500">Loading teacher attendance…</p>
            ) : teachersToday.length === 0 ? (
              <p className="p-6 text-center text-xs font-semibold text-slate-500">
                No teachers are available in the attendance directory.
              </p>
            ) : teachersToday.map((teacher) => {
              const day = teacher.days?.find((entry) => entry.date === attendanceDate);
              const status = getTeacherStatus(teacher, attendanceDate, attendanceOverview?.settings);
              const statusTone = status === 'Present'
                ? 'bg-emerald-50 text-emerald-700'
                : status === 'Absent'
                  ? 'bg-rose-50 text-rose-700'
                  : status === 'Holiday'
                    ? 'bg-slate-100 text-slate-600'
                    : status === 'Half day'
                      ? 'bg-orange-50 text-orange-700'
                      : 'bg-amber-50 text-amber-700';
              return (
                <div key={teacher.entityId} className="px-5 py-3.5 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                        {String(teacher.displayName || 'T').trim().slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-slate-900">{teacher.displayName}</p>
                        <p className="mt-0.5 truncate text-[10px] font-semibold capitalize text-slate-400">
                          {teacher.designation || teacher.role || 'Teacher'}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold ${statusTone}`}>
                      {status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-12 text-[10px] font-semibold text-slate-500">
                    <span>Clock in <strong className="text-slate-700">{formatAttendanceTime(day?.clockInAt, attendanceTimezone)}</strong></span>
                    <span>Clock out <strong className="text-slate-700">{formatAttendanceTime(day?.clockOutAt, attendanceTimezone)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => setActivePage?.('Attendance')}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white transition hover:bg-slate-800"
            >
              Open Attendance Management
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default Dashboard;
