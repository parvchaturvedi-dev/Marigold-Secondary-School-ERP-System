import { createElement } from 'react';
import { ArrowUpRight } from 'lucide-react';

const PortalStatCard = ({ icon, label, value, note, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="glass-card glass-hover group flex min-h-36 w-full flex-col justify-between rounded-3xl p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
  >
    <div className="flex items-center justify-between gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
        {createElement(icon, { className: 'h-5 w-5' })}
      </span>
      <ArrowUpRight className="h-4 w-4 text-slate-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </div>
    <div className="mt-4 min-w-0">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 break-words text-[10px] font-semibold text-slate-500">{note}</p>
    </div>
  </button>
);

export default PortalStatCard;
