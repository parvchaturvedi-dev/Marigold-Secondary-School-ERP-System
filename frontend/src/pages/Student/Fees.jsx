import React from 'react';
import {
  AlertCircle,
  BadgeCheck,
  BookOpenCheck,
  Bus,
  CalendarClock,
  CheckCircle2,
  Download,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import {
  getClassLabel,
  getFeeInstallments,
  getFeeSummary,
  getLibraryRecords,
  getPaymentHistory,
  getPortalStudent,
  getTransportDetails,
} from './studentPortalData';

const formatCurrency = (amount = 0) =>
  `Rs. ${Number(amount).toLocaleString('en-IN')}`;

const Fees = ({ session }) => {
  const student = getPortalStudent(session);
  const summary = getFeeSummary(student);
  const installments = getFeeInstallments(student);
  const payments = getPaymentHistory(student);
  const transport = getTransportDetails(student);
  const libraryRecords = getLibraryRecords(student);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Fees & Services
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            {student.displayName} | {getClassLabel(student)} | {student.admissionNumber}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="h-10 px-5 rounded-full bg-[#E1FA6C] border border-[#1A1A1A]/10 text-xs font-black flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Print Ledger
        </button>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <FeeMetric label="Annual Fee" value={formatCurrency(summary.annual)} icon={ReceiptText} />
        <FeeMetric label="Concession" value={formatCurrency(summary.concession)} icon={BadgeCheck} />
        <FeeMetric label="Paid" value={formatCurrency(summary.paid)} icon={CheckCircle2} />
        <FeeMetric
          label="Balance"
          value={formatCurrency(summary.pending)}
          icon={summary.pending ? AlertCircle : CheckCircle2}
          tone={summary.pending ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white border border-[#C8C8C8] rounded-3xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#EAEAEA] pb-3 mb-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Installment Ledger
            </h3>
            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
              summary.pending ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              {summary.status}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA]">
            <table className="w-full min-w-[680px] text-left text-xs font-bold">
              <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Term</th>
                  <th className="px-3 py-2">Months</th>
                  <th className="px-3 py-2">Due Date</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Paid</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {installments.map((installment) => (
                  <tr key={installment.id} className="hover:bg-[#F8F8F8]">
                    <td className="px-3 py-3 font-black">{installment.term}</td>
                    <td className="px-3 py-3 text-[#555555]">{installment.months}</td>
                    <td className="px-3 py-3">{installment.dueDate}</td>
                    <td className="px-3 py-3 font-mono">{formatCurrency(installment.amount)}</td>
                    <td className="px-3 py-3 font-mono text-emerald-700">{formatCurrency(installment.paid)}</td>
                    <td className="px-3 py-3 font-mono text-amber-700">{formatCurrency(installment.balance)}</td>
                    <td className="px-3 py-3">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                        installment.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : installment.status === 'Partial'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {installment.status}
                      </span>
                    </td>
                  </tr>
                ))}
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

          <ServicePanel icon={BookOpenCheck} title="Library">
            {libraryRecords.map((record) => (
              <div key={record.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-black">{record.title}</p>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                    record.status === 'Due Soon'
                      ? 'bg-amber-50 text-amber-700 border border-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {record.status}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-[#555555] mt-1">
                  Due {record.dueDate} | Fine {formatCurrency(record.fine)}
                </p>
              </div>
            ))}
          </ServicePanel>
        </div>
      </section>

      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
        <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
          <h3 className="text-sm font-black flex items-center gap-2">
            <ReceiptText className="w-4 h-4" /> Receipt History
          </h3>
          <span className="text-[10px] font-black text-[#555555]">{payments.length} receipts</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {payments.map((payment) => (
            <article key={payment.id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black">{payment.receiptNo}</p>
                  <p className="text-[10px] font-bold text-[#555555] mt-1">{payment.date} | {payment.mode}</p>
                </div>
                <span className="text-[9px] font-black bg-white border border-[#C8C8C8] px-2 py-1 rounded-md">
                  {payment.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-[#555555]">{payment.head}</p>
                <p className="text-lg font-black mt-1">{formatCurrency(payment.amount)}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

const FeeMetric = ({ label, value, icon, tone = 'bg-[#F8F8F8] text-[#1A1A1A] border-[#EAEAEA]' }) => (
  <div className="bg-white border border-[#C8C8C8] rounded-3xl p-4 min-h-32 flex flex-col justify-between">
    <span className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${tone}`}>
      {React.createElement(icon, { className: 'w-5 h-5' })}
    </span>
    <div>
      <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
      <p className="text-xl font-black mt-1">{value}</p>
    </div>
  </div>
);

const ServicePanel = ({ icon, title, children }) => (
  <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-3">
    <h3 className="text-sm font-black flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
      {React.createElement(icon, { className: 'w-4 h-4' })} {title}
    </h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const InfoLine = ({ label, value }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2.5 flex items-center justify-between gap-3 text-xs font-bold">
    <span className="text-[#555555]">{label}</span>
    <span className="text-right truncate">{value}</span>
  </div>
);

export default Fees;
