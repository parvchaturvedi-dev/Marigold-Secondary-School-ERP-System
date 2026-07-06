import React, { useEffect, useMemo, useState } from 'react';
import { getStoredSession } from '../../components/common/auth';
import { 
  ArrowLeft, User, Phone, MapPin, Calendar,
  FileText, BarChart3, GraduationCap, Download, Eye, PlusCircle, Save, UploadCloud, Camera, CreditCard, Users, Lock
} from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
import { API_BASE_URL, getAuthToken } from '../../components/common/api';
import { fetchAttendanceLogs } from '../../components/common/attendanceStore';
import { DEFAULT_CLASS_NAMES, sortClassNames } from '../../components/common/masterData';
import {
  EXAMINATION_UPDATED_EVENT,
  fetchExaminationState,
  getBoardResultForStudent,
  getReportRowsForStudent,
  isBoardFinalExam,
  readExaminationState,
} from '../../components/common/examinationStore';

const MAX_DOCUMENT_SIZE = 2 * 1024 * 1024;

const formatFileSize = (bytes = 0) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Clerk verification workflow: each document carries a status the clerk sets
// from the Document Management page. Students see the decision here (and a
// rejection reason), and cannot replace a doc the school has locked/approved.
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

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Documents now live in binary storage server-side (POST/GET/DELETE
// /student-documents). We keep ONLY metadata in the student roster blob so the
// shared roster payload never carries base64 dataUrls again. This mirrors the
// authed FormData-upload + authed blob-fetch pattern in ExaminationHub's
// boardResultsApi.
const studentDocumentsApi = {
  async upload({ file, admissionNumber, docName }) {
    const form = new FormData();
    form.append('file', file);
    form.append('admissionNumber', admissionNumber);
    form.append('docName', docName);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/student-documents`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || 'Document upload failed.');
      // Surface the HTTP status so the caller can show the friendly "locked"
      // message on a 403 (backend blocks students re-uploading locked/approved).
      error.status = response.status;
      throw error;
    }
    return payload;
  },
  async fetchStatuses({ admissionNumber }) {
    // Per-doc verification metadata: status ('pending'|'approved'|'rejected'|
    // 'locked'), reviewNote (rejection reason), reviewer info. Returns an array;
    // we key it by docName so the vault rows can show the clerk's decision.
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/student-documents?admissionNumber=${encodeURIComponent(admissionNumber)}`,
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
  async fetchBlob({ admissionNumber, docName }) {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/student-documents/${encodeURIComponent(admissionNumber)}/${encodeURIComponent(docName)}`,
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
  async remove({ admissionNumber, docName }) {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/student-documents/${encodeURIComponent(admissionNumber)}/${encodeURIComponent(docName)}`,
      {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Could not delete the document.');
    }
    return true;
  },
};

const normalizeDocument = (doc, fallbackName = '') => ({
  name: doc?.name || fallbackName,
  file: doc?.file || '',
  status: doc?.status || (doc?.file ? 'Uploaded' : 'Missing'),
  uploadedAt: doc?.uploadedAt || '',
  size: doc?.size || 0,
  type: doc?.type || '',
  dataUrl: doc?.dataUrl || '',
});

const getProfileClassName = (student = {}) =>
  student.className || student.class || student.targetClass || student.rawProfile?.targetClass || '';

const deriveClassHistory = (student = {}) => {
  // Merge classes from every signal we have — explicit classHistory, feeLedger
  // entries (every class the student ever paid fees for), previousClass, and
  // the current class. Dedupe + sort by natural class order. Bug fix: earlier
  // versions only returned the current class when classHistory[] was empty, so
  // the dropdown appeared frozen on today's class.
  const collected = new Set();
  const push = (raw) => {
    const name = String(raw || '').trim();
    if (name) collected.add(name);
  };

  const explicitHistory = Array.isArray(student.classHistory) ? student.classHistory : [];
  explicitHistory.forEach((entry) => push(entry.className || entry.class || entry));

  const feeLedger = Array.isArray(student.feeLedger) ? student.feeLedger : [];
  feeLedger.forEach((entry) => push(entry.className));

  push(student.previousClass);
  push(student.rawProfile?.previousClass);
  push(student.admissionClass);
  push(student.rawProfile?.admissionClass);
  push(student.rawProfile?.joiningClass);
  push(getProfileClassName(student));

  const currentClass = getProfileClassName(student);
  const currentIndex = DEFAULT_CLASS_NAMES.indexOf(currentClass);
  if (currentIndex >= 0) {
    // If we still only know the current class, backfill from the roster the
    // student joined at up to today so the dropdown has real options.
    if (collected.size <= 1) {
      const startClass = student.admissionClass || student.rawProfile?.admissionClass || student.rawProfile?.joiningClass || currentClass;
      const startIndex = DEFAULT_CLASS_NAMES.indexOf(startClass);
      const from = Math.max(0, startIndex >= 0 ? startIndex : currentIndex);
      DEFAULT_CLASS_NAMES.slice(from, currentIndex + 1).forEach(push);
    }
  }

  return sortClassNames(Array.from(collected));
};

const getClassSnapshot = (student = {}, className = '') =>
  (Array.isArray(student.classHistory) ? student.classHistory : []).find(
    (entry) => (entry.className || entry.class) === className
  ) || {};

const StudentProfile = ({ studentContext, onBack }) => {
  // Active Tab Controller State
  const [activeTab, setActiveTab] = useState('analytics');
  // Finance is admin-only — clerks reuse this same profile and must NOT see fees.
  const canViewFinance = getStoredSession()?.role === 'admin';

  const [studentsDb, setStudentsDb] = useMongoState('admin-student-management-students', []);
  const [roleDocuments] = useMongoState('admin-document-requirements', { Student: [] });
  const [financeRecords] = useMongoState('admin-finance-class-ledgers', []);
  const [examinationState, setExaminationState] = useState(() => readExaminationState());
  const [documentDraftState, setDocumentDraftState] = useState({ key: '', documents: [] });
  // Clerk verification metadata, keyed by lower-cased docName.
  const [documentStatuses, setDocumentStatuses] = useState({});
  const [documentMessage, setDocumentMessage] = useState('');
  const [customDocumentName, setCustomDocumentName] = useState('');
  const [liveAttendanceLogs, setLiveAttendanceLogs] = useState([]);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [detailMessage, setDetailMessage] = useState('');
  const studentAdmissionId =
    studentContext?.admissionNumber ||
    studentContext?.id ||
    localStorage.getItem('mgps_selected_student_profile') ||
    window.location.pathname.split('/').pop() ||
    '';
  const matchedStudent =
    studentContext ||
    studentsDb.find(
      (student) => student.admissionNumber === studentAdmissionId || student.id === studentAdmissionId
    ) ||
    {};
  const classHistory = deriveClassHistory(matchedStudent);
  // Default to the CURRENT class (last in natural order), not the earliest.
  const [selectedClassName, setSelectedClassName] = useState(
    getProfileClassName(matchedStudent) || classHistory[classHistory.length - 1] || ''
  );
  const profileData = {
    ...(matchedStudent.rawProfile || {}),
    admissionNumber: matchedStudent.admissionNumber || matchedStudent.id || studentAdmissionId,
    rollNo: matchedStudent.rollNo || matchedStudent.rawProfile?.rollNo || '',
    studentName: matchedStudent.studentName || matchedStudent.rawProfile?.studentName || matchedStudent.name || matchedStudent.displayName || '',
    gender: matchedStudent.gender || matchedStudent.rawProfile?.gender || '',
    dob: matchedStudent.dob || matchedStudent.rawProfile?.dob || '',
    category: matchedStudent.category || matchedStudent.rawProfile?.category || '',
    religion: matchedStudent.religion || matchedStudent.rawProfile?.religion || '',
    mobileNo: matchedStudent.mobileNo || matchedStudent.rawProfile?.mobileNo || matchedStudent.mobile || '',
    altMobileNo: matchedStudent.altMobileNo || matchedStudent.rawProfile?.altMobileNo || '',
    email: matchedStudent.email || matchedStudent.rawProfile?.email || '',
    dateOfAdmission: matchedStudent.dateOfAdmission || matchedStudent.rawProfile?.dateOfAdmission || '',
    targetClass: selectedClassName || matchedStudent.targetClass || matchedStudent.class || matchedStudent.className || '',
    lastSchoolName: matchedStudent.lastSchoolName || matchedStudent.rawProfile?.lastSchoolName || '',
    penNumber: matchedStudent.penNumber || matchedStudent.rawProfile?.penNumber || '',
    aadharNumber: matchedStudent.rawProfile?.studentAadhar || matchedStudent.studentAadhar || matchedStudent.aadharNumber || matchedStudent.aadhaarNumber || matchedStudent.rawProfile?.aadharNumber || matchedStudent.rawProfile?.aadhaarNumber || '',
    fatherName: matchedStudent.fatherName || matchedStudent.rawProfile?.fatherName || '',
    motherName: matchedStudent.motherName || matchedStudent.rawProfile?.motherName || '',
    fatherAadhar: matchedStudent.fatherAadhar || matchedStudent.rawProfile?.fatherAadhar || '',
    motherAadhar: matchedStudent.motherAadhar || matchedStudent.rawProfile?.motherAadhar || '',
    livingWith: matchedStudent.livingWith || matchedStudent.rawProfile?.livingWith || '',
    guardianName: matchedStudent.guardianName || matchedStudent.rawProfile?.guardianName || '',
    guardianAadhar: matchedStudent.guardianAadhar || matchedStudent.rawProfile?.guardianAadhar || '',
    tempAddress: matchedStudent.tempAddress || matchedStudent.rawProfile?.tempAddress || '',
    permAddress: matchedStudent.permAddress || matchedStudent.rawProfile?.permAddress || '',
    attendancePercentage: Number(matchedStudent.attendancePercentage) || 0,
    totalWorkingDays: Number(matchedStudent.totalWorkingDays) || 0,
    presentDays: Number(matchedStudent.presentDays) || 0,
    exams: matchedStudent.exams || [],
    documents: matchedStudent.documents || matchedStudent.rawProfile?.documents || [],
    photoDataUrl: matchedStudent.photoDataUrl || matchedStudent.rawProfile?.photoDataUrl || '',
  };
  const classSnapshot = getClassSnapshot(matchedStudent, selectedClassName);
  const liveAttendance = liveAttendanceLogs.reduce(
    (acc, log) => {
      acc.totalWorkingDays += 1;
      if (log.status === 'present' || log.status === 'half-day' || log.status === 'manual') {
        acc.presentDays += 1;
      }
      return acc;
    },
    { totalWorkingDays: 0, presentDays: 0 }
  );
  const classAttendance = liveAttendance.totalWorkingDays
    ? {
        totalWorkingDays: liveAttendance.totalWorkingDays,
        presentDays: liveAttendance.presentDays,
        attendancePercentage: Math.round((liveAttendance.presentDays / liveAttendance.totalWorkingDays) * 100),
      }
    : {
        totalWorkingDays: Number(classSnapshot.totalWorkingDays || matchedStudent.totalWorkingDays || 0),
        presentDays: Number(classSnapshot.presentDays || matchedStudent.presentDays || 0),
        attendancePercentage: Number(classSnapshot.attendancePercentage || matchedStudent.attendancePercentage || 0),
      };
  const profileExamStudent = {
    id: profileData.admissionNumber,
    admissionNumber: profileData.admissionNumber,
    displayName: profileData.studentName,
    className: selectedClassName,
  };
  const classExamRows = examinationState.exams.flatMap((exam) => {
    const boardResult = getBoardResultForStudent(examinationState, profileExamStudent, exam.id, selectedClassName);
    if (boardResult) {
      return [{
        term: `${exam.name} Board Result`,
        score: 'PDF uploaded',
        rank: '-',
        status: 'Board Result',
        pdf: boardResult,
      }];
    }

    const rows = getReportRowsForStudent(examinationState, profileExamStudent, exam.id);
    if (!rows.length) return [];
    const total = rows.reduce((sum, row) => sum + Number(row.marks || 0), 0);
    const maxTotal = rows.reduce((sum, row) => sum + Number(row.maxMarks || 0), 0);
    return [{
      term: exam.name,
      score: maxTotal ? `${Math.round((total / maxTotal) * 100)}%` : '-',
      rank: '-',
      status: isBoardFinalExam(examinationState, exam, selectedClassName) ? 'Board PDF pending' : 'Internal',
    }];
  });
  const fallbackExamRows = (classSnapshot.exams || matchedStudent.exams || []).map((exam) => ({
    ...exam,
    status: exam.status || 'Recorded',
  }));
  const selectedClassFinance = (Array.isArray(financeRecords) ? financeRecords : []).filter(
    (record) =>
      record.className === selectedClassName &&
      (record.admissionNumber === profileData.admissionNumber || record.studentId === profileData.admissionNumber)
  );

  useEffect(() => {
    if (!classHistory.length) return;
    if (!selectedClassName || !classHistory.includes(selectedClassName)) {
      setSelectedClassName(classHistory[classHistory.length - 1]);
    }
  }, [classHistory, selectedClassName]);

  useEffect(() => {
    if (!profileData.admissionNumber) return;
    fetchAttendanceLogs({
      entityType: 'student',
      entityId: profileData.admissionNumber,
      className: selectedClassName,
      period: 'yearly',
    })
      .then((payload) => setLiveAttendanceLogs(payload.logs || []))
      .catch(() => setLiveAttendanceLogs([]));
  }, [profileData.admissionNumber, selectedClassName]);

  const refreshDocumentStatuses = React.useCallback(() => {
    if (!profileData.admissionNumber) return Promise.resolve();
    return studentDocumentsApi
      .fetchStatuses({ admissionNumber: profileData.admissionNumber })
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
          };
        });
        setDocumentStatuses(byName);
      })
      .catch(() => {
        // Status endpoint unavailable (e.g. brand-new roster) — leave the vault
        // usable without verification chips rather than blocking uploads.
        setDocumentStatuses({});
      });
  }, [profileData.admissionNumber]);

  useEffect(() => {
    refreshDocumentStatuses();
  }, [refreshDocumentStatuses]);

  useEffect(() => {
    let isActive = true;
    const refreshState = () => {
      fetchExaminationState().then((latestState) => {
        if (isActive) setExaminationState(latestState);
      });
    };
    window.addEventListener(EXAMINATION_UPDATED_EVENT, refreshState);
    fetchExaminationState().then(setExaminationState);
    return () => {
      isActive = false;
      window.removeEventListener(EXAMINATION_UPDATED_EVENT, refreshState);
    };
  }, []);

  const documentRequirements = useMemo(
    () => (Array.isArray(roleDocuments.Student) ? roleDocuments.Student : []),
    [roleDocuments]
  );
  const baseDocumentDrafts = (() => {
    const savedDocuments = (profileData.documents || []).map((doc) => normalizeDocument(doc));
    const byName = new Map(savedDocuments.map((doc) => [doc.name.toLowerCase(), doc]));
    const requiredDocuments = documentRequirements.map((docName) => {
      const existing = byName.get(docName.toLowerCase());
      return existing || normalizeDocument({ name: docName, status: 'Missing' });
    });
    const extras = savedDocuments.filter(
      (doc) => !documentRequirements.some((required) => required.toLowerCase() === doc.name.toLowerCase())
    );

    return [...requiredDocuments, ...extras];
  })();
  const documentDraftKey = `${profileData.admissionNumber}:${JSON.stringify(baseDocumentDrafts)}`;
  const documentDrafts =
    documentDraftState.key === documentDraftKey ? documentDraftState.documents : baseDocumentDrafts;

  const handleDocumentUpload = async (docName, file) => {
    if (!file) return;
    if (file.size > MAX_DOCUMENT_SIZE) {
      alert('Document file size must be 2 MB or less.');
      return;
    }

    // Respect the clerk verification lock client-side too, so a locked/approved
    // doc never even attempts the upload (the backend still enforces this 403).
    const currentStatus = documentStatuses[docName.toLowerCase()]?.status;
    if (isDocumentLocked(currentStatus)) {
      alert("This document is locked and can't be changed. Contact the school office.");
      return;
    }

    // Persist the file to binary storage immediately. Only metadata (a pointer)
    // goes into the roster draft — never base64 — so the shared roster blob
    // stays small. The Save button then just writes that pointer metadata.
    let resp;
    try {
      resp = await studentDocumentsApi.upload({
        file,
        admissionNumber: profileData.admissionNumber,
        docName,
      });
    } catch (error) {
      if (error.status === 403) {
        alert("This document is locked and can't be changed. Contact the school office.");
      } else {
        alert(error.message || 'Document upload failed. Please try again.');
      }
      return;
    }

    setDocumentDraftState({
      key: documentDraftKey,
      documents: documentDrafts.map((doc) =>
        doc.name === docName
          ? {
              ...doc,
              file: file.name,
              fileName: resp?.fileName || file.name,
              status: 'Uploaded',
              uploadedAt: resp?.uploadedAt || new Date().toISOString(),
              size: file.size,
              type: file.type,
              stored: true,
            }
          : doc
      ),
    });
    setDocumentMessage('Document uploaded. Save documents to update the record.');
    // Re-pull the verification status so the chip flips back to Pending after a
    // fresh upload/replace of a previously-rejected document.
    refreshDocumentStatuses();
  };

  const handleSaveDocuments = () => {
    // Persist metadata only. Strip any legacy base64 dataUrl so old bloated
    // records get cleaned out of the roster blob on the next save.
    const cleanDocuments = documentDrafts
      .filter((doc) => doc.name)
      .map((doc) => {
        const { dataUrl, ...rest } = doc;
        return rest;
      });

    setStudentsDb((students) =>
      students.map((student) => {
        const isMatch =
          student.admissionNumber === profileData.admissionNumber ||
          student.id === profileData.admissionNumber;

        if (!isMatch) return student;

        return {
          ...student,
          documents: cleanDocuments,
          rawProfile: {
            ...(student.rawProfile || {}),
            documents: cleanDocuments,
          },
        };
      })
    );
    setDocumentMessage('Documents saved successfully.');
  };

  const handleAddCustomDocument = (event) => {
    event.preventDefault();
    const nextName = customDocumentName.trim();
    if (!nextName) return;

    if (documentDrafts.some((doc) => doc.name.toLowerCase() === nextName.toLowerCase())) {
      alert('This document slot already exists.');
      return;
    }

    setDocumentDraftState({
      key: documentDraftKey,
      documents: [...documentDrafts, normalizeDocument({ name: nextName, status: 'Missing' })],
    });
    setCustomDocumentName('');
    setDocumentMessage('New document slot added. Upload a file and save documents.');
  };

  // Open a document: prefer a legacy inline dataUrl (not-yet-migrated records),
  // otherwise fetch the bytes from binary storage as an authed blob and open the
  // object URL. Returns true when it managed to open something.
  const openStudentDocument = async (doc) => {
    if (doc.dataUrl) {
      window.open(doc.dataUrl, '_blank');
      return true;
    }

    if (!(doc.stored || doc.status === 'Uploaded' || doc.file)) {
      alert('This document only has a filename record. Upload/replace it once to enable preview.');
      return false;
    }

    try {
      const blob = await studentDocumentsApi.fetchBlob({
        admissionNumber: profileData.admissionNumber,
        docName: doc.name,
      });
      window.open(URL.createObjectURL(blob), '_blank');
      return true;
    } catch (error) {
      alert(error.message || 'Document not available.');
      return false;
    }
  };

  const handleDownloadDocument = (doc) => {
    // Fetching an authed blob and opening it lets the user save from the viewer;
    // the endpoint sets the download filename server-side.
    openStudentDocument(doc);
  };

  const handleViewDocument = (doc) => {
    openStudentDocument(doc);
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose a valid image file.');
      return;
    }

    const photoDataUrl = await fileToDataUrl(file);
    setStudentsDb((students) =>
      students.map((student) => {
        const isMatch =
          student.admissionNumber === profileData.admissionNumber ||
          student.id === profileData.admissionNumber;

        if (!isMatch) return student;

        return {
          ...student,
          photoDataUrl,
          rawProfile: {
            ...(student.rawProfile || {}),
            photoDataUrl,
          },
        };
      })
    );
  };

  const handleStartEditDetails = () => {
    setEditForm({
      studentName: profileData.studentName || '',
      rollNo: profileData.rollNo || '',
      gender: profileData.gender || '',
      dob: profileData.dob || '',
      category: profileData.category || '',
      religion: profileData.religion || '',
      mobileNo: profileData.mobileNo || '',
      altMobileNo: profileData.altMobileNo || '',
      email: profileData.email || '',
      dateOfAdmission: profileData.dateOfAdmission || '',
      lastSchoolName: profileData.lastSchoolName || '',
      penNumber: profileData.penNumber || '',
      aadharNumber: profileData.aadharNumber || '',
      fatherName: profileData.fatherName || '',
      motherName: profileData.motherName || '',
      fatherAadhar: profileData.fatherAadhar || '',
      motherAadhar: profileData.motherAadhar || '',
      livingWith: profileData.livingWith || '',
      guardianName: profileData.guardianName || '',
      guardianAadhar: profileData.guardianAadhar || '',
      tempAddress: profileData.tempAddress || '',
      permAddress: profileData.permAddress || '',
    });
    setDetailMessage('');
    setIsEditingDetails(true);
  };

  const handleEditFieldChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancelEditDetails = () => {
    setIsEditingDetails(false);
    setDetailMessage('');
  };

  const handleSaveDetails = () => {
    // Write every edited value to BOTH the top-level field AND the matching
    // rawProfile key so every reader (roster tables + this profile) stays
    // consistent. Student Aadhaar maps to rawProfile.studentAadhar (+ top-level
    // studentAadhar), not a new key. Same setStudentsDb pattern as
    // handleSaveDocuments — spread the existing record + rawProfile, overlay only
    // the edited fields.
    setStudentsDb((students) =>
      students.map((student) => {
        const isMatch =
          student.admissionNumber === profileData.admissionNumber ||
          student.id === profileData.admissionNumber;

        if (!isMatch) return student;

        return {
          ...student,
          studentName: editForm.studentName,
          name: editForm.studentName,
          displayName: editForm.studentName,
          rollNo: editForm.rollNo,
          gender: editForm.gender,
          dob: editForm.dob,
          category: editForm.category,
          religion: editForm.religion,
          mobileNo: editForm.mobileNo,
          mobile: editForm.mobileNo,
          altMobileNo: editForm.altMobileNo,
          email: editForm.email,
          dateOfAdmission: editForm.dateOfAdmission,
          lastSchoolName: editForm.lastSchoolName,
          penNumber: editForm.penNumber,
          studentAadhar: editForm.aadharNumber,
          aadharNumber: editForm.aadharNumber,
          fatherName: editForm.fatherName,
          motherName: editForm.motherName,
          fatherAadhar: editForm.fatherAadhar,
          motherAadhar: editForm.motherAadhar,
          livingWith: editForm.livingWith,
          guardianName: editForm.guardianName,
          guardianAadhar: editForm.guardianAadhar,
          tempAddress: editForm.tempAddress,
          permAddress: editForm.permAddress,
          rawProfile: {
            ...(student.rawProfile || {}),
            studentName: editForm.studentName,
            rollNo: editForm.rollNo,
            gender: editForm.gender,
            dob: editForm.dob,
            category: editForm.category,
            religion: editForm.religion,
            mobileNo: editForm.mobileNo,
            altMobileNo: editForm.altMobileNo,
            email: editForm.email,
            dateOfAdmission: editForm.dateOfAdmission,
            lastSchoolName: editForm.lastSchoolName,
            penNumber: editForm.penNumber,
            studentAadhar: editForm.aadharNumber,
            fatherName: editForm.fatherName,
            motherName: editForm.motherName,
            fatherAadhar: editForm.fatherAadhar,
            motherAadhar: editForm.motherAadhar,
            livingWith: editForm.livingWith,
            guardianName: editForm.guardianName,
            guardianAadhar: editForm.guardianAadhar,
            tempAddress: editForm.tempAddress,
            permAddress: editForm.permAddress,
          },
        };
      })
    );
    setIsEditingDetails(false);
    setDetailMessage('Student details saved successfully.');
  };

  // Native clean window navigation step-back
  const handleBackNavigation = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    window.location.href = '/admin/student-management';
  };

  return (
    <div className="flex-1 min-h-screen p-6 font-sans select-none text-slate-900">

      {/* TOP COMPACT BANNER LAYER */}
      <div className="glass-card p-4 rounded-3xl flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackNavigation}
            className="p-2 hover:bg-white/70 rounded-full transition-colors border border-slate-200/70"
          >
            <ArrowLeft className="w-4 h-4 text-slate-900" />
          </button>
          <div>
            <h3 className="text-md font-black tracking-tight">Student Workspace Folder</h3>
            <p className="text-[11px] text-slate-500">Comprehensive profile audit node for registered identities.</p>
          </div>
        </div>
        <span className="text-xs bg-indigo-50/60 px-3 py-1.5 rounded-full font-mono font-bold border border-slate-200/70 uppercase">
          ID: {profileData.admissionNumber}
        </span>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-slate-900">Class-wise Student History</h4>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Switch classes to view attendance, exams, finance, documents, and sibling status for that year.
          </p>
        </div>
        <select
          value={selectedClassName}
          onChange={(event) => setSelectedClassName(event.target.value)}
          className="bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl px-3 py-2 text-xs font-black min-w-44"
        >
          {classHistory.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>
      </div>

      {/* CORE 2-COLUMN PROFILE CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: THE DISCIPLINED IDENTITY CARD PANEL (3 COLS) */}
        <div className="lg:col-span-4 glass-card rounded-3xl p-6 text-center space-y-5">

          {/* Avatar Area */}
          <div className="relative w-28 h-28 mx-auto bg-indigo-50/60 rounded-3xl border-2 border-white/80 flex items-center justify-center overflow-hidden">
            {profileData.photoDataUrl ? (
              <img src={profileData.photoDataUrl} alt={profileData.studentName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-14 h-14 text-slate-400" />
            )}
            <div className="absolute bottom-1 right-1 bg-indigo-100 text-indigo-700 border-indigo-200 text-[9px] font-black font-mono border px-1.5 py-0.5 rounded-md">
              LIVE
            </div>
          </div>

          <label className="btn-primary inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black cursor-pointer transition-colors">
            <Camera className="w-3.5 h-3.5" />
            Update Photo
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>

          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">{profileData.studentName}</h2>
            <p className="text-xs font-bold text-slate-500 mt-1 flex items-center justify-center gap-1.5">
              <span>{profileData.targetClass}</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span>Roll Number: #{profileData.rollNo}</span>
            </p>
          </div>

          <hr className="border-slate-100/80" />

          <div className="glass-soft rounded-2xl p-3 text-left">
            <p className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Account for {selectedClassName || 'selected class'}
            </p>
            <p className="text-xs font-bold text-slate-900 mt-1">
              {classSnapshot.siblingGroupId || matchedStudent.siblingGroupId || matchedStudent.familyId
                ? `Family account: ${classSnapshot.siblingGroupId || matchedStudent.siblingGroupId || matchedStudent.familyId}`
                : `Individual account: STD-${profileData.admissionNumber}`}
            </p>
          </div>

          {/* Core Mini Matrix Stats */}
          <div className="grid grid-cols-2 gap-2 text-left text-[11px] font-bold">
            <div className="glass-soft p-2.5 rounded-xl">
              <span className="text-slate-500 block">Admission Date</span>
              <span className="text-slate-900 text-xs font-black block mt-0.5">{profileData.dateOfAdmission}</span>
            </div>
            <div className="glass-soft p-2.5 rounded-xl">
              <span className="text-slate-500 block">Category Track</span>
              <span className="text-slate-900 text-xs font-black block mt-0.5">{profileData.category}</span>
            </div>
          </div>

          {/* Quick Contact Coordinates Stack */}
          <div className="space-y-2 text-left text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2 glass-soft p-2.5 rounded-xl">
              <Phone className="w-3.5 h-3.5 text-slate-900" />
              <span className="font-mono text-slate-900">{profileData.mobileNo}</span>
            </div>
            <div className="flex items-center gap-2 glass-soft p-2.5 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-slate-900" />
              <span className="text-slate-900">{profileData.dob} ({profileData.gender})</span>
            </div>
            <div className="flex items-center gap-2 glass-soft p-2.5 rounded-xl">
              <MapPin className="w-3.5 h-3.5 text-slate-900 shrink-0" />
              <span className="text-slate-900 truncate" title={profileData.tempAddress}>
                {profileData.tempAddress}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RECONFIGURED TABS ARCHITECTURE SUB-SYSTEM (8 COLS) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* NAVIGATION TAB CONTROLLERS SELECTORS */}
          <div className="glass-card p-2 rounded-2xl flex flex-wrap gap-1 text-xs font-black">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'analytics' ? 'btn-primary' : 'text-slate-500 hover:bg-white/70'}`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Academic Analytics
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'details' ? 'btn-primary' : 'text-slate-500 hover:bg-white/70'}`}
            >
              <User className="w-3.5 h-3.5" /> Personal Matrix Records
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'exams' ? 'btn-primary' : 'text-slate-500 hover:bg-white/70'}`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Examinations
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'documents' ? 'btn-primary' : 'text-slate-500 hover:bg-white/70'}`}
            >
              <FileText className="w-3.5 h-3.5" /> Document Vault
            </button>
            {canViewFinance && (
              <button
                onClick={() => setActiveTab('finance')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'finance' ? 'btn-primary' : 'text-slate-500 hover:bg-white/70'}`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Finance
              </button>
            )}
          </div>

          {/* DYNAMIC CONTENT SWITCHBOARD VIEWER PANELS */}
          <div className="glass-card rounded-3xl p-6 min-h-[360px]">
            
            {/* TAB VALUE 1: ANALYTICS & ATTENDANCE GRAPHS */}
            {activeTab === 'analytics' && (
              <div className="space-y-6 animate-fadeIn text-xs font-bold">
                <div className="border-b border-slate-100/80 pb-2">
                  <h4 className="text-sm font-black text-slate-900">Live Attendance Metric Trackers</h4>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">
                    {liveAttendanceLogs.length ? 'Connected to QR / biometric attendance logs.' : 'Using saved profile attendance until live logs are marked.'}
                  </p>
                </div>

                {/* Simulated Attendance Visual Graph Node Component */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass-soft p-4 rounded-2xl text-center">
                    <span className="text-slate-500 block text-[11px]">Total Session Days</span>
                    <span className="text-xl font-black text-slate-900 block mt-1 font-mono">{classAttendance.totalWorkingDays}</span>
                  </div>
                  <div className="glass-soft p-4 rounded-2xl text-center">
                    <span className="text-slate-500 block text-[11px]">Total Days Present</span>
                    <span className="text-xl font-black text-emerald-600 block mt-1 font-mono">{classAttendance.presentDays}</span>
                  </div>
                  <div className="bg-indigo-50/60 border border-indigo-200/60 p-4 rounded-2xl text-center">
                    <span className="text-slate-500 block text-[11px]">Attendance Ratio</span>
                    <span className="text-xl font-black text-slate-900 block mt-1 font-mono">{classAttendance.attendancePercentage}%</span>
                  </div>
                </div>

                {/* GRAPH SCALE REPRESENTATION LAYOUT */}
                <div className="space-y-2 pt-2">
                  <label className="text-slate-500 block text-[11px]">Visual Roster Percentage Bar</label>
                  <div className="w-full h-4 bg-white/50 rounded-full overflow-hidden border border-slate-200/70 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${classAttendance.attendancePercentage}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold text-right">Target safe boundary limit threshold: 75.0%</p>
                </div>
              </div>
            )}

            {/* TAB VALUE 2: COMPREHENSIVE COMPACT REGISTRATION SUB-DATA GRID */}
            {activeTab === 'details' && (
              <div className="space-y-6 animate-fadeIn text-xs font-bold text-slate-900">

                {/* Edit / Save action header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100/80 pb-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Personal Matrix Records</h4>
                    {detailMessage && (
                      <p className="text-[10px] font-bold text-emerald-600 mt-1">{detailMessage}</p>
                    )}
                  </div>
                  {isEditingDetails ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDetails}
                        className="btn-primary px-4 py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditDetails}
                        className="px-4 py-2 bg-white/60 hover:bg-slate-900 hover:text-white border border-slate-200/70 rounded-xl text-[10px] font-black transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartEditDetails}
                      className="btn-primary px-4 py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5"
                    >
                      <User className="w-3.5 h-3.5" /> Edit Details
                    </button>
                  )}
                </div>

                {/* Core Identity Block */}
                <div>
                  <h5 className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100/80 pb-1.5 mb-3 flex items-center gap-1">
                    <span className="w-1 h-2 bg-indigo-400 inline-block rounded-xs"></span> Student Identity
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isEditingDetails ? (
                      <>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Student Name:</span><input type="text" value={editForm.studentName} onChange={(e) => handleEditFieldChange('studentName', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Roll Number:</span><input type="text" value={editForm.rollNo} onChange={(e) => handleEditFieldChange('rollNo', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Gender:</span><input type="text" value={editForm.gender} onChange={(e) => handleEditFieldChange('gender', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Date of Birth:</span><input type="text" value={editForm.dob} onChange={(e) => handleEditFieldChange('dob', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Category:</span><input type="text" value={editForm.category} onChange={(e) => handleEditFieldChange('category', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Religion:</span><input type="text" value={editForm.religion} onChange={(e) => handleEditFieldChange('religion', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Mobile Number:</span><input type="text" value={editForm.mobileNo} onChange={(e) => handleEditFieldChange('mobileNo', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Alternate Mobile:</span><input type="text" value={editForm.altMobileNo} onChange={(e) => handleEditFieldChange('altMobileNo', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Email:</span><input type="text" value={editForm.email} onChange={(e) => handleEditFieldChange('email', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                      </>
                    ) : (
                      <>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Student Name:</span>{profileData.studentName || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Roll Number:</span>{profileData.rollNo || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Gender:</span>{profileData.gender || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Date of Birth:</span>{profileData.dob || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Category:</span>{profileData.category || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Religion:</span>{profileData.religion || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Mobile Number:</span>{profileData.mobileNo || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Alternate Mobile:</span>{profileData.altMobileNo || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Email:</span>{profileData.email || 'Not provided'}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Academic Parent Nodes Block */}
                <div>
                  <h5 className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100/80 pb-1.5 mb-3 flex items-center gap-1">
                    <span className="w-1 h-2 bg-indigo-400 inline-block rounded-xs"></span> Lineage Parent Details
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isEditingDetails ? (
                      <>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Father Name:</span><input type="text" value={editForm.fatherName} onChange={(e) => handleEditFieldChange('fatherName', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Mother Name:</span><input type="text" value={editForm.motherName} onChange={(e) => handleEditFieldChange('motherName', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Father Aadhaar ID:</span><input type="text" value={editForm.fatherAadhar} onChange={(e) => handleEditFieldChange('fatherAadhar', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold font-mono outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Mother Aadhaar ID:</span><input type="text" value={editForm.motherAadhar} onChange={(e) => handleEditFieldChange('motherAadhar', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold font-mono outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Living With:</span><input type="text" value={editForm.livingWith} onChange={(e) => handleEditFieldChange('livingWith', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Guardian Name:</span><input type="text" value={editForm.guardianName} onChange={(e) => handleEditFieldChange('guardianName', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Guardian Aadhaar:</span><input type="text" value={editForm.guardianAadhar} onChange={(e) => handleEditFieldChange('guardianAadhar', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold font-mono outline-none focus:border-indigo-400" /></label>
                      </>
                    ) : (
                      <>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Father Name:</span>{profileData.fatherName}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Mother Name:</span>{profileData.motherName}</p>
                        <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Father Aadhaar ID:</span>{profileData.fatherAadhar}</p>
                        <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Mother Aadhaar ID:</span>{profileData.motherAadhar}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Living With:</span>{profileData.livingWith || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Guardian Name:</span>{profileData.guardianName || profileData.livingWith || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Guardian Aadhaar:</span>{profileData.guardianAadhar || 'Not provided'}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Structural Identities Block */}
                <div>
                  <h5 className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100/80 pb-1.5 mb-3 flex items-center gap-1">
                    <span className="w-1 h-2 bg-indigo-400 inline-block rounded-xs"></span> Institutional Tracking Parameters
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {isEditingDetails ? (
                      <>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">PEN ID Code:</span><input type="text" value={editForm.penNumber} onChange={(e) => handleEditFieldChange('penNumber', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold font-mono outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Aadhaar Number:</span><input type="text" value={editForm.aadharNumber} onChange={(e) => handleEditFieldChange('aadharNumber', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold font-mono outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Date of Admission:</span><input type="text" value={editForm.dateOfAdmission} onChange={(e) => handleEditFieldChange('dateOfAdmission', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Previous Institute:</span><input type="text" value={editForm.lastSchoolName} onChange={(e) => handleEditFieldChange('lastSchoolName', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                      </>
                    ) : (
                      <>
                        <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">PEN ID Code:</span>{profileData.penNumber || 'NOT REQUIRED / PROVIDED'}</p>
                        <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Aadhaar Number:</span>{profileData.aadharNumber || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Date of Admission:</span>{profileData.dateOfAdmission || 'Not provided'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Religion Metric:</span>{profileData.religion}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Previous Institute:</span>{profileData.lastSchoolName || 'None Specified'}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Email:</span>{profileData.email || 'Not provided'}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Permanent Demographics Addresses Block */}
                <div>
                  <h5 className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100/80 pb-1.5 mb-3 flex items-center gap-1">
                    <span className="w-1 h-2 bg-indigo-400 inline-block rounded-xs"></span> Residential Addresses Coordinates
                  </h5>
                  <div className="space-y-2">
                    {isEditingDetails ? (
                      <>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Current Location (Temporary):</span><input type="text" value={editForm.tempAddress} onChange={(e) => handleEditFieldChange('tempAddress', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                        <label className="glass-soft p-3 rounded-xl block"><span className="text-slate-500 block text-[10px] mb-1">Home Registration (Permanent):</span><input type="text" value={editForm.permAddress} onChange={(e) => handleEditFieldChange('permAddress', e.target.value)} className="w-full p-2 bg-white/60 border border-white/80 rounded-lg text-xs font-bold outline-none focus:border-indigo-400" /></label>
                      </>
                    ) : (
                      <>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Current Location Location (Temporary):</span>{profileData.tempAddress}</p>
                        <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Home Registration Node (Permanent):</span>{profileData.permAddress}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB VALUE 3: EXAMINATION RECORDS MATRIX */}
            {activeTab === 'exams' && (
              <div className="space-y-4 animate-fadeIn text-xs font-bold">
                <div className="border-b border-slate-100/80 pb-2">
                  <h4 className="text-sm font-black text-slate-900">Historical Examination Grade Book</h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-100/80 uppercase text-[10px] tracking-wider">
                        <th className="pb-3">Assessment Term Cycle</th>
                        <th className="pb-3 text-center">Score Ratio</th>
                        <th className="pb-3 text-center">Class Rank Position</th>
                        <th className="pb-3 text-right">Status Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80 text-slate-900">
                      {(classExamRows.length ? classExamRows : fallbackExamRows).map((ex, idx) => (
                        <tr key={idx} className="hover:bg-white/50">
                          <td className="py-3.5 font-black">{ex.term}</td>
                          <td className="py-3.5 text-center font-mono text-sm">{ex.score}</td>
                          <td className="py-3.5 text-center font-mono">{ex.rank}</td>
                          <td className="py-3.5 text-right">
                            {ex.pdf?.dataUrl && (
                              <button
                                type="button"
                                onClick={() => window.open(ex.pdf.dataUrl, '_blank')}
                                className="mr-2 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-[10px] border border-blue-200"
                              >
                                View PDF
                              </button>
                            )}
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] border border-emerald-200">
                              {ex.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!classExamRows.length && !fallbackExamRows.length && (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-slate-500">
                            No examination records found for {selectedClassName}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB VALUE 4: DYNAMIC DOCUMENT STORAGE MANAGEMENT VAULT */}
            {activeTab === 'documents' && (
              <div className="space-y-4 animate-fadeIn text-xs font-bold">
                <div className="border-b border-slate-100/80 pb-2">
                  <h4 className="text-sm font-black text-slate-900">Verified Structural Asset Vault</h4>
                </div>

                <form onSubmit={handleAddCustomDocument} className="flex flex-col sm:flex-row gap-2 glass-soft rounded-2xl p-3">
                  <input
                    type="text"
                    value={customDocumentName}
                    onChange={(event) => setCustomDocumentName(event.target.value)}
                    placeholder="Add extra document name..."
                    className="flex-1 bg-white/60 border border-white/80 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all rounded-xl px-3 py-2 text-xs font-bold"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white/60 hover:bg-slate-900 hover:text-white border border-slate-200/70 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Slot
                  </button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {documentDrafts.map((doc, idx) => {
                    const verification = documentStatuses[doc.name.toLowerCase()] || {};
                    const verificationStatus = verification.status;
                    const locked = isDocumentLocked(verificationStatus);
                    return (
                      <div key={`${doc.name}-${idx}`} className="glass-soft p-3 rounded-xl flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-slate-900 font-black truncate block">{doc.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono block truncate mt-0.5">
                              {doc.file || 'No file uploaded yet'} {doc.size ? `| ${formatFileSize(doc.size)}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {verificationStatus ? (
                              <span className={`text-[9px] px-1.5 py-0.5 border rounded font-black uppercase ${VERIFICATION_CHIP_STYLES[verificationStatus]}`}>
                                {VERIFICATION_CHIP_LABELS[verificationStatus]}
                              </span>
                            ) : (
                              <span className={`text-[9px] px-1.5 py-0.5 border rounded font-black uppercase ${
                                doc.file
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {doc.status}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleViewDocument(doc)}
                              className="p-2 bg-white/60 hover:bg-slate-900 hover:text-white rounded-lg border border-slate-200/70 transition-all"
                              title="Preview Document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadDocument(doc)}
                              className="p-2 bg-white/60 hover:bg-slate-900 hover:text-white rounded-lg border border-slate-200/70 transition-all"
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
                                title={doc.file ? 'Replace Document' : 'Upload Document'}
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                                  onChange={(event) => handleDocumentUpload(doc.name, event.target.files?.[0])}
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

                {documentDrafts.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-xs font-medium">
                    No document requirements configured for students yet.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-soft p-3 rounded-2xl">
                  <p className="text-[11px] text-slate-500 font-bold">
                    {documentMessage || 'Upload or replace files here, then save the student document vault.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveDocuments}
                    className="btn-primary px-4 py-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Documents
                  </button>
                </div>
              </div>
            )}

            {canViewFinance && activeTab === 'finance' && (
              <div className="space-y-4 animate-fadeIn text-xs font-bold">
                <div className="border-b border-slate-100/80 pb-2">
                  <h4 className="text-sm font-black text-slate-900">Class-wise Finance Records</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selectedClassFinance.map((record, index) => (
                    <div key={record.id || index} className="glass-soft rounded-2xl p-4">
                      <span className="text-[10px] text-slate-500 uppercase block">Session</span>
                      <strong className="text-sm text-slate-900">{record.session || record.academicYear || selectedClassName}</strong>
                      <div className="mt-3 space-y-1 font-mono">
                        <p>Assigned: Rs. {Number(record.totalAssigned || record.total || 0).toLocaleString('en-IN')}</p>
                        <p className="text-emerald-700">Paid: Rs. {Number(record.paid || record.recovered || 0).toLocaleString('en-IN')}</p>
                        <p className="text-red-600">Due: Rs. {Number(record.due || record.balance || record.pending || 0).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!selectedClassFinance.length && (
                  <div className="text-center py-12 text-slate-500 text-xs font-medium bg-white/50 rounded-2xl">
                    No finance ledger entries found for {selectedClassName}. Finance can still manage previous dues from its class dropdown.
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentProfile;
