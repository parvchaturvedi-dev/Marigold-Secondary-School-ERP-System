import React, { useMemo, useState } from 'react';
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  CreditCard,
  DollarSign,
  Mail,
  Pencil,
  Printer,
  Search,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { useMongoState } from '../../components/common/mongoState';
import {
  currentMonthKey,
  nextMonthKey,
  getStaffName,
  getStaffId,
  buildPayrollLedger,
  staffPayrollTotals,
  applyPayrollMirrors,
  setStaffSalary,
  recordSalaryPayment,
  settleStaffOutstanding,
  buildSalarySlip,
  parseAmount,
  formatCurrency,
} from '../../components/common/payrollData';

const NAMESPACE_BY_TAB = {
  teachers: 'admin-teacher-management-list',
  clerks: 'admin-clerk-management-list',
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

const Payroll = ({ session }) => {
  const [activeTab, setActiveTab] = useState('teachers');
  const [teachers, setTeachers] = useMongoState(NAMESPACE_BY_TAB.teachers, []);
  const [clerks, setClerks] = useMongoState(NAMESPACE_BY_TAB.clerks, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState('');

  const [salaryModalStaff, setSalaryModalStaff] = useState(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryEffMonth, setSalaryEffMonth] = useState(nextMonthKey());

  const [payModalStaff, setPayModalStaff] = useState(null);
  const [payTab, setPayTab] = useState('settle'); // 'settle' | 'month'
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Bank');
  const [payNote, setPayNote] = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [salarySlip, setSalarySlip] = useState(null);

  const list = activeTab === 'teachers' ? teachers : clerks;
  const setList = activeTab === 'teachers' ? setTeachers : setClerks;

  const staffList = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    const normalized = arr.map((staff) => applyPayrollMirrors(staff));
    const term = searchTerm.trim().toLowerCase();
    return normalized
      .filter((staff) => {
        if (!term) return true;
        const haystack = `${getStaffName(staff)} ${getStaffId(staff)}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => getStaffName(a).localeCompare(getStaffName(b)));
  }, [list, searchTerm]);

  const summary = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    return arr.reduce(
      (acc, staff) => {
        const totals = staffPayrollTotals(staff);
        acc.count += 1;
        acc.monthlyPayroll += parseAmount(staff.monthlySalary);
        acc.paid += totals.paid;
        acc.pending += totals.pending;
        return acc;
      },
      { count: 0, monthlyPayroll: 0, paid: 0, pending: 0 }
    );
  }, [list]);

  const persistStaff = (updatedStaff) => {
    setList((current) =>
      (Array.isArray(current) ? current : []).map((staff) =>
        getStaffId(staff) === getStaffId(updatedStaff) ? updatedStaff : staff
      )
    );
  };

  const openSalaryModal = (staff) => {
    setSalaryModalStaff(staff);
    setSalaryAmount(staff.monthlySalary ? String(staff.monthlySalary) : '');
    setSalaryEffMonth(nextMonthKey());
  };

  const submitSalaryUpdate = (event) => {
    event.preventDefault();
    const amount = parseAmount(salaryAmount);
    if (amount <= 0) {
      alert('Enter a valid salary amount.');
      return;
    }
    const updated = setStaffSalary(salaryModalStaff, amount, salaryEffMonth);
    persistStaff(updated);
    setSalaryModalStaff(null);
    alert(`Salary set to ${formatCurrency(amount)} effective ${salaryEffMonth} for ${getStaffName(salaryModalStaff)}.`);
  };

  const openPayModal = (staff) => {
    setPayModalStaff(staff);
    setPayTab('settle');
    setPayAmount('');
    setPayMode('Bank');
    setPayNote('');
    const ledger = buildPayrollLedger(staff);
    const firstPending = ledger.find((row) => row.pending > 0);
    setPayMonth(firstPending ? firstPending.month : currentMonthKey());
    setSalarySlip(null);
  };

  const notifySalaryPayment = (staff, amount) => {
    const staffId = getStaffId(staff);
    if (!staffId) return;
    apiFetch('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Salary Credited',
        description: `Your salary payment of ${formatCurrency(amount)} was recorded.`,
        type: 'salary',
        linkPage: 'My Salary',
        recipientRole: activeTab === 'teachers' ? 'teacher' : 'clerk',
        recipientUsername: staffId,
      }),
    }).catch((error) => {
      console.warn('Failed to send salary payment notification', error);
    });
  };

  const submitPayment = (event) => {
    event.preventDefault();
    const amount = parseAmount(payAmount);
    if (amount <= 0) {
      alert('Enter a valid payment amount.');
      return;
    }

    if (payTab === 'settle') {
      const result = settleStaffOutstanding(payModalStaff, amount, payMode, payNote);
      persistStaff(result.staff);
      const slip = buildSalarySlip({
        staffName: getStaffName(result.staff),
        staffId: getStaffId(result.staff),
        month: result.applied.map((a) => a.month).join(', ') || '-',
        amount: amount - result.remaining,
        mode: payMode,
        note: payNote,
      });
      setSalarySlip(slip);
      setPayModalStaff(result.staff);
      if (result.remaining > 0) {
        alert(`Applied ${formatCurrency(amount - result.remaining)}. ${formatCurrency(result.remaining)} could not be applied (no further pending months).`);
      }
      if (amount - result.remaining > 0) {
        notifySalaryPayment(result.staff, amount - result.remaining);
      }
    } else {
      const updated = recordSalaryPayment(payModalStaff, payMonth, amount, payMode, payNote);
      persistStaff(updated);
      const slip = buildSalarySlip({
        staffName: getStaffName(updated),
        staffId: getStaffId(updated),
        month: payMonth,
        amount,
        mode: payMode,
        note: payNote,
      });
      setSalarySlip(slip);
      setPayModalStaff(updated);
      notifySalaryPayment(updated, amount);
    }
    setPayAmount('');
    setPayNote('');
  };

  return (
    <div className="w-full min-h-screen p-6 text-neutral-800 font-sans box-border select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-neutral-400/60 pb-5">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-2 text-neutral-900">
            Staff Payroll <Sparkles className="w-5 h-5 text-neutral-700" />
          </h2>
          <p className="text-xs text-neutral-600 font-medium font-mono mt-1">
            Month-wise salary ledger for teaching and non-teaching staff.
          </p>
        </div>
        <div className="flex items-center gap-2 glass-card p-1.5 rounded-2xl">
          {['teachers', 'clerks'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setSearchTerm('');
                setExpandedId('');
              }}
              className={`text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all ${
                activeTab === tab ? 'bg-neutral-900 text-white' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
              }`}
            >
              {tab === 'teachers' ? 'Teachers' : 'Clerks'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { id: 'staff', title: 'Total Staff', value: summary.count, icon: Users, note: `${activeTab === 'teachers' ? 'Teaching' : 'Non-teaching'} staff on record` },
          { id: 'monthly', title: 'Monthly Payroll', value: formatCurrency(summary.monthlyPayroll), icon: Wallet, note: 'Sum of current salary rates' },
          { id: 'paid', title: 'Total Paid', value: formatCurrency(summary.paid), icon: Banknote, note: 'Paid to date, all months' },
          { id: 'pending', title: 'Total Pending', value: formatCurrency(summary.pending), icon: DollarSign, note: summary.pending ? 'Requires clearance' : 'All dues cleared' },
        ].map((card) => {
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

      <div className="relative bg-white/60 border border-white/80 rounded-xl flex items-center px-3 py-1.5 w-full sm:w-72 mb-5">
        <Search className="w-4 h-4 text-neutral-400 mr-2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name or ID..."
          className="bg-transparent text-xs text-neutral-800 outline-none w-full font-medium"
        />
      </div>

      <div className="space-y-4">
        {staffList.map((staff) => {
          const staffId = getStaffId(staff);
          const totals = staffPayrollTotals(staff);
          const ledger = buildPayrollLedger(staff);
          const isExpanded = expandedId === staffId;
          return (
            <div key={staffId} className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 rounded-xl flex items-center justify-center text-sm font-black text-neutral-600">
                    {getStaffName(staff).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-black text-neutral-900">{getStaffName(staff)}</p>
                    <p className="text-[10px] font-mono text-neutral-500">{staffId}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-mono">
                  <div>
                    <span className="block text-[9px] font-black text-neutral-400 uppercase">Monthly Salary</span>
                    <span className="font-bold text-neutral-800">{formatCurrency(staff.monthlySalary)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-neutral-400 uppercase">Paid</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(totals.paid)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-neutral-400 uppercase">Pending</span>
                    <span className={`font-bold ${totals.pending > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                      {formatCurrency(totals.pending)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-neutral-400 uppercase">Total Due</span>
                    <span className="font-bold text-neutral-800">{formatCurrency(totals.due)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openSalaryModal(staff)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 px-3 py-2 rounded-xl hover:bg-neutral-800 hover:text-white transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Set / Update Salary
                  </button>
                  <button
                    type="button"
                    onClick={() => openPayModal(staff)}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black bg-neutral-900 text-white px-3 py-2 rounded-xl hover:bg-neutral-800 transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Pay Salary
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? '' : staffId)}
                    className="p-2 bg-white/60 border border-white/80 rounded-xl hover:bg-white/80 transition-all"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100/80">
                  <div className="p-4 bg-indigo-50/40 flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase font-mono text-neutral-500">Payroll Ledger</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[640px]">
                      <thead>
                        <tr className="bg-indigo-50/60 border-b border-slate-100/80 text-[9px] font-black text-neutral-400 font-mono">
                          <th className="p-3">Month</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Due</th>
                          <th className="p-3 text-right">Paid</th>
                          <th className="p-3 text-right">Pending</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                        {ledger.map((row) => (
                          <tr key={row.month} className="hover:bg-white/60">
                            <td className="p-3 font-bold text-neutral-900 font-mono">{row.month}</td>
                            <td className="p-3 text-center"><StatusBadge status={row.status} /></td>
                            <td className="p-3 text-right font-mono font-bold text-neutral-800">{formatCurrency(row.due)}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(row.paid)}</td>
                            <td className={`p-3 text-right font-mono font-bold ${row.pending > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                              {formatCurrency(row.pending)}
                            </td>
                          </tr>
                        ))}
                        {!ledger.length && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                              No salary set yet for this staff member.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!staffList.length && (
          <div className="glass-card rounded-2xl p-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
            No {activeTab === 'teachers' ? 'teacher' : 'clerk'} records found.
          </div>
        )}
      </div>

      {/* Set / Update Salary modal */}
      {salaryModalStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card bg-white/95 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black uppercase text-neutral-900 flex items-center gap-1.5">
                <Pencil className="w-4 h-4" /> Set / Update Salary
              </h4>
              <button type="button" onClick={() => setSalaryModalStaff(null)} className="p-1.5 hover:bg-neutral-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-neutral-600 font-semibold">
              Updating salary for {getStaffName(salaryModalStaff)}. The new rate applies from{' '}
              <span className="font-mono font-black">{salaryEffMonth}</span> onward.
            </p>
            <form onSubmit={submitSalaryUpdate} className="space-y-3">
              <div>
                <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Monthly Salary Amount</span>
                <div className="relative flex items-center bg-white border border-neutral-300 rounded-xl px-3 py-1">
                  <span className="text-sm font-mono font-black mr-2">Rs.</span>
                  <input
                    type="number"
                    value={salaryAmount}
                    onChange={(event) => setSalaryAmount(event.target.value)}
                    placeholder="Salary amount"
                    className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Effective From</span>
                <input
                  type="month"
                  value={salaryEffMonth}
                  onChange={(event) => setSalaryEffMonth(event.target.value)}
                  className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                />
                <p className="text-[9px] text-neutral-400 mt-1 font-semibold">Defaults to next month ({nextMonthKey()}).</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSalaryModalStaff(null)}
                  className="flex-1 py-2.5 text-center text-xs font-black border border-neutral-300 rounded-xl hover:bg-neutral-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-md"
                >
                  Save Salary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary modal */}
      {payModalStaff && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-card bg-white/95 max-w-lg w-full rounded-2xl p-6 space-y-4 shadow-2xl my-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black uppercase text-neutral-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" /> Pay Salary
              </h4>
              <button
                type="button"
                onClick={() => {
                  setPayModalStaff(null);
                  setSalarySlip(null);
                }}
                className="p-1.5 hover:bg-neutral-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!salarySlip && (
              <>
                <p className="text-[11px] text-neutral-600 font-semibold">
                  Paying {getStaffName(payModalStaff)}. Outstanding: {formatCurrency(staffPayrollTotals(payModalStaff).pending)}
                </p>

                <div className="glass-soft rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-left min-w-[420px]">
                    <thead>
                      <tr className="bg-indigo-50/60 border-b border-slate-100/80 text-[9px] font-black text-neutral-400 font-mono sticky top-0">
                        <th className="p-2 px-3">Month</th>
                        <th className="p-2 px-3 text-center">Status</th>
                        <th className="p-2 px-3 text-right">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-xs font-medium">
                      {buildPayrollLedger(payModalStaff)
                        .filter((row) => row.pending > 0)
                        .map((row) => (
                          <tr key={row.month} className="hover:bg-white/60">
                            <td className="p-2 px-3 font-bold text-neutral-900 font-mono">{row.month}</td>
                            <td className="p-2 px-3 text-center"><StatusBadge status={row.status} /></td>
                            <td className="p-2 px-3 text-right font-mono font-bold text-red-500">{formatCurrency(row.pending)}</td>
                          </tr>
                        ))}
                      {!buildPayrollLedger(payModalStaff).some((row) => row.pending > 0) && (
                        <tr>
                          <td colSpan="3" className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            No outstanding months.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-4 bg-white/50 p-3 rounded-xl border border-slate-100/80 text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={payTab === 'settle'} onChange={() => setPayTab('settle')} />
                    Settle Outstanding (oldest first)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={payTab === 'month'} onChange={() => setPayTab('month')} />
                    Pay Specific Month
                  </label>
                </div>

                <form onSubmit={submitPayment} className="space-y-3">
                  {payTab === 'month' && (
                    <div>
                      <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Month</span>
                      <input
                        type="month"
                        value={payMonth}
                        onChange={(event) => setPayMonth(event.target.value)}
                        className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all font-mono"
                      />
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Amount</span>
                    <div className="relative flex items-center bg-white border border-neutral-300 rounded-xl px-3 py-1">
                      <span className="text-sm font-mono font-black mr-2">Rs.</span>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(event) => setPayAmount(event.target.value)}
                        placeholder="Amount to pay"
                        className="w-full bg-transparent p-2 outline-none font-mono text-sm font-bold"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Mode</span>
                      <select
                        value={payMode}
                        onChange={(event) => setPayMode(event.target.value)}
                        className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none"
                      >
                        <option value="Bank">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-neutral-400 block font-mono mb-1">Note (optional)</span>
                      <input
                        type="text"
                        value={payNote}
                        onChange={(event) => setPayNote(event.target.value)}
                        placeholder="Accounts note"
                        className="w-full p-2.5 bg-white border border-neutral-300 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" /> Confirm Payment
                  </button>
                </form>
              </>
            )}

            {salarySlip && (
              <div className="space-y-4">
                <div className="bg-white border border-neutral-300 p-5 rounded-2xl space-y-4 text-left">
                  <div className="text-center space-y-1 border-b border-dashed border-neutral-300 pb-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">Salary Payment Slip</h3>
                    <p className="text-[10px] font-mono text-neutral-400">
                      {salarySlip.timestamp} | Ref: {salarySlip.slipNo}
                    </p>
                  </div>
                  <div className="text-xs space-y-1.5 font-mono">
                    <p><strong>Staff:</strong> {salarySlip.staffName} ({salarySlip.staffId})</p>
                    <p><strong>Month(s):</strong> {salarySlip.month}</p>
                    <p><strong>Mode:</strong> {salarySlip.mode}</p>
                    {salarySlip.note && <p><strong>Note:</strong> {salarySlip.note}</p>}
                  </div>
                  <div className="p-3 bg-neutral-900 text-white flex justify-between rounded-xl font-black">
                    <span>Amount Paid</span><span>{formatCurrency(salarySlip.amount)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button
                    type="button"
                    onClick={() => alert('Slip email dispatch not wired yet.')}
                    className="flex items-center justify-center gap-1.5 text-[10px] font-black bg-neutral-100 border border-neutral-300 p-2.5 rounded-xl"
                  >
                    <Mail className="w-3.5 h-3.5 text-red-500" /> Email
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPayModalStaff(null);
                    setSalarySlip(null);
                  }}
                  className="w-full py-2.5 text-center text-xs font-black border border-neutral-800 rounded-xl hover:bg-neutral-900 hover:text-white transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
