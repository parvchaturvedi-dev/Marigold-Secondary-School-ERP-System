import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  BookOpen,
  FileText,
  Download,
  Eye,
  UploadCloud,
  Lock,
} from 'lucide-react';
import { getStoredSession } from '../../components/common/auth';
import { useMongoState } from '../../components/common/mongoState';
import { getSessionTeacherProfile } from '../../components/common/portalProfiles';
import { API_BASE_URL, getAuthToken } from '../../components/common/api';

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024;

const formatFileSize = (bytes = 0) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Clerk verification workflow — mirrors the student Document Vault. A teacher
// sees the clerk's decision (and any rejection reason) and cannot replace a doc
// the school has locked/approved.
const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected', 'locked'];

const normalizeVerificationStatus = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  return VERIFICATION_STATUSES.includes(value) ? value : '';
};

const isDocumentLocked = (status) => status === 'locked' || status === 'approved';

const VERIFICATION_CHIP_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  locked: 'bg-slate-100 text-slate-600 border-slate-300',
};

const VERIFICATION_CHIP_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  locked: 'Locked',
};

// Teacher documents live in binary storage server-side (POST/GET
// /teacher-documents), keyed by teacherId. This mirrors studentDocumentsApi in
// StudentProfile.jsx: authed FormData upload + authed blob fetch + a status
// endpoint that carries the clerk's verification decision.
const teacherDocumentsApi = {
  async upload({ file, teacherId, docName }) {
    const form = new FormData();
    form.append('file', file);
    form.append('teacherId', teacherId);
    form.append('docName', docName);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/teacher-documents`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || 'Document upload failed.');
      // Surface the HTTP status so a 403 (locked/approved) shows the friendly
      // "locked" message instead of a raw error.
      error.status = response.status;
      throw error;
    }
    return payload;
  },
  async fetchStatuses({ teacherId }) {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/teacher-documents?teacherId=${encodeURIComponent(teacherId)}`,
      {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!response.ok) {
      throw new Error('Could not load document statuses.');
    }
    const payload = await response.json().catch(() => []);
    return Array.isArray(payload) ? payload : payload?.documents || [];
  },
  async fetchBlob({ teacherId, docName }) {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/teacher-documents/${encodeURIComponent(teacherId)}/${encodeURIComponent(docName)}`,
      {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!response.ok) {
      throw new Error('Document not available.');
    }
    return response.blob();
  },
};

// Resolve which teacher this profile is for. Admin/clerk open a specific teacher
// via teacherContext (or a stored selection); a teacher viewing their own
// profile falls back to their session teacher profile.
const resolveTeacher = (teacherContext, teachersDb, session) => {
  if (teacherContext && (teacherContext.id || teacherContext.name)) {
    return teacherContext;
  }

  const storedId =
    localStorage.getItem('mgps_selected_teacher_profile') ||
    window.location.pathname.split('/').pop() ||
    '';
  const fromDb =
    teachersDb.find(
      (teacher) =>
        teacher.id === storedId ||
        teacher.employeeId === storedId ||
        String(teacher.username || '').toLowerCase() === String(storedId).toLowerCase()
    ) || null;
  if (fromDb) return fromDb;

  if (session?.role === 'teacher') {
    const own = getSessionTeacherProfile(session);
    const fromDbBySession = teachersDb.find(
      (teacher) =>
        teacher.id === own.employeeId ||
        String(teacher.username || '').toLowerCase() === String(own.username || '').toLowerCase()
    );
    return fromDbBySession || own;
  }

  return teachersDb[0] || {};
};

const TeacherProfile = ({ teacherContext, onBack }) => {
  const session = getStoredSession();
  const [teachersDb] = useMongoState('admin-teacher-management-list', []);
  const [roleDocuments] = useMongoState('admin-document-requirements', { Teacher: [] });
  const [documentStatuses, setDocumentStatuses] = useState({});
  const [documentMessage, setDocumentMessage] = useState('');

  const teacher = useMemo(
    () => resolveTeacher(teacherContext, teachersDb, session),
    [teacherContext, teachersDb, session]
  );

  // The teacherId used for the documents API — the teacher record's id (falls
  // back to employeeId/username).
  const teacherId = teacher.id || teacher.employeeId || teacher.username || '';
  const teacherName = teacher.name || teacher.displayName || 'Teacher';

  const documentRequirements = useMemo(
    () => (Array.isArray(roleDocuments.Teacher) ? roleDocuments.Teacher : []),
    [roleDocuments]
  );

  const refreshDocumentStatuses = React.useCallback(() => {
    if (!teacherId) return Promise.resolve();
    return teacherDocumentsApi
      .fetchStatuses({ teacherId })
      .then((records) => {
        const byName = {};
        (records || []).forEach((record) => {
          const key = String(record?.docName || '').trim().toLowerCase();
          if (!key) return;
          byName[key] = {
            status: normalizeVerificationStatus(record.status),
            reviewNote: record.reviewNote || '',
            reviewedByName: record.reviewedByName || '',
            reviewedAt: record.reviewedAt || '',
            fileName: record.fileName || '',
            size: record.size || 0,
            uploadedAt: record.uploadedAt || '',
          };
        });
        setDocumentStatuses(byName);
      })
      .catch(() => {
        setDocumentStatuses({});
      });
  }, [teacherId]);

  useEffect(() => {
    refreshDocumentStatuses();
  }, [refreshDocumentStatuses]);

  const handleDocumentUpload = async (docName, file) => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_SIZE) {
      alert('Document file size must be 2 MB or less.');
      return;
    }

    const currentStatus = documentStatuses[docName.toLowerCase()]?.status;
    if (isDocumentLocked(currentStatus)) {
      alert("This document is locked and can't be changed. Contact the school office.");
      return;
    }

    try {
      await teacherDocumentsApi.upload({ file, teacherId, docName });
    } catch (error) {
      if (error.status === 403) {
        alert("This document is locked and can't be changed. Contact the school office.");
      } else {
        alert(error.message || 'Document upload failed. Please try again.');
      }
      return;
    }

    setDocumentMessage(`${docName} uploaded. It is now pending school verification.`);
    refreshDocumentStatuses();
  };

  const openTeacherDocument = async (docName) => {
    try {
      const blob = await teacherDocumentsApi.fetchBlob({ teacherId, docName });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (error) {
      alert(error.message || 'Document not available.');
    }
  };

  const handleBackNavigation = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    window.location.href = '/admin/teacher-management';
  };

  const allottedClasses = Array.isArray(teacher.classAssignments)
    ? teacher.classAssignments.map((entry) => entry.className).filter(Boolean)
    : [];

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">

      {/* TOP COMPACT BANNER */}
      <div className="glass-card p-4 rounded-3xl flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackNavigation}
            className="p-2 hover:bg-white/70 rounded-full transition-colors border border-slate-200/70"
          >
            <ArrowLeft className="w-4 h-4 text-slate-900" />
          </button>
          <div>
            <h3 className="text-md font-black tracking-tight">Faculty Workspace Folder</h3>
            <p className="text-[11px] text-slate-500">Document verification node for registered faculty identities.</p>
          </div>
        </div>
        <span className="text-xs bg-indigo-50/60 px-3 py-1.5 rounded-full font-mono font-bold border border-slate-200/70 uppercase">
          ID: {teacherId || 'N/A'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT: IDENTITY CARD */}
        <div className="lg:col-span-4 glass-card rounded-3xl p-6 text-center space-y-5">
          <div className="relative w-28 h-28 mx-auto bg-indigo-50/60 rounded-3xl border-2 border-white/80 flex items-center justify-center overflow-hidden">
            {teacher.photoDataUrl ? (
              <img src={teacher.photoDataUrl} alt={teacherName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-14 h-14 text-slate-400" />
            )}
            <div className="absolute bottom-1 right-1 bg-indigo-100 text-indigo-700 border-indigo-200 text-[9px] font-black font-mono border px-1.5 py-0.5 rounded-md">
              FACULTY
            </div>
          </div>

          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">{teacherName}</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {teacher.isClassTeacher === 'Yes'
                ? `Class Teacher: ${teacher.assignedClassTeacherFor || '-'}`
                : 'Subject Instructor'}
            </p>
          </div>

          <hr className="border-slate-100/80" />

          <div className="space-y-2 text-left text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2 glass-soft p-2.5 rounded-xl">
              <Mail className="w-3.5 h-3.5 text-slate-900 shrink-0" />
              <span className="text-slate-900 truncate" title={teacher.email}>{teacher.email || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-2 glass-soft p-2.5 rounded-xl">
              <Phone className="w-3.5 h-3.5 text-slate-900" />
              <span className="font-mono text-slate-900">{teacher.mobile || teacher.phone || 'Not provided'}</span>
            </div>
            <div className="flex items-center gap-2 glass-soft p-2.5 rounded-xl">
              <BookOpen className="w-3.5 h-3.5 text-slate-900 shrink-0" />
              <span className="text-slate-900 truncate" title={allottedClasses.join(', ')}>
                {allottedClasses.length ? allottedClasses.join(', ') : 'No classes allotted'}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: DOCUMENT VAULT */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-card rounded-3xl p-6 min-h-[360px]">
            <div className="space-y-4 animate-fadeIn text-xs font-bold">
              <div className="border-b border-slate-100/80 pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-900" />
                <h4 className="text-sm font-black text-slate-900">Verification Document Vault</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documentRequirements.map((docName, idx) => {
                  const verification = documentStatuses[docName.toLowerCase()] || {};
                  const verificationStatus = verification.status;
                  const locked = isDocumentLocked(verificationStatus);
                  const hasFile = Boolean(verificationStatus || verification.fileName);
                  return (
                    <div key={`${docName}-${idx}`} className="glass-soft p-3 rounded-xl flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-slate-900 font-black truncate block">{docName}</span>
                          <span className="text-[10px] text-slate-500 font-mono block truncate mt-0.5">
                            {verification.fileName || 'No file uploaded yet'}
                            {verification.size ? ` | ${formatFileSize(verification.size)}` : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {verificationStatus ? (
                            <span className={`text-[9px] px-1.5 py-0.5 border rounded font-black uppercase ${VERIFICATION_CHIP_STYLES[verificationStatus]}`}>
                              {VERIFICATION_CHIP_LABELS[verificationStatus]}
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 border rounded font-black uppercase bg-amber-50 text-amber-700 border-amber-200">
                              Missing
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openTeacherDocument(docName)}
                            disabled={!hasFile}
                            className="p-2 bg-white/60 hover:bg-slate-900 hover:text-white rounded-lg border border-slate-200/70 transition-all disabled:opacity-40 disabled:hover:bg-white/60 disabled:hover:text-slate-900"
                            title="Preview Document"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openTeacherDocument(docName)}
                            disabled={!hasFile}
                            className="p-2 bg-white/60 hover:bg-slate-900 hover:text-white rounded-lg border border-slate-200/70 transition-all disabled:opacity-40 disabled:hover:bg-white/60 disabled:hover:text-slate-900"
                            title="Download Asset File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {locked ? (
                            <span
                              className="p-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-500 flex items-center"
                              title={verificationStatus === 'approved' ? 'Approved by school' : 'Locked by school'}
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <label
                              className="btn-primary p-2 rounded-lg transition-all cursor-pointer"
                              title={hasFile ? 'Replace Document' : 'Upload Document'}
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,.pdf"
                                onChange={(event) => handleDocumentUpload(docName, event.target.files?.[0])}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {locked && (
                        <p className="text-[10px] font-bold text-slate-500">
                          {verificationStatus === 'approved' ? 'Approved — no changes needed.' : 'Locked by school.'}
                        </p>
                      )}
                      {verificationStatus === 'rejected' && verification.reviewNote && (
                        <p className="text-[10px] font-bold text-red-600">
                          Rejected: {verification.reviewNote}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {documentRequirements.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs font-medium">
                  No document requirements configured for teachers yet.
                </div>
              )}

              {documentMessage && (
                <div className="glass-soft p-3 rounded-2xl">
                  <p className="text-[11px] text-slate-500 font-bold">{documentMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeacherProfile;
