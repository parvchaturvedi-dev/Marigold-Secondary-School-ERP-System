import React, { useMemo } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckCircle,
  GraduationCap,
  Landmark,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useMasterData } from '../../components/common/masterData';

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

const getClassColor = (className) => {
  let hash = 0;
  for (const char of String(className)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash}, 72%, 45%)`;
};

const getMonthIndex = (entry) => {
  const monthValue = entry.month || entry.monthName || entry.feeMonth || entry.period;
  if (monthValue) {
    const monthText = String(monthValue).slice(0, 3).toLowerCase();
    const index = MONTHS.findIndex((month) => month.toLowerCase() === monthText);
    if (index >= 0) return index;
  }

  const dateValue = entry.date || entry.paidAt || entry.createdAt || entry.receiptDate || entry.dueDate;
  const parsedDate = dateValue ? new Date(dateValue) : null;
  return parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : new Date().getMonth();
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
  const amount = getFirstAmount(entry, ['amount', 'value']);
  const status = String(entry.status || entry.type || '').toLowerCase();
  return status.includes('pending') || status.includes('due') || status.includes('balance') ? amount : 0;
};

const buildFinanceAnalytics = (students = [], classNames = []) => {
  const classSet = new Set(classNames);
  students.forEach((student) => {
    const className = student.className || student.class || student.rawProfile?.targetClass || 'Unassigned';
    classSet.add(className);
  });

  const classes = [...classSet].filter(Boolean);
  const chartData = MONTHS.map((month) => {
    const row = { month };
    classes.forEach((className) => {
      row[className] = 0;
      row[`${className} Pending`] = 0;
    });
    return row;
  });

  students.forEach((student) => {
    const className = student.className || student.class || student.rawProfile?.targetClass || 'Unassigned';
    const entries = getMonthlyEntries(student);

    if (entries.length > 0) {
      entries.forEach((entry) => {
        const monthIndex = getMonthIndex(entry);
        chartData[monthIndex][className] += getEntryCollected(entry);
        chartData[monthIndex][`${className} Pending`] += getEntryPending(entry);
      });
      return;
    }

    const currentMonthIndex = new Date().getMonth();
    chartData[currentMonthIndex][className] += getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid']);
    chartData[currentMonthIndex][`${className} Pending`] += getFirstAmount(student, [
      'pendingFees',
      'feePending',
      'balanceFees',
      'unpaidFees',
    ]);
  });

  return {
    classes,
    chartData,
  };
};

const formatCurrency = (amount) => `Rs. ${Math.round(Number(amount || 0)).toLocaleString('en-IN')}`;

const FinanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-[#EAEAEA] rounded-2xl shadow-lg p-3 text-xs min-w-56">
      <p className="font-black text-[#1A1A1A] mb-2">{label}</p>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="space-y-0.5">
            <div className="flex items-center justify-between gap-4 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.dataKey}
              </span>
              <span>{formatCurrency(item.value)}</span>
            </div>
            <p className="text-[10px] text-red-500 pl-4">
              Pending: {formatCurrency(item.payload?.[`${item.dataKey} Pending`] || 0)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Dashboard = ({ setActivePage }) => {
  const { students, teachers, classNames, isLoading, errors } = useMasterData();

  const financeSummary = useMemo(() => {
    const yearlyFees = students.map(getYearlyFee);
    const positiveFees = yearlyFees.filter((fee) => fee > 0);
    const totalYearlyFees = yearlyFees.reduce((total, fee) => total + fee, 0);
    const totalCollected = students.reduce(
      (total, student) => total + getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid']),
      0
    );
    return {
      totalYearlyFees,
      totalCollected,
      maxFee: positiveFees.length ? Math.max(...positiveFees) : 0,
      minFee: positiveFees.length ? Math.min(...positiveFees) : 0,
      averageFee: students.length ? totalYearlyFees / students.length : 0,
    };
  }, [students]);

  const analytics = useMemo(
    () => buildFinanceAnalytics(students, classNames),
    [students, classNames]
  );

  const quickActions = [
    { label: 'Finance', page: 'Finance', icon: Wallet, bg: 'bg-[#FFF8EC]', text: 'text-[#f59e0b]', border: 'border-[#F5E6CC]' },
    { label: 'Post Notice', page: 'Notices', icon: BellRing, bg: 'bg-[#F5F3FF]', text: 'text-[#8b5cf6]', border: 'border-[#E8E3FF]' },
    { label: 'Schedule Events', page: 'Events', icon: CalendarDays, bg: 'bg-[#E6FFFA]', text: 'text-[#06b6d4]', border: 'border-[#CCFBF1]' },
    { label: 'Approve Leaves', page: 'Leave Requests', icon: CheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  ];

  const overviewCards = [
    {
      label: 'Total Students',
      value: students.length.toLocaleString('en-IN'),
      note: isLoading ? 'Loading database' : 'Student database',
      icon: Users,
      bg: 'bg-[#FFF8EC]',
      border: 'border-[#F5E6CC]',
      iconBg: 'bg-[#FCECD2]',
      text: 'text-[#f59e0b]',
    },
    {
      label: 'Total Teachers',
      value: teachers.length.toLocaleString('en-IN'),
      note: isLoading ? 'Loading database' : 'Faculty database',
      icon: GraduationCap,
      bg: 'bg-[#F5F3FF]',
      border: 'border-[#E8E3FF]',
      iconBg: 'bg-[#EBE5FF]',
      text: 'text-[#8b5cf6]',
    },
    {
      label: 'Finance',
      value: formatCurrency(financeSummary.totalYearlyFees),
      note: `${formatCurrency(financeSummary.totalCollected)} collected`,
      icon: Landmark,
      bg: 'bg-[#E6FFFA]',
      border: 'border-[#CCFBF1]',
      iconBg: 'bg-[#CCFBF1]',
      text: 'text-[#06b6d4]',
    },
  ];

  const feeStats = [
    { label: 'Maximum Fee', value: formatCurrency(financeSummary.maxFee), tone: 'bg-[#FFF8EC] text-[#f59e0b] border-[#F5E6CC]' },
    { label: 'Minimum Fee', value: formatCurrency(financeSummary.minFee), tone: 'bg-[#F5F3FF] text-[#8b5cf6] border-[#E8E3FF]' },
    { label: 'Average Fee', value: formatCurrency(financeSummary.averageFee), tone: 'bg-[#E6FFFA] text-[#0891b2] border-[#CCFBF1]' },
  ];

  return (
    <div className="space-y-6 pb-8 select-none">
      <div className="bg-white p-5 rounded-3xl border border-[#EAEAEA] shadow-sm">
        <h3 className="text-sm font-bold text-[#1A1A1A] mb-3.5">Admin Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => setActivePage?.(action.page)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border ${action.bg} ${action.border} hover:scale-[1.02] transition-transform duration-200 text-left`}
              >
                <div className={`p-2 bg-white rounded-xl ${action.text} shadow-sm shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#1A1A1A] leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 text-xs font-bold">
          Database sync warning: {errors.join(' | ')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-[#EAEAEA] p-4 rounded-3xl flex flex-col gap-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1A1A1A] px-2 mb-1">Academic Overview</h3>

          {overviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`${card.bg} p-4 rounded-2xl border ${card.border} flex flex-col justify-between h-28 relative overflow-hidden`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-2xl font-black text-[#1A1A1A] break-words">{card.value}</span>
                    <p className="text-xs font-semibold text-[#666666] mt-1">{card.label}</p>
                  </div>
                  <div className={`p-2.5 ${card.iconBg} rounded-full ${card.text} shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{card.note}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-[#EAEAEA] flex flex-col justify-between shadow-sm">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A]">Finance Analytics</h3>
                <p className="text-[11px] text-[#666666]">
                  Class-wise monthly collections with pending amounts in the tooltip
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Collected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full" /> Pending
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {feeStats.map((stat) => (
                <div key={stat.label} className={`rounded-2xl border px-4 py-3 ${stat.tone}`}>
                  <p className="text-[10px] uppercase tracking-wider font-black">{stat.label}</p>
                  <p className="text-lg font-black text-[#1A1A1A] mt-1">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.chartData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#888888', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#888888', fontSize: 11 }}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<FinanceTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                {analytics.classes.map((className) => (
                  <Line
                    key={className}
                    type="monotone"
                    dataKey={className}
                    name={className}
                    stroke={getClassColor(className)}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {analytics.classes.length === 0 && (
            <p className="text-center text-xs font-bold text-[#666666] py-4">
              Add student finance records to populate class-wise fee analytics.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
