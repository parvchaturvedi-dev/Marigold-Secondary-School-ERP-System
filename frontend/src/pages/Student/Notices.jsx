import React from 'react';
import { BellRing, CalendarDays, Megaphone } from 'lucide-react';
import { getClassLabel, getPortalStudent } from './studentPortalData';
import { formatNotificationTime, useNotificationsDatabase } from '../../components/common/notificationStore';

const Notices = ({ session }) => {
  const student = getPortalStudent(session);
  const { notifications, error } = useNotificationsDatabase(session);

  const notices = notifications
    .filter((item) => (item.type || 'notice') !== 'message')
    .map((item) => ({
      id: item.id,
      title: item.title || 'Notice',
      body: item.description || item.text || '',
      date: formatNotificationTime(item.time || item.createdAt),
      scope: item.recipientClassName || 'All Students',
    }));

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <BellRing className="w-5 h-5" /> Notices
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">
          Showing class and school notices relevant to {student.displayName} | {getClassLabel(student)}
        </p>
      </section>

      {error ? (
        <section className="glass-card rounded-3xl p-6 text-center text-xs font-bold text-rose-500">
          {error}
        </section>
      ) : notices.length === 0 ? (
        <section className="glass-card rounded-3xl p-10 text-center">
          <p className="text-sm font-bold text-slate-500">No notices</p>
        </section>
      ) : (
        <section className="space-y-4 stagger">
          {notices.map((notice) => (
            <article key={notice.id} className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[9px] font-black uppercase bg-white/50 text-slate-500 px-2 py-1 rounded-md">
                    {notice.scope}
                  </span>
                  <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-md flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> {notice.date}
                  </span>
                </div>
                <h3 className="text-sm font-black">{notice.title}</h3>
                {notice.body ? (
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-2">{notice.body}</p>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default Notices;
