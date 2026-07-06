import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  FolderGit,
  GraduationCap,
  Lock,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Users,
  XCircle,
} from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { API_BASE_URL, getAuthToken } from '../../components/common/api';

// ---------------------------------------------------------------------------
// Backend document API. Mirrors the studentDocumentsApi helper in
// Admin/StudentProfile.jsx: authed FormData upload, authed blob fetch, JSON
// PATCH/DELETE. `scope` selects the base path + the id field name so a single
// helper drives both student (admissionNumber) and teacher (teacherId) docs.
// ---------------------------------------------------------------------------
const SCOPES = {
  student: { base: 'student-documents', idField: 'admissionNumber' },
  teacher: { base: 'teacher-documents', idField: 'teacherId' },
};

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const docsApi = {
  async list({ scope, id }) {
    const { base, idField } = SCOPES[scope];
    const response = await fetch(
      `${API_BASE_URL}/${base}?${idField}=${encodeURIComponent(id)}`,
      { credentials: 'include', headers: authHeaders() }
    );
    if (!response.ok) throw new Error('Could not load documents.');
    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload : payload?.documents || [];
  },
  async upload({ scope, id, docName, file }) {
    const { base, idField } = SCOPES[scope];
    const form = new FormData();
    form.append('file', file);
    form.append(idField, id);
    form.append('docName', docName);
    const response = await fetch(`${API_BASE_URL}/${base}`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Document upload failed.');
    return payload;
  },
  async fetchBlob({ scope, id, docName }) {
    const { base } = SCOPES[scope];
    const response = await fetch(
      `${API_BASE_URL}/${base}/${encodeURIComponent(id)}/${encodeURIComponent(docName)}`,
      { credentials: 'include', headers: authHeaders() }
    );
    if (!response.ok) throw new Error('Document not available.');
    return response.blob();
  },
  async setStatus({ scope, id, docName, status, note }) {
    const { base } = SCOPES[scope];
    const response = await fetch(
      `${API_BASE_URL}/${base}/${encodeURIComponent(id)}/${encodeURIComponent(docName)}/status`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Could not update status.');
    return payload;
  },
  async remove({ scope, id, docName }) {
    const { base } = SCOPES[scope];
    const response = await fetch(
      `${API_BASE_URL}/${base}/${encodeURIComponent(id)}/${encodeURIComponent(docName)}`,
      { method: 'DELETE', credentials: 'include', headers: authHeaders() }
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Could not delete the document.');
    }
    return true;
  },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
  locked: { label: 'Locked', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  missing: { label: 'Not uploaded', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const ACCEPT = '.jpg,.jpeg,.png,.pdf';
const MAX_SIZE = 5 * 1024 * 1024;

const formatFileSize = (bytes = 0) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const pickId = (entity = {}) =>
  entity.admissionNumber || entity.id || entity.teacherId || entity.empId || '';
const pickTeacherId = (t = {}) => t.id || t.teacherId || t.empId || '';
const pickName = (entity = {}) =>
  entity.name || entity.displayName || entity.studentName || entity.teacherName || 'Unnamed';
const pickClass = (student = {}) =>
  student.class || student.className || student.targetClass || 'Unassigned';

const StatusChip = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.missing;
  return (
    <span className={`text-[9px] px-2 py-0.5 border rounded-md font-black uppercase tracking-wide ${meta.cls}`}>
      {meta.label}
    </span>
  );
};

// ===========================================================================
// Document panel — shown for a selected student or teacher
// ===========================================================================
const DocumentPanel = ({ scope, id, name, subtitle, requiredDocs, onBack }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyDoc, setBusyDoc] = useState('');

  const refetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const list = await docsApi.list({ scope, id });
      setDocs(list);
    } catch (err) {
      setError(err.message || 'Could not load documents.');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [scope, id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Merge the required-label list with whatever the backend returned so every
  // required doc shows a row even when nothing has been uploaded, and any extra
  // uploaded docs still surface.
  const rows = useMemo(() => {
    const byName = new Map(docs.map((d) => [String(d.docName || '').toLowerCase(), d]));
    const required = requiredDocs.map((label) => {
      const found = byName.get(String(label).toLowerCase());
      return found ? { ...found, docName: found.docName || label } : { docName: label, status: 'missing' };
    });
    const extras = docs.filter(
      (d) => !requiredDocs.some((label) => String(label).toLowerCase() === String(d.docName || '').toLowerCase())
    );
    return [...required, ...extras];
  }, [docs, requiredDocs]);

  const isUploaded = (doc) =>
    !!(doc.fileName || doc.uploadedAt || (doc.status && doc.status !== 'missing'));

  const withBusy = async (docName, fn) => {
    setBusyDoc(docName);
    try {
      await fn();
      await refetch();
    } catch (err) {
      alert(err.message || 'Action failed. Please try again.');
    } finally {
      setBusyDoc('');
    }
  };

  const handleView = async (doc) => {
    try {
      const blob = await docsApi.fetchBlob({ scope, id, docName: doc.docName });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      alert(err.message || 'Document not available.');
    }
  };

  const handleApprove = (doc) =>
    withBusy(doc.docName, () => docsApi.setStatus({ scope, id, docName: doc.docName, status: 'approved' }));

  const handleReject = (doc) => {
    const note = window.prompt(`Reason for rejecting "${doc.docName}"?`, doc.reviewNote || '');
    if (note === null) return;
    return withBusy(doc.docName, () =>
      docsApi.setStatus({ scope, id, docName: doc.docName, status: 'rejected', note })
    );
  };

  const handleLock = (doc) => {
    if (!window.confirm(`Lock "${doc.docName}"? The user will no longer be able to upload it.`)) return;
    return withBusy(doc.docName, () =>
      docsApi.setStatus({ scope, id, docName: doc.docName, status: 'locked' })
    );
  };

  const handleUpload = (doc, file) => {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      alert('File must be 5 MB or less.');
      return;
    }
    return withBusy(doc.docName, () =>
      docsApi.upload({ scope, id, docName: doc.docName, file })
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <section className="glass-card rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-white/70 rounded-full transition-colors border border-slate-200/70"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-black flex items-center gap-2">
              {scope === 'teacher' ? <Users className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
              {name}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="px-3 py-2 bg-white/60 hover:bg-slate-900 hover:text-white border border-slate-200/70 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </section>

      {loading ? (
        <div className="glass-card rounded-3xl p-12 text-center text-xs font-black text-slate-500">
          Loading documents...
        </div>
      ) : error ? (
        <div className="glass-card rounded-3xl p-8 text-center">
          <p className="text-xs font-black text-red-600">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="mt-3 btn-primary px-4 py-2 rounded-xl text-[10px] font-black"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-xs font-black text-slate-500">
          No document requirements configured for {scope === 'teacher' ? 'teachers' : 'students'} yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {rows.map((doc) => {
            const uploaded = isUploaded(doc);
            const status = doc.status || (uploaded ? 'pending' : 'missing');
            const locked = status === 'locked';
            const busy = busyDoc === doc.docName;

            return (
              <article key={doc.docName} className="glass-soft rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-2xl bg-white/60 border border-slate-100/80 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{doc.docName}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">
                        {uploaded
                          ? `${doc.fileName || 'File on record'}${doc.size ? ` | ${formatFileSize(doc.size)}` : ''}`
                          : 'Not uploaded'}
                      </p>
                    </div>
                  </div>
                  <StatusChip status={status} />
                </div>

                {doc.reviewNote && (
                  <p className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">
                    Note: {doc.reviewNote}
                  </p>
                )}
                {(doc.reviewedByName || doc.reviewedAt) && (
                  <p className="text-[9px] font-bold text-slate-400">
                    Reviewed{doc.reviewedByName ? ` by ${doc.reviewedByName}` : ''}
                    {doc.reviewedAt ? ` on ${new Date(doc.reviewedAt).toLocaleDateString()}` : ''}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  {uploaded && (
                    <button
                      type="button"
                      onClick={() => handleView(doc)}
                      className="px-2.5 py-1.5 bg-white/60 hover:bg-slate-900 hover:text-white border border-slate-200/70 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  )}
                  {uploaded && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleApprove(doc)}
                        className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleReject(doc)}
                        className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                      <button
                        type="button"
                        disabled={busy || locked}
                        onClick={() => handleLock(doc)}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all disabled:opacity-50"
                      >
                        <Lock className="w-3.5 h-3.5" /> {locked ? 'Locked' : 'Lock'}
                      </button>
                    </>
                  )}
                  <label
                    className={`px-2.5 py-1.5 btn-primary rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                    title={uploaded ? 'Replace document (clerk override)' : 'Upload on user behalf'}
                  >
                    <UploadCloud className="w-3.5 h-3.5" /> {uploaded ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(event) => {
                        handleUpload(doc, event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// Root component — navigation flow via local state
// ===========================================================================
const DocumentsManagement = () => {
  const [teachers] = useMongoState('admin-teacher-management-list', []);
  const [students] = useMongoState('admin-student-management-students', []);
  const [requirements] = useMongoState('admin-document-requirements', { Student: [], Teacher: [] });
  const [classesMaster] = useMongoState('admin-class-management-classes', []);

  // view: 'home' | 'faculty' | 'classes' | 'classStudents' | 'panel'
  const [view, setView] = useState('home');
  const [selectedClass, setSelectedClass] = useState('');
  const [selection, setSelection] = useState(null); // { scope, id, name, subtitle }

  const studentDocs = useMemo(
    () => (Array.isArray(requirements?.Student) ? requirements.Student : []),
    [requirements]
  );
  const teacherDocs = useMemo(
    () => (Array.isArray(requirements?.Teacher) ? requirements.Teacher : []),
    [requirements]
  );

  const classGroups = useMemo(() => {
    const map = new Map();
    (Array.isArray(students) ? students : []).forEach((s) => {
      const cls = pickClass(s);
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls).push(s);
    });
    // Ensure master-list classes appear even when empty.
    (Array.isArray(classesMaster) ? classesMaster : []).forEach((c) => {
      const cls = typeof c === 'string' ? c : c?.name || c?.className;
      if (cls && !map.has(cls)) map.set(cls, []);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [students, classesMaster]);

  const classStudents = useMemo(() => {
    const found = classGroups.find(([cls]) => cls === selectedClass);
    return (found ? found[1] : []).slice().sort((a, b) => {
      const ra = Number(a.rollNo) || 0;
      const rb = Number(b.rollNo) || 0;
      if (ra && rb) return ra - rb;
      return pickName(a).localeCompare(pickName(b));
    });
  }, [classGroups, selectedClass]);

  const openPanel = (scope, entity) => {
    setSelection({
      scope,
      id: scope === 'teacher' ? pickTeacherId(entity) : pickId(entity),
      name: pickName(entity),
      subtitle:
        scope === 'teacher'
          ? `Faculty | ID ${pickTeacherId(entity) || '—'}`
          : `${pickClass(entity)} | Roll ${entity.rollNo || '—'} | ID ${pickId(entity) || '—'}`,
    });
    setView('panel');
  };

  // ---- Document panel view -------------------------------------------------
  if (view === 'panel' && selection) {
    return (
      <div className="pb-8 select-none font-sans text-slate-900">
        <DocumentPanel
          scope={selection.scope}
          id={selection.id}
          name={selection.name}
          subtitle={selection.subtitle}
          requiredDocs={selection.scope === 'teacher' ? teacherDocs : studentDocs}
          onBack={() => {
            setSelection(null);
            setView(selection.scope === 'teacher' ? 'faculty' : 'classStudents');
          }}
        />
      </div>
    );
  }

  const Header = ({ title, onBack }) => (
    <section className="glass-card rounded-3xl p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-white/70 rounded-full transition-colors border border-slate-200/70"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <FolderGit className="w-5 h-5" /> {title}
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1 max-w-2xl">
            Users upload documents from their own profile. As clerk you verify them (approve or reject with a
            reason), can upload or replace a file on the user's behalf, and lock a document once it is final.
          </p>
        </div>
      </div>
    </section>
  );

  // ---- Home: two big cards -------------------------------------------------
  if (view === 'home') {
    return (
      <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
        <Header title="Document Verification Console" />
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => setView('faculty')}
            className="glass-card rounded-3xl p-8 text-left hover:border-indigo-300 border border-transparent transition-all group"
          >
            <span className="w-14 h-14 rounded-3xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Users className="w-7 h-7 text-indigo-600" />
            </span>
            <h3 className="text-lg font-black">Faculty</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {(Array.isArray(teachers) ? teachers.length : 0)} staff members | {teacherDocs.length} required documents
            </p>
          </button>

          <button
            type="button"
            onClick={() => setView('classes')}
            className="glass-card rounded-3xl p-8 text-left hover:border-indigo-300 border border-transparent transition-all group"
          >
            <span className="w-14 h-14 rounded-3xl bg-violet-50/70 border border-violet-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-7 h-7 text-violet-600" />
            </span>
            <h3 className="text-lg font-black">Students</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {(Array.isArray(students) ? students.length : 0)} students across {classGroups.length} classes | {studentDocs.length} required documents
            </p>
          </button>
        </section>
      </div>
    );
  }

  // ---- Faculty list --------------------------------------------------------
  if (view === 'faculty') {
    const list = Array.isArray(teachers) ? teachers : [];
    return (
      <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
        <Header title="Faculty" onBack={() => setView('home')} />
        <section className="glass-card rounded-3xl p-4">
          {list.length === 0 ? (
            <div className="p-10 text-center text-xs font-black text-slate-500">No faculty records found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((t) => (
                <button
                  key={pickTeacherId(t) || pickName(t)}
                  type="button"
                  onClick={() => openPanel('teacher', t)}
                  className="glass-soft rounded-2xl p-4 text-left hover:border-indigo-300 border border-white/70 transition-all flex items-center gap-3"
                >
                  <span className="w-10 h-10 rounded-2xl bg-white/60 border border-slate-100/80 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{pickName(t)}</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">
                      ID {pickTeacherId(t) || '—'}{t.subject ? ` | ${t.subject}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---- Class cards ---------------------------------------------------------
  if (view === 'classes') {
    return (
      <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
        <Header title="Students by Class" onBack={() => setView('home')} />
        <section className="glass-card rounded-3xl p-4">
          {classGroups.length === 0 ? (
            <div className="p-10 text-center text-xs font-black text-slate-500">No classes or students found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {classGroups.map(([cls, members]) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => {
                    setSelectedClass(cls);
                    setView('classStudents');
                  }}
                  className="glass-soft rounded-2xl p-5 text-left hover:border-indigo-300 border border-white/70 transition-all"
                >
                  <span className="w-10 h-10 rounded-2xl bg-violet-50/70 border border-violet-100 flex items-center justify-center mb-3">
                    <GraduationCap className="w-4 h-4 text-violet-600" />
                  </span>
                  <p className="text-sm font-black truncate">{cls}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                    {members.length} student{members.length === 1 ? '' : 's'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ---- Students within a class --------------------------------------------
  if (view === 'classStudents') {
    return (
      <div className="space-y-6 pb-8 select-none font-sans text-slate-900 animate-fadeIn">
        <Header title={`Class ${selectedClass}`} onBack={() => setView('classes')} />
        <section className="glass-card rounded-3xl p-4">
          {classStudents.length === 0 ? (
            <div className="p-10 text-center text-xs font-black text-slate-500">
              No students in {selectedClass}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classStudents.map((s) => (
                <button
                  key={pickId(s) || pickName(s)}
                  type="button"
                  onClick={() => openPanel('student', s)}
                  className="glass-soft rounded-2xl p-4 text-left hover:border-indigo-300 border border-white/70 transition-all flex items-center gap-3"
                >
                  <span className="w-10 h-10 rounded-2xl bg-white/60 border border-slate-100/80 flex items-center justify-center shrink-0 text-[10px] font-black font-mono">
                    {s.rollNo || '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{pickName(s)}</p>
                    <p className="text-[10px] font-bold text-slate-500 truncate">
                      Roll {s.rollNo || '—'} | ID {pickId(s) || '—'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Fallback (should not hit)
  return (
    <div className="glass-card rounded-3xl p-10 text-center text-slate-500 font-sans">
      <ShieldCheck className="w-10 h-10 mx-auto mb-2" />
      <p className="text-xs font-black">Loading console...</p>
    </div>
  );
};

export default DocumentsManagement;
