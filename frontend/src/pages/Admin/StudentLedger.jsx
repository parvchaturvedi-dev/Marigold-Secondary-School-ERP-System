import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  Layers,
  Mail,
  MessageSquare,
  Printer,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { sendGmailMessages } from '../../components/common/gmail';
import { useMasterData } from '../../components/common/masterData';
import {
  assignClassFeeToStudent,
  buildClassWiseReceipt,
  buildFamilyLedger,
  collectFamilyPayment,
  collectStudentPayment,
  entryPending,
  entryStatus,
  ensureFeeLedger,
  formatCurrency,
  getClassOrder,
  getStudentAdmissionNumber,
  getStudentDisplayName,
  ledgerTotals,
  parseAmount,
  sortedFeeLedger,
} from '../../components/common/financeData';

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
      (item) => `- ${item.name ? `${item.name} - ` : ''}${item.className}: ${formatCurrency(item.amount)}`
    ),
    '',
    'Regards,',
    'Accounts Department',
    'MGPS ERP Portal',
  ].join('\n'),
});

const getRouteAdmissionNumber = () => {
  try {
    return new URLSearchParams(window.location.search).get('admNo') || '';
  } catch {
    return '';
  }
};

const StatusBadge = ({ status }) => {
  const styles =
    status === 'Paid'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'Partial'
        ? 'bg-amber-100 text-amber-700 border border-amber-300'
        : 'bg-red-100 text-red-700 border border-red-200';
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-md font-black tracking-wider uppercase font-mono ${styles}`}>
      {status}
    </span>
  );
};

const ClassLedgerTable = ({ student, classOrder }) => {
  const [expandedClass, setExpandedClass] = useState('');
  const ledger = useMemo(() => sortedFeeLedger(ensureFeeLedger(student), classOrder), [student, classOrder]);
  const totals = useMemo(() => ledgerTotals(ledger), [ledger]);

  if (!ledger.length) {
    return (
      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 py-6 text-center">
        No class fee rows yet for this student.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[720px]">
        <thead>
          <tr className="bg-neutral-50 border-b border-neutral-200 text-[9px] font-black uppercase tracking-wider text-neutral-400 font-mono">
            <th className="p-3 w-6"></th>
            <th className="p-3">Class</th>
            <th className="p-3 text-right">Assigned</th>
            <th className="p-3 text-right">Paid</th>
            <th className="p-3 text-right">Pending</th>
            <th className="p-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-800">
          {ledger.map((entry) => {
            const isOpen = expandedClass === entry.className;
            const pending = entryPending(entry);
            const status = entryStatus(entry);
            return (
              <React.Fragment key={entry.className}>
                <tr
                  className="hover:bg-neutral-50/50 cursor-pointer"
                  onClick={() => setExpandedClass(isOpen ? '' : entry.className)}
                >
                  <td className="p-3 text-neutral-400">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </td>
                  <td className="p-3 font-bold text-neutral-900">{entry.className}</td>
                  <td className="p-3 text-right font-mono font-bold text-neutral-800">
                    {formatCurrency(entry.assigned)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600">
                    {formatCurrency(entry.paid)}
                  </td>
                  <td className={`p-3 text-right font-mono font-bold ${pending > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                    {pending > 0 ? formatCurrency(pending) : 'Cleared'}
                  </td>
                  <td className="p-3 text-center">
                    <StatusBadge status={status} />
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-neutral-50/70">
                    <td></td>
                    <td colSpan="5" className="p-3">
                      {entry.note && (
                        <p className="text-[10px] text-neutral-500 font-semibold mb-2">Note: {entry.note}</p>
                      )}
                      {entry.payments.length ? (
                        <div className="rounded-xl border border-neutral-200 overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-white border-b border-neutral-200 text-[8px] font-black uppercase tracking-wider text-neutral-400 font-mono">
                                <th className="p-2">Amount</th>
                                <th className="p-2">Date</th>
                                <th className="p-2">Mode</th>
                                <th className="p-2">Receipt No.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 text-[11px] font-mono">
                              {entry.payments.map((payment) => (
                                <tr key={payment.id}>
                                  <td className="p-2 font-bold text-neutral-800">{formatCurrency(payment.amount)}</td>
                                  <td className="p-2 text-neutral-600">
                                    {new Date(payment.date).toLocaleDateString()}
                                  </td>
                                  <td className="p-2 text-neutral-600">{payment.mode}</td>
                                  <td className="p-2 text-neutral-500">{payment.receiptNo || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                          No payments recorded for this class yet.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-neutral-900 text-white text-xs font-black">
            <td className="p-3"></td>
            <td className="p-3 uppercase tracking-widest text-[10px]">Total</td>
            <td className="p-3 text-right font-mono">{formatCurrency(totals.assigned)}</td>
            <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(totals.paid)}</td>
            <td className="p-3 text-right font-mono text-red-400">{formatCurrency(totals.pending)}</td>
            <td className="p-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const StudentLedger = () => {
  const masterData = useMasterData();
  const classOrder = useMemo(() => getClassOrder(masterData.raw.classPreferences), [masterData.raw.classPreferences]);
  const [activeView, setActiveView] = useState('ledger');
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [paymentMode, setPaymentMode] = useState('family');
  const [selectedIndividualId, setSelectedIndividualId] = useState('');
  const [feeAssignmentStudentId, setFeeAssignmentStudentId] = useState('');
  const [feeAssignmentClassName, setFeeAssignmentClassName] = useState('');
  const [feeAssignmentAmount, setFeeAssignmentAmount] = useState('');
  const [feeAssignmentNote, setFeeAssignmentNote] = useState('');
  const [isSendingFeeAssignmentMail, setIsSendingFeeAssignmentMail] = useState(false);
  const [inputAmount, setInputAmount] = useState('');
  const [latestReceipt, setLatestReceipt] = useState(null);
  const [ledgerStudentId, setLedgerStudentId] = useState('');
  const selectedAdmissionNumber = getRouteAdmissionNumber();

  const familyProfile = useMemo(
    () => buildFamilyLedger(masterData.raw.students, selectedAdmissionNumber),
    [masterData.raw.students, selectedAdmissionNumber]
  );

  useEffect(() => {
    const firstStudent = familyProfile.students[0];
    if (firstStudent && !familyProfile.students.some((student) => student.id === selectedIndividualId)) {
      setSelectedIndividualId(firstStudent.id);
    }
  }, [familyProfile.students, selectedIndividualId]);

  useEffect(() => {
    const firstStudent = familyProfile.students[0];
    const hasSelected = familyProfile.students.some(
      (student) => student.id === feeAssignmentStudentId || student.admissionNumber === feeAssignmentStudentId
    );
    if (firstStudent && !hasSelected) {
      setFeeAssignmentStudentId(firstStudent.id);
    }
  }, [familyProfile.students, feeAssignmentStudentId]);

  useEffect(() => {
    const firstStudent = familyProfile.students[0];
    if (firstStudent && !familyProfile.students.some((student) => student.id === ledgerStudentId)) {
      setLedgerStudentId(firstStudent.id);
    }
  }, [familyProfile.students, ledgerStudentId]);

  const feeAssignmentStudent = useMemo(
    () =>
      familyProfile.students.find(
        (student) => student.id === feeAssignmentStudentId || student.admissionNumber === feeAssignmentStudentId
      ),
    [familyProfile.students, feeAssignmentStudentId]
  );

  useEffect(() => {
    if (!feeAssignmentStudent) return;
    const ledger = sortedFeeLedger(ensureFeeLedger(feeAssignmentStudent), classOrder);
    const hasCurrent = ledger.some((entry) => entry.className === feeAssignmentClassName);
    if (!hasCurrent) {
      setFeeAssignmentClassName(ledger[0]?.className || feeAssignmentStudent.className || '');
    }
  }, [feeAssignmentStudent, classOrder, feeAssignmentClassName]);

  const ledgerStudent = useMemo(
    () => familyProfile.students.find((student) => student.id === ledgerStudentId) || familyProfile.students[0],
    [familyProfile.students, ledgerStudentId]
  );

  const sendReceiptMail = async (receipt, mode = 'manual') => {
    const message = buildReceiptMessage(receipt);

    if (!message.to) {
      alert('Guardian email is missing for this receipt.');
      return;
    }

    setIsSendingMail(true);
    try {
      await sendGmailMessages(message);
      if (mode === 'manual') alert('Receipt sent via email.');
    } catch (error) {
      const prefix = mode === 'auto' ? 'Receipt was saved, but email failed' : 'Receipt email failed';
      alert(`${prefix}: ${error.message}`);
    } finally {
      setIsSendingMail(false);
    }
  };

  const executeFeeAssignment = async (event) => {
    event.preventDefault();
    const amount = parseAmount(feeAssignmentAmount);
    const targetStudent = feeAssignmentStudent;

    if (!targetStudent) {
      alert('Select a student before assigning fees.');
      return;
    }

    if (!feeAssignmentClassName) {
      alert('Select a class before assigning fees.');
      return;
    }

    if (amount <= 0) {
      alert('Enter a valid class fee amount.');
      return;
    }

    const updatedStudent = assignClassFeeToStudent(targetStudent, feeAssignmentClassName, amount, feeAssignmentNote);

    // Replace the exact student record by admission number.
    const targetAdmission = getStudentAdmissionNumber(targetStudent);
    const merged = masterData.raw.students.map((student) =>
      (student.admissionNumber || student.admNo || student.id) === targetAdmission
        ? { ...student, ...updatedStudent }
        : student
    );

    masterData.actions.setStudents(merged);
    setFeeAssignmentAmount('');
    setFeeAssignmentNote('');

    const guardianEmail = targetStudent.guardianEmail;
    if (!guardianEmail) {
      alert('Class fee saved, but guardian email is missing for this student.');
      return;
    }

    setIsSendingFeeAssignmentMail(true);
    try {
      await sendGmailMessages({
        to: guardianEmail,
        subject: `Fee Assigned: ${getStudentDisplayName(targetStudent)}`,
        text: [
          `Dear ${targetStudent.fatherName || 'Parent/Guardian'},`,
          '',
          'This is an official fee assignment notice from Marigold Secondary School, Behror.',
          '',
          `Student: ${getStudentDisplayName(targetStudent)} (${targetAdmission})`,
          `Class: ${feeAssignmentClassName}`,
          `Class fee fixed: ${formatCurrency(amount)}`,
          feeAssignmentNote ? `Accounts note: ${feeAssignmentNote}` : '',
          '',
          'Please keep this message for your records. For any clarification, contact the school accounts office.',
          '',
          'Regards,',
          'Accounts Department',
          'Marigold Secondary School, Behror',
        ]
          .filter(Boolean)
          .join('\n'),
      });
      alert(`Class fee saved and email notice sent to ${guardianEmail}.`);
    } catch (error) {
      alert(`Class fee saved, but email notice failed: ${error.message}`);
    } finally {
      setIsSendingFeeAssignmentMail(false);
    }
  };

  const executeManualPayment = async (event) => {
    event.preventDefault();
    const amount = parseAmount(inputAmount);
    if (amount <= 0) {
      alert('Enter a valid transaction value.');
      return;
    }

    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;

    if (paymentMode === 'individual') {
      const targetStudent = familyProfile.students.find(
        (student) => student.id === selectedIndividualId || student.admissionNumber === selectedIndividualId
      );
      if (!targetStudent) {
        alert('Select a student before collecting payment.');
        return;
      }

      const { student: updatedStudent, breakdown, remaining } = collectStudentPayment(
        targetStudent,
        amount,
        classOrder,
        receiptNo
      );

      if (!breakdown.length) {
        alert('No pending balance found for this student.');
        return;
      }

      const targetAdmission = getStudentAdmissionNumber(targetStudent);
      const merged = masterData.raw.students.map((student) =>
        (student.admissionNumber || student.admNo || student.id) === targetAdmission
          ? { ...student, ...updatedStudent }
          : student
      );
      masterData.actions.setStudents(merged);

      const receipt = buildClassWiseReceipt({
        payerName: getStudentDisplayName(targetStudent),
        admissionNumber: targetAdmission,
        amount: amount - remaining,
        breakdown: breakdown.map((row) => ({ ...row, name: getStudentDisplayName(targetStudent) })),
        mode: 'individual',
        contact: targetStudent.guardianPhone,
        guardianEmail: targetStudent.guardianEmail,
      });
      setLatestReceipt(receipt);
      setInputAmount('');
      setActiveView('receipt');

      try {
        localStorage.setItem('latest_invoice_payload', JSON.stringify(receipt));
      } catch (error) {
        console.warn('Failed to persist invoice payload', error);
      }

      await sendReceiptMail(receipt, 'auto');
      return;
    }

    const { students: updatedStudents, breakdown, remaining } = collectFamilyPayment(
      familyProfile.students,
      amount,
      classOrder,
      receiptNo
    );

    if (!breakdown.length) {
      alert('No pending balance found for this ledger.');
      return;
    }

    const updatedByAdmission = new Map(
      updatedStudents.map((student) => [getStudentAdmissionNumber(student), student])
    );
    const merged = masterData.raw.students.map((student) => {
      const admissionNumber = student.admissionNumber || student.admNo || student.id;
      const updated = updatedByAdmission.get(admissionNumber);
      return updated ? { ...student, ...updated } : student;
    });
    masterData.actions.setStudents(merged);

    const receipt = buildClassWiseReceipt({
      payerName: familyProfile.fatherName,
      admissionNumber: familyProfile.selectedStudent
        ? getStudentAdmissionNumber(familyProfile.selectedStudent)
        : '',
      amount: amount - remaining,
      breakdown,
      mode: 'family',
      contact: familyProfile.contact,
      guardianEmail: familyProfile.guardianEmail,
    });
    setLatestReceipt(receipt);
    setInputAmount('');
    setActiveView('receipt');

    try {
      localStorage.setItem('latest_invoice_payload', JSON.stringify(receipt));
    } catch (error) {
      console.warn('Failed to persist invoice payload', error);
    }

    await sendReceiptMail(receipt, 'auto');
  };

  return (
    <div className="w-full min-h-screen p-6 text-neutral-800 font-sans box-border select-none">
      {activeView === 'ledger' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-neutral-400/60 pb-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="p-2 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-neutral-900 flex items-center gap-2">
                Secure Family Ledger Console <Sparkles className="w-4 h-4 text-neutral-600" />
              </h2>
              <p className="text-xs text-neutral-600 font-medium font-mono">
                Account Cluster: {familyProfile.familyId || 'No student selected'}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Father / Guardian</span>
              <p className="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-neutral-500" /> {familyProfile.fatherName || '-'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Mother Name</span>
              <p className="text-sm font-bold text-neutral-800">{familyProfile.motherName || '-'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Contact</span>
              <p className="text-sm font-bold text-neutral-700 font-mono">{familyProfile.contact || '-'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase text-neutral-400 font-mono block">Category</span>
              <p className="text-sm font-bold text-neutral-700 uppercase tracking-wider">{familyProfile.category || '-'}</p>
            </div>
          </div>

          <div className="bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider font-mono text-neutral-500 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Connected Sibling Registers
              </h3>
              <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-md font-black font-mono">
                Total Dues: {formatCurrency(familyProfile.totalPending)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-[9px] font-black uppercase tracking-wider text-neutral-400 font-mono">
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Class</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Total Fees</th>
                    <th className="p-3 text-right">Cumulative Paid</th>
                    <th className="p-3 text-right">Unpaid Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs font-medium text-neutral-800">
                  {familyProfile.students.map((student) => {
                    const totals = ledgerTotals(ensureFeeLedger(student));
                    return (
                      <tr
                        key={student.admissionNumber}
                        className={`hover:bg-neutral-50/50 cursor-pointer ${ledgerStudentId === student.id ? 'bg-neutral-50' : ''}`}
                        onClick={() => setLedgerStudentId(student.id)}
                      >
                        <td className="p-3 font-bold text-neutral-900">{student.name}</td>
                        <td className="p-3 font-mono text-neutral-600">{student.className}</td>
                        <td className="p-3 text-center">
                          <span className={`text-[9px] px-2 py-0.5 rounded-md font-black tracking-wider uppercase font-mono ${student.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 border border-amber-300'}`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-neutral-800">{formatCurrency(totals.assigned)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(totals.paid)}</td>
                        <td className={`p-3 text-right font-mono font-bold ${totals.pending > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                          {totals.pending > 0 ? formatCurrency(totals.pending) : 'Cleared'}
                        </td>
                      </tr>
                    );
                  })}
                  {!familyProfile.students.length && (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        No live student ledger found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-neutral-300 rounded-2xl shadow-md overflow-hidden">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider font-mono text-neutral-500 flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Class-Wise Fee Breakdown
                {ledgerStudent && <span className="text-neutral-800 normal-case font-bold ml-1">- {ledgerStudent.name}</span>}
              </h3>
              {familyProfile.students.length > 1 && (
                <select
                  value={ledgerStudentId}
                  onChange={(event) => setLedgerStudentId(event.target.value)}
                  className="p-2 bg-white border border-neutral-300 rounded-lg text-[10px] font-bold outline-none text-neutral-800"
                >
                  {familyProfile.students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.className})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {ledgerStudent ? (
              <ClassLedgerTable student={ledgerStudent} classOrder={classOrder} />
            ) : (
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 py-6 text-center">
                No student selected.
              </p>
            )}
          </div>

          <form onSubmit={executeFeeAssignment} className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-neutral-700" /> Assign / Edit Class Fee
                </h4>
                <p className="mt-1 text-[11px] text-neutral-600 leading-relaxed font-semibold">
                  Fix the fee for one class on this student's ledger. Paid amount for that class carries over automatically.
                </p>
              </div>
              <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg">
                Email notice auto-sends
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_1fr_1.2fr_auto] gap-3">
              <select
                value={feeAssignmentStudentId}
                onChange={(event) => setFeeAssignmentStudentId(event.target.value)}
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold outline-none text-neutral-800"
              >
                {familyProfile.students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.className})
                  </option>
                ))}
              </select>
              <select
                value={feeAssignmentClassName}
                onChange={(event) => setFeeAssignmentClassName(event.target.value)}
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold outline-none text-neutral-800"
              >
                {(feeAssignmentStudent
                  ? sortedFeeLedger(ensureFeeLedger(feeAssignmentStudent), classOrder)
                  : []
                ).map((entry) => (
                  <option key={entry.className} value={entry.className}>
                    {entry.className} - Current {formatCurrency(entry.assigned)}
                  </option>
                ))}
                {feeAssignmentStudent && !ensureFeeLedger(feeAssignmentStudent).length && (
                  <option value={feeAssignmentStudent.className}>{feeAssignmentStudent.className}</option>
                )}
              </select>
              <div className="relative flex items-center bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1">
                <span className="text-sm font-black text-neutral-500 font-mono mr-2">Rs.</span>
                <input
                  type="number"
                  value={feeAssignmentAmount}
                  onChange={(event) => setFeeAssignmentAmount(event.target.value)}
                  placeholder="Class fee"
                  className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold text-neutral-900"
                />
              </div>
              <input
                type="text"
                value={feeAssignmentNote}
                onChange={(event) => setFeeAssignmentNote(event.target.value)}
                placeholder="Optional accounts note"
                className="w-full p-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold outline-none text-neutral-800"
              />
              <button
                type="submit"
                disabled={isSendingFeeAssignmentMail}
                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Mail className="w-3.5 h-3.5" /> {isSendingFeeAssignmentMail ? 'Sending' : 'Save Fee'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md md:col-span-2 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900 flex items-center gap-1">
                <CreditCard className="w-4 h-4 text-neutral-700" /> Secure Direct Collection Matrix
              </h4>

              <form onSubmit={executeManualPayment} className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 cursor-pointer">
                    <input type="radio" checked={paymentMode === 'family'} onChange={() => setPaymentMode('family')} className="accent-neutral-900" />
                    Family Distribution
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 cursor-pointer">
                    <input type="radio" checked={paymentMode === 'individual'} onChange={() => setPaymentMode('individual')} className="accent-neutral-900" />
                    Individual Payment
                  </label>
                </div>

                {paymentMode === 'individual' && (
                  <select
                    value={selectedIndividualId}
                    onChange={(event) => setSelectedIndividualId(event.target.value)}
                    className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none text-neutral-800"
                  >
                    {familyProfile.students.map((student) => {
                      const totals = ledgerTotals(ensureFeeLedger(student));
                      return (
                        <option key={student.id} value={student.id}>
                          {student.name} ({student.className}) - Due: {formatCurrency(totals.pending)}
                        </option>
                      );
                    })}
                  </select>
                )}

                <p className="text-[10px] text-neutral-500 font-semibold leading-relaxed">
                  Amount waterfalls across unpaid classes in class-preference order (lowest class first).
                </p>

                <div className="relative flex items-center bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1">
                  <span className="text-sm font-black text-neutral-500 font-mono mr-2">Rs.</span>
                  <input
                    type="number"
                    value={inputAmount}
                    onChange={(event) => setInputAmount(event.target.value)}
                    placeholder="Enter amount to credit..."
                    className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold text-neutral-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Commit Entry And Receipt
                </button>
              </form>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-300 shadow-md flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900 flex items-center gap-1.5 mb-3">
                  <Layers className="w-4 h-4 text-neutral-600" /> Ledger Sync
                </h4>
                <p className="text-[11px] text-neutral-600 leading-relaxed font-semibold">
                  This page now writes to the same student master records used by Finance, Dashboard, Class Finance,
                  and receipt generation.
                </p>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[10px] leading-relaxed text-amber-800 font-medium font-mono mt-3 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
                <span>Outstanding balances keep the ledger retained.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'receipt' && latestReceipt && (
        <div className="max-w-xl mx-auto bg-white border border-neutral-400 p-6 rounded-2xl shadow-2xl animate-scaleUp text-left space-y-6 select-text">
          <div className="text-center space-y-1 border-b border-dashed border-neutral-300 pb-4">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-black uppercase tracking-widest text-neutral-900">Institutional Audit Invoice</h3>
            <p className="text-[10px] font-mono text-neutral-500 font-bold">Transaction Ref: {latestReceipt.receiptNo}</p>
            <p className="text-[9px] font-mono text-neutral-400">{latestReceipt.timestamp}</p>
          </div>

          <div className="text-xs space-y-1.5 font-medium border-b border-neutral-100 pb-4">
            <p className="font-bold text-neutral-900 font-mono text-[10px] uppercase text-neutral-400 tracking-wider">Account Specifications:</p>
            <p><span className="text-neutral-500">Primary Guardian:</span> <strong className="text-neutral-900">{latestReceipt.payerName || '-'}</strong></p>
            <p><span className="text-neutral-500">Communication Link:</span> <strong className="text-neutral-800 font-mono">{latestReceipt.contact || '-'}</strong></p>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-wider block">Class-Wise Allocation:</span>
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 divide-y divide-neutral-200/60 font-mono text-xs overflow-hidden">
              {latestReceipt.breakdown.map((item, index) => (
                <div key={`${item.admissionNumber || item.name || 'row'}-${item.className}-${index}`} className="p-3 flex justify-between items-center font-bold">
                  <span className="text-neutral-700">
                    {item.name ? `${item.name} - ` : ''}
                    {item.className}
                  </span>
                  <span className="text-neutral-900">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="p-3 bg-neutral-900 text-white flex justify-between items-center font-black">
                <span className="uppercase tracking-widest text-[10px]">Total Remitted</span>
                <span>{formatCurrency(latestReceipt.amountPaid)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-4 border-t border-dashed border-neutral-200">
            <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 text-neutral-800 p-2.5 rounded-xl border border-neutral-300 transition-all shadow-sm">
              <Printer className="w-3.5 h-3.5 text-neutral-600" /> Print
            </button>
            <button type="button" onClick={() => alert(`Receipt queued to ${latestReceipt.contact || 'guardian'} on WhatsApp.`)} className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 text-neutral-800 p-2.5 rounded-xl border border-neutral-300 transition-all shadow-sm">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
            </button>
            <button type="button" onClick={() => sendReceiptMail(latestReceipt)} disabled={isSendingMail} className="flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 text-neutral-800 p-2.5 rounded-xl border border-neutral-300 transition-all shadow-sm disabled:opacity-60">
              <Mail className="w-3.5 h-3.5 text-red-500" /> {isSendingMail ? 'Sending...' : 'Email'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setLatestReceipt(null);
              setActiveView('ledger');
            }}
            className="w-full py-2.5 text-center text-xs font-black uppercase tracking-widest border border-neutral-800 text-neutral-800 hover:bg-neutral-900 hover:text-white rounded-xl transition-all"
          >
            Exit Statement Review
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentLedger;
