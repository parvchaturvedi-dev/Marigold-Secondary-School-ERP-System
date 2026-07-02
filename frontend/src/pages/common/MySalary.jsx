import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ReceiptText,
  User,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { formatCurrency } from '../../components/common/payrollData';

const emptyTotals = { due: 0, paid: 0, pending: 0 };

const formatMonthLabel = (month = '') => {
  if (!/^\d{4}-\d{2}$/.test(String(month))) return month || '—';
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const statusTone = (status) => {
  if (status === 'Paid') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'Partial') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const MySalary = ({ session }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState('');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await apiFetch('/payroll/me');
        if (!alive) return;
        setData(result || null);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Unable to load salary details right now.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [session?.username]);

  const staff = data?.staff || null;
  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
  const totals = data?.totals || emptyTotals;
  const hasRecord = Boolean(staff) || ledger.length > 0;

  const staffName = staff?.name || staff?.displayName || session?.displayName || 'Staff';
  const monthlySalary = staff?.monthlySalary || 0;
  const joinMonth = staff?.joinMonth || (ledger[0]?.month ?? '');

  const sortedLedger = [...ledger].sort((a, b) => String(b.month).localeCompare(String(a.month)));

  const toggleMonth = (month) => {
    setExpandedMonth((current) => (current === month ? '' : month));
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl border bg-indigo-50 text-indigo-700 border-indigo-100 flex items-center justify-center">
            <User className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <Wallet className="w-5 h-5" /> My Salary
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {staffName}
              {joinMonth ? ` | Joined ${formatMonthLabel(joinMonth)}` : ''}
            </p>
          </div>
        </div>

        <div className="glass-soft rounded-2xl px-4 py-2.5 text-xs font-bold flex items-center gap-2">
          <span className="text-slate-500">Current Monthly Salary</span>
          <span className="text-sm font-black text-slate-900">{formatCurrency(monthlySalary)}</span>
        </div>
      </section>

      {loading && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="glass-card rounded-3xl p-4 min-h-32 skeleton" />
          ))}
        </section>
      )}

      {!loading && error && (
        <section className="glass-card rounded-3xl p-6 text-center">
          <p className="text-sm font-bold text-rose-600">{error}</p>
        </section>
      )}

      {!loading && !error && !hasRecord && (
        <section className="glass-card rounded-3xl p-6 text-center">
          <p className="text-sm font-bold text-slate-500">No salary record yet.</p>
        </section>
      )}

      {!loading && !error && hasRecord && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            <SalaryMetric label="Total Earned / Due" value={formatCurrency(totals.due)} icon={ReceiptText} />
            <SalaryMetric
              label="Paid"
              value={formatCurrency(totals.paid)}
              icon={CheckCircle2}
              tone="bg-emerald-50 text-emerald-700 border-emerald-100"
            />
            <SalaryMetric
              label="Pending"
              value={formatCurrency(totals.pending)}
              icon={totals.pending ? AlertCircle : BadgeCheck}
              tone={
                totals.pending
                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }
            />
          </section>

          <section className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
              <h3 className="text-sm font-black flex items-center gap-2">
                <CalendarClock className="w-4 h-4" /> Month-by-Month Ledger
              </h3>
              <span className="text-[10px] font-black text-slate-500">{sortedLedger.length} months</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100/80 bg-white">
              <table className="w-full min-w-[680px] text-left text-xs font-bold">
                <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Salary Due</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Pending</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Payments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {sortedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                        No salary record yet.
                      </td>
                    </tr>
                  ) : (
                    sortedLedger.map((row) => {
                      const isOpen = expandedMonth === row.month;
                      const payments = Array.isArray(row.payments) ? row.payments : [];
                      return (
                        <React.Fragment key={row.month}>
                          <tr className="hover:bg-white/60">
                            <td className="px-3 py-3 font-black">{formatMonthLabel(row.month)}</td>
                            <td className="px-3 py-3 font-mono">{formatCurrency(row.due)}</td>
                            <td className="px-3 py-3 font-mono text-emerald-700">{formatCurrency(row.paid)}</td>
                            <td className="px-3 py-3 font-mono text-amber-700">{formatCurrency(row.pending)}</td>
                            <td className="px-3 py-3">
                              <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${statusTone(row.status)}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => toggleMonth(row.month)}
                                disabled={payments.length === 0}
                                className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                              >
                                {payments.length} payment{payments.length === 1 ? '' : 's'}
                                {payments.length > 0 && (isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                              </button>
                            </td>
                          </tr>
                          {isOpen && payments.length > 0 && (
                            <tr>
                              <td colSpan={6} className="px-3 pb-3">
                                <div className="glass-soft rounded-2xl p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                  {payments.map((payment, index) => (
                                    <div
                                      key={payment.id || `${row.month}-${index}`}
                                      className="bg-white/70 border border-white/70 rounded-xl px-3 py-2 text-[10px] font-bold space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-black text-slate-900">{formatCurrency(payment.amount)}</span>
                                        <span className="text-slate-500">{payment.mode || 'Bank'}</span>
                                      </div>
                                      <div className="text-slate-500">
                                        {payment.paidOn ? new Date(payment.paidOn).toLocaleDateString('en-IN') : '—'}
                                      </div>
                                      {payment.note && <div className="text-slate-400 truncate">{payment.note}</div>}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

const SalaryMetric = ({ label, value, icon, tone = 'bg-indigo-50 text-indigo-700 border-indigo-100' }) => (
  <div className="glass-card rounded-3xl p-4 min-h-32 flex flex-col justify-between">
    <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${tone}`}>
      {React.createElement(icon, { className: 'w-5 h-5' })}
    </span>
    <div>
      <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
    </div>
  </div>
);

export default MySalary;
