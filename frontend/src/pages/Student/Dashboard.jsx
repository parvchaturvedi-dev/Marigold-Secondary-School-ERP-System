import { useEffect, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../../components/common/api';
import { formatNotificationTime, useNotificationsDatabase } from '../../components/common/notificationStore';
import { getClassLabel, getPortalStudent } from './studentPortalData';
import PortalStatCard from '../../components/common/PortalStatCard';
import PortalWelcomeCard from '../../components/common/PortalWelcomeCard';

const normalizeAdmission = (value = '') => String(value || '').trim().toUpperCase();

const Dashboard = ({ session, setActivePage }) => {
  const student = getPortalStudent(session);
  const admissionNumber = normalizeAdmission(student.admissionNumber);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [feeRecord, setFeeRecord] = useState(null);
  const [meetings, setMeetings] = useState([]);

  const { notifications } = useNotificationsDatabase(session);
  const notices = Array.isArray(notifications) ? notifications.slice(0, 2) : [];

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [summaryData, feeData, meetingsData] = await Promise.all([
          apiFetch('/dashboard/summary'),
          apiFetch('/fees/me').catch(() => null),
          apiFetch(
            `/meetings?role=student&username=${encodeURIComponent(session?.username || '')}&className=${encodeURIComponent(student.className || '')}`
          ).catch(() => []),
        ]);

        if (!alive) return;

        setSummary(summaryData || null);

        const feeStudents = Array.isArray(feeData?.students) ? feeData.students : [];
        const matchedFee =
          feeStudents.find((entry) => normalizeAdmission(entry.admissionNumber) === admissionNumber) ||
          feeStudents[0] ||
          null;
        setFeeRecord(matchedFee);

        const upcomingMeetings = Array.isArray(meetingsData)
          ? meetingsData
              .filter((meeting) => meeting.status !== 'ended')
              .sort((a, b) => new Date(a.date) - new Date(b.date))
          : [];
        setMeetings(upcomingMeetings.slice(0, 1));
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Unable to load dashboard right now.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [admissionNumber, session?.username, student.className]);

  const stats = Array.isArray(summary?.stats) ? summary.stats : [];
  const attendanceStat = stats.find((stat) => stat.title === 'Attendance');
  const assignmentsStat = stats.find((stat) => stat.title === 'Assignments');
  const noticesStat = stats.find((stat) => stat.title === 'Notices');

  const hasFeeRecord = Boolean(feeRecord?.hasRecord);
  const feeSummary = feeRecord?.summary || null;

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
      <PortalWelcomeCard session={session} />
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

      {!loading && !error && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <PortalStatCard
            icon={CheckCircle2}
            label="Attendance"
            value={attendanceStat?.value || '—'}
            note={attendanceStat?.subtitle || 'Not available'}
            onClick={() => setActivePage?.('Attendance')}
          />
          <PortalStatCard
            icon={ClipboardList}
            label="Assignments"
            value={assignmentsStat?.value || '—'}
            note={assignmentsStat?.subtitle || 'Not available'}
            onClick={() => setActivePage?.('Assignment')}
          />
          <PortalStatCard
            icon={BellRing}
            label="Notices"
            value={noticesStat?.value || '—'}
            note={noticesStat?.subtitle || 'Not available'}
            onClick={() => setActivePage?.('Notices')}
          />
          <PortalStatCard
            icon={Wallet}
            label="Fees"
            value={hasFeeRecord ? feeSummary?.status || '—' : 'No fee record'}
            note={
              hasFeeRecord && feeSummary?.pending
                ? `Pending Rs. ${Number(feeSummary.pending).toLocaleString('en-IN')}`
                : hasFeeRecord
                  ? 'Ledger clear'
                  : 'Not available'
            }
            onClick={() => setActivePage?.('Fees')}
          />
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Today
            </h3>
            <span className="text-[10px] font-black text-slate-500">{getClassLabel(student)}</span>
          </div>

          {summary?.action ? (
            <div className="glass-soft rounded-2xl p-4">
              <span className="text-[9px] font-black uppercase bg-white/70 border border-white/70 px-2 py-1 rounded-md">
                {summary.action.label}
              </span>
              <p className="text-sm font-black mt-3">{summary.action.title}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">{summary.action.subtitle}</p>
            </div>
          ) : (
            <p className="text-xs font-semibold text-slate-500">Not available</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <BellRing className="w-4 h-4" /> Notices
            </h3>
            {notices.length === 0 && (
              <p className="text-[11px] font-semibold text-slate-500">No notices yet.</p>
            )}
            {notices.map((notice) => (
              <div key={notice.id || notice._id} className="glass-soft rounded-2xl p-3">
                <p className="text-xs font-black">{notice.title}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  {formatNotificationTime(notice.createdAt)}
                </p>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Next Meeting
            </h3>
            {meetings.length === 0 && (
              <p className="text-[11px] font-semibold text-slate-500">No upcoming meetings.</p>
            )}
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-indigo-100/60 border border-indigo-200/70 rounded-2xl p-3">
                <p className="text-xs font-black">{meeting.title}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  {meeting.date} | {meeting.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
