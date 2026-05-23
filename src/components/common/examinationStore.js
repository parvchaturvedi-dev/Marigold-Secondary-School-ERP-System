import { getUserProfile } from './auth';
import { DEFAULT_CLASS_NAMES } from './masterData';
import { API_BASE_URL, authFetch, withAuthHeaders } from './api';

export const EXAMINATION_STORAGE_KEY = 'mgps_erp_examination_module';
export const EXAMINATION_UPDATED_EVENT = 'mgps-erp-examination-updated';

export const PAPER_TYPES = ['Written', 'Oral', 'Practical', 'Worksheet'];

const nowIso = () => new Date().toISOString();
export const MARKS_EDIT_LOCK_HOURS = 24;
export const MARKS_ADMIN_UNLOCK_HOURS = 24;

export const teacherDirectory = {};

const examMasterData = {
  classNames: DEFAULT_CLASS_NAMES,
  students: [],
  teachers: [],
  subjectsByClass: {},
};

export const configureExaminationMasterData = (masterData = {}) => {
  examMasterData.classNames = masterData.classNames?.length
    ? masterData.classNames
    : DEFAULT_CLASS_NAMES;
  examMasterData.students = Array.isArray(masterData.students) ? masterData.students : [];
  examMasterData.teachers = Array.isArray(masterData.teachers) ? masterData.teachers : [];
  examMasterData.subjectsByClass = masterData.subjectsByClass || {};

  Object.keys(teacherDirectory).forEach((key) => delete teacherDirectory[key]);
  examMasterData.teachers.forEach((teacher) => {
    if (teacher?.name && (teacher.id || teacher.empId)) {
      teacherDirectory[teacher.name] = teacher.id || teacher.empId;
    }
  });

  allExamClasses.splice(0, allExamClasses.length, ...getAllExamClasses());
};

const getClassNumber = (className = '') => Number(String(className).replace(/\D/g, '')) || 0;

const withTeacherUsername = (items) =>
  items.map((item) => ({
    ...item,
    teacherUsername: teacherDirectory[item.teacherName] || '',
  }));

export const getSubjectsForClass = (className = 'Class 9') => {
  const configuredSubjects = examMasterData.subjectsByClass[className] || [];
  if (configuredSubjects.length) return withTeacherUsername(configuredSubjects);

  const teacherAssignments = examMasterData.teachers.flatMap((teacher) =>
    (teacher.classAssignments || [])
      .filter((assignment) => assignment.className === className && assignment.subject)
      .map((assignment) => ({
        subject: assignment.subject,
        teacherName: teacher.name || '',
        teacherUsername: teacher.id || teacher.empId || '',
      }))
  );

  return withTeacherUsername(teacherAssignments);
};

export const getSubjectTeacher = (className, subjectName) =>
  getSubjectsForClass(className).find((item) => item.subject === subjectName) || {
    subject: subjectName || '',
    teacherName: '',
    teacherUsername: '',
  };

export const getTeacherExamAssignments = (session) => {
  const username = session?.username || '';
  const profile = getUserProfile(username, 'teacher');
  const allottedClasses = profile.allottedClasses?.length ? profile.allottedClasses : [];

  const allAssignments = allottedClasses.flatMap((className) =>
    getSubjectsForClass(className).map((item) => ({ ...item, className }))
  );

  const directMatches = allAssignments.filter(
    (item) => item.teacherUsername === username || item.teacherName === session?.displayName
  );

  return directMatches.length ? directMatches : allAssignments.slice(0, 3);
};

export const studentDirectory = [];

const normalizeExamStudent = (student = {}, index = 0, className = 'Class 9') => ({
  id: student.id || student.admissionNumber || `student-${className}-${index + 1}`,
  displayName: student.displayName || student.name || `Student ${index + 1}`,
  className: student.className || className,
  section: student.section || 'A',
  rollNo: student.rollNo || index + 1,
  admissionNumber: student.admissionNumber || '',
  fatherName: student.fatherName || '',
  motherName: student.motherName || '',
  guardianPhone: student.guardianPhone || '',
  guardianEmail: student.guardianEmail || '',
  address: student.address || '',
});

export const getStudentsForClass = (className = 'Class 9') => {
  const directory = examMasterData.students.length ? examMasterData.students : studentDirectory;
  const students = directory
    .filter((student) => student.className === className)
    .map((student, index) => normalizeExamStudent(student, index, className));

  if (students.length) return students.sort((a, b) => Number(a.rollNo) - Number(b.rollNo));

  return [];
};

export const ensureStudentInRoster = (student) => {
  if (!student?.className) return getStudentsForClass('Class 9');

  const roster = getStudentsForClass(student.className);
  const exists = roster.some(
    (item) => item.id === student.id || item.admissionNumber === student.admissionNumber
  );

  return exists
    ? roster
    : [normalizeExamStudent(student, 0, student.className), ...roster].sort(
        (a, b) => Number(a.rollNo) - Number(b.rollNo)
      );
};

const broadcastExaminationUpdate = () => {
  window.dispatchEvent(new Event(EXAMINATION_UPDATED_EVENT));
};

const EXAMINATION_API_URL = `${API_BASE_URL}/examinations/state`;
const EMPTY_EXAMINATION_STATE = {
  exams: [],
  papers: [],
  schedules: [],
  marks: [],
  deliveries: [],
};

let examinationStateCache = EMPTY_EXAMINATION_STATE;

const normalizeExaminationState = (state = {}) => ({
  exams: Array.isArray(state.exams) ? state.exams : [],
  papers: Array.isArray(state.papers) ? state.papers : [],
  schedules: Array.isArray(state.schedules) ? state.schedules : [],
  marks: Array.isArray(state.marks) ? state.marks : [],
  deliveries: Array.isArray(state.deliveries) ? state.deliveries : [],
});

const persistExaminationState = async (state) => {
  const response = await authFetch(EXAMINATION_API_URL, {
    method: 'PUT',
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Examination state could not be saved.');
  }

  return normalizeExaminationState(await response.json());
};

export const readExaminationState = () => examinationStateCache;

export const fetchExaminationState = async () => {
  try {
    const response = await authFetch(EXAMINATION_API_URL);

    if (response.ok) {
      examinationStateCache = normalizeExaminationState(await response.json());
      broadcastExaminationUpdate();
      return examinationStateCache;
    }

    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.message || 'Examination state could not be loaded.');
  } catch (error) {
    alert(`Examination sync failed: ${error.message}`);
    return examinationStateCache;
  }
};

export const writeExaminationState = (state) => {
  examinationStateCache = normalizeExaminationState(state);
  broadcastExaminationUpdate();
  persistExaminationState(examinationStateCache).catch((error) => {
    alert(`Examination save failed: ${error.message}`);
  });
};

export const updateExaminationState = (updater) => {
  const currentState = readExaminationState();
  const nextState = updater(currentState);
  writeExaminationState(nextState);
  return nextState;
};

export const createExamRecord = ({ name, academicYear, actor }) =>
  updateExaminationState((state) => ({
    ...state,
    exams: [
      {
        id: `EXAM-${Date.now()}`,
        name,
        academicYear: academicYear || '2026-27',
        createdByName: actor.name,
        createdByRole: actor.role,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      ...state.exams,
    ],
  }));

export const getActor = (role, session) => ({
  role,
  username: session?.username || role,
  name: session?.displayName || session?.username || role,
});

export const getExamLabel = (exam) => (exam ? `${exam.name} Examination` : 'Examination');

export const getPaperStatusMeta = (status) => {
  const meta = {
    draft: {
      label: 'Draft',
      tone: 'bg-gray-100 text-gray-700 border-gray-200',
      description: 'Saved by clerk/admin. Not sent yet.',
    },
    teacher_review: {
      label: 'Pending Teacher Approval',
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Teacher needs to approve or reject.',
    },
    teacher_rejected: {
      label: 'Teacher Rejected',
      tone: 'bg-rose-50 text-rose-700 border-rose-200',
      description: 'Returned to paper creator for correction.',
    },
    teacher_approved: {
      label: 'Teacher Approved',
      tone: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Ready to send to admin.',
    },
    admin_review: {
      label: 'Pending Admin Approval',
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description: 'Admin final review is pending.',
    },
    admin_rejected: {
      label: 'Admin Rejected',
      tone: 'bg-orange-50 text-orange-700 border-orange-200',
      description: 'Teacher must route corrections to clerk.',
    },
    selected: {
      label: 'Selected',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Teacher and admin both approved.',
    },
  };

  return meta[status] || meta.draft;
};

export const savePaperRecord = (payload, actor) => {
  const teacher = getSubjectTeacher(payload.className, payload.subject);

  return updateExaminationState((state) => {
    const existingPaper = state.papers.find((paper) => paper.id === payload.id);
    const nextPaper = {
      id: payload.id || `PAPER-${Date.now()}`,
      examId: payload.examId,
      className: payload.className,
      subject: payload.subject,
      type: payload.type,
      title: payload.title || `${payload.subject} Paper`,
      content: payload.content,
      status: payload.status || existingPaper?.status || 'draft',
      createdByName: existingPaper?.createdByName || actor.name,
      createdByUsername: existingPaper?.createdByUsername || actor.username,
      teacherName: teacher.teacherName,
      teacherUsername: teacher.teacherUsername,
      teacherApprovedAt: payload.status === 'teacher_review' ? '' : existingPaper?.teacherApprovedAt || '',
      adminApprovedAt: payload.status === 'teacher_review' ? '' : existingPaper?.adminApprovedAt || '',
      revision:
        existingPaper && payload.status === 'teacher_review'
          ? Number(existingPaper.revision || 1) + 1
          : existingPaper?.revision || 1,
      comments: existingPaper?.comments || [],
      createdAt: existingPaper?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    return {
      ...state,
      papers: existingPaper
        ? state.papers.map((paper) => (paper.id === existingPaper.id ? nextPaper : paper))
        : [nextPaper, ...state.papers],
    };
  });
};

export const addPaperDecision = (paperId, decision, actor, comment = '') =>
  updateExaminationState((state) => ({
    ...state,
    papers: state.papers.map((paper) => {
      if (paper.id !== paperId) return paper;

      const nextPaper = {
        ...paper,
        updatedAt: nowIso(),
        comments: [
          ...(paper.comments || []),
          {
            id: `CMT-${Date.now()}`,
            role: actor.role,
            actorName: actor.name,
            action: decision.action,
            comment,
            createdAt: nowIso(),
          },
        ],
      };

      if (decision.status) nextPaper.status = decision.status;
      if (decision.status === 'teacher_approved') nextPaper.teacherApprovedAt = nowIso();
      if (decision.status === 'selected') nextPaper.adminApprovedAt = nowIso();

      return nextPaper;
    }),
  }));

export const upsertScheduleRows = (examId, className, rows) =>
  updateExaminationState((state) => {
    const otherRows = state.schedules.filter(
      (row) => !(row.examId === examId && row.className === className)
    );

    const normalizedRows = rows.map((row) => ({
      id: row.id || `SCH-${Date.now()}-${row.subject}`,
      examId,
      className,
      subject: row.subject,
      date: row.date || '',
      startTime: row.startTime || '',
      endTime: row.endTime || '',
    }));

    return {
      ...state,
      schedules: [...otherRows, ...normalizedRows],
    };
  });

export const upsertMarksRecord = (payload, actor) =>
  updateExaminationState((state) => {
    const existingRecord = state.marks.find(
      (record) =>
        record.examId === payload.examId &&
        record.className === payload.className &&
        record.subject === payload.subject
    );

    const nextRecord = {
      id: existingRecord?.id || `MARK-${Date.now()}`,
      examId: payload.examId,
      className: payload.className,
      subject: payload.subject,
      maxMarks: Number(payload.maxMarks) || 100,
      enteredByRole: actor.role,
      enteredByName: actor.name,
      submittedAt: existingRecord?.submittedAt || nowIso(),
      updatedAt: nowIso(),
      teacherEditUnlockedUntil: existingRecord?.teacherEditUnlockedUntil || '',
      teacherEditUnlockedByName: existingRecord?.teacherEditUnlockedByName || '',
      teacherEditUnlockedAt: existingRecord?.teacherEditUnlockedAt || '',
      rows: payload.rows,
    };

    return {
      ...state,
      marks: existingRecord
        ? state.marks.map((record) => (record.id === existingRecord.id ? nextRecord : record))
        : [nextRecord, ...state.marks],
    };
  });

export const recordReportDelivery = ({ examId, className, channel, actor }) =>
  updateExaminationState((state) => ({
    ...state,
    deliveries: [
      {
        id: `DEL-${Date.now()}`,
        examId,
        className,
        channel,
        sentByName: actor.name,
        sentByRole: actor.role,
        sentAt: nowIso(),
      },
      ...state.deliveries,
    ],
  }));

export const enableTeacherMarksEdit = (recordId, actor) =>
  updateExaminationState((state) => ({
    ...state,
    marks: state.marks.map((record) =>
      record.id === recordId
        ? {
            ...record,
            teacherEditUnlockedUntil: new Date(
              Date.now() + MARKS_ADMIN_UNLOCK_HOURS * 60 * 60 * 1000
            ).toISOString(),
            teacherEditUnlockedByName: actor.name,
            teacherEditUnlockedAt: nowIso(),
            updatedAt: nowIso(),
          }
        : record
    ),
  }));

export const isMarksRecordLocked = (record, role, now = Date.now()) => {
  if (!record?.submittedAt || role === 'admin' || role === 'clerk') return false;
  if (isTeacherMarksEditUnlocked(record, now)) return false;

  const submittedAt = new Date(record.submittedAt).getTime();
  const hoursPassed = (now - submittedAt) / (1000 * 60 * 60);
  return hoursPassed >= MARKS_EDIT_LOCK_HOURS;
};

export const isTeacherMarksEditUnlocked = (record, now = Date.now()) => {
  if (!record?.teacherEditUnlockedUntil) return false;
  const unlockedUntil = new Date(record.teacherEditUnlockedUntil).getTime();
  return Number.isFinite(unlockedUntil) && now < unlockedUntil;
};

export const calculateGrade = (marks, maxMarks = 100) => {
  const percentage = maxMarks ? (Number(marks) / Number(maxMarks)) * 100 : 0;

  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'Needs Support';
};

export const getFocusRemark = (marks, maxMarks = 100) => {
  const percentage = maxMarks ? (Number(marks) / Number(maxMarks)) * 100 : 0;

  if (percentage >= 85) return 'Strong performance';
  if (percentage >= 70) return 'Revise for consistency';
  if (percentage >= 50) return 'Needs guided practice';
  return 'Needs urgent attention';
};

export const getReportRowsForStudent = (state, student, examId) => {
  const className = student?.reportClassName || student?.className || 'Class 9';
  const records = state.marks.filter(
    (record) => record.examId === examId && record.className === className
  );

  return records.map((record) => {
    const row =
      record.rows.find(
        (item) =>
          item.studentId === student?.id ||
          item.admissionNumber === student?.admissionNumber ||
          item.studentName === student?.displayName
      ) || {};

    return {
      subject: record.subject,
      marks: Number(row.marks || 0),
      maxMarks: Number(record.maxMarks || 100),
      grade: calculateGrade(row.marks || 0, record.maxMarks || 100),
      remark: row.remark || getFocusRemark(row.marks || 0, record.maxMarks || 100),
    };
  });
};

export const marksRowBelongsToStudent = (row = {}, student = {}) =>
  Boolean(
    (row.studentId && student?.id && row.studentId === student.id) ||
      (row.admissionNumber &&
        student?.admissionNumber &&
        row.admissionNumber === student.admissionNumber) ||
      (row.studentName && student?.displayName && row.studentName === student.displayName)
  );

export const getSavedReportOptionsForStudent = (state, student) => {
  const optionsByKey = new Map();

  state.marks.forEach((record) => {
    if (!record.rows?.some((row) => marksRowBelongsToStudent(row, student))) return;
    const key = `${record.examId}-${record.className}`;
    if (!optionsByKey.has(key)) {
      optionsByKey.set(key, {
        examId: record.examId,
        className: record.className,
        updatedAt: record.updatedAt || record.submittedAt || '',
      });
      return;
    }

    const option = optionsByKey.get(key);
    if (new Date(record.updatedAt || record.submittedAt || 0) > new Date(option.updatedAt || 0)) {
      option.updatedAt = record.updatedAt || record.submittedAt || '';
    }
  });

  return Array.from(optionsByKey.values()).sort(
    (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  );
};

export const formatExamDate = (dateValue) => {
  if (!dateValue) return 'Not scheduled';
  return new Date(dateValue).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatExamDateTime = (dateValue) => {
  if (!dateValue) return 'Not recorded';
  return new Date(dateValue).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getPrintDocument = (title, bodyHtml) => `
  <!doctype html>
  <html>
    <head>
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        .page { page-break-after: always; border: 1px solid #222; padding: 24px; min-height: 96vh; }
        .page:last-child { page-break-after: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #222; padding: 8px; text-align: left; }
        h1, h2, h3 { margin: 0 0 8px; }
        .muted { color: #555; font-size: 12px; }
        .photo { width: 92px; height: 110px; border: 1px solid #222; display: flex; align-items: center; justify-content: center; font-size: 12px; }
        @media print {
          body { margin: 0; }
          .page { border: 0; min-height: 100vh; }
        }
      </style>
    </head>
    <body>${bodyHtml}</body>
  </html>
`;

export const roleCanManageExams = (role) => role === 'admin' || role === 'clerk';
export const roleCanCreatePapers = (role) => role === 'admin' || role === 'clerk';
export const roleCanReviewAsTeacher = (role) => role === 'teacher';
export const roleCanReviewAsAdmin = (role) => role === 'admin';
export const roleCanManageReportCards = (role) => role === 'admin' || role === 'clerk';
export const roleCanEnterMarks = (role) => ['admin', 'clerk', 'teacher'].includes(role);
export const allExamClasses = DEFAULT_CLASS_NAMES.filter((className) => !['Nursery', 'LKG', 'UKG'].includes(className));
export const getAllExamClasses = () =>
  (examMasterData.classNames?.length ? examMasterData.classNames : DEFAULT_CLASS_NAMES).filter(
    (className) => !['Nursery', 'LKG', 'UKG'].includes(className)
  );
