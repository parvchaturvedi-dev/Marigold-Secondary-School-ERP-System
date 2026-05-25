import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck2,
  Clock3,
  Fingerprint,
  IdCard,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMasterData } from './masterData';
import {
  fetchAttendanceDirectory,
  fetchAttendanceLogs,
  registerBiometric,
  saveAttendanceSettings,
  scanAttendance,
  useAttendanceOverview,
} from './attendanceStore';

const todayKey = () => new Date().toISOString().slice(0, 10);
const normalize = (value = '') => String(value || '').trim().toLowerCase();

const statusTone = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'half-day': 'bg-amber-50 text-amber-700 border-amber-100',
  absent: 'bg-rose-50 text-rose-700 border-rose-100',
  manual: 'bg-blue-50 text-blue-700 border-blue-100',
  unmarked: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

const sourceLabel = {
  qr: 'QR Scan',
  biometric: 'Biometric',
  manual: 'Manual',
};

const AttendanceControl = ({ role = 'admin' }) => {
  const masterData = useMasterData();
  const [selectedClass, setSelectedClass] = useState(masterData.classNames[0] || '');
  const [attendanceDate, setAttendanceDate] = useState(todayKey());
  const [period, setPeriod] = useState('monthly');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [biometricToken, setBiometricToken] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('student');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [directory, setDirectory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState('');
  const { overview, isLoading, error, reload } = useAttendanceOverview({
    date: attendanceDate,
    className: selectedClass,
    period,
  });
  const [settingsDraft, setSettingsDraft] = useState({
    presentUntil: '08:30',
    halfDayUntil: '10:30',
    closeAfter: '11:00',
    timezone: 'Asia/Kolkata',
    allowTeacherQrScan: true,
  });

  const canManageBiometric = ['admin', 'clerk'].includes(role);

  useEffect(() => {
    if (!selectedClass && masterData.classNames[0]) setSelectedClass(masterData.classNames[0]);
  }, [masterData.classNames, selectedClass]);

  useEffect(() => {
    if (overview?.settings) {
      setSettingsDraft({
        presentUntil: overview.settings.presentUntil || '08:30',
        halfDayUntil: overview.settings.halfDayUntil || '10:30',
        closeAfter: overview.settings.closeAfter || '11:00',
        timezone: overview.settings.timezone || 'Asia/Kolkata',
        allowTeacherQrScan: overview.settings.allowTeacherQrScan !== false,
      });
    }
  }, [overview?.settings]);

  useEffect(() => {
    let mounted = true;
    fetchAttendanceDirectory({ type: selectedEntityType, className: selectedEntityType === 'student' ? selectedClass : '' })
      .then((payload) => {
        if (mounted) setDirectory(payload.rows || []);
      })
      .catch((loadError) => setMessage(loadError.message));
    return () => {
      mounted = false;
    };
  }, [selectedClass, selectedEntityType]);

  useEffect(() => {
    fetchAttendanceLogs({ period, className: selectedClass })
      .then((payload) => setLogs(payload.logs || []))
      .catch((loadError) => setMessage(loadError.message));
  }, [period, selectedClass, overview]);

  const classNames = masterData.classNames.length
    ? masterData.classNames
    : [...new Set((overview?.roster || []).map((student) => student.className).filter(Boolean))];

  const visibleRoster = useMemo(() => {
    const needle = normalize(searchTerm);
    return (overview?.roster || [])
      .filter((student) => {
        const blob = [
          student.displayName,
          student.admissionNumber,
          student.entityId,
          student.fatherName,
          student.motherName,
          student.mobileNumber,
        ]
          .join(' ')
          .toLowerCase();
        return !needle || blob.includes(needle);
      })
      .sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0) || a.displayName.localeCompare(b.displayName));
  }, [overview?.roster, searchTerm]);

  const filteredDirectory = useMemo(() => {
    const needle = normalize(searchTerm);
    return directory.filter((item) => {
      const blob = [item.displayName, item.entityId, item.admissionNumber, item.className, item.mobileNumber]
        .join(' ')
        .toLowerCase();
      return !needle || blob.includes(needle);
    });
  }, [directory, searchTerm]);

  const selectedPerson = filteredDirectory.find((item) => item.entityId === selectedEntityId) || filteredDirectory[0] || null;

  const handleSaveSettings = async () => {
    try {
      await saveAttendanceSettings(settingsDraft);
      setMessage('Attendance time rules saved.');
      reload();
    } catch (saveError) {
      setMessage(saveError.message);
    }
  };

  const handleQrScan = async () => {
    if (!scanInput.trim()) {
      setMessage('QR payload, admission number, or employee ID required.');
      return;
    }

    try {
      const payload = await scanAttendance({
        source: 'qr',
        qrPayload: scanInput,
        admissionNumber: scanInput,
        entityId: scanInput,
        attendanceDate,
        deviceId: 'erp-qr-console',
      });
      setMessage(payload.message || 'Attendance marked.');
      setScanInput('');
      reload();
    } catch (scanError) {
      setMessage(scanError.message);
    }
  };

  const handleBiometricAttendance = async () => {
    if (!biometricToken.trim()) {
      setMessage('Biometric device token required.');
      return;
    }

    try {
      const payload = await scanAttendance({
        source: 'biometric',
        biometricToken,
        attendanceDate,
        deviceId: 'erp-biometric-console',
      });
      setMessage(payload.message || 'Biometric attendance marked.');
      setBiometricToken('');
      reload();
    } catch (scanError) {
      setMessage(scanError.message);
    }
  };

  const handleRegisterBiometric = async () => {
    if (!selectedPerson || !biometricToken.trim()) {
      setMessage('Select a profile and enter the biometric token.');
      return;
    }

    try {
      await registerBiometric({
        entityType: selectedPerson.entityType,
        entityId: selectedPerson.entityId,
        admissionNumber: selectedPerson.admissionNumber,
        biometricToken,
      });
      setMessage(`${selectedPerson.displayName} biometric saved and linked with profile.`);
      setBiometricToken('');
      const payload = await fetchAttendanceDirectory({
        type: selectedEntityType,
        className: selectedEntityType === 'student' ? selectedClass : '',
      });
      setDirectory(payload.rows || []);
    } catch (saveError) {
      setMessage(saveError.message);
    }
  };

  const markManual = async (student, status = 'manual') => {
    try {
      await scanAttendance({
        source: 'qr',
        entityType: student.entityType,
        entityId: student.entityId,
        admissionNumber: student.admissionNumber,
        attendanceDate,
        status,
        force: true,
        note: 'Manual correction from attendance desk',
      });
      setMessage(`${student.displayName} attendance updated.`);
      reload();
    } catch (saveError) {
      setMessage(saveError.message);
    }
  };

  return (
    <div className="space-y-6 pb-8 select-none font-sans text-[#1A1A1A]">
      <section className="bg-white border border-[#C8C8C8] rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-emerald-700" /> Smart Attendance Control
          </h2>
          <p className="text-xs font-bold text-[#555555] mt-1">
            QR ID card scan, biometric fallback, live logs, timing rules, and profile-linked audit.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-full xl:min-w-[520px]">
          <Metric label="Roster" value={overview?.counts?.total || 0} />
          <Metric label="Present" value={overview?.counts?.present || 0} tone="text-emerald-700" />
          <Metric label="Half Day" value={overview?.counts?.['half-day'] || 0} tone="text-amber-700" />
          <Metric label="Unmarked" value={overview?.counts?.unmarked || 0} tone="text-neutral-500" />
        </div>
      </section>

      {(message || error) && (
        <div className="bg-[#1A1A1A] text-white border border-black rounded-2xl px-4 py-3 text-xs font-bold">
          {message || error}
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black flex items-center gap-2">
                  <Users className="w-4 h-4" /> Classwise Live Register
                </h3>
                <p className="text-[10px] font-bold text-[#555555] mt-1">
                  {selectedClass || 'All Classes'} | {attendanceDate}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold outline-none"
                >
                  <option value="">All Classes</option>
                  {classNames.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(event) => setAttendanceDate(event.target.value)}
                  className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold outline-none"
                />
                <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#555555]" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search"
                    className="bg-transparent outline-none text-xs font-bold w-40"
                  />
                </div>
                <button
                  type="button"
                  onClick={reload}
                  className="w-10 h-10 grid place-items-center bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl"
                  title="Refresh attendance"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA]">
              <table className="w-full min-w-[900px] text-left text-xs font-bold">
                <thead className="bg-[#EAEAEA] text-[#555555] uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-3">Roll</th>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Admission</th>
                    <th className="px-3 py-3">Parents / Mobile</th>
                    <th className="px-3 py-3">Today</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3 text-right">Manual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA]">
                  {visibleRoster.map((student) => {
                    const status = student.todayLog?.status || 'unmarked';
                    return (
                      <tr key={`${student.entityType}-${student.entityId}`} className="hover:bg-[#F8F8F8]">
                        <td className="px-3 py-3 font-mono">{student.rollNo || '-'}</td>
                        <td className="px-3 py-3">
                          <p className="font-black">{student.displayName}</p>
                          <p className="text-[10px] text-[#555555]">{student.className}-{student.section || '-'}</p>
                        </td>
                        <td className="px-3 py-3 font-mono text-[#555555]">{student.admissionNumber}</td>
                        <td className="px-3 py-3 text-[#555555]">
                          <p>{student.fatherName || student.motherName || '-'}</p>
                          <p className="font-mono text-[10px]">{student.mobileNumber || '-'}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex px-2 py-1 rounded-lg border text-[10px] font-black uppercase ${statusTone[status] || statusTone.unmarked}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#555555]">
                          {student.todayLog ? sourceLabel[student.todayLog.source] || student.todayLog.source : '-'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => markManual(student, 'manual')}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black"
                            >
                              Mark
                            </button>
                            <button
                              type="button"
                              onClick={() => markManual(student, 'absent')}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black"
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleRoster.length && (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        {isLoading ? 'Loading attendance...' : 'No students found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3 mb-4">
              <h3 className="text-sm font-black flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Attendance Graph
              </h3>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-xl px-3 py-2 text-[10px] font-black outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview?.trend || []}>
                  <defs>
                    <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="present" stroke="#059669" fill="url(#presentGradient)" />
                  <Area type="monotone" dataKey="halfDay" stroke="#d97706" fill="#fef3c7" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <aside className="xl:col-span-4 space-y-6">
          <Panel title="QR Machine Scan" icon={IdCard}>
            <textarea
              value={scanInput}
              onChange={(event) => setScanInput(event.target.value)}
              placeholder="Scan QR payload or type admission / employee ID"
              className="w-full h-24 bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 text-xs font-semibold outline-none focus:border-black resize-none"
            />
            <button
              type="button"
              onClick={handleQrScan}
              className="w-full px-4 py-3 bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl text-xs font-black flex items-center justify-center gap-2"
            >
              <CalendarCheck2 className="w-4 h-4" /> Mark QR Attendance
            </button>
          </Panel>

          <Panel title="Biometric Register" icon={Fingerprint}>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedEntityType}
                onChange={(event) => {
                  setSelectedEntityType(event.target.value);
                  setSelectedEntityId('');
                }}
                disabled={!canManageBiometric}
                className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold outline-none disabled:opacity-60"
              >
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="clerk">Clerks</option>
                <option value="admin">Admins</option>
              </select>
              <select
                value={selectedEntityId || selectedPerson?.entityId || ''}
                onChange={(event) => setSelectedEntityId(event.target.value)}
                disabled={!canManageBiometric}
                className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl px-3 py-2 text-xs font-bold outline-none disabled:opacity-60"
              >
                {filteredDirectory.map((item) => (
                  <option key={`${item.entityType}-${item.entityId}`} value={item.entityId}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={biometricToken}
              onChange={(event) => setBiometricToken(event.target.value)}
              placeholder="Thumb device template/token"
              className="w-full bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3 text-xs font-semibold outline-none focus:border-black"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleRegisterBiometric}
                disabled={!canManageBiometric}
                className="px-4 py-3 bg-[#1A1A1A] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Thumb
              </button>
              <button
                type="button"
                onClick={handleBiometricAttendance}
                disabled={!canManageBiometric}
                className="px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4" /> Mark
              </button>
            </div>
          </Panel>

          <Panel title="Timing Rules" icon={Clock3}>
            {[
              ['presentUntil', 'On-time until'],
              ['halfDayUntil', 'Half-day until'],
              ['closeAfter', 'Close after'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-xs font-black">
                <span className="text-[#555555]">{label}</span>
                <input
                  type="time"
                  value={settingsDraft[key]}
                  onChange={(event) => setSettingsDraft((draft) => ({ ...draft, [key]: event.target.value }))}
                  disabled={!canManageBiometric}
                  className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-xl px-3 py-2 font-mono outline-none disabled:opacity-60"
                />
              </label>
            ))}
            <label className="flex items-center justify-between gap-3 text-xs font-black">
              <span className="text-[#555555]">Teacher QR scan</span>
              <input
                type="checkbox"
                checked={settingsDraft.allowTeacherQrScan}
                onChange={(event) => setSettingsDraft((draft) => ({ ...draft, allowTeacherQrScan: event.target.checked }))}
                disabled={!canManageBiometric}
                className="w-4 h-4"
              />
            </label>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={!canManageBiometric}
              className="w-full px-4 py-3 bg-[#E1FA6C] border border-[#1A1A1A]/10 rounded-2xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" /> Save Rules
            </button>
          </Panel>

          <Panel title="Audit Logs" icon={ShieldCheck}>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {logs.slice(0, 18).map((log) => (
                <div key={log._id} className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black truncate">{log.displayName}</p>
                    <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${statusTone[log.status] || statusTone.unmarked}`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#555555] font-mono mt-1">
                    {log.attendanceDate} | {sourceLabel[log.source] || log.source} | {log.recordedBy || '-'}
                  </p>
                </div>
              ))}
              {!logs.length && (
                <p className="text-center py-8 text-[10px] font-black uppercase text-neutral-400">
                  No audit logs in this period.
                </p>
              )}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
};

const Metric = ({ label, value, tone = 'text-[#1A1A1A]' }) => (
  <div className="bg-[#F8F8F8] border border-[#EAEAEA] rounded-2xl p-3">
    <p className="text-[10px] font-black uppercase text-[#555555]">{label}</p>
    <p className={`text-2xl font-black mt-1 ${tone}`}>{value}</p>
  </div>
);

const Panel = ({ title, icon, children }) => (
  <div className="bg-white border border-[#C8C8C8] rounded-3xl p-5 space-y-3">
    <h3 className="text-sm font-black flex items-center gap-2 border-b border-[#EAEAEA] pb-3">
      {React.createElement(icon, { className: 'w-4 h-4 text-[#555555]' })} {title}
    </h3>
    {children}
  </div>
);

export default AttendanceControl;
