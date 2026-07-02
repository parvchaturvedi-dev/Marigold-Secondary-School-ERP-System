import React from 'react';
import { BellRing, CalendarDays, Megaphone } from 'lucide-react';
import { CLERK_NOTICES, formatShortDate, getClerkProfile } from './clerkPortalData';

const Notices = ({ session }) => {
  const profile = getClerkProfile(session);

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <BellRing className="w-5 h-5" /> Notices
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">
          {profile.department} | Published office notices
        </p>
      </section>

      <section className="space-y-4 stagger">
        {CLERK_NOTICES.map((notice) => (
          <article key={notice.id} className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-start gap-4">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[9px] font-black uppercase bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-md">
                  {notice.category}
                </span>
                <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> {formatShortDate(notice.date)}
                </span>
                <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-md">
                  {notice.status}
                </span>
              </div>
              <h3 className="text-sm font-black">{notice.title}</h3>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-2">{notice.body}</p>
              <p className="text-[10px] font-black text-slate-500 mt-3">
                Targets: {notice.targets.join(', ')}
              </p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default Notices;
