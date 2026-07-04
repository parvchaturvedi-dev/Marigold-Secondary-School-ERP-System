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
  UserX,
  Tag,
  X,
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
import { apiFetch } from '../../components/common/api';
import { useMasterData } from '../../components/common/masterData';
import { useMongoState } from '../../components/common/mongoState';
import {
  buildFinanceAnalytics,
  buildClassFinanceSummaries,
  buildFamilyLedger,
  formatCurrency,
  normalizeFinanceStudent,
  parseAmount,
  getStudentAdmissionNumber,
  getStudentDisplayName,
  getStudentClassName,
  getClassOrder,
  ensureFeeLedger,
  entryPending,
  entryStatus,
  sortedFeeLedger,
  ledgerTotals,
  studentFeeTotals,
  studentHasPending,
  assignClassFeeToStudent,
  collectStudentPayment,
  collectFamilyPayment,
  buildClassWiseReceipt,
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
  to: receipt.guardianEmail,
  subject: `Fee Receipt ${receipt.receiptNo}`,
  text: [
    `Dear ${receipt.payerName || 'Guardian'},`,
    '',
    `Payment received: ${formatCurrency(receipt.amountPaid)}.`,
    `Receipt number: ${receipt.receiptNo}.`,
    `Receipt time: ${receipt.timestamp}.`,
    '',
    'Class-wise allocation:',
    ...(receipt.breakdown || []).map(
      (item) => `- ${item.name ? `${item.name} · ` : ''}${item.className}: ${formatCurrency(item.amount)}`
    ),
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

const StatusBadge = ({ status }) => {
  const styles =
    status === 'Paid'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'Partial'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-black uppercase ${styles}`}>{status}</span>
  );
};

const Finance = ({ setActivePage }) => {
  const masterData = useMasterData();
  const [alumniPending, setAlumniPending] = useMongoState('admin-finance-alumni-pending', []);

  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [isSendingReceiptMail, setIsSendingReceiptMail] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedAdmissionNumber, setSelectedAdmissionNumber] = useState('');
  const [selectedIsAlumni, setSelectedIsAlumni] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('none');
  const [paymentMode, setPaymentMode] = useState('individual');
  const [selectedIndividualId, setSelectedIndividualId] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [latestReceipt, setLatestReceipt] = useState(null);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignClassName, setAssignClassName] = useState('');
  const [assignAmount, setAssignAmount] = useState('');
  const [assignNote, setAssignNote] = useState('');

  const students = useMemo(
    () => masterData.raw.students.map(normalizeFinanceStudent),
    [masterData.raw.students]
  );
  const classOrder = useMemo(
    () => getClassOrder(masterData.raw.classPreferences),
    [masterData.raw.classPreferences]
  );
  const classSummaries = useMemo(
    () => buildClassFinanceSummaries(masterData.raw.students, masterData.classNames),
    [masterData.classNames, masterData.raw.students]
  );
  const analytics = useMemo(
    () => buildFinanceAnalytics(masterData.raw.students, masterData.classNames),
    [masterData.classNames, masterData.raw.students]
  );

  const alumniList = useMemo(
    () => (Array.isArray(alumniPending) ? alumniPending.map(normalizeFinanceStudent) : []),
    [alumniPending]
  );
  const alumniTotals = useMemo(() => {
    return alumniList.reduce(
      (acc, student) => {
        const totals = studentFeeTotals(student);
        acc.pending += totals.pending;
        acc.count += totals.pending > 0 ? 1 : 0;
        return acc;
      },
      { pending: 0, count: 0 }
    );
  }, [alumniList]);

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
      .map((student) => {
        const ledger = ensureFeeLedger(student);
        const currentEntry = ledger.find(
          (entry) => entry.className.toLowerCase() === student.className.toLowerCase()
        );
        const overall = studentFeeTotals(student);
        return {
          ...student,
          currentClassAssigned: currentEntry ? parseAmount(currentEntry.assigned) : 0,
          currentClassPaid: currentEntry ? parseAmount(currentEntry.paid) : 0,
          currentClassPending: currentEntry ? entryPending(currentEntry) : 0,
          currentClassStatus: currentEntry ? entryStatus(currentEntry) : 'Due',
          overallPending: overall.pending,
        };
      })
      .sort((a, b) => {
        if (sortOrder === 'high-to-low') return b.currentClassPending - a.currentClassPending;
        if (sortOrder === 'low-to-high') return a.currentClassPending - b.currentClassPending;
        return a.name.localeCompare(b.name);
      });
  }, [searchTerm, selectedClassName, sortOrder, students]);

  const familyLedger = useMemo(
    () => buildFamilyLedger(masterData.raw.students, selectedIsAlumni ? '' : selectedAdmissionNumber),
    [masterData.raw.students, selectedAdmissionNumber, selectedIsAlumni]
  );

  // Ledger view target: either a live student (with family siblings) or an alumni record (standalone).
  const ledgerStudent = useMemo(() => {
    if (selectedIsAlumni) {
      return alumniList.find((student) => student.admissionNumber === selectedAdmissionNumber) || null;
    }
    return familyLedger.selectedStudent || null;
  }, [selectedIsAlumni, alumniList, selectedAdmissionNumber, familyLedger.selectedStudent]);

  const ledgerSiblings = selectedIsAlumni ? (ledgerStudent ? [ledgerStudent] : []) : familyLedger.students;

  const ledgerEntries = useMemo(() => {
    if (!ledgerStudent) return [];
    return sortedFeeLedger(ensureFeeLedger(ledgerStudent), classOrder);
  }, [ledgerStudent, classOrder]);

  const ledgerFeeTotals = useMemo(() => ledgerTotals(ledgerEntries), [ledgerEntries]);

  useEffect(() => {
    if (selectedIsAlumni) return;
    const firstLedgerStudent = familyLedger.students[0];
    if (firstLedgerStudent && !familyLedger.students.some((student) => student.id === selectedIndividualId)) {
      setSelectedIndividualId(firstLedgerStudent.id);
    }
  }, [familyLedger.students, selectedIndividualId, selectedIsAlumni]);

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
      alert('No pending-fee email recipients found.');
      return;
    }

    setIsSendingReminder(true);
    try {
      const result = await sendGmailMessages(recipients.map(buildFeeReminderMessage));
      alert(`Email reminders sent successfully to ${result.sent || recipients.length} guardian account(s).`);
    } catch (error) {
      alert(`Email reminder failed: ${error.message}`);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const sendReceiptMail = async (receipt) => {
    const receiptMessage = buildReceiptMessage(receipt);

    if (!receiptMessage.to) {
      alert('Guardian email is missing for this receipt.');
      return;
    }

    setIsSendingReceiptMail(true);
    try {
      await sendGmailMessages(receiptMessage);
      alert(`Receipt mailed successfully to ${receiptMessage.to}.`);
    } catch (error) {
      alert(`Receipt email failed: ${error.message}`);
    } finally {
      setIsSendingReceiptMail(false);
    }
  };

  const openAssignModal = () => {
    if (!ledgerStudent) return;
    setAssignClassName(ledgerStudent.className || classOrder[0] || '');
    setAssignAmount('');
    setAssignNote('');
    setShowAssignModal(true);
  };

  const persistStudentUpdate = (updatedStudent) => {
    if (selectedIsAlumni) {
      setAlumniPending((current) =>
        (Array.isArray(current) ? current : []).map((student) =>
          getStudentAdmissionNumber(student) === getStudentAdmissionNumber(updatedStudent) ? updatedStudent : student
        )
      );
      return;
    }
    masterData.actions.setStudents(
      masterData.raw.students.map((student, index) => {
        const normalized = normalizeFinanceStudent(student, index);
        return normalized.admissionNumber === getStudentAdmissionNumber(updatedStudent) ? updatedStudent : student;
      })
    );
  };

  const executeFeeAssignment = (event) => {
    event.preventDefault();
    const amount = parseAmount(assignAmount);
    const target = assignClassName.trim();

    if (!ledgerStudent) {
      alert('Select a student before assigning fees.');
      return;
    }
    if (!target) {
      alert('Choose a class to assign fees for.');
      return;
    }
    if (amount <= 0) {
      alert('Enter a valid fee amount.');
      return;
    }

    const updated = assignClassFeeToStudent(ledgerStudent, target, amount, assignNote);
    persistStudentUpdate(updated);
    setShowAssignModal(false);
    setAssignAmount('');
    setAssignNote('');
    alert(`Fee of ${formatCurrency(amount)} set for ${target}.`);
  };

  const notifyFeePayment = (admissionNumber, amount) => {
    if (!admissionNumber) return;
    apiFetch('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Fee Payment Received',
        description: `A payment of ${formatCurrency(amount)} was recorded to your account.`,
        type: 'fee',
        linkPage: 'Fees',
        recipientRole: 'student',
        recipientStudentId: admissionNumber,
      }),
    }).catch((error) => {
      console.warn('Failed to send fee payment notification', error);
    });
  };

  const executeManualPayment = (event) => {
    event.preventDefault();
    const amount = parseAmount(inputAmount);
    if (amount <= 0) {
      alert('Enter a valid payment amount.');
      return;
    }

    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
    const nowISO = new Date().toISOString();

    if (selectedIsAlumni) {
      if (!ledgerStudent) {
        alert('No alumni record selected.');
        return;
      }
      const result = collectStudentPayment(ledgerStudent, amount, classOrder, receiptNo, nowISO);
      if (!result.breakdown.length) {
        alert('No pending balance found for this record.');
        return;
      }

      const stillPending = studentHasPending(result.student);
      setAlumniPending((current) => {
        const list = Array.isArray(current) ? current : [];
        if (!stillPending) {
          return list.filter(
            (student) => getStudentAdmissionNumber(student) !== getStudentAdmissionNumber(result.student)
          );
        }
        return list.map((student) =>
          getStudentAdmissionNumber(student) === getStudentAdmissionNumber(result.student) ? result.student : student
        );
      });

      const receipt = buildClassWiseReceipt({
        payerName: getStudentDisplayName(result.student),
        admissionNumber: getStudentAdmissionNumber(result.student),
        amount,
        breakdown: result.breakdown,
        mode: 'individual',
        contact: result.student.guardianPhone,
        guardianEmail: result.student.guardianEmail,
      });
      setLatestReceipt(receipt);
      setInputAmount('');
      try {
        localStorage.setItem('latest_invoice_payload', JSON.stringify(receipt));
      } catch (error) {
        console.warn('Failed to persist invoice payload', error);
      }
      notifyFeePayment(getStudentAdmissionNumber(result.student), amount);
      if (typeof setActivePage === 'function') setActivePage('Fees Receipt');
      else setCurrentView('receipt');
      if (!stillPending) {
        setCurrentView('alumni');
      }
      return;
    }

    if (paymentMode === 'individual') {
      const targetStudent = familyLedger.students.find(
        (student) => student.id === selectedIndividualId || student.admissionNumber === selectedIndividualId
      );
      if (!targetStudent) {
        alert('Select a student to collect payment for.');
        return;
      }

      const result = collectStudentPayment(targetStudent, amount, classOrder, receiptNo, nowISO);
      if (!result.breakdown.length) {
        alert('No pending balance found for the selected student.');
        return;
      }

      masterData.actions.setStudents(
        masterData.raw.students.map((student, index) => {
          const normalized = normalizeFinanceStudent(student, index);
          return normalized.admissionNumber === getStudentAdmissionNumber(result.student) ? result.student : student;
        })
      );

      const receipt = buildClassWiseReceipt({
        payerName: getStudentDisplayName(result.student),
        admissionNumber: getStudentAdmissionNumber(result.student),
        amount,
        breakdown: result.breakdown,
        mode: 'individual',
        contact: familyLedger.contact,
        guardianEmail: familyLedger.guardianEmail,
      });
      setLatestReceipt(receipt);
      setInputAmount('');
      try {
        localStorage.setItem('latest_invoice_payload', JSON.stringify(receipt));
      } catch (error) {
        console.warn('Failed to persist invoice payload', error);
      }
      notifyFeePayment(getStudentAdmissionNumber(result.student), amount);
      if (typeof setActivePage === 'function') setActivePage('Fees Receipt');
      else setCurrentView('receipt');
      return;
    }

    // family mode
    const result = collectFamilyPayment(familyLedger.students, amount, classOrder, receiptNo, nowISO);
    if (!result.breakdown.length) {
      alert('No pending balance found for this family.');
      return;
    }

    const updatedByAdmission = new Map(
      result.students.map((student) => [getStudentAdmissionNumber(student), student])
    );
    masterData.actions.setStudents(
      masterData.raw.students.map((student, index) => {
        const normalized = normalizeFinanceStudent(student, index);
        const updated = updatedByAdmission.get(normalized.admissionNumber);
        return updated || student;
      })
    );

    const receipt = buildClassWiseReceipt({
      payerName: familyLedger.fatherName || familyLedger.motherName || 'Guardian',
      admissionNumber: familyLedger.selectedStudent?.admissionNumber || '',
      amount,
      breakdown: result.breakdown,
      mode: 'family',
      contact: familyLedger.contact,
      guardianEmail: familyLedger.guardianEmail,
    });
    setLatestReceipt(receipt);
    setInputAmount('');
    try {
      localStorage.setItem('latest_invoice_payload', JSON.stringify(receipt));
    } catch (error) {
      console.warn('Failed to persist invoice payload', error);
    }
    const perStudentTotals = new Map();
    result.breakdown.forEach((row) => {
      if (!row.admissionNumber) return;
      perStudentTotals.set(row.admissionNumber, (perStudentTotals.get(row.admissionNumber) || 0) + parseAmount(row.amount));
    });
    perStudentTotals.forEach((studentAmount, admissionNumber) => notifyFeePayment(admissionNumber, studentAmount));
    if (typeof setActivePage === 'function') setActivePage('Fees Receipt');
    else setCurrentView('receipt');
  };

  const openLedger = (student, isAlumni = false) => {
    setSelectedIsAlumni(isAlumni);
    setSelectedAdmissionNumber(student.admissionNumber);
    setPaymentMode('individual');
    setSelectedIndividualId(student.id);
    setCurrentView('ledger');
  };

  return (
    <div className="w-full min-h-screen p-6 text-neutral-800 font-sans box-border select-none">
      {currentView === 'dashboard' && (
        <div className="animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2 text-neutral-900">
                Institutional Finance Ledger <Sparkles className="w-5 h-5 text-neutral-700" />
              </h2>
              <p className="text-xs text-neutral-600 font-medium font-mono mt-1">
                Class-wise fee ledger shared across Student Management, Dashboard, Class Finance, and Fee Receipt.
              </p>
            </div>
            <div className="flex items-center gap-2 glass-card p-1.5 rounded-2xl">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 text-neutral-500 font-mono">
                Reminders:
              </span>
              <button
                type="button"
                onClick={() => triggerBroadcastReminders('gmail')}
                disabled={isSendingReminder}
                className="flex items-center gap-1 text-[10px] font-black bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-xl transition-all disabled:opacity-60"
              >
                <Mail className="w-3.5 h-3.5 text-red-500" /> Via Email
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
                <div key={card.id} className="glass-card p-5 rounded-2xl">
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

          <div className="w-full glass-card p-5 rounded-2xl mb-6">
            <div className="w-full h-64 font-mono text-[10px] font-bold">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="month" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip content={<FinanceTooltip />} />
                  <Legend />
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
                  {/* Class-wise numbers stay in each row so the tooltip still shows per-class breakdown. */}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-600 mb-4 font-mono">
            Classwise Accounts Index
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {classSummaries.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => {
                  setSelectedClassName(cls.className);
                  setSearchTerm('');
                  setCurrentView('list');
                }}
                className="glass-card glass-hover p-5 rounded-2xl cursor-pointer transition-all text-left"
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

          <button
            type="button"
            onClick={() => setCurrentView('alumni')}
            className="w-full glass-card glass-hover p-5 rounded-2xl cursor-pointer transition-all text-left flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-center">
                <UserX className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-black text-neutral-900">Pending · Alumni (Passed-out / Left)</h3>
                <p className="text-[10px] text-neutral-500 font-semibold mt-0.5">
                  {alumniTotals.count} record(s) with outstanding dues
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-red-100 text-red-700 px-2.5 py-1.5 rounded-lg font-black font-mono">
                Pend: {formatCurrency(alumniTotals.pending)}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-800" />
            </div>
          </button>
        </div>
      )}

      {currentView === 'list' && (
        <div className="animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="p-2 bg-white/60 border border-white/80 rounded-xl hover:bg-white/80 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900">
                {selectedClassName} Financial Log
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative bg-white/60 border border-white/80 rounded-xl flex items-center px-3 py-1.5 w-full sm:w-64">
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
                className="flex items-center gap-1.5 text-[10px] font-black bg-white/60 border border-white/80 px-3 py-2.5 rounded-xl hover:bg-white/80 transition-all"
              >
                <ArrowUpDown className="w-3.5 h-3.5" /> Sort Due: {sortOrder}
              </button>
            </div>
          </div>

          <div className="w-full glass-card rounded-2xl overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[960px]">
                <thead>
                  <tr className="bg-indigo-50/60 border-b border-slate-100/80 text-[10px] font-black uppercase text-slate-500 font-mono">
                    <th className="py-3 px-4">Adm. Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Father's Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-center">Class Status</th>
                    <th className="py-3 px-4 text-right">{selectedClassName} Fee</th>
                    <th className="py-3 px-4 text-right">{selectedClassName} Paid</th>
                    <th className="py-3 px-4 text-right">{selectedClassName} Pending</th>
                    <th className="py-3 px-4 text-right">Overall Pending</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {selectedClassStudents.map((student) => (
                    <tr key={student.admissionNumber} className="hover:bg-white/60">
                      <td className="py-3.5 px-4 font-mono font-bold text-neutral-600">{student.admissionNumber}</td>
                      <td className="py-3.5 px-4 font-bold text-neutral-900">
                        <span className="inline-flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5 text-neutral-500" />
                          {student.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-600">{student.fatherName || '-'}</td>
                      <td className="py-3.5 px-4 font-mono text-neutral-500">{student.guardianPhone || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={student.currentClassStatus} />
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-800">
                        {formatCurrency(student.currentClassAssigned)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(student.currentClassPaid)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-red-500">
                        {formatCurrency(student.currentClassPending)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-500">
                        {formatCurrency(student.overallPending)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => openLedger(student, false)}
                          className="inline-flex items-center gap-1 text-[10px] font-black bg-neutral-100 border border-neutral-300 px-3 py-1.5 rounded-xl hover:bg-neutral-800 hover:text-white transition-all"
                        >
                          <Eye className="w-3 h-3" /> View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!selectedClassStudents.length && (
                    <tr>
                      <td colSpan="10" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
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

      {currentView === 'alumni' && (
        <div className="animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="p-2 bg-white/60 border border-white/80 rounded-xl hover:bg-white/80 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900 flex items-center gap-2">
                <UserX className="w-5 h-5 text-amber-700" /> Pending · Alumni (Passed-out / Left)
              </h2>
            </div>
            <span className="text-[10px] bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-black font-mono">
              Total Outstanding: {formatCurrency(alumniTotals.pending)}
            </span>
          </div>

          <div className="w-full glass-card rounded-2xl overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-amber-50/60 border-b border-slate-100/80 text-[10px] font-black uppercase text-slate-500 font-mono">
                    <th className="py-3 px-4">Adm. Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Last Class</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Total Fees</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Pending</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {alumniList.map((student) => {
                    const t = studentFeeTotals(student);
                    return (
                      <tr key={student.admissionNumber} className="hover:bg-white/60">
                        <td className="py-3.5 px-4 font-mono font-bold text-neutral-600">{student.admissionNumber}</td>
                        <td className="py-3.5 px-4 font-bold text-neutral-900">
                          <span className="inline-flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            {student.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-neutral-600">{student.className}</td>
                        <td className="py-3.5 px-4 font-mono text-neutral-500">{student.guardianPhone || '-'}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-neutral-800">
                          {formatCurrency(t.assigned)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                          {formatCurrency(t.paid)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-red-500">
                          {formatCurrency(t.pending)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => openLedger(student, true)}
                            className="inline-flex items-center gap-1 text-[10px] font-black bg-neutral-100 border border-neutral-300 px-3 py-1.5 rounded-xl hover:bg-neutral-800 hover:text-white transition-all"
                          >
                            <Eye className="w-3 h-3" /> View / Collect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!alumniList.length && (
                    <tr>
                      <td colSpan="8" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        No alumni records with pending dues.
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
              onClick={() => setCurrentView(selectedIsAlumni ? 'alumni' : 'list')}
              className="p-2 bg-white/60 border border-white/80 rounded-xl hover:bg-white/80 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-black uppercase text-neutral-900">
                {selectedIsAlumni ? 'Alumni Ledger' : 'Family Ledger'}: {ledgerStudent ? getStudentDisplayName(ledgerStudent) : 'Student'}
              </h2>
              <p className="text-xs text-neutral-600 font-mono">
                {selectedIsAlumni ? `Last Class: ${ledgerStudent?.className || '-'}` : `Family ID: ${familyLedger.familyId}`}
              </p>
            </div>
            {selectedIsAlumni && (
              <span className="text-[9px] bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg font-black font-mono uppercase">
                Passed-out / Left
              </span>
            )}
          </div>

          <div className="glass-card p-5 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Father Name</span><p className="text-sm font-bold">{ledgerStudent?.fatherName || '-'}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Mother Name</span><p className="text-sm font-bold">{ledgerStudent?.motherName || '-'}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Contact</span><p className="text-sm font-bold font-mono">{ledgerStudent?.guardianPhone || '-'}</p></div>
            <div><span className="text-[9px] font-black text-neutral-400 block font-mono">Category</span><p className="text-sm font-bold uppercase">{ledgerStudent?.category || '-'}</p></div>
          </div>

          {!selectedIsAlumni && ledgerSiblings.length > 1 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 bg-indigo-50/60 border-b border-slate-100/80 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase font-mono text-neutral-500">Connected Sibling Registers</h3>
                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-black font-mono">
                  Total Family Dues: {formatCurrency(familyLedger.totalPending)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[820px]">
                  <thead>
                    <tr className="bg-indigo-50/60 border-b border-slate-100/80 text-[9px] font-black text-neutral-400 font-mono">
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Class</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Total Fees</th>
                      <th className="p-3 text-right">Cumulative Paid</th>
                      <th className="p-3 text-right">Unpaid Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                    {familyLedger.students.map((student) => (
                      <tr
                        key={student.admissionNumber}
                        className={`hover:bg-white/60 cursor-pointer ${
                          student.admissionNumber === selectedAdmissionNumber ? 'bg-indigo-50/40' : ''
                        }`}
                        onClick={() => setSelectedAdmissionNumber(student.admissionNumber)}
                      >
                        <td className="p-3 font-bold text-neutral-900">{student.name}</td>
                        <td className="p-3 font-mono">{student.className}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-black ${student.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-neutral-800 font-bold font-mono">{formatCurrency(student.yearlyFee)}</td>
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
          )}

          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 bg-indigo-50/60 border-b border-slate-100/80 flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-xs font-black uppercase font-mono text-neutral-500 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Class-wise Fee Ledger
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-black font-mono">
                  Pending: {formatCurrency(ledgerFeeTotals.pending)}
                </span>
                <button
                  type="button"
                  onClick={openAssignModal}
                  className="inline-flex items-center gap-1 text-[10px] font-black bg-neutral-900 text-white px-3 py-1.5 rounded-xl hover:bg-neutral-800 transition-all"
                >
                  <DollarSign className="w-3 h-3" /> Assign Fee
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="bg-indigo-50/60 border-b border-slate-100/80 text-[9px] font-black text-neutral-400 font-mono">
                    <th className="p-3">Class</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Assigned</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Pending</th>
                    <th className="p-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.className} className="hover:bg-white/60">
                      <td className="p-3 font-bold text-neutral-900">{entry.className}</td>
                      <td className="p-3 text-center"><StatusBadge status={entryStatus(entry)} /></td>
                      <td className="p-3 text-right font-mono font-bold text-neutral-800">{formatCurrency(entry.assigned)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(entry.paid)}</td>
                      <td className={`p-3 text-right font-mono font-bold ${entryPending(entry) > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                        {formatCurrency(entryPending(entry))}
                      </td>
                      <td className="p-3 text-neutral-500">{entry.note || '-'}</td>
                    </tr>
                  ))}
                  {!ledgerEntries.length && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        No class fee assigned yet. Use "Assign Fee" to set one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-5 rounded-2xl md:col-span-2 space-y-4">
              <h4 className="text-xs font-black uppercase text-neutral-900 flex items-center gap-1"><CreditCard className="w-4 h-4" /> Fee Collection</h4>
              <form onSubmit={executeManualPayment} className="space-y-4">
                {!selectedIsAlumni && (
                  <div className="flex flex-wrap gap-4 bg-white/50 p-3 rounded-xl border border-slate-100/80 text-xs font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={paymentMode === 'individual'} onChange={() => setPaymentMode('individual')} />
                      Individual Payment
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" checked={paymentMode === 'family'} onChange={() => setPaymentMode('family')} />
                      Family Distribution
                    </label>
                  </div>
                )}
                {!selectedIsAlumni && paymentMode === 'individual' && (
                  <select
                    value={selectedIndividualId}
                    onChange={(event) => setSelectedIndividualId(event.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none"
                  >
                    {familyLedger.students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({student.className}) - Due: {formatCurrency(student.pendingFees)}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-neutral-500 font-semibold bg-white/50 p-2.5 rounded-xl border border-slate-100/80">
                  Amount waterfalls into unpaid classes in class-preference order (lowest class first).
                </p>
                <div className="relative flex items-center bg-white/60 border border-white/80 rounded-xl px-3 py-1">
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

            <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-neutral-900 mb-3">Ledger Policy</h4>
                <p className="text-[11px] text-neutral-600 leading-relaxed font-semibold">
                  Passed-out or TC-issued students stay visible in the Alumni bucket while balances are positive.
                  Clearing a payment updates the shared ledger and removes the record automatically once dues are
                  fully cleared.
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
            <p><strong>Payer:</strong> {latestReceipt.payerName || '-'}</p>
            <p><strong>Registered Mobile:</strong> {latestReceipt.contact || '-'}</p>
          </div>
          <div className="space-y-2 font-mono text-xs">
            <p className="text-[9px] font-black uppercase text-neutral-400 font-mono">Class-wise Allocation</p>
            {latestReceipt.breakdown?.map((item, index) => (
              <div key={`${item.admissionNumber || ''}-${item.className}-${index}`} className="p-2 flex justify-between border-b border-neutral-100">
                <span>{item.name ? `${item.name} · ` : ''}{item.className}</span>
                <span className="font-bold">{formatCurrency(item.amount)}</span>
              </div>
            ))}
            <div className="p-3 bg-neutral-900 text-white flex justify-between rounded-xl font-black">
              <span>Total Collected</span><span>{formatCurrency(latestReceipt.amountPaid)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"><Printer className="w-3.5 h-3.5" /> Print</button>
            <button type="button" onClick={() => alert(`WhatsApp alert queued for ${latestReceipt.contact || 'guardian'}.`)} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"><MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp</button>
            <button type="button" onClick={() => sendReceiptMail(latestReceipt)} disabled={isSendingReceiptMail} className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl disabled:opacity-60"><Mail className="w-3.5 h-3.5 text-red-500" /> {isSendingReceiptMail ? 'Sending...' : 'Email'}</button>
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

      {showAssignModal && ledgerStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-white/95 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black uppercase text-neutral-900 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Assign / Edit Class Fee
              </h4>
              <button type="button" onClick={() => setShowAssignModal(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-neutral-600 font-semibold">
              Set the fee amount for {getStudentDisplayName(ledgerStudent)}. Choose the class this fee applies to.
            </p>
            <form onSubmit={executeFeeAssignment} className="space-y-3">
              <div>
                <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Class</span>
                <select
                  value={assignClassName}
                  onChange={(event) => setAssignClassName(event.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                >
                  {(classOrder.length ? classOrder : masterData.classNames).map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                  {!classOrder.includes(ledgerStudent.className) && ledgerStudent.className && (
                    <option value={ledgerStudent.className}>{ledgerStudent.className}</option>
                  )}
                </select>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Amount</span>
                <div className="relative flex items-center bg-white border border-neutral-300 rounded-xl px-3 py-1">
                  <span className="text-sm font-mono font-black mr-2">Rs.</span>
                  <input
                    type="number"
                    value={assignAmount}
                    onChange={(event) => setAssignAmount(event.target.value)}
                    placeholder="Fee amount"
                    className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold"
                  />
                </div>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Note (optional)</span>
                <input
                  type="text"
                  value={assignNote}
                  onChange={(event) => setAssignNote(event.target.value)}
                  placeholder="Accounts note"
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2.5 text-center text-xs font-black border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-md"
                >
                  Save Fee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Finance;
