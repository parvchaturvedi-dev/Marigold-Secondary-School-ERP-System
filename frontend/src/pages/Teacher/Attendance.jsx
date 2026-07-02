import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMasterData } from '../../components/common/masterData';
import {
  clockAttendance,
  saveStudentAttendanceBatch,
  useAttendanceOverview,
} from '../../components/common/attendanceStore';

const todayKey = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};
const toRad = (degree) => (degree * Math.PI) / 180;
const distanceMeters = (a, b) => {
  if (!a || !b || a.latitude === null || b.latitude === null) return Number.POSITIVE_INFINITY;
  const earth = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const Attendance = ({ session }) => {
  const masterData = useMasterData();
  const teacher = useMemo(() => {
    const username = String(session?.username || '').toUpperCase();
    return masterData.teachers.find((item) =>
      [item.id, item.empId, item.username, item.name].some((value) => String(value || '').toUpperCase() === username)
    );
  }, [masterData.teachers, session?.username]);

  const assignedClass = teacher?.isClassTeacher === 'Yes' ? teacher.assignedClassTeacherFor || '' : '';
  const [attendanceDate, setAttendanceDate] = useState(todayKey());
  const [overrideToken, setOverrideToken] = useState('');
  const [draftStatus, setDraftStatus] = useState({});
  const [message, setMessage] = useState('');
  const [device, setDevice] = useState({
    checking: false,
    mock: null,
    coords: null,
    allowed: false,
    text: 'Run validation before marking attendance.',
  });

  const { overview, isLoading, error, reload } = useAttendanceOverview({
    date: attendanceDate,
    className: assignedClass,
    period: 'monthly',
  });

  useEffect(() => {
    const next = {};
    (overview?.roster || []).forEach((student) => {
      next[student.entityId] = student.todayLog?.status === 'absent' ? 'absent' : 'present';
    });
    setDraftStatus(next);
  }, [overview?.roster]);

  const roster = useMemo(
    () => [...(overview?.roster || [])].sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0)),
    [overview?.roster]
  );

  const summary = useMemo(
    () =>
      roster.reduce(
        (acc, student) => {
          acc[draftStatus[student.entityId] === 'absent' ? 'absent' : 'present'] += 1;
          return acc;
        },
        { present: 0, absent: 0 }
      ),
    [draftStatus, roster]
  );

  const isHistorical = attendanceDate !== todayKey();
  const canSave = assignedClass && (!isHistorical || overrideToken.trim());

  const validateDevice = async () => {
    const nativeApi = window.MGPSNativeDevice || window.NativeDevice || {};
    const mock = typeof nativeApi.isMockLocation === 'function' ? await nativeApi.isMockLocation() : false;
    if (mock) {
      setDevice({ checking: false, mock: true, coords: null, allowed: false, text: 'Mock location detected. Attendance is locked.' });
      return;
    }
    if (!navigator.geolocation) {
      setDevice({ checking: false, mock: false, coords: null, allowed: false, text: 'GPS unavailable on this device.' });
      return;
    }
    setDevice((current) => ({ ...current, checking: true, text: 'Checking GPS boundary...' }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const settings = overview?.settings || {};
        const school = {
          latitude: Number(settings.geofenceLatitude),
          longitude: Number(settings.geofenceLongitude),
        };
        const distance = distanceMeters(coords, school);
        const allowed = Number.isFinite(distance) && distance <= Number(settings.geofenceRadiusMeters || 100);
        setDevice({
          checking: false,
          mock: false,
          coords,
          allowed,
          text: allowed ? `Validated inside school boundary (${Math.round(distance)}m).` : 'Out of school boundary.',
        });
      },
      () => setDevice({ checking: false, mock: false, coords: null, allowed: false, text: 'GPS permission denied.' }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const markMyAttendance = async () => {
    try {
      const payload = await clockAttendance({
        action: 'clock-in',
        source: 'teacher-mobile',
        requiresGeofence: true,
        isMockLocation: device.mock === true,
        gpsLatitude: device.coords?.latitude,
        gpsLongitude: device.coords?.longitude,
        deviceId: localStorage.getItem('mgps_device_id') || navigator.userAgent,
        deviceType: navigator.userAgent,
        receptionQrVerified: true,
      });
      setMessage(payload.message || 'Teacher attendance marked.');
    } catch (clockError) {
      setMessage(clockError.message);
    }
  };

  const saveRegister = async () => {
    try {
      const payload = await saveStudentAttendanceBatch({
        className: assignedClass,
        attendanceDate,
        adminOverrideToken: overrideToken,
        records: roster.map((student) => ({
          entityId: student.entityId,
          admissionNumber: student.admissionNumber,
          status: draftStatus[student.entityId] === 'absent' ? 'absent' : 'present',
        })),
      });
      setMessage(payload.message || 'Class attendance saved.');
      reload();
    } catch (saveError) {
      setMessage(saveError.message);
    }
  };

  const resetDraft = () => {
    const next = {};
    roster.forEach((student) => {
      next[student.entityId] = student.todayLog?.status === 'absent' ? 'absent' : 'present';
    });
    setDraftStatus(next);
  };

  if (!assignedClass) {
    return (
      <div className="min-h-[70vh] grid place-items-center font-sans text-slate-900">
        <div className="max-w-md rounded-3xl border border-rose-100 bg-rose-50 p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-rose-700" />
          <h2 className="mt-3 text-lg font-black">Access denied</h2>
          <p className="mt-2 text-xs font-bold text-rose-700">
            Student attendance is restricted to designated class teachers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
              <CalendarCheck className="h-5 w-5 text-emerald-700" /> Attendance
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {session?.displayName || session?.username} | Class Teacher: {assignedClass}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <Metric label="Present" value={summary.present} tone="text-emerald-700 bg-emerald-50 border-emerald-100" />
            <Metric label="Absent" value={summary.absent} tone="text-rose-700 bg-rose-50 border-rose-100" />
          </div>
        </div>
      </section>

      {(message || error) && <div className="rounded-2xl bg-slate-900/90 px-4 py-3 text-xs font-bold text-white">{message || error}</div>}

      <section className="glass-card rounded-3xl p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500">Mark My Attendance</p>
            <p className="mt-1 text-sm font-black">{device.text}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={validateDevice} className="h-11 rounded-2xl glass-soft px-4 text-xs font-black inline-flex items-center gap-2">
              <LocateFixed className="h-4 w-4" /> Validate
            </button>
            <button type="button" disabled={!device.allowed} onClick={markMyAttendance} className="h-11 rounded-2xl btn-primary px-4 text-xs font-black disabled:opacity-40 inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Mark My Attendance
            </button>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-3xl p-5">
        <div className="flex flex-col gap-3 border-b border-slate-100/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-black">{assignedClass} Class Roster</h3>
            {isHistorical && (
              <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Historical editing needs Admin override token.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <DateShifter date={attendanceDate} setDate={setAttendanceDate} />
            {isHistorical && (
              <input
                value={overrideToken}
                onChange={(event) => setOverrideToken(event.target.value)}
                placeholder="Admin override token"
                className="h-10 rounded-2xl bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all px-3 text-xs font-bold"
              />
            )}
          </div>
        </div>

        <div className="mt-4 divide-y divide-slate-100/80 overflow-hidden rounded-2xl border border-slate-100/80">
          {roster.map((student) => {
            const status = draftStatus[student.entityId] || 'present';
            return (
              <div key={student.entityId} className="grid grid-cols-[56px_1fr_96px] items-center gap-2 bg-white/60 p-3 text-xs font-bold">
                <span className="font-mono text-slate-500">{student.rollNo || '-'}</span>
                <div className="min-w-0">
                  <p className="truncate font-black">{student.displayName}</p>
                  <p className="truncate text-[10px] text-slate-500">{student.admissionNumber}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <StatusButton label="A" active={status === 'absent'} tone="absent" onClick={() => setDraftStatus((draft) => ({ ...draft, [student.entityId]: 'absent' }))} />
                  <StatusButton label="P" active={status === 'present'} tone="present" onClick={() => setDraftStatus((draft) => ({ ...draft, [student.entityId]: 'present' }))} />
                </div>
              </div>
            );
          })}
          {!roster.length && (
            <p className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
              {isLoading ? 'Loading roster...' : 'No students found.'}
            </p>
          )}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 glass-strong px-4 py-3">
        <div className="mx-auto flex max-w-3xl justify-end gap-2">
          <button type="button" onClick={resetDraft} className="h-11 rounded-2xl border border-slate-200/70 bg-white/60 px-4 text-xs font-black inline-flex items-center gap-2">
            <X className="h-4 w-4" /> Cancel
          </button>
          <button type="button" onClick={resetDraft} className="h-11 rounded-2xl glass-soft px-4 text-xs font-black inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button type="button" disabled={!canSave} onClick={saveRegister} className="h-11 rounded-2xl btn-primary px-4 text-xs font-black disabled:opacity-40 inline-flex items-center gap-2">
            <Save className="h-4 w-4" /> Save Attendance
          </button>
        </div>
      </div>
    </div>
  );
};

const DateShifter = ({ date, setDate }) => (
  <div className="h-10 rounded-2xl glass-soft px-2 inline-flex items-center gap-1">
    <button type="button" onClick={() => setDate(addDays(date, -1))} className="grid h-8 w-8 place-items-center rounded-xl bg-white/70">
      <ChevronLeft className="h-4 w-4" />
    </button>
    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 bg-transparent text-xs font-black outline-none" />
    <button type="button" onClick={() => setDate(addDays(date, 1))} className="grid h-8 w-8 place-items-center rounded-xl bg-white/70">
      <ChevronRight className="h-4 w-4" />
    </button>
  </div>
);

const Metric = ({ label, value, tone }) => (
  <div className={`rounded-2xl border p-3 ${tone}`}>
    <p className="text-[10px] font-black uppercase">{label}</p>
    <p className="mt-1 text-xl font-black">{value}</p>
  </div>
);

const StatusButton = ({ label, active, tone, onClick }) => {
  const activeClass = tone === 'absent' ? 'bg-rose-600 text-white border-rose-700' : 'bg-emerald-600 text-white border-emerald-700';
  return (
    <button type="button" onClick={onClick} className={`h-10 w-10 rounded-full border text-sm font-black ${active ? activeClass : 'border-slate-200/70 bg-white/60 text-slate-500'}`}>
      {label}
    </button>
  );
};

export default Attendance;
