import React from 'react';
import { IdCard } from 'lucide-react';

const EmployeeIdCard = ({ session = {} }) => {
  const employee = session.employeeProfile || {};
  const name = employee.name || session.displayName || session.username || 'Employee';

  return (
    <div className="mx-auto max-w-2xl space-y-5 text-slate-900">
      <section className="glass-card rounded-3xl p-6">
        <h1 className="flex items-center gap-2 text-xl font-black"><IdCard className="h-5 w-5 text-indigo-600" /> Employee ID Card</h1>
        <p className="mt-1 text-xs font-semibold text-slate-500">Your assigned school identity card.</p>
      </section>
      <article className="glass-card overflow-hidden rounded-3xl border border-white/80">
        <div className="bg-gradient-to-r from-indigo-600 to-teal-500 p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Marigold Secondary School</p>
          <p className="mt-1 text-xs font-bold text-white/80">Employee Identification</p>
        </div>
        <div className="space-y-3 p-6">
          <Detail label="Name" value={name} />
          <Detail label="Employee ID" value={employee.id || session.username} />
          <Detail label="Designation" value={employee.designation || 'Employee'} />
          <Detail label="Email" value={employee.email || ''} />
          <Detail label="Mobile" value={employee.mobile || ''} />
          <Detail label="Date of joining" value={employee.dateOfJoining || ''} />
        </div>
        <div className="border-t border-slate-200 px-6 py-3 text-[10px] font-bold text-slate-500">Keep this identity available while on campus.</div>
      </article>
      <button type="button" onClick={() => window.print()} className="no-print btn-primary rounded-xl px-5 py-3 text-xs font-black">Print ID Card</button>
    </div>
  );
};

function Detail({ label, value }) {
  return value ? <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-xs"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-black">{value}</span></div> : null;
}

export default EmployeeIdCard;
