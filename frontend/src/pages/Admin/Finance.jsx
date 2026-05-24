import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  CreditCard,
  DollarSign,
  Eye,
  GraduationCap,
  Mail,
  MessageSquare,
  Printer,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Users,
  Clock,
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
import { sendGmailMessages } from '../../components/common/gmail';
import { useMasterData } from '../../components/common/masterData';
import {
  allocatePayment,
  applyPaymentToStudents,
  buildClassFinanceSummaries,
  buildFamilyLedger,
  buildFinanceAnalytics,
  buildReceiptPayload,
  formatCurrency,
  normalizeFinanceStudent,
  parseAmount,
} from '../../components/common/financeData';

const getClassColor = (className) => {
  let hash = 0;
  for (const char of String(className)) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash}, 72%, 45%)`;
};

const buildFeeReminderMessage = (student) => ({
  to: student.guardianEmail,
  subject: `Fee Reminder: ${student.name} (${student.admissionNumber})`,
  text: [
    `Dear ${student.fatherName || student.guardianName || 'Guardian'},`,
    '',
    `This is a fee reminder for ${student.name} (${student.admissionNumber}).`,
    `Pending amount: ${formatCurrency(student.pendingFees)}.`,
    '',
    'Please clear the pending dues at the earliest or contact the accounts office for clarification.',
    '',
    'Regards,',
    'Accounts Department',
    'MGPS ERP Portal',
  ].join('\n'),
});

const buildReceiptMessage = (receipt) => ({
  to: receipt.familyDetails?.guardianEmail,
  subject: `Fee Receipt ${receipt.receiptNo}`,
  text: [
    `Dear ${receipt.familyDetails?.fatherName || 'Guardian'},`,
    '',
    `Payment received: ${formatCurrency(receipt.amountPaid)}.`,
    `Receipt number: ${receipt.receiptNo}.`,
    `Receipt time: ${receipt.timestamp}.`,
    '',
    'Allocation breakdown:',
    ...(receipt.breakdown || []).map((item) => `- ${item.name}: ${formatCurrency(item.allocated)}`),
    '',
    'Regards,',
    'Accounts Department',
    'MGPS ERP Portal',
  ].join('\n'),
});

const FinanceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-lg p-3 text-xs min-w-56">
      <p className="font-black text-neutral-900 mb-2">{label}</p>
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

const Finance = ({ setActivePage }) => {
  const masterData = useMasterData();
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSendingReceiptMail, setIsSendingReceiptMail] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedAdmissionNumber, setSelectedAdmissionNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('none');
  const [paymentMode, setPaymentMode] = useState('family');
  const [selectedIndividualId, setSelectedIndividualId] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [latestReceipt, setLatestReceipt] = useState(null);

  const students = useMemo(
    () => masterData.raw.students.map(normalizeFinanceStudent),
    [masterData.raw.students]
  );
  const classSummaries = useMemo(
    () => buildClassFinanceSummaries(masterData.raw.students, masterData.classNames),
    [masterData.classNames, masterData.raw.students]
  );
  const analytics = useMemo(
    () => buildFinanceAnalytics(masterData.raw.students, masterData.classNames),
    [masterData.classNames, masterData.raw.students]
  );

  const totals = useMemo(() => {
    const totalCollected = students.reduce((sum, student) => sum + student.paidFees, 0);
    const totalPending = students.reduce((sum, student) => sum + student.pendingFees, 0);
    return {
      totalCollected,
      totalPending,
      totalAssigned: totalCollected + totalPending,
      totalStudents: students.length,
      recoveryRate:
        totalCollected + totalPending > 0
          ? Math.round((totalCollected / (totalCollected + totalPending)) * 100)
          : 0,
    };
  }, [students]);

  const selectedClassStudents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return students
      .filter((student) => !selectedClassName || student.className === selectedClassName)
      .filter((student) => {
        const haystack = [student.name, student.admissionNumber, student.fatherName, student.guardianPhone]
          .join(' ')
          .toLowerCase();
        return !normalizedSearch || haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sortOrder === 'high-to-low') return b.pendingFees - a.pendingFees;
        if (sortOrder === 'low-to-high') return a.pendingFees - b.pendingFees;
        return a.name.localeCompare(b.name);
      });
  }, [searchTerm, selectedClassName, sortOrder, students]);

  const familyLedger = useMemo(
    () => buildFamilyLedger(masterData.raw.students, selectedAdmissionNumber),
    [masterData.raw.students, selectedAdmissionNumber]
  );

  useEffect(() => {
    const firstLedgerStudent = familyLedger.students[0];
    if (firstLedgerStudent && !familyLedger.students.some((student) => student.id === selectedIndividualId)) {
      setSelectedIndividualId(firstLedgerStudent.id);
    }
  }, [familyLedger.students, selectedIndividualId]);

  const statsOverview = [
    {
      id: 'assigned',
      title: 'Total Demand',
      value: formatCurrency(totals.totalAssigned),
      icon: DollarSign,
      note: `${formatCurrency(totals.totalCollected)} collected`,
    },
    {
      id: 'collected',
      title: 'Total Collected',
      value: formatCurrency(totals.totalCollected),
      icon: TrendingUp,
      note: `${totals.recoveryRate}% recovery rate`,
    },
    {
      id: 'pending',
      title: 'Total Pending',
      value: formatCurrency(totals.totalPending),
      icon: Clock,
      note: totals.totalPending ? 'Requires follow-up' : 'All dues cleared',
    },
    {
      id: 'students',
      title: 'Total Students',
      value: totals.totalStudents,
      icon: Users,
      note: 'Synced from Student Management',
    },
  ];

  const triggerBroadcastReminders = async (channel) => {
    const recipients = students.filter((student) => student.pendingFees > 0 && student.guardianEmail);

    if (channel !== 'gmail') {
      alert(`Reminder queued for ${recipients.length} pending-fee guardian account(s).`);
      return;
    }

    if (!recipients.length) {
      alert('No pending-fee Gmail recipients found.');
      return;
    }

    setIsSendingReminder(true);
    try {
      const result = await sendGmailMessages(recipients.map(buildFeeReminderMessage));
      alert(`Gmail reminders sent successfully to ${result.sent || recipients.length} guardian account(s).`);
    } catch (error) {
      alert(`Gmail reminder failed: ${error.message}`);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const sendReceiptMail = async (receipt) => {
    const receiptMessage = buildReceiptMessage(receipt);

    if (!receiptMessage.to) {
      alert('Guardian Gmail is missing for this receipt.');
      return;
    }

    setIsSendingReceiptMail(true);
    try {
      await sendGmailMessages(receiptMessage);
      alert(`Receipt mailed successfully to ${receiptMessage.to}.`);
    } catch (error) {
      alert(`Receipt Gmail failed: ${error.message}`);
    } finally {
      setIsSendingReceiptMail(false);
    }
  };

  const executeManualPayment = (event) => {
    event.preventDefault();
    const amount = parseAmount(inputAmount);
    if (amount <= 0) {
      alert('Enter a valid payment amount.');
      return;
    }

    const allocations = allocatePayment(familyLedger.students, amount, paymentMode, selectedIndividualId);
    if (!allocations.length) {
      alert('No pending balance found for the selected ledger.');
      return;
    }

    const nextStudents = applyPaymentToStudents(masterData.raw.students, allocations);
    const receipt = buildReceiptPayload(familyLedger, amount, allocations, paymentMode);
    masterData.actions.setStudents(nextStudents);
    setLatestReceipt(receipt);
    setInputAmount('');

    try {
      localStorage.setItem('latest_invoice_payload', JSON.stringify(receipt));
    } catch (error) {
      console.warn('Failed to persist invoice payload', error);
    }

    if (typeof setActivePage === 'function') setActivePage('Fees Receipt');
    else setCurrentView('receipt');
  };

  return (
    <div className="w-full min-h-screen bg-[#D9D9D9] p-6 text-neutral-800 font-sans box-border select-none">
      {currentView === 'dashboard' && (
        <div className="animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2 text-neutral-900">
                Institutional Finance Ledger <Sparkles className="w-5 h-5 text-neutral-700" />
              </h2>
              <p className="text-xs text-neutral-600 font-medium font-mono mt-1">
                Student Management, Dashboard, Class Finance, and Fee Receipt now share one fee ledger.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-neutral-300 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 text-neutral-500 font-mono">
                Reminders:
              </span>
              <button
                type="button"
                onClick={() => triggerBroadcastReminders('gmail')}
                disabled={isSendingReminder}
                className="flex items-center gap-1 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-xl transition-all disabled:opacity-60"
              >
                <Mail className="w-3.5 h-3.5 text-red-500" /> Via Gmail
              </button>
              <button
                type="button"
                onClick={() => triggerBroadcastReminders('whatsapp')}
                disabled={isSendingReminder}
                className="flex items-center gap-1 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-xl transition-all disabled:opacity-60"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statsOverview.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.id} className="bg-white p-5 rounded-2xl shadow-md border border-neutral-300/40">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase text-neutral-500 font-mono">{card.title}</span>
                    <div className="w-7 h-7 bg-neutral-100 border border-neutral-200 rounded-xl flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">{card.value}</h3>
                  <p className="text-[10px] text-neutral-500 mt-1 font-semibold">{card.note}</p>
                </div>
              );
            })}
          </div>

          <div className="w-full bg-white border border-neutral-300 shadow-md p-5 rounded-2xl mb-6">
            <div className="w-full h-64 font-mono text-[10px] font-bold">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="month" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip content={<FinanceTooltip />} />
                  <Legend />
                  {analytics.classes.map((className) => (
                    <Line
                      key={className}
                      type="monotone"
                      dataKey={className}
                      stroke={getClassColor(className)}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-600 mb-4 font-mono">
            Classwise Accounts Index
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classSummaries.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => {
                  setSelectedClassName(cls.className);
                  setSearchTerm('');
                  setCurrentView('list');
                }}
                className="bg-white hover:bg-neutral-50 border border-neutral-300 p-5 rounded-2xl cursor-pointer transition-all text-left shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-black text-neutral-900">{cls.className}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-800" />
                </div>
                <div className="flex justify-between text-[10px] font-mono font-bold mb-2.5">
                  <span className="text-emerald-600">Coll: {formatCurrency(cls.collectedValue)}</span>
                  <span className="text-red-600">Pend: {formatCurrency(cls.pendingValue)}</span>
                </div>
                <div className="w-full h-2.5 bg-neutral-200 rounded-full flex overflow-hidden border border-neutral-300">
                  <div className="h-full bg-emerald-500" style={{ width: `${cls.collectedPercent}%` }} />
                  <div className="h-full bg-red-500" style={{ width: `${cls.pendingPercent}%` }} />
                </div>
                <p className="text-[10px] text-neutral-500 font-semibold mt-2">{cls.studentCount} student(s)</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {currentView === 'list' && (
        <div className="animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="p-2 bg-white border border-neutral-300 rounded-xl shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900">
                {selectedClassName} Financial Log
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative bg-white rounded-xl border border-neutral-300 shadow-sm flex items-center px-3 py-1.5 w-full sm:w-64">
                <Search className="w-4 h-4 text-neutral-400 mr-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search..."
                  className="bg-transparent text-xs text-neutral-800 outline-none w-full font-medium"
                />
              </div>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'high-to-low' ? 'low-to-high' : 'high-to-low')}
                className="flex items-center gap-1.5 text-[10px] font-black bg-white border border-neutral-300 px-3 py-2.5 rounded-xl shadow-sm"
              >
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort Due: {sortOrder}
              </button>
            </div>
          </div>

          <div className="w-full bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-black uppercase text-neutral-500 font-mono">
                    <th className="py-3 px-4">Adm. Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Father's Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Paid Fees</th>
                    <th className="py-3 px-4 text-right">Pending Fees</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {selectedClassStudents.map((student) => (
                    <tr key={student.admissionNumber} className="hover:bg-neutral-50/60">
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-600">{student.admissionNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-neutral-900">
                        <span className="inline-flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 text-neutral-500" />
                          {student.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600">{student.fatherName || '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-500">{student.guardianPhone || '-'}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(student.paidFees)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-red-500">
                        {formatCurrency(student.pendingFees)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdmissionNumber(student.admissionNumber);
                            setCurrentView('ledger');
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-black bg-neutral-100 border border-neutral-300 px-3 py-1.5 rounded-xl hover:bg-neutral-800 hover:text-white transition-all"
                        >
                          <Eye className="w-3 h-3" /> View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!selectedClassStudents.length && (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        No synced student fee records found for this class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {currentView === 'ledger' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-neutral-400/60 pb-4">
            <button
              type="button"
              onClick={() => setCurrentView('list')}
              className="p-2 bg-white border border-neutral-300 rounded-xl shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-black uppercase text-neutral-900">
                Family Ledger: {familyLedger.selectedStudent?.name || 'Student'}
              </h2>
              <p className="text-xs text-neutral-600 font-mono">Family ID: {familyLedger.familyId}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Father Name</span><p className="text-sm font-bold">{familyLedger.fatherName || '-'}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Mother Name</span><p className="text-sm font-bold">{familyLedger.motherName || '-'}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Contact</span><p className="text-sm font-bold font-mono">{familyLedger.contact || '-'}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Category</span><p className="text-sm font-bold uppercase">{familyLedger.category || '-'}</p></div>
          </div>

          <div className="bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase font-mono text-neutral-500">Connected Sibling Registers</h3>
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-black font-mono">
                Total Family Dues: {formatCurrency(familyLedger.totalPending)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[9px] font-black text-neutral-400 font-mono">
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Cumulative Paid</th>
                    <th className="p-3 text-right">Unpaid Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {familyLedger.students.map((student) => (
                    <tr key={student.admissionNumber} className="hover:bg-neutral-50/50">
                      <td className="p-3 font-bold text-neutral-900">{student.name}</td>
                      <td className="p-3 font-mono">{student.className}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-black ${student.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="p-3 text-right text-emerald-600 font-bold font-mono">{formatCurrency(student.paidFees)}</td>
                      <td className={`p-3 text-right font-bold font-mono ${student.pendingFees > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {formatCurrency(student.pendingFees)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md md:col-span-2 space-y-4">
              <h4 className="text-xs font-black uppercase text-neutral-900 flex items-center gap-1"><CreditCard className="w-4 h-4" /> Fee Collection</h4>
              <form onSubmit={executeManualPayment} className="space-y-4">
                <div className="flex flex-wrap gap-4 bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={paymentMode === 'family'} onChange={() => setPaymentMode('family')} />
                    Family Distribution
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={paymentMode === 'individual'} onChange={() => setPaymentMode('individual')} />
                    Individual Payment
                  </label>
                </div>
                {paymentMode === 'individual' && (
                  <select
                    value={selectedIndividualId}
                    onChange={(event) => setSelectedIndividualId(event.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none"
                  >
                    {familyLedger.students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} - Due: {formatCurrency(student.pendingFees)}
                      </option>
                    ))}
                  </select>
                )}
                <div className="relative flex items-center bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1">
                  <span className="text-sm font-mono font-black mr-2">Rs.</span>
                  <input
                    type="number"
                    value={inputAmount}
                    onChange={(event) => setInputAmount(event.target.value)}
                    placeholder="Amount to collect..."
                    className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Commit Receipt
                </button>
              </form>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-neutral-900 mb-3">Ledger Policy</h4>
                <p className="text-[11px] text-neutral-600 leading-relaxed font-semibold">
                  Passed-out or TC-issued students stay visible while balances are positive. Clearing a payment updates
                  the shared student ledger for Dashboard, Class Finance, and receipt generation.
                </p>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[10px] text-amber-800 font-mono mt-3 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Accounts with outstanding dues remain retained.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'receipt' && latestReceipt && (
        <div className="max-w-xl mx-auto bg-white border border-neutral-400 p-6 rounded-2xl shadow-2xl space-y-6 text-left">
          <div className="text-center space-y-1 border-b border-dashed border-neutral-300 pb-4">
            <h3 className="text-base font-black uppercase tracking-widest text-neutral-900">Institutional Remittance Invoice</h3>
            <p className="text-[10px] font-mono text-neutral-400">{latestReceipt.timestamp} | Ref: {latestReceipt.receiptNo}</p>
          </div>
          <div className="text-xs space-y-1 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <p><strong>Primary Guardian:</strong> {latestReceipt.familyDetails?.fatherName || '-'}</p>
            <p><strong>Registered Mobile:</strong> {latestReceipt.familyDetails?.contact || '-'}</p>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {latestReceipt.breakdown?.map((item) => (
              <div key={item.admissionNumber} className="p-2 flex justify-between border-b border-neutral-100">
                <span>{item.name}</span>
                <span className="font-bold">{formatCurrency(item.allocated)}</span>
              </div>
            ))}
            <div className="p-3 bg-neutral-900 text-white flex justify-between rounded-xl font-black">
              <span>Total Collected</span><span>{formatCurrency(latestReceipt.amountPaid)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"><Printer className="w-3.5 h-3.5" /> Print</button>
            <button type="button" onClick={() => alert(`WhatsApp alert queued for ${latestReceipt.familyDetails?.contact || 'guardian'}.`)} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"><MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp</button>
            <button type="button" onClick={() => sendReceiptMail(latestReceipt)} disabled={isSendingReceiptMail} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl disabled:opacity-60"><Mail className="w-3.5 h-3.5 text-red-500" /> {isSendingReceiptMail ? 'Sending...' : 'Gmail'}</button>
          </div>
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="w-full py-2.5 text-center text-xs font-black border border-neutral-800 rounded-xl hover:bg-neutral-900 hover:text-white transition-all"
          >
            Exit To Finance Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default Finance;
