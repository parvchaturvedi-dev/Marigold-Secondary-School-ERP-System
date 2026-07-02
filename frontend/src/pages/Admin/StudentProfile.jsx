import React, { useEffect, useMemo, useState } from 'react';
import { 
  ArrowLeft, User, Phone, MapPin, Calendar, 
  FileText, BarChart3, GraduationCap, Download, Eye, PlusCircle, Save, UploadCloud, Camera, CreditCard, Users
} from 'lucide-react';
import { useMongoState } from '../../components/common/mongoState';
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

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

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
  const explicitHistory = Array.isArray(student.classHistory) ? student.classHistory : [];
  if (explicitHistory.length) return sortClassNames(explicitHistory.map((entry) => entry.className || entry.class || entry));

  const currentClass = getProfileClassName(student);
  const currentIndex = DEFAULT_CLASS_NAMES.indexOf(currentClass);
  if (currentIndex >= 0) {
    const startClass = student.admissionClass || student.rawProfile?.admissionClass || student.rawProfile?.joiningClass || currentClass;
    const startIndex = DEFAULT_CLASS_NAMES.indexOf(startClass);
    return DEFAULT_CLASS_NAMES.slice(Math.max(0, startIndex >= 0 ? startIndex : currentIndex), currentIndex + 1);
  }

  return currentClass ? [currentClass] : [];
};

const getClassSnapshot = (student = {}, className = '') =>
  (Array.isArray(student.classHistory) ? student.classHistory : []).find(
    (entry) => (entry.className || entry.class) === className
  ) || {};

const StudentProfile = ({ studentContext, onBack }) => {
  // Active Tab Controller State
  const [activeTab, setActiveTab] = useState('analytics');

  const [studentsDb, setStudentsDb] = useMongoState('admin-student-management-students', []);
  const [roleDocuments] = useMongoState('admin-document-requirements', { Student: [] });
  const [financeRecords] = useMongoState('admin-finance-class-ledgers', []);
  const [examinationState, setExaminationState] = useState(() => readExaminationState());
  const [documentDraftState, setDocumentDraftState] = useState({ key: '', documents: [] });
  const [documentMessage, setDocumentMessage] = useState('');
  const [customDocumentName, setCustomDocumentName] = useState('');
  const [liveAttendanceLogs, setLiveAttendanceLogs] = useState([]);
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
  const [selectedClassName, setSelectedClassName] = useState(classHistory[0] || '');
  const profileData = {
    ...(matchedStudent.rawProfile || {}),
    admissionNumber: matchedStudent.admissionNumber || matchedStudent.id || studentAdmissionId,
    rollNo: matchedStudent.rollNo || '',
    studentName: matchedStudent.studentName || matchedStudent.name || matchedStudent.displayName || '',
    gender: matchedStudent.gender || '',
    dob: matchedStudent.dob || '',
    category: matchedStudent.category || '',
    religion: matchedStudent.religion || '',
    mobileNo: matchedStudent.mobileNo || matchedStudent.mobile || '',
    altMobileNo: matchedStudent.altMobileNo || '',
    email: matchedStudent.email || '',
    dateOfAdmission: matchedStudent.dateOfAdmission || '',
    targetClass: selectedClassName || matchedStudent.targetClass || matchedStudent.class || matchedStudent.className || '',
    lastSchoolName: matchedStudent.lastSchoolName || '',
    penNumber: matchedStudent.penNumber || '',
    aadharNumber: matchedStudent.aadharNumber || matchedStudent.aadhaarNumber || matchedStudent.rawProfile?.aadharNumber || matchedStudent.rawProfile?.aadhaarNumber || '',
    fatherName: matchedStudent.fatherName || '',
    motherName: matchedStudent.motherName || '',
    fatherAadhar: matchedStudent.fatherAadhar || '',
    motherAadhar: matchedStudent.motherAadhar || '',
    livingWith: matchedStudent.livingWith || '',
    guardianName: matchedStudent.guardianName || matchedStudent.rawProfile?.guardianName || '',
    guardianAadhar: matchedStudent.guardianAadhar || matchedStudent.rawProfile?.guardianAadhar || '',
    tempAddress: matchedStudent.tempAddress || '',
    permAddress: matchedStudent.permAddress || '',
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

    const dataUrl = await fileToDataUrl(file);
    setDocumentDraftState({
      key: documentDraftKey,
      documents: documentDrafts.map((doc) =>
        doc.name === docName
          ? {
              ...doc,
              file: file.name,
              status: 'Uploaded',
              uploadedAt: new Date().toISOString(),
              size: file.size,
              type: file.type,
              dataUrl,
            }
          : doc
      ),
    });
    setDocumentMessage('Unsaved document changes pending.');
  };

  const handleSaveDocuments = () => {
    const cleanDocuments = documentDrafts.filter((doc) => doc.name);

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

  const handleDownloadDocument = (doc) => {
    if (!doc.dataUrl) {
      alert('This document only has a filename record. Upload/replace it once to enable download.');
      return;
    }

    const link = document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.file || `${doc.name}.pdf`;
    link.click();
  };

  const handleViewDocument = (doc) => {
    if (!doc.dataUrl) {
      alert('This document only has a filename record. Upload/replace it once to enable preview.');
      return;
    }

    const viewer = window.open();
    if (viewer) {
      viewer.document.write(
        `<iframe src="${doc.dataUrl}" title="${doc.name}" style="border:0;width:100%;height:100vh"></iframe>`
      );
    }
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
            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${activeTab === 'finance' ? 'btn-primary' : 'text-slate-500 hover:bg-white/70'}`}
            >
              <CreditCard className="w-3.5 h-3.5" /> Finance
            </button>
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

                {/* Academic Parent Nodes Block */}
                <div>
                  <h5 className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100/80 pb-1.5 mb-3 flex items-center gap-1">
                    <span className="w-1 h-2 bg-indigo-400 inline-block rounded-xs"></span> Lineage Parent Details
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Father Name:</span>{profileData.fatherName}</p>
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Mother Name:</span>{profileData.motherName}</p>
                    <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Father Aadhaar ID:</span>{profileData.fatherAadhar}</p>
                    <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Mother Aadhaar ID:</span>{profileData.motherAadhar}</p>
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Guardian Name:</span>{profileData.guardianName || profileData.livingWith || 'Not provided'}</p>
                    <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Guardian Aadhaar:</span>{profileData.guardianAadhar || 'Not provided'}</p>
                  </div>
                </div>

                {/* Structural Identities Block */}
                <div>
                  <h5 className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100/80 pb-1.5 mb-3 flex items-center gap-1">
                    <span className="w-1 h-2 bg-indigo-400 inline-block rounded-xs"></span> Institutional Tracking Parameters
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">PEN ID Code:</span>{profileData.penNumber || 'NOT REQUIRED / PROVIDED'}</p>
                    <p className="glass-soft p-3 rounded-xl font-mono"><span className="text-slate-500 block text-[10px]">Aadhaar Number:</span>{profileData.aadharNumber || 'Not provided'}</p>
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Religion Metric:</span>{profileData.religion}</p>
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Previous Institute:</span>{profileData.lastSchoolName || 'None Specified'}</p>
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Email:</span>{profileData.email || 'Not provided'}</p>
                  </div>
                </div>

                {/* Permanent Demographics Addresses Block */}
                <div>
                  <h5 className="text-[11px] uppercase text-slate-500 tracking-wider border-b border-slate-100/80 pb-1.5 mb-3 flex items-center gap-1">
                    <span className="w-1 h-2 bg-indigo-400 inline-block rounded-xs"></span> Residential Addresses Coordinates
                  </h5>
                  <div className="space-y-2">
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Current Location Location (Temporary):</span>{profileData.tempAddress}</p>
                    <p className="glass-soft p-3 rounded-xl"><span className="text-slate-500 block text-[10px]">Home Registration Node (Permanent):</span>{profileData.permAddress}</p>
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
                  {documentDrafts.map((doc, idx) => (
                    <div key={`${doc.name}-${idx}`} className="glass-soft p-3 rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-slate-900 font-black truncate block">{doc.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono block truncate mt-0.5">
                          {doc.file || 'No file uploaded yet'} {doc.size ? `| ${formatFileSize(doc.size)}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 border rounded font-black uppercase ${
                          doc.file
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {doc.status}
                        </span>
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
                      </div>
                    </div>
                  ))}
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

            {activeTab === 'finance' && (
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
