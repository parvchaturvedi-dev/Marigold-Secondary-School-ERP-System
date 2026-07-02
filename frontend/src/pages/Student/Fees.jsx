import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Bus,
  CalendarClock,
  CheckCircle2,
  Download,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { getClassLabel, getPortalStudent } from './studentPortalData';

const formatCurrency = (amount = 0) =>
  `Rs. ${Number(amount || 0).toLocaleString('en-IN')}`;

const normalizeAdmission = (value = '') => String(value || '').trim().toUpperCase();

const emptyTotals = { assigned: 0, paid: 0, pending: 0 };

const emptyTransport = {
  route: '—',
  pickupPoint: '—',
  pickupTime: '—',
  vehicleNo: '—',
  driver: '—',
};

const Fees = ({ session }) => {
  const student = getPortalStudent(session);
  const admissionNumber = normalizeAdmission(student.admissionNumber);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch('/fees/me');
        if (!alive) return;
        const students = Array.isArray(data?.students) ? data.students : [];
        const match =
          students.find((entry) => normalizeAdmission(entry.admissionNumber) === admissionNumber) ||
          students[0] ||
          null;
        setRecord(match);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Unable to load fee details right now.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [admissionNumber]);

  const totals = record?.totals || emptyTotals;
  const classLedger = Array.isArray(record?.classLedger) ? record.classLedger : [];
  const transport = record?.transport || emptyTransport;
  const hasRecord = Boolean(record?.hasRecord);
  const status = record?.status || 'Clear';
  const concession = record?.concession || 0;

  const receipts = classLedger
    .flatMap((entry) =>
      (Array.isArray(entry.payments) ? entry.payments : []).map((payment, index) => ({
        id: `${entry.className}-${payment.receiptNo || index}`,
        className: entry.className,
        amount: payment.amount,
        date: payment.date,
        mode: payment.mode,
        receiptNo: payment.receiptNo,
      }))
    )
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Fees & Services
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {student.displayName} | {getClassLabel(student)} | {student.admissionNumber}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="h-10 px-5 rounded-full btn-primary text-xs font-black flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Print Ledger
        </button>
      </section>

      {loading && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((key) => (
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
          <p className="text-sm font-bold text-slate-500">No fee record on file yet.</p>
        </section>
      )}

      {!loading && !error && hasRecord && (
      <>
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        <FeeMetric label="Assigned" value={formatCurrency(totals.assigned)} icon={ReceiptText} />
        <FeeMetric label="Concession" value={formatCurrency(concession)} icon={BadgeCheck} />
        <FeeMetric label="Paid" value={formatCurrency(totals.paid)} icon={CheckCircle2} />
        <FeeMetric
          label="Balance"
          value={formatCurrency(totals.pending)}
          icon={totals.pending ? AlertCircle : CheckCircle2}
          tone={totals.pending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 glass-card rounded-3xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100/80 pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Class-wise Ledger
            </h3>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
              totals.pending ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              {status}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100/80 bg-white">
            <table className="w-full min-w-[680px] text-left text-xs font-bold">
              <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Assigned</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {classLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                      No class ledger entries on file yet.
                    </td>
                  </tr>
                ) : (
                  classLedger.map((entry) => (
                    <tr key={entry.className} className="hover:bg-white/60">
                      <td className="px-3 py-3 font-black">
                        {entry.className}
                        {record?.nextDueClass && entry.className === record.nextDueClass && (
                          <span className="ml-2 text-[9px] font-black text-amber-600 align-middle">Next Due</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono">{formatCurrency(entry.assigned)}</td>
                      <td className="px-3 py-3 font-mono text-emerald-700">{formatCurrency(entry.paid)}</td>
                      <td className="px-3 py-3 font-mono text-amber-700">{formatCurrency(entry.pending)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                          entry.status === 'Paid' || entry.status === 'Clear'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : entry.status === 'Partial'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <ServicePanel icon={Bus} title="Transport">
            <InfoLine label="Route" value={transport.route} />
            <InfoLine label="Pickup" value={transport.pickupPoint} />
            <InfoLine label="Time" value={transport.pickupTime} />
            <InfoLine label="Vehicle" value={transport.vehicleNo} />
            <InfoLine label="Driver" value={transport.driver} />
          </ServicePanel>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex items-center justify-between border-b border-slate-100/80 pb-3 mb-4">
          <h3 className="text-sm font-black flex items-center gap-2">
            <ReceiptText className="w-4 h-4" /> Receipt History
          </h3>
          <span className="text-[10px] font-black text-slate-500">{receipts.length} receipts</span>
        </div>

        {receipts.length === 0 ? (
          <p className="text-xs font-bold text-slate-500 text-center py-6">No receipts on file yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {receipts.map((payment) => (
              <article key={payment.id} className="glass-soft rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black">{payment.receiptNo || 'No receipt no.'}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">{payment.date} | {payment.mode}</p>
                  </div>
                  <span className="text-[9px] font-black bg-white/70 border border-white/70 px-2 py-1 rounded-md">
                    {payment.className}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-500">{payment.className}</p>
                  <p className="text-lg font-black mt-1">{formatCurrency(payment.amount)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
};

const FeeMetric = ({ label, value, icon, tone = 'bg-indigo-50 text-indigo-700 border-indigo-100' }) => (
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

const ServicePanel = ({ icon, title, children }) => (
  <div className="glass-card rounded-3xl p-5 space-y-3">
    <h3 className="text-sm font-black flex items-center gap-2 border-b border-slate-100/80 pb-3">
      {React.createElement(icon, { className: 'w-4 h-4' })} {title}
    </h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const InfoLine = ({ label, value }) => (
  <div className="glass-soft rounded-2xl px-3 py-2.5 flex items-center justify-between gap-3 text-xs font-bold">
    <span className="text-slate-500">{label}</span>
    <span className="text-right truncate">{value}</span>
  </div>
);

export default Fees;
