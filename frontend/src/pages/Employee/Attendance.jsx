import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Clock, LocateFixed, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../components/common/api';

const EmployeeAttendance = () => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setStatus(await apiFetch('/attendance/my-clock-status'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const getLocation = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser does not support location access.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error('Location access is required. Enable location services and try again.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const recordAttendance = async () => {
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const location = await getLocation();
      const action = status?.clockedIn ? 'clock-out' : 'clock-in';
      const payload = await apiFetch('/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...location, action, source: 'self-service', requiresGeofence: true }),
      });
      setMessage(payload.message || 'Attendance recorded.');
      await loadStatus();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const done = status?.clockedIn && status?.clockedOut;

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-slate-900">
      <section className="glass-card rounded-3xl p-6">
        <p className="text-[10px] font-black uppercase tracking-wider text-teal-700">Employee Desk</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black"><CalendarCheck className="h-6 w-6 text-teal-600" /> My Attendance</h1>
        <p className="mt-2 text-xs font-semibold text-slate-500">Clock in and out from campus. School location verification is required.</p>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{message}</p>}
      <section className="glass-card rounded-3xl p-6">
        {isLoading ? <p className="text-xs font-bold text-slate-500">Loading today's attendance…</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Today</p>
                <p className="mt-1 text-sm font-black">{new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}</p>
              </div>
              <button type="button" onClick={loadStatus} className="rounded-xl p-2 text-slate-600 hover:bg-white/70" aria-label="Refresh attendance"><RefreshCw className="h-4 w-4" /></button>
            </div>
            <div className="my-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ClockRow label="Clock in" value={status?.clockInAt} />
              <ClockRow label="Clock out" value={status?.clockOutAt} />
            </div>
            <p className="mb-4 text-xs font-bold text-slate-600">Status: {status?.isOffDay ? 'Holiday / off day' : done ? 'Completed' : status?.clockedIn ? 'Clocked in' : 'Not clocked in'}</p>
            {!status?.isOffDay && !done && (
              <button type="button" onClick={recordAttendance} disabled={isSaving} className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black disabled:opacity-50">
                <LocateFixed className="h-4 w-4" /> {isSaving ? 'Verifying location…' : status?.clockedIn ? 'Clock Out' : 'Clock In'}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
};

function ClockRow({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/60 p-4">
      <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black">{value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
    </div>
  );
}

export default EmployeeAttendance;
