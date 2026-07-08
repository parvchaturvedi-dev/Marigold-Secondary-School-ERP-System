import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  ChevronDown,
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
  UsersRound,
  Wifi,
  X,
} from 'lucide-react';
import { useMasterData } from './masterData';
import { apiFetch, authFetch } from './api';
import StaffAttendanceReport from './StaffAttendanceReport';
import {
  clockAttendance,
  fetchStaffAttendanceRecords,
  saveAttendanceSettings,
  saveStudentAttendanceBatch,
  useAttendanceOverview,
} from './attendanceStore';

// Role-based sub-menu tabs for the Attendance Desk. Admin gets the full split;
// clerk/teacher get self + class register; student sees no tabs (own view).
const TAB_DEFS = {
  admin: [
    { key: 'students', label: 'Students Attendance', icon: CalendarDays },
    { key: 'staff', label: 'Staff Attendance', icon: UsersRound },
    { key: 'management', label: 'Attendance Management', icon: ShieldCheck },
  ],
  clerk: [
    { key: 'my', label: 'My Attendance', icon: Clock3 },
    { key: 'class', label: 'Class Attendance', icon: UsersRound },
  ],
  teacher: [
    { key: 'my', label: 'My Attendance', icon: Clock3 },
    { key: 'class', label: 'Class Attendance', icon: UsersRound },
  ],
};

// Format a Date as a LOCAL YYYY-MM-DD. Never use toISOString() here — it converts
// to UTC, which in ahead-of-UTC zones (e.g. IST +5:30) shifts the day, making the
// prev arrow jump 2 days and the next arrow appear to do nothing.
const toLocalKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const todayKey = () => toLocalKey(new Date());
const addDays = (date, days) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return toLocalKey(next);
};
const statusFromLog = (log) => (log?.status === 'absent' ? 'absent' : log ? 'present' : 'present');
const bssidPlaceholder = 'AA:BB:CC:DD:EE:FF';

// First / last day of the current month as LOCAL YYYY-MM-DD (never toISOString).
const monthStartKey = () => {
  const now = new Date();
  return toLocalKey(new Date(now.getFullYear(), now.getMonth(), 1));
};
const monthEndKey = () => {
  const now = new Date();
  return toLocalKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
};

// Format an ISO timestamp string as local hh:mm AM/PM. Returns '—' for null.
const formatClockTime = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const AttendanceControl = ({ role = 'admin' }) => {
  const isAdmin = role === 'admin';
  const tabs = role === 'student' ? [] : TAB_DEFS[role] || TAB_DEFS.admin;
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || '');
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

  // The student register (roster + A/P toggles + class dropdown + search +
  // DateShifter). Shared by admin's "Students Attendance" tab, clerk/teacher's
  // "Class Attendance" tab, and the student's own view. Scoping (which classes
  // are available) is untouched — driven by classNames from the overview.
  const registerSection = (
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

      {/* Quick bulk actions — TCS-style shortcuts so a teacher doesn't tap 40 rows. */}
      {roster.length > 0 && !isAdmin && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-indigo-50/50 border border-indigo-100 px-3 py-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quick actions</span>
          <button
            type="button"
            onClick={() => {
              const next = {};
              roster.forEach((s) => { next[s.entityId] = 'present'; });
              setDraftStatus((prev) => ({ ...prev, ...next }));
            }}
            className="h-8 px-3 rounded-xl bg-emerald-500 text-white text-[11px] font-black hover:bg-emerald-600 transition"
          >
            Mark all Present
          </button>
          <button
            type="button"
            onClick={() => {
              const next = {};
              roster.forEach((s) => { next[s.entityId] = 'absent'; });
              setDraftStatus((prev) => ({ ...prev, ...next }));
            }}
            className="h-8 px-3 rounded-xl bg-red-500 text-white text-[11px] font-black hover:bg-red-600 transition"
          >
            Mark all Absent
          </button>
          <button
            type="button"
            onClick={() => setDraftStatus({})}
            className="h-8 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-black hover:bg-slate-50 transition inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset draft
          </button>
          <div className="ml-auto text-[11px] font-black text-slate-700">
            Present <span className="text-emerald-600">{localCounts.present}</span> · Absent <span className="text-red-600">{localCounts.absent}</span> · Total {roster.length}
          </div>
        </div>
      )}

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
  );

  // Attendance Management tab (admin): role-summary metric cards + geofence /
  // WiFi / time-rules configurator + the legacy staff-attendance-record table.
  const managementSection = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 stagger">
        <MetricCard title="Clerk Attendance Summary" counts={roleSummary.clerk} />
        <MetricCard title="Teacher Attendance Summary" counts={roleSummary.teacher} />
        <MetricCard title="Student Attendance Summary" counts={roleSummary.student} />
      </div>

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

      <StaffAttendanceRecords />
    </div>
  );

  // The student register save-bar is only meaningful when a register is on screen.
  const registerVisible =
    role === 'student' ||
    (isAdmin && activeTab === 'students') ||
    (['clerk', 'teacher'].includes(role) && activeTab === 'class');

  return (
    <div className="space-y-6 pb-28 select-none font-sans text-slate-900">
      <section className="glass-card rounded-3xl p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-emerald-700" /> Attendance Desk
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {isAdmin
                ? 'Student registers, staff attendance, and geofence / policy management.'
                : role === 'student'
                  ? 'Your attendance summary and daily register.'
                  : 'Your daily clock-in / clock-out and the class attendance register.'}
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

        {tabs.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black transition-all ${
                    activeTab === tab.key
                      ? 'btn-primary border-transparent shadow-sm'
                      : 'bg-white/50 text-slate-500 border-slate-100/80 hover:bg-white/70'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {(message || error) && (
        <div className="rounded-2xl bg-linear-to-r from-indigo-500 to-violet-500 shadow-lg px-4 py-3 text-xs font-bold text-white">
          {message || error}
        </div>
      )}

      {/* STUDENT — own view (self clock + summary + register), no tabs. */}
      {role === 'student' && (
        <>
          <section className="glass-card rounded-3xl p-6">
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
          </section>
          {registerSection}
        </>
      )}

      {/* ADMIN tabs */}
      {isAdmin && activeTab === 'students' && registerSection}
      {isAdmin && activeTab === 'staff' && <StaffAttendanceReport />}
      {isAdmin && activeTab === 'management' && managementSection}

      {/* CLERK / TEACHER tabs */}
      {['clerk', 'teacher'].includes(role) && activeTab === 'my' && <MyAttendancePanel />}
      {['clerk', 'teacher'].includes(role) && activeTab === 'class' && registerSection}

      {/* Rendered via a portal to <body> so its `fixed` positioning is relative to
          the viewport — the glass UI's backdrop-blur/transform ancestors would
          otherwise re-anchor a plain `fixed` element and float it mid-content.
          Only shown when a student register is actually on screen. */}
      {registerVisible &&
        createPortal(
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/70 bg-white/80 px-6 py-3 backdrop-blur-xl">
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
          </div>,
          document.body
        )}
    </div>
  );
};

// Self clock-in / clock-out for clerks and teachers. Reads GET
// /attendance/my-clock-status on load and shows ONLY the next valid action:
//   not clocked in   -> Check GPS + Clock In
//   clocked in only  -> Clock Out
//   both done        -> "Done for today" summary (no buttons)
// 409s from the clock endpoint (already clocked in / clock in first) surface as
// a friendly banner and trigger a status refetch.
const MyAttendancePanel = () => {
  const [gps, setGps] = useState({ checking: false, allowed: false, text: 'GPS not checked', coords: null });
  const [status, setStatus] = useState({ loading: true, error: '', data: null });
  const [banner, setBanner] = useState('');
  const [working, setWorking] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatus((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await apiFetch('/attendance/my-clock-status');
      setStatus({ loading: false, error: '', data: data || {} });
    } catch (loadError) {
      setStatus({ loading: false, error: loadError.message || 'Could not load your clock status.', data: null });
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const checkGps = () => {
    if (!navigator.geolocation) {
      setGps({ checking: false, allowed: false, text: 'GPS unavailable on this device', coords: null });
      return;
    }
    setGps((current) => ({ ...current, checking: true, text: 'Checking GPS...' }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          checking: false,
          allowed: true,
          text: 'GPS captured for secure clock action',
          coords: { gpsLatitude: position.coords.latitude, gpsLongitude: position.coords.longitude },
        });
      },
      () => setGps({ checking: false, allowed: false, text: 'GPS permission denied or unavailable', coords: null }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const doClock = async (action) => {
    setBanner('');
    setWorking(true);
    try {
      // authFetch (not apiFetch) so the 409 status is inspectable rather than
      // collapsed into a generic thrown Error.
      const response = await authFetch('/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          source: 'self',
          requiresGeofence: true,
          deviceId: localStorage.getItem('mgps_device_id') || navigator.userAgent,
          deviceType: navigator.userAgent,
          ...(gps.coords || {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setBanner(
          payload?.message ||
            (action === 'clock-in' ? 'You are already clocked in for today.' : 'Please clock in first.')
        );
        await loadStatus();
        return;
      }
      if (!response.ok) {
        setBanner(payload?.message || 'Clock action could not complete. Please try again.');
        return;
      }
      setBanner(payload?.message || 'Clock action recorded.');
      await loadStatus();
    } catch (clockError) {
      setBanner(clockError.message || 'Clock action failed.');
    } finally {
      setWorking(false);
    }
  };

  const data = status.data || {};
  // Endpoint shape isn't finalised yet — read defensively across a few likely keys.
  const clockInAt = data.clockInAt || data.clockIn || data.inAt || data.clockInTime || null;
  const clockOutAt = data.clockOutAt || data.clockOut || data.outAt || data.clockOutTime || null;
  const stateLabel = String(data.status || data.state || '').toLowerCase();
  const clockedIn =
    Boolean(clockInAt) ||
    data.clockedIn === true ||
    ['clocked-in', 'clocked_in', 'clocked-out', 'clocked_out', 'in', 'out', 'present', 'complete', 'completed', 'done'].includes(stateLabel);
  const clockedOut =
    Boolean(clockOutAt) ||
    data.clockedOut === true ||
    ['clocked-out', 'clocked_out', 'out', 'complete', 'completed', 'done'].includes(stateLabel);

  return (
    <section className="glass-card rounded-3xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Clock3 className="w-5 h-5 text-emerald-700" />
        <div>
          <h3 className="text-sm font-black">My Attendance</h3>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">
            Secure geofenced clock-in and clock-out for your daily attendance.
          </p>
        </div>
      </div>

      {banner && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs font-black text-amber-800">
          {banner}
        </div>
      )}
      {status.error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-black text-rose-700">
          {status.error}
        </div>
      )}

      {status.loading ? (
        <div className="glass-soft rounded-2xl p-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
          Loading your attendance status...
        </div>
      ) : clockedIn && clockedOut ? (
        <div className="glass-soft rounded-2xl p-5">
          <p className="text-[10px] font-black uppercase text-emerald-700">Done for today</p>
          <p className="mt-2 text-sm font-black text-slate-700">
            In: {formatClockTime(clockInAt)} &nbsp;·&nbsp; Out: {formatClockTime(clockOutAt)}
          </p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">
            Your attendance for today is complete. See you tomorrow.
          </p>
        </div>
      ) : clockedIn ? (
        <div className="glass-soft rounded-2xl p-5 space-y-3">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500">Clocked in</p>
            <p className="mt-1 text-sm font-black text-slate-700">In: {formatClockTime(clockInAt)}</p>
          </div>
          <button
            type="button"
            onClick={() => doClock('clock-out')}
            disabled={working}
            className="h-11 px-5 rounded-2xl btn-primary text-xs font-black inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Clock3 className="w-4 h-4" /> {working ? 'Please wait...' : 'Clock Out'}
          </button>
        </div>
      ) : (
        <div className="glass-soft rounded-2xl p-5 space-y-3">
          <p className="text-sm font-black">{gps.text}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={checkGps}
              disabled={gps.checking}
              className="h-11 px-4 rounded-2xl btn-ghost text-xs font-black inline-flex items-center gap-2 disabled:opacity-40"
            >
              <LocateFixed className="w-4 h-4" /> {gps.checking ? 'Checking...' : 'Check GPS'}
            </button>
            <button
              type="button"
              onClick={() => doClock('clock-in')}
              disabled={!gps.allowed || working}
              className="h-11 px-5 rounded-2xl bg-emerald-600 text-white text-xs font-black inline-flex items-center gap-2 disabled:opacity-40"
            >
              <Clock3 className="w-4 h-4" /> {working ? 'Please wait...' : 'Clock In'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

const StaffAttendanceRecords = () => {
  const [from, setFrom] = useState(monthStartKey());
  const [to, setTo] = useState(monthEndKey());
  const [state, setState] = useState({ isLoading: false, error: '', data: null });
  const [expanded, setExpanded] = useState({});

  const load = async (rangeFrom, rangeTo) => {
    setState((current) => ({ ...current, isLoading: true, error: '' }));
    try {
      const data = await fetchStaffAttendanceRecords({ from: rangeFrom, to: rangeTo });
      setState({ isLoading: false, error: '', data });
      setExpanded({});
    } catch (loadError) {
      setState({ isLoading: false, error: loadError.message || 'Could not load staff records.', data: null });
    }
  };

  useEffect(() => {
    load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const staff = state.data?.staff || [];

  return (
    <section className="glass-card rounded-3xl p-5 space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-100/80 pb-4">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2">
            <UsersRound className="w-4 h-4 text-emerald-700" /> Staff Attendance Record
          </h3>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            Days present and daily clock-in / clock-out times for every teacher and clerk.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-black uppercase text-slate-500">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 h-10 w-full rounded-2xl bg-white/60 border border-white/80 px-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
          </label>
          <label className="text-[10px] font-black uppercase text-slate-500">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 h-10 w-full rounded-2xl bg-white/60 border border-white/80 px-3 text-xs font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
            />
          </label>
          <button
            type="button"
            onClick={() => load(from, to)}
            disabled={state.isLoading}
            className="h-10 px-4 rounded-2xl btn-primary text-xs font-black inline-flex items-center gap-2 disabled:opacity-40"
          >
            <RefreshCcw className="w-4 h-4" /> {state.isLoading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>

      {state.error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-black text-rose-700">
          {state.error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-100/80">
        <table className="w-full min-w-180 text-left text-xs font-bold">
          <thead className="bg-indigo-50/60 text-slate-500 uppercase text-[10px]">
            <tr>
              <th className="px-3 py-3">Staff Name</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Days Present</th>
              <th className="px-3 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {staff.map((person) => {
              const isOpen = Boolean(expanded[person.entityId]);
              const hasDays = person.days.length > 0;
              return (
                <React.Fragment key={person.entityId}>
                  <tr className="hover:bg-white/60">
                    <td className="px-3 py-3">
                      <p className="font-black">{person.displayName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{person.entityId}</p>
                    </td>
                    <td className="px-3 py-3 capitalize text-slate-500">{person.role}</td>
                    <td className="px-3 py-3">
                      <span className={`text-lg font-black ${person.daysPresent > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {person.daysPresent}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setExpanded((current) => ({ ...current, [person.entityId]: !isOpen }))}
                        disabled={!hasDays}
                        className="h-8 px-3 rounded-xl bg-white/70 border border-white/80 text-[11px] font-black inline-flex items-center gap-1 disabled:opacity-40"
                      >
                        {isOpen ? 'Hide' : 'View'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {isOpen && hasDays && (
                    <tr>
                      <td colSpan="4" className="px-3 pb-4">
                        <div className="overflow-x-auto rounded-xl border border-slate-100/80 bg-white/40">
                          <table className="w-full text-left text-[11px] font-bold">
                            <thead className="bg-emerald-50/60 text-slate-500 uppercase text-[9px]">
                              <tr>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Clock In</th>
                                <th className="px-3 py-2">Clock Out</th>
                                <th className="px-3 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/70">
                              {person.days.map((day) => (
                                <tr key={day.date}>
                                  <td className="px-3 py-2 font-mono">{day.date}</td>
                                  <td className="px-3 py-2 font-mono text-emerald-700">{formatClockTime(day.clockInAt)}</td>
                                  <td className="px-3 py-2 font-mono text-indigo-700">{formatClockTime(day.clockOutAt)}</td>
                                  <td className="px-3 py-2 capitalize text-slate-500">{day.status || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!hasDays && (
                    <tr>
                      <td colSpan="4" className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        No clock-ins in this range
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {!staff.length && (
              <tr>
                <td colSpan="4" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  {state.isLoading ? 'Loading staff records...' : 'No teachers or clerks found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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

// Attendance can be marked for today or any past day, never the future. The next
// arrow is disabled at today and the picker's `max` blocks forward dates.
const DateShifter = ({ date, setDate }) => {
  const today = todayKey();
  const atToday = date >= today;
  return (
    <div className="h-10 rounded-2xl bg-white/60 border border-white/80 px-2 inline-flex items-center gap-1">
      <button type="button" onClick={() => setDate(addDays(date, -1))} className="h-8 w-8 grid place-items-center rounded-xl bg-white/70" title="Previous date">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(event) => {
          const value = event.target.value;
          setDate(value && value > today ? today : value);
        }}
        className="h-8 bg-transparent px-1 text-xs font-black outline-none"
      />
      <button
        type="button"
        onClick={() => { if (!atToday) setDate(addDays(date, 1)); }}
        disabled={atToday}
        className="h-8 w-8 grid place-items-center rounded-xl bg-white/70 disabled:opacity-40 disabled:cursor-not-allowed"
        title={atToday ? 'Cannot select a future date' : 'Next date'}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

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
