import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Lock,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { getStudentsForClass, getExamLabel, isFinalExam } from './examinationStore';

// API_BASE_URL / authFetch / getAuthToken live in ./api (re-exported from services).
// Multipart uploads use a raw fetch (authFetch is JSON-only through axios), mirroring
// boardResultsApi in ExaminationHub — token pulled from the same session store.
import { API_BASE_URL, authFetch, getAuthToken } from './api';

const EXAM_API = `${API_BASE_URL}/examinations`;

// ---------------------------------------------------------------------------
// Small authed helpers (mirror ExaminationHub's boardResultsApi pattern).
// ---------------------------------------------------------------------------
const authedJson = async (path, { method = 'GET', body } = {}) => {
  const response = await authFetch(`${EXAM_API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status}).`);
  }
  return payload;
};

const authedMultipart = async (path, formData) => {
  const token = getAuthToken();
  const response = await fetch(`${EXAM_API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Upload failed.');
  }
  return payload;
};

// Files served by the API need auth, so fetch as a blob then open the object URL.
const openAuthedFile = async (path) => {
  const token = getAuthToken();
  const response = await fetch(`${EXAM_API}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let message = 'Could not open the file.';
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      /* non-JSON body */
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Pop-up blocked — fall back to same-tab navigation.
    window.location.href = objectUrl;
  }
  // Revoke a little later so the new tab has time to load.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ---------------------------------------------------------------------------
// 3D CSS padlock (locked state).
// ---------------------------------------------------------------------------
const Lock3D = () => (
  <div
    aria-hidden="true"
    className="relative"
    style={{ width: 128, height: 150, perspective: '600px' }}
  >
    {/* Shackle */}
    <div
      style={{
        position: 'absolute',
        top: 6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 72,
        height: 72,
        borderRadius: '999px 999px 0 0',
        border: '13px solid transparent',
        borderBottom: 'none',
        background:
          'linear-gradient(180deg, #cbd5e1, #94a3b8) padding-box, linear-gradient(90deg, #e2e8f0, #64748b, #cbd5e1) border-box',
        backgroundClip: 'padding-box, border-box',
        boxShadow: 'inset 2px 0 3px rgba(255,255,255,0.6), inset -3px 0 4px rgba(0,0,0,0.25)',
      }}
    />
    {/* Body */}
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%) rotateX(8deg)',
        width: 116,
        height: 92,
        borderRadius: 20,
        background: 'linear-gradient(145deg, #a78bfa 0%, #8b5cf6 45%, #6d28d9 100%)',
        boxShadow:
          '0 18px 30px rgba(76,29,149,0.45), inset 3px 3px 6px rgba(255,255,255,0.35), inset -4px -6px 10px rgba(0,0,0,0.28)',
      }}
    >
      {/* Keyhole */}
      <div
        style={{
          position: 'absolute',
          top: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 18,
          height: 18,
          borderRadius: '999px',
          background: 'radial-gradient(circle at 40% 35%, #1e1b4b, #0f0a2e)',
          boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.7)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 42,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 10,
          height: 24,
          background: 'linear-gradient(180deg, #1e1b4b, #0f0a2e)',
          borderRadius: '0 0 4px 4px',
        }}
      />
    </div>
  </div>
);

const Notice = ({ tone = 'info', children }) => {
  if (!children) return null;
  const tones = {
    info: 'bg-white/60 border-white/70 text-slate-600',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    error: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertTriangle : Clock;
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black ${
        tones[tone] || tones.info
      }`}
    >
      <Icon size={15} />
      <span className="truncate">{children}</span>
    </div>
  );
};

// ===========================================================================
// Main component
// ===========================================================================
export default function BoardExaminationDesk({ state, role, actor, session, onRefresh }) {
  const boardClasses = useMemo(
    () => (Array.isArray(state?.boardClasses) ? state.boardClasses.filter(Boolean) : []),
    [state]
  );
  const exams = useMemo(() => (Array.isArray(state?.exams) ? state.exams : []), [state]);

  const isAdmin = role === 'admin';
  const clerkUsername = session?.username || actor?.username || '';

  // --- Access gate state ---------------------------------------------------
  const [accessStatus, setAccessStatus] = useState('none'); // clerk: none|requested|approved
  const [accessRecords, setAccessRecords] = useState([]); // admin: array
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState('');

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    setAccessError('');
    try {
      const payload = await authedJson('/board-access/status');
      if (isAdmin) {
        setAccessRecords(Array.isArray(payload) ? payload : payload?.records || []);
      } else {
        const status =
          (Array.isArray(payload) ? payload[0]?.status : payload?.status) || 'none';
        setAccessStatus(status);
      }
    } catch (error) {
      setAccessError(error.message || 'Could not load access status.');
    } finally {
      setAccessLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const requestAccess = async () => {
    setAccessBusy(true);
    setAccessError('');
    try {
      await authedJson('/board-access/request', { method: 'POST' });
      setAccessStatus('requested');
      onRefresh?.();
    } catch (error) {
      setAccessError(error.message || 'Could not send the request.');
    } finally {
      setAccessBusy(false);
    }
  };

  const grantAccess = async (username) => {
    setAccessBusy(true);
    setAccessError('');
    try {
      await authedJson('/board-access/grant', { method: 'POST', body: { clerkUsername: username } });
      await loadAccess();
      onRefresh?.();
    } catch (error) {
      setAccessError(error.message || 'Could not grant access.');
    } finally {
      setAccessBusy(false);
    }
  };

  const revokeAccess = async (username) => {
    setAccessBusy(true);
    setAccessError('');
    try {
      await authedJson('/board-access/revoke', {
        method: 'POST',
        body: { clerkUsername: username },
      });
      await loadAccess();
      onRefresh?.();
    } catch (error) {
      setAccessError(error.message || 'Could not revoke access.');
    } finally {
      setAccessBusy(false);
    }
  };

  const clerkApproved = isAdmin || accessStatus === 'approved';

  // --- Desk selectors ------------------------------------------------------
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExamId, setSelectedExamId] = useState('');

  useEffect(() => {
    if (!selectedClass && boardClasses.length) {
      setSelectedClass(boardClasses[0]);
    } else if (selectedClass && !boardClasses.includes(selectedClass) && boardClasses.length) {
      setSelectedClass(boardClasses[0]);
    }
  }, [boardClasses, selectedClass]);

  useEffect(() => {
    if (!exams.length) return;
    const existing = exams.some((exam) => exam.id === selectedExamId);
    if (!selectedExamId || !existing) {
      const finalExam = exams.find((exam) => isFinalExam(exam));
      setSelectedExamId((finalExam || exams[0]).id);
    }
  }, [exams, selectedExamId]);

  // --- Timetable state -----------------------------------------------------
  const [timetable, setTimetable] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableBusy, setTimetableBusy] = useState(false);
  const [timetableNotice, setTimetableNotice] = useState(null); // {tone, text}
  const timetableInputRef = useRef(null);

  const loadTimetable = useCallback(async () => {
    if (!selectedClass || !selectedExamId) {
      setTimetable([]);
      return;
    }
    setTimetableLoading(true);
    try {
      const payload = await authedJson(
        `/board-timetable?className=${encodeURIComponent(selectedClass)}&examId=${encodeURIComponent(
          selectedExamId
        )}`
      );
      setTimetable(Array.isArray(payload) ? payload : payload?.items || []);
    } catch (error) {
      setTimetableNotice({ tone: 'error', text: error.message || 'Could not load timetable.' });
      setTimetable([]);
    } finally {
      setTimetableLoading(false);
    }
  }, [selectedClass, selectedExamId]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const uploadTimetable = async () => {
    const file = timetableInputRef.current?.files?.[0];
    if (!file) {
      setTimetableNotice({ tone: 'error', text: 'Choose a PDF file first.' });
      return;
    }
    setTimetableBusy(true);
    setTimetableNotice(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('className', selectedClass);
      form.append('examId', selectedExamId);
      await authedMultipart('/board-timetable', form);
      if (timetableInputRef.current) timetableInputRef.current.value = '';
      setTimetableNotice({ tone: 'success', text: 'Board timetable uploaded.' });
      await loadTimetable();
      onRefresh?.();
    } catch (error) {
      setTimetableNotice({ tone: 'error', text: error.message || 'Upload failed.' });
    } finally {
      setTimetableBusy(false);
    }
  };

  const deleteTimetable = async (id) => {
    setTimetableBusy(true);
    setTimetableNotice(null);
    try {
      await authedJson(`/board-timetable/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setTimetableNotice({ tone: 'success', text: 'Timetable removed.' });
      await loadTimetable();
      onRefresh?.();
    } catch (error) {
      setTimetableNotice({ tone: 'error', text: error.message || 'Could not delete.' });
    } finally {
      setTimetableBusy(false);
    }
  };

  const viewTimetable = async () => {
    try {
      await openAuthedFile(
        `/board-timetable/${encodeURIComponent(selectedClass)}/${encodeURIComponent(selectedExamId)}`
      );
    } catch (error) {
      setTimetableNotice({ tone: 'error', text: error.message || 'Could not open file.' });
    }
  };

  // --- Student results state ----------------------------------------------
  const students = useMemo(
    () => (selectedClass ? getStudentsForClass(selectedClass) : []),
    [selectedClass]
  );

  const [results, setResults] = useState([]); // metadata array
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultBusyAdm, setResultBusyAdm] = useState(''); // admissionNumber currently uploading
  const [resultsNotice, setResultsNotice] = useState(null);
  const [studentSearch, setStudentSearch] = useState('');
  const fileInputs = useRef({}); // admissionNumber -> input ref

  const loadResults = useCallback(async () => {
    if (!selectedClass || !selectedExamId) {
      setResults([]);
      return;
    }
    setResultsLoading(true);
    try {
      const payload = await authedJson(
        `/board-student-result?className=${encodeURIComponent(
          selectedClass
        )}&examId=${encodeURIComponent(selectedExamId)}`
      );
      setResults(Array.isArray(payload) ? payload : payload?.items || []);
    } catch (error) {
      setResultsNotice({ tone: 'error', text: error.message || 'Could not load results.' });
      setResults([]);
    } finally {
      setResultsLoading(false);
    }
  }, [selectedClass, selectedExamId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const resultByAdmission = useMemo(() => {
    const map = new Map();
    results.forEach((rec) => {
      if (rec?.admissionNumber) map.set(String(rec.admissionNumber), rec);
    });
    return map;
  }, [results]);

  const uploadStudentResult = async (student) => {
    const admission = student.admissionNumber;
    const ref = fileInputs.current[admission];
    const file = ref?.files?.[0];
    if (!admission) {
      setResultsNotice({ tone: 'error', text: 'This student has no admission number.' });
      return;
    }
    if (!file) {
      setResultsNotice({ tone: 'error', text: 'Choose a file for this student first.' });
      return;
    }
    setResultBusyAdm(admission);
    setResultsNotice(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('admissionNumber', admission);
      form.append('studentName', student.displayName || '');
      form.append('className', selectedClass);
      form.append('examId', selectedExamId);
      await authedMultipart('/board-student-result', form);
      if (ref) ref.value = '';
      setResultsNotice({
        tone: 'success',
        text: `Result uploaded for ${student.displayName || admission}.`,
      });
      await loadResults();
      onRefresh?.();
    } catch (error) {
      setResultsNotice({ tone: 'error', text: error.message || 'Upload failed.' });
    } finally {
      setResultBusyAdm('');
    }
  };

  const viewStudentResult = async (admission) => {
    try {
      await openAuthedFile(
        `/board-student-result/${encodeURIComponent(admission)}/${encodeURIComponent(
          selectedExamId
        )}`
      );
    } catch (error) {
      setResultsNotice({ tone: 'error', text: error.message || 'Could not open file.' });
    }
  };

  const deleteStudentResult = async (record) => {
    if (!record?.id) return;
    setResultBusyAdm(record.admissionNumber || 'x');
    setResultsNotice(null);
    try {
      await authedJson(`/board-student-result/${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
      });
      setResultsNotice({ tone: 'success', text: 'Result removed.' });
      await loadResults();
      onRefresh?.();
    } catch (error) {
      setResultsNotice({ tone: 'error', text: error.message || 'Could not delete.' });
    } finally {
      setResultBusyAdm('');
    }
  };

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) => {
      const name = String(student.displayName || '').toLowerCase();
      const adm = String(student.admissionNumber || '').toLowerCase();
      return name.includes(term) || adm.includes(term);
    });
  }, [students, studentSearch]);

  const uploadedCount = resultByAdmission.size;

  // -------------------------------------------------------------------------
  // Access gate render (clerk, not yet approved)
  // -------------------------------------------------------------------------
  if (!isAdmin && !clerkApproved) {
    return (
      <div className="glass-card rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center gap-5 py-8 text-center">
          {accessLoading ? (
            <p className="text-xs font-black text-slate-500">Checking access…</p>
          ) : (
            <>
              <Lock3D />
              {accessStatus === 'requested' ? (
                <>
                  <p className="text-sm font-black text-slate-700">Waiting for admin approval</p>
                  <p className="max-w-md text-xs font-black text-slate-500">
                    Your request has been sent. An administrator must approve it before you can use
                    the Board Examination desk.
                  </p>
                  <span className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">
                    <Clock size={14} /> Approval requested — waiting for an admin.
                  </span>
                </>
              ) : (
                <>
                  <p className="text-sm font-black text-slate-700">This desk is locked.</p>
                  <p className="max-w-md text-xs font-black text-slate-500">
                    If you want to access, you must take admin approval.
                    {clerkUsername ? ` Signed in as ${clerkUsername}.` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={requestAccess}
                    disabled={accessBusy}
                    className="rounded-full btn-primary px-6 py-3 text-xs font-black flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShieldCheck size={15} />
                    {accessBusy ? 'Sending…' : 'Send for Approval'}
                  </button>
                </>
              )}
              {accessError && <Notice tone="error">{accessError}</Notice>}
            </>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Desk content (admin or approved clerk)
  // -------------------------------------------------------------------------
  const requestedClerks = accessRecords.filter((rec) => rec?.status === 'requested');
  const approvedClerks = accessRecords.filter((rec) => rec?.status === 'approved');

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="glass-card rounded-3xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#8b5cf6]/10 text-[#6d28d9]">
            <GraduationCap size={22} />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-800">Board Examination</h3>
            <p className="mt-1 max-w-2xl text-xs font-black leading-relaxed text-slate-500">
              Board classes take their FINAL exam at an external board centre. Upload the board
              timetable and each student&apos;s result (PDF / JPG / PNG) here — students will see
              their own result.
            </p>
          </div>
        </div>
      </section>

      {/* Admin: clerk access requests */}
      {isAdmin && (
        <section className="glass-card rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-[#6d28d9]" />
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-600">
              Clerk Access Requests
            </h4>
          </div>
          <div className="mt-3 space-y-2">
            {accessLoading ? (
              <p className="text-xs font-black text-slate-400">Loading…</p>
            ) : requestedClerks.length === 0 && approvedClerks.length === 0 ? (
              <p className="text-xs font-black text-slate-400">No pending requests.</p>
            ) : (
              <>
                {requestedClerks.map((rec) => (
                  <div
                    key={`req-${rec.clerkUsername}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-xs font-black text-amber-800">
                      <Clock size={14} /> {rec.clerkUsername}
                    </span>
                    <button
                      type="button"
                      onClick={() => grantAccess(rec.clerkUsername)}
                      disabled={accessBusy}
                      className="rounded-full btn-primary px-4 py-2 text-xs font-black disabled:opacity-50"
                    >
                      Grant
                    </button>
                  </div>
                ))}
                {approvedClerks.map((rec) => (
                  <div
                    key={`ok-${rec.clerkUsername}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-xs font-black text-emerald-800">
                      <CheckCircle2 size={14} /> {rec.clerkUsername}
                    </span>
                    <button
                      type="button"
                      onClick={() => revokeAccess(rec.clerkUsername)}
                      disabled={accessBusy}
                      className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-600 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </>
            )}
            {accessError && <Notice tone="error">{accessError}</Notice>}
          </div>
        </section>
      )}

      {/* No board classes */}
      {boardClasses.length === 0 ? (
        <section className="glass-card rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-xs font-black text-slate-500">
            <AlertTriangle size={16} className="text-amber-500" />
            No classes are marked as Board yet. Mark a class as Board Class in Class Management.
          </div>
        </section>
      ) : (
        <>
          {/* Selector row */}
          <section className="glass-card rounded-3xl p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Board Class
                </span>
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs font-black text-slate-700 outline-none"
                >
                  {boardClasses.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                  Examination
                </span>
                <select
                  value={selectedExamId}
                  onChange={(event) => setSelectedExamId(event.target.value)}
                  className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs font-black text-slate-700 outline-none"
                >
                  {exams.length === 0 && <option value="">No exams available</option>}
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {getExamLabel(exam)}
                      {exam.academicYear ? ` · ${exam.academicYear}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* SECTION A: Board Timetable */}
          <section className="glass-card rounded-3xl p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-[#6d28d9]" />
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-600">
                Board Timetable
              </h4>
            </div>

            <div className="mt-3 space-y-2">
              {timetableLoading ? (
                <p className="text-xs font-black text-slate-400">Loading timetable…</p>
              ) : timetable.length === 0 ? (
                <p className="text-xs font-black text-slate-400">
                  No timetable uploaded for this class &amp; exam yet.
                </p>
              ) : (
                timetable.map((item) => (
                  <div
                    key={item.id || item.fileName}
                    className="flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-xs font-black text-slate-700">
                      <FileText size={14} className="shrink-0 text-[#6d28d9]" />
                      <span className="truncate">{item.fileName || 'Timetable.pdf'}</span>
                      {item.uploadedAt && (
                        <span className="hidden shrink-0 text-slate-400 sm:inline">
                          · {formatDateTime(item.uploadedAt)}
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={viewTimetable}
                        className="rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-black text-slate-700"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTimetable(item.id)}
                        disabled={timetableBusy || !item.id}
                        className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-black text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={timetableInputRef}
                type="file"
                accept="application/pdf"
                className="block w-full text-xs font-black text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-[#8b5cf6]/10 file:px-4 file:py-2 file:text-xs file:font-black file:text-[#6d28d9]"
              />
              <button
                type="button"
                onClick={uploadTimetable}
                disabled={timetableBusy || !selectedClass || !selectedExamId}
                className="shrink-0 rounded-full btn-primary px-5 py-2 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={14} />
                {timetableBusy ? 'Uploading…' : 'Upload Timetable'}
              </button>
            </div>

            {timetableNotice && (
              <div className="mt-3">
                <Notice tone={timetableNotice.tone}>{timetableNotice.text}</Notice>
              </div>
            )}
          </section>

          {/* SECTION B: Student-wise Final Results */}
          <section className="glass-card rounded-3xl p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#6d28d9]" />
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-600">
                  Student-wise Final Results
                </h4>
                <span className="rounded-full bg-[#8b5cf6]/10 px-2.5 py-1 text-[11px] font-black text-[#6d28d9]">
                  {uploadedCount}/{students.length} uploaded
                </span>
              </div>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search name or admission…"
                  className="w-full rounded-full border border-white/70 bg-white/60 py-2 pl-9 pr-3 text-xs font-black text-slate-700 outline-none sm:w-64"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {resultsLoading && (
                <p className="text-xs font-black text-slate-400">Loading results…</p>
              )}
              {!resultsLoading && students.length === 0 && (
                <p className="text-xs font-black text-slate-400">
                  No students found for {selectedClass || 'this class'}.
                </p>
              )}
              {!resultsLoading &&
                students.length > 0 &&
                filteredStudents.length === 0 && (
                  <p className="text-xs font-black text-slate-400">
                    No students match &ldquo;{studentSearch}&rdquo;.
                  </p>
                )}

              {filteredStudents.map((student) => {
                const admission = student.admissionNumber;
                const record = admission ? resultByAdmission.get(String(admission)) : null;
                const uploaded = Boolean(record);
                const busy = resultBusyAdm === admission;
                return (
                  <div
                    key={student.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/60 p-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8b5cf6]/10 text-xs font-black text-[#6d28d9]">
                        {student.rollNo}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-800">
                          {student.displayName}
                        </p>
                        <p className="truncate text-[11px] font-black text-slate-400">
                          Adm: {admission || '—'} · Roll {student.rollNo}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${
                          uploaded
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {uploaded ? 'Uploaded' : 'Pending'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={(el) => {
                          if (admission) fileInputs.current[admission] = el;
                        }}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        disabled={!admission}
                        className="block max-w-[220px] text-[11px] font-black text-slate-600 file:mr-2 file:rounded-full file:border-0 file:bg-[#8b5cf6]/10 file:px-3 file:py-1.5 file:text-[11px] file:font-black file:text-[#6d28d9]"
                      />
                      <button
                        type="button"
                        onClick={() => uploadStudentResult(student)}
                        disabled={busy || !admission || !selectedExamId}
                        className="rounded-full btn-primary px-3 py-1.5 text-[11px] font-black flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload size={12} />
                        {busy ? '…' : uploaded ? 'Replace' : 'Upload'}
                      </button>
                      {uploaded && (
                        <>
                          <button
                            type="button"
                            onClick={() => viewStudentResult(admission)}
                            className="rounded-full border border-white/70 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStudentResult(record)}
                            disabled={busy}
                            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-black text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {resultsNotice && (
              <div className="mt-3">
                <Notice tone={resultsNotice.tone}>{resultsNotice.text}</Notice>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
