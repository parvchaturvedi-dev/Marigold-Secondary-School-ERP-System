import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LocateFixed,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react';
import { useMasterData } from './masterData';
import {
  clockAttendance,
  saveAttendanceSettings,
  saveStudentAttendanceBatch,
  useAttendanceOverview,
} from './attendanceStore';

const todayKey = () => new Date().toISOString().slice(0, 10);
const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};
const statusFromLog = (log) => (log?.status === 'absent' ? 'absent' : log ? 'present' : 'present');
const bssidPlaceholder = 'AA:BB:CC:DD:EE:FF';

const AttendanceControl = ({ role = 'admin' }) => {
  const isAdmin = role === 'admin';
  const masterData = useMasterData();
  const [selectedClass, setSelectedClass] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(todayKey());
  const [searchTerm, setSearchTerm] = useState('');
  const [draftStatus, setDraftStatus] = useState({});
  const [message, setMessage] = useState('');
  const [gpsState, setGpsState] = useState({ checking: false, allowed: false, text: 'GPS not checked', coords: null });
  const [settingsDraft, setSettingsDraft] = useState({
    presentUntil: '08:30',
    halfDayUntil: '10:30',
    closeAfter: '11:00',
    timezone: 'Asia/Kolkata',
    allowTeacherQrScan: true,
    schoolAddress: '',
    geofenceLatitude: '',
    geofenceLongitude: '',
    geofenceRadiusMeters: 100,
    authorizedWifiBssid: '',
    enforceReceptionQr: false,
  });

  const { overview, isLoading, error, reload } = useAttendanceOverview({
    date: attendanceDate,
    className: selectedClass,
    period: 'monthly',
  });

  const classNames = useMemo(
    () =>
      masterData.classNames.length
        ? masterData.classNames
        : [...new Set((overview?.roster || []).map((student) => student.className).filter(Boolean))],
    [masterData.classNames, overview?.roster]
  );

  useEffect(() => {
    if (!selectedClass && classNames[0]) setSelectedClass(classNames[0]);
  }, [classNames, selectedClass]);

  useEffect(() => {
    if (!overview?.settings) return;
    setSettingsDraft((draft) => ({
      ...draft,
      ...overview.settings,
      geofenceLatitude: overview.settings.geofenceLatitude ?? '',
      geofenceLongitude: overview.settings.geofenceLongitude ?? '',
      geofenceRadiusMeters: overview.settings.geofenceRadiusMeters || 100,
      authorizedWifiBssid: overview.settings.authorizedWifiBssid || '',
      enforceReceptionQr: overview.settings.enforceReceptionQr === true,
    }));
  }, [overview?.settings]);

  useEffect(() => {
    const next = {};
    (overview?.roster || []).forEach((student) => {
      next[student.entityId] = statusFromLog(student.todayLog);
    });
    setDraftStatus(next);
  }, [overview?.roster]);

  const roster = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return (overview?.roster || [])
      .filter((student) => {
        const blob = [student.rollNo, student.displayName, student.admissionNumber, student.fatherName, student.mobileNumber]
          .join(' ')
          .toLowerCase();
        return !needle || blob.includes(needle);
      })
      .sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0) || a.displayName.localeCompare(b.displayName));
  }, [overview?.roster, searchTerm]);

  const localCounts = useMemo(
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

  const roleSummary = overview?.roleSummary || {};
  const mapSrc =
    settingsDraft.geofenceLatitude && settingsDraft.geofenceLongitude
      ? `https://maps.google.com/maps?q=${settingsDraft.geofenceLatitude},${settingsDraft.geofenceLongitude}&z=16&output=embed`
      : `https://maps.google.com/maps?q=${encodeURIComponent(settingsDraft.schoolAddress || 'school')}&z=15&output=embed`;

  const setStudentStatus = (student, status) => {
    setDraftStatus((current) => ({ ...current, [student.entityId]: status }));
  };

  const resetDraft = () => {
    const next = {};
    (overview?.roster || []).forEach((student) => {
      next[student.entityId] = statusFromLog(student.todayLog);
    });
    setDraftStatus(next);
  };

  const saveRegister = async () => {
    try {
      const payload = await saveStudentAttendanceBatch({
        className: selectedClass,
        attendanceDate,
        records: roster.map((student) => ({
          entityId: student.entityId,
          admissionNumber: student.admissionNumber,
          status: draftStatus[student.entityId] === 'absent' ? 'absent' : 'present',
        })),
      });
      setMessage(payload.message || 'Attendance saved.');
      reload();
    } catch (saveError) {
      setMessage(saveError.message);
    }
  };

  const saveSettings = async () => {
    try {
      await saveAttendanceSettings(settingsDraft);
      setMessage('Geofence and security configuration saved.');
      reload();
    } catch (saveError) {
      setMessage(saveError.message);
    }
  };

  const searchAddress = async () => {
    if (!settingsDraft.schoolAddress.trim()) {
      setMessage('Enter a school address first.');
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(settingsDraft.schoolAddress)}`
      );
      const [result] = await response.json();
      if (!result) {
        setMessage('No map result found for this address.');
        return;
      }
      setSettingsDraft((draft) => ({
        ...draft,
        geofenceLatitude: Number(result.lat).toFixed(6),
        geofenceLongitude: Number(result.lon).toFixed(6),
      }));
      setMessage('Map location resolved. Review the pin and save.');
    } catch {
      setMessage('Address search could not complete. You can enter latitude and longitude manually.');
    }
  };

  const checkGps = () => {
    if (!navigator.geolocation) {
      setGpsState({ checking: false, allowed: false, text: 'GPS unavailable on this device', coords: null });
      return;
    }
    setGpsState((current) => ({ ...current, checking: true, text: 'Checking GPS...' }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          gpsLatitude: position.coords.latitude,
          gpsLongitude: position.coords.longitude,
        };
        setGpsState({ checking: false, allowed: true, text: 'GPS captured for secure clock action', coords });
      },
      () => setGpsState({ checking: false, allowed: false, text: 'GPS permission denied or unavailable', coords: null }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clock = async (action) => {
    try {
      const payload = await clockAttendance({
        action,
        source: 'clerk-self',
        requiresGeofence: true,
        deviceId: localStorage.getItem('mgps_device_id') || navigator.userAgent,
        deviceType: navigator.userAgent,
        ...(gpsState.coords || {}),
      });
      setMessage(payload.message || 'Clock action recorded.');
    } catch (clockError) {
      setMessage(clockError.message);
    }
  };

  return (
    <div className="space-y-6 pb-28 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-700" />
              {isAdmin ? 'Admin Attendance Control Center' : 'Clerk Attendance Management'}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {isAdmin
                ? 'Global monitoring, geofence rules, reception QR policy, and historical overrides.'
                : 'Self-service staff attendance and full student register CRUD.'}
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="h-10 px-4 rounded-2xl btn-primary text-xs font-black inline-flex items-center justify-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {isAdmin ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 stagger">
            <MetricCard title="Clerk Attendance Summary" counts={roleSummary.clerk} />
            <MetricCard title="Teacher Attendance Summary" counts={roleSummary.teacher} />
            <MetricCard title="Student Attendance Summary" counts={roleSummary.student} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 glass-soft rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">My Attendance</p>
              <p className="mt-1 text-sm font-black">{gpsState.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={checkGps} className="h-10 px-4 rounded-2xl btn-ghost text-xs font-black inline-flex items-center gap-2">
                  <LocateFixed className="w-4 h-4" /> Check GPS
                </button>
                <button type="button" onClick={() => clock('clock-in')} disabled={!gpsState.allowed} className="h-10 px-4 rounded-2xl bg-emerald-600 text-white text-xs font-black disabled:opacity-40">
                  Clock-In
                </button>
                <button type="button" onClick={() => clock('clock-out')} disabled={!gpsState.allowed} className="h-10 px-4 rounded-2xl btn-primary text-xs font-black disabled:opacity-40">
                  Clock-Out
                </button>
              </div>
            </div>
            <MetricCard title="Student Attendance Summary" counts={{ ...localCounts, late: overview?.counts?.['half-day'] || 0, total: roster.length }} />
          </div>
        )}
      </section>

      {(message || error) && (
        <div className="rounded-2xl bg-linear-to-r from-indigo-500 to-violet-500 shadow-lg px-4 py-3 text-xs font-bold text-white">
          {message || error}
        </div>
      )}

      {isAdmin && (
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Geofencing & Security Configurator
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
              <input
                value={settingsDraft.schoolAddress}
                onChange={(event) => setSettingsDraft((draft) => ({ ...draft, schoolAddress: event.target.value }))}
                placeholder="Search school address"
                className="lg:col-span-3 h-11 rounded-2xl bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all px-3 text-xs font-bold outline-none"
              />
              <button type="button" onClick={searchAddress} className="h-11 rounded-2xl btn-primary text-xs font-black inline-flex items-center justify-center gap-2">
                <Search className="w-4 h-4" /> Search
              </button>
            </div>
            <iframe title="School geofence map" src={mapSrc} className="h-72 w-full rounded-2xl border border-white/70 bg-white/50" loading="lazy" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Field label="Latitude" value={settingsDraft.geofenceLatitude} onChange={(value) => setSettingsDraft((draft) => ({ ...draft, geofenceLatitude: value }))} />
              <Field label="Longitude" value={settingsDraft.geofenceLongitude} onChange={(value) => setSettingsDraft((draft) => ({ ...draft, geofenceLongitude: value }))} />
              <label className="glass-soft rounded-2xl p-3 text-xs font-black">
                Radius: {settingsDraft.geofenceRadiusMeters}m
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="50"
                  value={settingsDraft.geofenceRadiusMeters}
                  onChange={(event) => setSettingsDraft((draft) => ({ ...draft, geofenceRadiusMeters: Number(event.target.value) }))}
                  className="mt-3 w-full"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="glass-soft rounded-2xl p-3 text-xs font-black">
                <span className="flex items-center gap-2 text-slate-500"><Wifi className="w-4 h-4" /> Authorized WiFi BSSID</span>
                <input
                  value={settingsDraft.authorizedWifiBssid}
                  onChange={(event) => setSettingsDraft((draft) => ({ ...draft, authorizedWifiBssid: event.target.value }))}
                  placeholder={bssidPlaceholder}
                  className="mt-2 w-full bg-transparent font-mono outline-none"
                />
              </label>
              <label className="glass-soft rounded-2xl p-3 text-xs font-black flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500"><ShieldCheck className="w-4 h-4" /> Enforce Reception QR</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.enforceReceptionQr}
                  onChange={(event) => setSettingsDraft((draft) => ({ ...draft, enforceReceptionQr: event.target.checked }))}
                  className="h-5 w-5"
                />
              </label>
            </div>
            <button type="button" onClick={saveSettings} className="h-11 px-5 rounded-2xl btn-primary text-xs font-black inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> Save Global Configuration
            </button>
          </div>

          <div className="xl:col-span-5 glass-card rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Clock3 className="w-4 h-4" /> Time Rules
            </h3>
            {[
              ['presentUntil', 'Present until'],
              ['halfDayUntil', 'Late/Half-day until'],
              ['closeAfter', 'Close after'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 glass-soft rounded-2xl p-3 text-xs font-black">
                {label}
                <input type="time" value={settingsDraft[key]} onChange={(event) => setSettingsDraft((draft) => ({ ...draft, [key]: event.target.value }))} className="bg-white/60 rounded-xl px-3 py-2 font-mono outline-none" />
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="glass-card rounded-3xl p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-100/80 pb-4">
          <div>
            <h3 className="text-sm font-black">{isAdmin ? 'Global Override Action' : 'Student Attendance CRUD'}</h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1">
              {selectedClass || 'Select class'} | {attendanceDate} | Present {localCounts.present} / Absent {localCounts.absent}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="h-10 rounded-2xl bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all px-3 text-xs font-bold outline-none">
              {classNames.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
            <DateShifter date={attendanceDate} setDate={setAttendanceDate} />
            <label className="h-10 rounded-2xl bg-white/60 border border-white/80 px-3 text-xs font-bold inline-flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500" />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search roster" className="w-40 bg-transparent outline-none" />
            </label>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100/80">
          <table className="w-full min-w-180 text-left text-xs font-bold">
            <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
              <tr>
                <th className="px-3 py-3">Roll No</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Admission</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {roster.map((student) => {
                const status = draftStatus[student.entityId] || 'present';
                return (
                  <tr key={student.entityId} className="hover:bg-white/60">
                    <td className="px-3 py-3 font-mono">{student.rollNo || '-'}</td>
                    <td className="px-3 py-3">
                      <p className="font-black">{student.displayName}</p>
                      <p className="text-[10px] text-slate-500">{student.className}-{student.section || '-'}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-500">{student.admissionNumber}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <StatusButton label="A" active={status === 'absent'} tone="absent" onClick={() => setStudentStatus(student, 'absent')} />
                        <StatusButton label="P" active={status === 'present'} tone="present" onClick={() => setStudentStatus(student, 'present')} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!roster.length && (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    {isLoading ? 'Loading roster...' : 'No students found for this class.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="fixed -bottom-full left-0 right-0 z-30 border-t border-white/70 bg-white/70 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl justify-end gap-2">
          <button type="button" onClick={resetDraft} className="h-11 px-4 rounded-2xl btn-ghost text-xs font-black inline-flex items-center gap-2">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button type="button" onClick={resetDraft} className="h-11 px-4 rounded-2xl btn-ghost text-xs font-black inline-flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <button type="button" onClick={saveRegister} className="h-11 px-5 rounded-2xl btn-primary text-xs font-black inline-flex items-center gap-2">
            <Save className="w-4 h-4" /> {isAdmin ? 'Save' : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, counts = {} }) => (
  <article className="glass-soft rounded-2xl p-4">
    <p className="text-[10px] font-black uppercase text-slate-500">{title}</p>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <MiniMetric label="Present" value={counts?.present || 0} tone="text-emerald-700" />
      <MiniMetric label="Absent" value={counts?.absent || 0} tone="text-rose-700" />
      <MiniMetric label="Late" value={counts?.late || 0} tone="text-amber-700" />
    </div>
  </article>
);

const MiniMetric = ({ label, value, tone }) => (
  <div className="rounded-xl bg-white/60 p-2">
    <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
    <p className={`text-xl font-black ${tone}`}>{value}</p>
  </div>
);

const Field = ({ label, value, onChange }) => (
  <label className="glass-soft rounded-2xl p-3 text-xs font-black">
    <span className="text-slate-500">{label}</span>
    <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent font-mono outline-none" />
  </label>
);

const DateShifter = ({ date, setDate }) => (
  <div className="h-10 rounded-2xl bg-white/60 border border-white/80 px-2 inline-flex items-center gap-1">
    <button type="button" onClick={() => setDate(addDays(date, -1))} className="h-8 w-8 grid place-items-center rounded-xl bg-white/70" title="Previous date">
      <ChevronLeft className="w-4 h-4" />
    </button>
    <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 bg-transparent px-1 text-xs font-black outline-none" />
    <button type="button" onClick={() => setDate(addDays(date, 1))} className="h-8 w-8 grid place-items-center rounded-xl bg-white/70" title="Next date">
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>
);

const StatusButton = ({ label, active, tone, onClick }) => {
  const activeClass = tone === 'absent' ? 'bg-rose-600 text-white border-rose-700' : 'bg-emerald-600 text-white border-emerald-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 w-10 rounded-full border text-sm font-black transition-colors ${
        active ? activeClass : 'bg-white/60 text-slate-500 border-white/80'
      }`}
    >
      {label}
    </button>
  );
};

export default AttendanceControl;
