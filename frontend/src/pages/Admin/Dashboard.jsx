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

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e'];

const getClassColor = (className) => {
  let hash = 0;
  for (const char of String(className)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return CHART_COLORS[hash % CHART_COLORS.length];
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

  // Roll up class-wise numbers into a single Total Collected / Total Pending
  // pair per month, so the chart stays legible instead of showing N tangled lines.
  chartData.forEach((row) => {
    let collected = 0;
    let pending = 0;
    classes.forEach((className) => {
      collected += Number(row[className] || 0);
      pending += Number(row[`${className} Pending`] || 0);
    });
    row.Collected = collected;
    row.Pending = pending;
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
    <div className="glass-strong rounded-2xl shadow-lg p-3 text-xs min-w-56">
      <p className="font-black text-slate-900 mb-2">{label}</p>
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
    { label: 'Finance', page: 'Finance', icon: Wallet, bg: 'bg-amber-50/70', text: 'text-amber-500', border: 'border-amber-200/60' },
    { label: 'Post Notice', page: 'Notices', icon: BellRing, bg: 'bg-violet-50/70', text: 'text-violet-500', border: 'border-violet-200/60' },
    { label: 'Schedule Events', page: 'Events', icon: CalendarDays, bg: 'bg-sky-50/70', text: 'text-sky-500', border: 'border-sky-200/60' },
    { label: 'Approve Leaves', page: 'Leave Requests', icon: CheckCircle, bg: 'bg-emerald-50/70', text: 'text-emerald-600', border: 'border-emerald-200/60' },
  ];

  const overviewCards = [
    {
      label: 'Total Students',
      value: students.length.toLocaleString('en-IN'),
      note: isLoading ? 'Loading database' : 'Student database',
      icon: Users,
      bg: 'bg-amber-50/70',
      border: 'border-amber-200/60',
      iconBg: 'bg-amber-100/70',
      text: 'text-amber-500',
    },
    {
      label: 'Total Teachers',
      value: teachers.length.toLocaleString('en-IN'),
      note: isLoading ? 'Loading database' : 'Faculty database',
      icon: GraduationCap,
      bg: 'bg-violet-50/70',
      border: 'border-violet-200/60',
      iconBg: 'bg-violet-100/70',
      text: 'text-violet-500',
    },
    {
      label: 'Finance',
      value: formatCurrency(financeSummary.totalYearlyFees),
      note: `${formatCurrency(financeSummary.totalCollected)} collected`,
      icon: Landmark,
      bg: 'bg-sky-50/70',
      border: 'border-sky-200/60',
      iconBg: 'bg-sky-100/70',
      text: 'text-sky-500',
    },
  ];

  const feeStats = [
    { label: 'Maximum Fee', value: formatCurrency(financeSummary.maxFee), tone: 'bg-amber-50/70 text-amber-600 border-amber-200/60' },
    { label: 'Minimum Fee', value: formatCurrency(financeSummary.minFee), tone: 'bg-violet-50/70 text-violet-600 border-violet-200/60' },
    { label: 'Average Fee', value: formatCurrency(financeSummary.averageFee), tone: 'bg-sky-50/70 text-sky-600 border-sky-200/60' },
  ];

  return (
    <div className="space-y-6 pb-8 select-none">
      <div className="glass-card p-5 rounded-3xl animate-fadeInUp">
        <h3 className="text-sm font-bold text-slate-900 mb-3.5">Admin Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => setActivePage?.(action.page)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border ${action.bg} ${action.border} hover:scale-[1.02] transition-transform duration-200 text-left`}
              >
                <div className={`p-2 bg-white/80 rounded-xl ${action.text} shadow-sm shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-900 leading-tight">{action.label}</span>
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
        <div className="lg:col-span-1 glass-card p-4 rounded-3xl flex flex-col gap-4 stagger">
          <h3 className="text-sm font-bold text-slate-900 px-2 mb-1">Academic Overview</h3>

          {overviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="glass-card glass-hover p-4 rounded-3xl flex flex-col justify-between h-28 relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-2xl font-black text-slate-900 break-words">{card.value}</span>
                    <p className="text-xs font-semibold text-slate-400 mt-1">{card.label}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 shrink-0">
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

        <div className="lg:col-span-2 glass-card p-5 rounded-3xl flex flex-col justify-between">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Finance Analytics</h3>
                <p className="text-[11px] text-slate-400">
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
                  <p className="text-lg font-black text-slate-900 mt-1">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.chartData} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<FinanceTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Line
                  type="monotone"
                  dataKey="Collected"
                  name="Total Collected"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981' }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Pending"
                  name="Total Pending"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#ef4444' }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
                {/* Per-class series stay in the underlying rows so the tooltip still shows the class-wise breakdown. */}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {analytics.classes.length === 0 && (
            <p className="text-center text-xs font-bold text-slate-400 py-4">
              Add student finance records to populate class-wise fee analytics.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
