import React from 'react';
import { BellRing, CalendarDays, Megaphone } from 'lucide-react';
import { getTeacherProfile } from './teacherPortalData';
import {
  formatNotificationTime,
  useNotificationsDatabase,
} from '../../components/common/notificationStore';

const deriveScope = (notification) => {
  if (notification.recipientClassName) return notification.recipientClassName;
  if (notification.recipientRole === 'teacher') return 'Faculty';
  return notification.recipientRole || 'General';
};

const derivePriority = (notification) => {
  const type = String(notification.type || '').toLowerCase();
  if (type.includes('urgent') || type.includes('high') || type.includes('alert')) return 'High';
  return 'Normal';
};

const Notices = ({ session }) => {
  const profile = getTeacherProfile(session);
  const { notifications, error } = useNotificationsDatabase(session);
  const loading = !error && !session?.username;
  const notices = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title || notification.description || 'Notice',
    body: notification.description || notification.text || '',
    date: formatNotificationTime(notification.time || notification.createdAt),
    scope: deriveScope(notification),
    priority: derivePriority(notification),
  }));

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6">
        <h2 className="text-xl font-black flex items-center gap-2">
          <BellRing className="w-5 h-5" /> Notices
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">
          Faculty and class notices relevant to {profile.displayName}.
        </p>
      </section>

      <section className="space-y-4">
        {error && (
          <div className="glass-card rounded-3xl p-5 text-xs font-bold text-rose-600">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[0, 1, 2].map((key) => (
              <div key={key} className="glass-card rounded-3xl p-5">
                <div className="skeleton h-12 w-12 rounded-2xl mb-3" />
                <div className="skeleton h-3 w-1/3 rounded mb-2" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && notices.length === 0 && (
          <div className="glass-card rounded-3xl p-8 text-center">
            <p className="text-sm font-black text-slate-600">No notices yet</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Notices for {profile.displayName} will appear here once published.
            </p>
          </div>
        )}

        {!loading &&
          notices.map((notice) => (
            <article key={notice.id} className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[9px] font-black uppercase bg-indigo-50/60 text-slate-500 px-2 py-1 rounded-md">
                    {notice.scope}
                  </span>
                  <span className={`text-[9px] font-black uppercase border px-2 py-1 rounded-md ${
                    notice.priority === 'High'
                      ? 'bg-rose-50 text-rose-700 border-rose-100'
                      : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {notice.priority}
                  </span>
                  <span className="text-[9px] font-black uppercase bg-white/70 text-slate-500 border border-slate-100/80 px-2 py-1 rounded-md flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> {notice.date}
                  </span>
                </div>
                <h3 className="text-sm font-black">{notice.title}</h3>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-2">{notice.body}</p>
              </div>
            </article>
          ))}
      </section>
    </div>
  );
};

export default Notices;
