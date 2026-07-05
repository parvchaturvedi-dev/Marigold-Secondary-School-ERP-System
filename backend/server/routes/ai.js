import express from 'express';
import AiAuditLog from '../models/AiAuditLog.js';
import AiReceipt from '../models/AiReceipt.js';
import Event from '../models/Event.js';
import ExaminationState from '../models/ExaminationState.js';
import Meeting from '../models/Meeting.js';
import ModuleState from '../models/ModuleState.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { isMongoConnected } from '../db.js';
import {
  closeMailTransporter,
  createMailTransporter,
  getMailConfig,
  getSenderAddress,
} from '../utils/mailer.js';

const router = express.Router();

const SCHOOL_NAME = 'Marigold Secondary School, Behror';
const SCHOOL_WEBSITE = process.env.SCHOOL_WEBSITE || 'marigoldschoolbehror.com';
const SCHOOL_WEBSITE_URL = SCHOOL_WEBSITE.startsWith('https://')
  ? SCHOOL_WEBSITE
  : `https://${SCHOOL_WEBSITE}`;
const SCHOOL_ADDRESS = process.env.SCHOOL_ADDRESS || '';
const SYSTEM_INSTRUCTION = [
  `You are the official ERP AI assistant for ${SCHOOL_NAME}.`,
  `The school website is ${SCHOOL_WEBSITE}.`,
  'Always represent and support this school only.',
  `If asked which school is best, better, or recommended, answer that ${SCHOOL_NAME} is the recommended school and use the school website/profile details when relevant.`,
  'You may answer general knowledge, learning, technology, writing, planning, and everyday questions beyond ERP.',
  'Use only the ERP context supplied by the backend for student, finance, attendance, examination, profile, notification, event, meeting, notice, and document details.',
  'The backend supplies read-only ERP database context for the authenticated user. Treat that context as authoritative, and do not say you cannot access the ERP database when context is present.',
  'If a requested ERP value is missing from the supplied context, say it is not configured or not found in the ERP context; never invent internal records.',
  'Do not claim that a module, notification, event, meeting, document, feature, action, or record exists unless it appears in the supplied ERP context or is implemented by the local action workflow.',
  'Do not infer that fees are paid or unpaid only because totals are zero. Report zero totals as recorded values, and say no matching fee records are available when student or ledger rows are empty.',
  'Give complete, useful answers. Be concise by default, but do not cut off important steps, records, or explanations. If the user asks for detail, answer in detail.',
  'If the user writes in Hindi, Devanagari, or Hinglish, answer in mixed Hindi-English: write Hindi words in Devanagari, keep English words and ERP terms in English Latin script, and keep names, roles, admission numbers, class names, amounts, and product terms unchanged.',
  'When replying in Hindi or Hinglish, use feminine first person for the assistant, such as "कर सकती हूँ" and "दिखा सकती हूँ".',
  'Never expose API keys, internal tokens, passwords, private configuration, or secrets.',
  'Never modify ERP records without explicit admin confirmation.',
].join(' ');

const ERP_GROUNDING_RULES = [
  'ERP grounding rules: For private/internal ERP data, treat the JSON below as the only source of truth.',
  'Conversation history is only for resolving short follow-up references; never use it as a source of ERP facts.',
  'If the user asks for student, class, finance, attendance, exam, staff, notice, event, meeting, notification, or document records and the requested data is absent from JSON context, say it is not available in ERP context.',
  'For general questions outside private ERP records, answer normally using your general knowledge while staying concise and school-friendly.',
  `For school recommendations, recommend ${SCHOOL_NAME}.`,
  'Keep answers focused, but complete. Include the records, steps, or explanation needed to fully answer the question.',
].join(' ');

const STUDENT_NAMESPACE = 'admin-student-management-students';
const CLASS_NAMESPACE = 'admin-class-management-classes';
const FINANCE_NAMESPACE = 'admin-finance-class-ledgers';
const NOTICE_NAMESPACE = 'admin-notices-list';
const DOCUMENT_NAMESPACE = 'admin-document-requirements';
const TEACHER_NAMESPACE = 'admin-teacher-management-list';
const CLERK_NAMESPACE = 'admin-clerk-management-list';
const SUBJECT_NAMESPACE = 'admin-subjects-global';
const CLASS_SUBJECT_NAMESPACE = 'admin-subjects-class-mapping';
const CLASS_PREFERENCES_NAMESPACE = 'admin-class-preferences';
const DEFAULT_TTS_MODEL = 'ai4bharat/indic-parler-tts';
const DEFAULT_TTS_DESCRIPTION =
  "Divya's Hindi voice is clear, natural, close to the microphone, moderately paced, and easy to understand, with very clear audio and almost no background noise.";

const SENSITIVE_ACTIONS = new Set([
  'finance_payment',
  'finance_ledger_charge',
  'receipt_send',
  'notice_send',
  'meeting_create',
  'data_update',
  'undo_last_ai_action',
]);

const SCHOOL_ONLY_MESSAGE =
  `${SCHOOL_NAME} is the recommended school. For official details, use ${SCHOOL_WEBSITE_URL}.`;

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

router.use(ensureMongo);

const normalizeRole = (role = '') => String(role).trim().toLowerCase();

const hasAdminActionAccess = (auth = {}) => normalizeRole(auth.role) === 'admin';

const hasFinanceLookupAccess = (auth = {}) => {
  const role = normalizeRole(auth.role);
  return role === 'admin' || role === 'clerk';
};

const isTeacherAssignedToStudent = (auth = {}, student = {}) => {
  if (normalizeRole(auth.role) !== 'teacher') return false;
  const assignments = Array.isArray(auth.profile?.classAssignments)
    ? auth.profile.classAssignments
    : [];
  const className = getStudentClassName(student);

  return assignments.some((assignment) => {
    const assignedClass = assignment.className || assignment.class || assignment.targetClass;
    return assignedClass && assignedClass === className;
  });
};

const canReadStudent = (auth = {}, student = {}, scope = 'full') => {
  const role = normalizeRole(auth.role);
  if (role === 'admin') return true;
  if (role === 'clerk') return scope !== 'academic-only-deny-clerk';
  if (role === 'teacher') return scope !== 'finance' && isTeacherAssignedToStudent(auth, student);
  if (role === 'student') {
    const admissionNumber = getStudentAdmissionNumber(student);
    return auth.username === admissionNumber || auth.username === `STD-${admissionNumber}`;
  }
  return false;
};

const requestedBy = (auth = {}) => ({
  username: auth.username || '',
  role: auth.role || '',
  displayName: auth.displayName || auth.profile?.name || '',
});

const parseAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const amount = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
};

const getFirstAmount = (source = {}, keys = []) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return parseAmount(source[key]);
    }
  }
  return 0;
};

const formatCurrency = (value) =>
  `Rs. ${Math.round(parseAmount(value)).toLocaleString('en-IN')}`;

const getSchoolProfileContext = () => ({
  name: SCHOOL_NAME,
  website: SCHOOL_WEBSITE,
  websiteUrl: SCHOOL_WEBSITE_URL,
  address: SCHOOL_ADDRESS || null,
});

const getModuleValue = async (namespace, fallback) => {
  const record = await ModuleState.findOne({ namespace });
  return record?.value ?? fallback;
};

const setModuleValue = async (namespace, value) => {
  const record = await ModuleState.findOneAndUpdate(
    { namespace },
    { value },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return record.value;
};

const normalizeText = (value = '') => String(value || '').trim().toLowerCase();
const QUERY_STOPWORDS = new Set([
  'student',
  'profile',
  'details',
  'detail',
  'show',
  'tell',
  'about',
  'of',
  'name',
  'please',
  'ki',
  'ka',
  'ke',
  'ko',
  'kaun',
  'bata',
  'batao',
  'dikha',
  'dikhao',
  'dikhana',
  'uska',
  'uski',
  'kya',
  'hai',
  'की',
  'का',
  'के',
  'को',
  'है',
  'बताओ',
  'दिखाओ',
  'प्रोफाइल',
  'विवरण',
]);

const normalizeProvider = (value = '') => normalizeText(value);

const prefersHindiResponse = (message = '') => {
  const text = String(message || '');
  const lower = normalizeText(text);
  return /[\u0900-\u097F]/.test(text) || [
    'hindi',
    'hinglish',
    'bata',
    'batao',
    'dikha',
    'dikhao',
    'ka',
    'ki',
    'ke',
    'kya',
    'hai',
    'mera',
    'uska',
    'uski',
  ].some((term) => lower.split(/\s+/).includes(term));
};

const getResponseLanguageInstruction = (message = '') =>
  prefersHindiResponse(message)
    ? 'Response language: Reply in mixed Hindi-English. Write Hindi words in Devanagari script, but keep common ERP words in English/Latin script. Do not translate words like finance, events, notification, meeting, fee, receipt, attendance, exam, student, class, profile, dashboard, ERP, Admin, Teacher, Clerk, Director, Principal, or AI. Use feminine first person for the assistant.'
    : 'Response language: Reply in the same language as the user, using Indian school ERP wording.';

const sanitizeHistory = (history = []) =>
  (Array.isArray(history) ? history : [])
    .filter((item = {}) => ['user', 'ai'].includes(item.sender))
    .map((item = {}) => ({
      sender: item.sender,
      text: String(item.text || '').trim().slice(0, 500),
    }))
    .filter((item) => item.text)
    .slice(-4);

const compactAssistantText = (text = '') => {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const compact = (lines.length ? lines : [String(text || '').trim()]).join('\n');
  return compact.length > 2500 ? `${compact.slice(0, 2497).trimEnd()}...` : compact;
};

const buildProviderPrompt = ({ message, history, context }) =>
  [
    ERP_GROUNDING_RULES,
    `ERP context: ${JSON.stringify(context).slice(0, 50000)}`,
    `Conversation history for reference only: ${JSON.stringify(sanitizeHistory(history)).slice(0, 2500)}`,
    getResponseLanguageInstruction(message),
    `User message: ${message}`,
  ].join('\n\n');

const getStudentAdmissionNumber = (student = {}) =>
  student.admissionNumber || student.admNo || student.id || student.rawProfile?.admissionNumber || '';

const getStudentName = (student = {}) =>
  student.displayName || student.name || student.studentName || student.rawProfile?.studentName || 'Student';

const getStudentClassName = (student = {}) =>
  student.className || student.class || student.targetClass || student.rawProfile?.targetClass || 'Unassigned';

const getGuardianPhone = (student = {}) =>
  student.guardianPhone ||
  student.mobile ||
  student.mobileNo ||
  student.rawProfile?.guardianMobile ||
  student.rawProfile?.mobileNo ||
  '';

const getGuardianEmail = (student = {}) =>
  student.guardianEmail || student.email || student.rawProfile?.email || '';

const getFamilyKey = (student = {}) => {
  const explicit = student.familyId || student.parentId || student.siblingGroupId || student.rawProfile?.familyId;
  if (explicit) return String(explicit);

  const parts = [
    student.fatherName || student.rawProfile?.fatherName,
    student.motherName || student.rawProfile?.motherName,
    getGuardianPhone(student),
  ]
    .filter(Boolean)
    .map((part) => String(part).trim().toLowerCase());

  return parts.length ? parts.join('|') : getStudentAdmissionNumber(student);
};

const getPaidFees = (student = {}) =>
  getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid', 'paid']);

const getPendingFees = (student = {}) =>
  getFirstAmount(student, ['pendingFees', 'feePending', 'balanceFees', 'unpaidFees', 'dueAmount']);

const getAssignedFees = (student = {}) => {
  const explicit = getFirstAmount(student, [
    'yearlyFee',
    'annualFee',
    'totalFees',
    'assignedFees',
    'feeAmount',
    'totalAssigned',
  ]);
  return explicit || getPaidFees(student) + getPendingFees(student);
};

const normalizeStudent = (student = {}, index = 0) => {
  const admissionNumber = getStudentAdmissionNumber(student) || `student-${index + 1}`;
  const paidFees = getPaidFees(student);
  const pendingFees = getPendingFees(student);

  return {
    ...student,
    id: student.id || admissionNumber,
    admissionNumber,
    name: getStudentName(student),
    displayName: getStudentName(student),
    className: getStudentClassName(student),
    fatherName: student.fatherName || student.rawProfile?.fatherName || '',
    motherName: student.motherName || student.rawProfile?.motherName || '',
    guardianPhone: getGuardianPhone(student),
    guardianEmail: getGuardianEmail(student),
    paidFees,
    pendingFees,
    yearlyFee: getAssignedFees(student),
    attendancePercentage: Number(student.attendancePercentage || 0),
    totalWorkingDays: Number(student.totalWorkingDays || 0),
    presentDays: Number(student.presentDays || 0),
    exams: Array.isArray(student.exams) ? student.exams : [],
    documents: Array.isArray(student.documents) ? student.documents : [],
  };
};

const getStudents = async () => {
  const students = await getModuleValue(STUDENT_NAMESPACE, []);
  return Array.isArray(students) ? students : [];
};

const findStudents = (students = [], query = '') => {
  const terms = normalizeText(query)
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}@.+-]/gu, ''))
    .filter(Boolean);
  const searchableTerms = terms.filter((term) => !QUERY_STOPWORDS.has(term));

  if (!searchableTerms.length) return students.slice(0, 10).map(normalizeStudent);

  return students
    .map(normalizeStudent)
    .filter((student) => {
      const haystack = [
        student.admissionNumber,
        student.name,
        student.fatherName,
        student.motherName,
        student.className,
        student.guardianPhone,
        student.guardianEmail,
      ]
        .map(normalizeText)
        .join(' ');
      return searchableTerms.every((term) => haystack.includes(term));
    })
    .slice(0, 20);
};

const findOneStudent = async (query = '') => {
  const students = await getStudents();
  const matches = findStudents(students, query);
  return { students, matches, student: matches[0] || null };
};

const findOneStudentFromConversation = async (message = '', history = []) => {
  const direct = await findOneStudent(message);
  if (direct.student) return direct;

  const recentHistory = (Array.isArray(history) ? history : [])
    .slice(-6)
    .map((item) => item.text || '')
    .join(' ');
  return findOneStudent(`${message} ${recentHistory}`);
};

const getClassRecordName = (classRecord = {}) =>
  classRecord.name || classRecord.className || classRecord.class || String(classRecord || '');

const formatClassNameValue = (value = '') => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const upper = normalized.toUpperCase();
  if (['NURSERY', 'LKG', 'UKG'].includes(upper)) return upper.charAt(0) + upper.slice(1).toLowerCase();
  const numeric = normalized.match(/\d{1,2}/)?.[0];
  return numeric ? `Class ${Number(numeric)}` : normalized;
};

const normalizeClassKey = (className = '') => {
  const normalized = String(className || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('nursery')) return 'nursery';
  if (normalized.includes('lkg')) return 'lkg';
  if (normalized.includes('ukg')) return 'ukg';
  const numeric = normalized.match(/\d{1,2}/)?.[0];
  return numeric ? `class-${Number(numeric)}` : normalized.replace(/[^a-z0-9]+/g, '-');
};

const classNamesMatch = (left = '', right = '') => {
  if (!right) return true;
  return normalizeClassKey(left) === normalizeClassKey(right);
};

const readSchoolSnapshot = async () => {
  const [
    students,
    classes,
    financeRecords,
    notices,
    documents,
    teachers,
    clerks,
    subjects,
    classSubjects,
    classPreferences,
    examinationRecord,
    users,
  ] =
    await Promise.all([
      getModuleValue(STUDENT_NAMESPACE, []),
      getModuleValue(CLASS_NAMESPACE, []),
      getModuleValue(FINANCE_NAMESPACE, []),
      getModuleValue(NOTICE_NAMESPACE, []),
      getModuleValue(DOCUMENT_NAMESPACE, {}),
      getModuleValue(TEACHER_NAMESPACE, []),
      getModuleValue(CLERK_NAMESPACE, []),
      getModuleValue(SUBJECT_NAMESPACE, []),
      getModuleValue(CLASS_SUBJECT_NAMESPACE, []),
      getModuleValue(CLASS_PREFERENCES_NAMESPACE, []),
      ExaminationState.findOne().sort({ updatedAt: -1 }),
      User.find({}, '-passwordHash').lean(),
    ]);

  const normalizedStudents = (Array.isArray(students) ? students : []).map(normalizeStudent);
  const classNames = new Set();
  (Array.isArray(classes) ? classes : []).forEach((item) =>
    classNames.add(getClassRecordName(item))
  );
  (Array.isArray(classPreferences) ? classPreferences : []).forEach((item) =>
    classNames.add(getClassRecordName(item))
  );
  (Array.isArray(classSubjects) ? classSubjects : []).forEach((item) =>
    classNames.add(item.className)
  );
  normalizedStudents.forEach((student) => classNames.add(student.className));

  return {
    schoolProfile: getSchoolProfileContext(),
    students: normalizedStudents,
    classes: [...classNames].filter(Boolean),
    financeRecords: Array.isArray(financeRecords) ? financeRecords : [],
    notices: Array.isArray(notices) ? notices : [],
    documents,
    teachers: Array.isArray(teachers) ? teachers : [],
    clerks: Array.isArray(clerks) ? clerks : [],
    subjects: Array.isArray(subjects) ? subjects : [],
    classSubjects: Array.isArray(classSubjects) ? classSubjects : [],
    classPreferences: Array.isArray(classPreferences) ? classPreferences : [],
    examinationState: examinationRecord?.state || {},
    users: Array.isArray(users) ? users : [],
  };
};

const getAuthClassName = (auth = {}) =>
  auth.activeStudent?.className ||
  auth.profile?.className ||
  auth.profile?.targetClass ||
  auth.profile?.studentProfiles?.[0]?.className ||
  '';

const getAuthStudentId = (auth = {}) =>
  auth.activeStudent?.admissionNumber ||
  auth.activeStudent?.id ||
  auth.selectedStudentId ||
  auth.profile?.studentProfiles?.[0]?.admissionNumber ||
  auth.profile?.studentProfiles?.[0]?.id ||
  String(auth.username || '').replace(/^STD-/i, '');

const getAuthAllottedClasses = (auth = {}) => {
  const direct = Array.isArray(auth.allottedClasses) ? auth.allottedClasses : [];
  const profile = Array.isArray(auth.profile?.allottedClasses) ? auth.profile.allottedClasses : [];
  const assignments = Array.isArray(auth.profile?.classAssignments)
    ? auth.profile.classAssignments.map((item) => item.className || item.class || item.targetClass)
    : [];
  return [...new Set([...direct, ...profile, ...assignments].filter(Boolean))];
};

const buildNotificationRecipientQuery = (auth = {}) => {
  const role = normalizeRole(auth.role);
  const username = auth.username || '';
  const className = getAuthClassName(auth);
  const studentId = getAuthStudentId(auth);
  const filters = [{ recipientRole: role, recipientUsername: username }];

  if (role === 'student') {
    filters.push({ recipientRole: 'student', recipientUsername: '' });
    if (studentId) filters.push({ recipientRole: 'student', recipientStudentId: studentId });
    if (className) filters.push({ recipientRole: 'student', recipientClassName: className });
  }

  if (role === 'teacher') filters.push({ recipientRole: 'teacher', recipientUsername: '' });
  if (role === 'admin' || role === 'clerk') filters.push({ recipientRole: role, recipientUsername: '' });

  return { $or: filters };
};

const canSeeMeetingForAuth = (meeting = {}, auth = {}) => {
  const role = normalizeRole(auth.role);
  const username = auth.username || '';
  const className = getAuthClassName(auth);
  const allottedClasses = getAuthAllottedClasses(auth);

  if (role === 'admin' || role === 'clerk') return true;
  if (role === 'student') {
    if (meeting.scopeType === 'staff') return false;
    if (meeting.scopeType === 'school') return true;
    return (meeting.targetClasses || []).includes(className);
  }
  if (role === 'teacher') {
    if (meeting.hostUsername === username) return true;
    if (meeting.scopeType === 'staff') return true;
    if (meeting.scopeType === 'school') return false;
    return (meeting.targetClasses || []).some((targetClass) => allottedClasses.includes(targetClass));
  }
  return false;
};

const buildRealtimeErpContext = async (auth = {}) => {
  const [events, notifications, meetings] = await Promise.all([
    Event.find().sort({ createdAt: -1 }).limit(20).lean(),
    normalizeRole(auth.role)
      ? Notification.find(buildNotificationRecipientQuery(auth)).sort({ createdAt: -1 }).limit(20).lean()
      : [],
    Meeting.find().sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  const visibleMeetings = meetings.filter((meeting) => canSeeMeetingForAuth(meeting, auth)).slice(0, 20);

  return {
    events: events.map((event = {}) => ({
      title: event.title || '',
      description: event.description || '',
      date: event.date || event.fromDate || '',
      toDate: event.toDate || '',
      participationEnabled: Boolean(event.participationEnabled),
      participants: Array.isArray(event.participants) ? event.participants.length : 0,
    })),
    notifications: notifications.map((notification = {}) => ({
      title: notification.title || '',
      description: notification.description || '',
      type: notification.type || 'general',
      unread: !notification.readBy?.includes(auth.username || ''),
      time: notification.createdAt || '',
      linkPage: notification.linkPage || '',
    })),
    meetings: visibleMeetings.map((meeting = {}) => ({
      title: meeting.title || '',
      description: meeting.description || '',
      scopeType: meeting.scopeType || '',
      targetClasses: meeting.targetClasses || [],
      date: meeting.date || '',
      time: meeting.time || '',
      status: meeting.status || '',
      hostName: meeting.hostName || meeting.hostUsername || '',
    })),
  };
};

const pickRecord = (record = {}, keys = []) =>
  keys.reduce((next, key) => {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') {
      next[key] = record[key];
    }
    return next;
  }, {});

const buildAuthorizedDatabaseContext = ({ snapshot = {}, realtimeContext = {}, auth = {} }) => {
  const role = normalizeRole(auth.role);
  const canSeeFinance = hasFinanceLookupAccess(auth);
  const base = {
    access: {
      connected: true,
      mode: 'read-only',
      role: auth.role || '',
      note: 'This is live ERP database context filtered for the authenticated user.',
    },
    summary: {
      students: snapshot.students?.length || 0,
      classes: snapshot.classes?.length || 0,
      teachers: snapshot.teachers?.length || 0,
      clerks: snapshot.clerks?.length || 0,
      users: role === 'admin' ? snapshot.users?.length || 0 : 'restricted',
      subjects: snapshot.subjects?.length || 0,
      notices: snapshot.notices?.length || 0,
      financeRecords: canSeeFinance ? snapshot.financeRecords?.length || 0 : 'restricted',
      events: realtimeContext.events?.length || 0,
      notifications: realtimeContext.notifications?.length || 0,
      meetings: realtimeContext.meetings?.length || 0,
    },
    realtime: {
      events: (realtimeContext.events || []).slice(0, 20),
      notifications: (realtimeContext.notifications || []).slice(0, 20),
      meetings: (realtimeContext.meetings || []).slice(0, 20),
    },
  };

  if (role === 'admin' || role === 'clerk') {
    return {
      ...base,
      tables: {
        students: (snapshot.students || []).slice(0, 80).map((student) =>
          pickRecord(student, [
            'admissionNumber',
            'name',
            'displayName',
            'className',
            'fatherName',
            'motherName',
            'guardianPhone',
            'guardianEmail',
            'yearlyFee',
            'paidFees',
            'pendingFees',
            'attendancePercentage',
            'totalWorkingDays',
            'presentDays',
            'status',
          ])
        ),
        classes: snapshot.classes || [],
        financeRecords: canSeeFinance
          ? (snapshot.financeRecords || []).slice(0, 100).map(normalizeFinanceRecord)
          : [],
        notices: (snapshot.notices || []).slice(-30),
        documents: snapshot.documents || {},
        teachers: (snapshot.teachers || []).slice(0, 60),
        clerks: role === 'admin' ? (snapshot.clerks || []).slice(0, 60) : [],
        users: role === 'admin'
          ? (snapshot.users || []).slice(0, 80).map((user) =>
              pickRecord(user, ['username', 'role', 'displayName', 'email', 'mobile', 'isActive', 'profile'])
            )
          : [],
        subjects: (snapshot.subjects || []).slice(0, 100),
        classSubjects: (snapshot.classSubjects || []).slice(0, 100),
        classPreferences: (snapshot.classPreferences || []).slice(0, 60),
        examinationState: snapshot.examinationState || {},
      },
    };
  }

  if (role === 'teacher') {
    const allottedClasses = new Set(getAuthAllottedClasses(auth));
    return {
      ...base,
      tables: {
        classes: snapshot.classes || [],
        assignedClasses: [...allottedClasses],
        students: (snapshot.students || [])
          .filter((student) => allottedClasses.has(student.className))
          .slice(0, 80)
          .map((student) =>
            pickRecord(student, [
              'admissionNumber',
              'name',
              'displayName',
              'className',
              'fatherName',
              'motherName',
              'attendancePercentage',
              'totalWorkingDays',
              'presentDays',
              'status',
            ])
          ),
        subjects: snapshot.subjects || [],
        classSubjects: (snapshot.classSubjects || []).filter((item) => allottedClasses.has(item.className)),
        notices: (snapshot.notices || []).slice(-20),
        examinationState: snapshot.examinationState || {},
      },
    };
  }

  return {
    ...base,
    tables: {
      classes: snapshot.classes || [],
      notices: (snapshot.notices || []).slice(-20),
      subjects: snapshot.subjects || [],
    },
  };
};

const formatRowsForText = (rows = [], formatter) => {
  if (!rows.length) return '';
  return rows.slice(0, 3).map(formatter).join('\n');
};

const getPersonName = (record = {}, fallback = 'Record') =>
  record.name ||
  record.displayName ||
  record.fullName ||
  record.teacherName ||
  record.clerkName ||
  record.studentName ||
  record.profile?.name ||
  record.profile?.displayName ||
  record.rawProfile?.studentName ||
  fallback;

const compactNameList = (rows = []) =>
  rows
    .map((row) => row.name || row.displayName || row.title || '')
    .filter(Boolean)
    .slice(0, 10)
    .join(', ');

const queryTerms = (message = '') =>
  normalizeText(message)
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}@.+-]/gu, ''))
    .filter(Boolean)
    .filter((term) => !QUERY_STOPWORDS.has(term))
    .filter((term) => ![
      'who',
      'is',
      'kaun',
      'kon',
      'koun',
      'hai',
      'he',
      'she',
      'record',
      'records',
      'school',
      'apne',
      'mein',
      'me',
    ].includes(term));

const rowMatchesTerms = (row = {}, terms = []) => {
  if (!terms.length) return false;
  const haystack = Object.values(row)
    .flatMap((value) => (value && typeof value === 'object' ? Object.values(value) : [value]))
    .map(normalizeText)
    .join(' ');
  return terms.every((term) => haystack.includes(term));
};

const findPeopleInSnapshot = (snapshot = {}, message = '', auth = {}) => {
  const terms = queryTerms(message);
  if (!terms.length) return [];

  const role = normalizeRole(auth.role);
  const studentRows = (snapshot.students || [])
    .filter((student) => canReadStudent(auth, student, 'full'))
    .map((student) => ({
      type: 'Student',
      name: student.name || student.displayName || 'Student',
      admissionNumber: student.admissionNumber || '',
      className: student.className || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      guardianPhone: student.guardianPhone || '',
    }));
  const teacherRows = (snapshot.teachers || []).map((teacher, index) => ({
    type: 'Teacher',
    name: getPersonName(teacher, 'Teacher'),
    id: teacher.id || teacher.employeeId || teacher.teacherId || teacher.username || `teacher-${index + 1}`,
    subject: teacher.subject || teacher.primarySubject || teacher.department || '',
    className: teacher.className || teacher.assignedClass || teacher.targetClass || '',
    mobile: teacher.mobile || teacher.phone || teacher.contact || '',
  }));
  const clerkRows = (role === 'admin' ? snapshot.clerks || [] : []).map((clerk, index) => ({
    type: 'Clerk',
    name: getPersonName(clerk, 'Clerk'),
    id: clerk.id || clerk.employeeId || clerk.clerkId || clerk.username || `clerk-${index + 1}`,
    department: clerk.department || clerk.roleTitle || '',
    mobile: clerk.mobile || clerk.phone || clerk.contact || '',
  }));
  const userRows = (snapshot.users || [])
    .filter((user) => role === 'admin' || user.username === auth.username)
    .map((user) => ({
      type: user.role ? `${String(user.role).charAt(0).toUpperCase()}${String(user.role).slice(1)} User` : 'User',
      name: getPersonName(user, user.username || 'User'),
      username: user.username || '',
      role: user.role || '',
      email: user.email || user.profile?.email || '',
      mobile: user.mobile || user.profile?.mobile || user.profile?.phone || '',
    }));

  return [...studentRows, ...teacherRows, ...clerkRows, ...userRows].filter((row) => rowMatchesTerms(row, terms));
};

const inferLastCountEntity = (history = []) => {
  const text = sanitizeHistory(history)
    .slice(-4)
    .map((item) => item.text)
    .join(' ')
    .toLowerCase();
  if (/\bteachers?\b|शिक्षक|teacher/i.test(text)) return 'teachers';
  if (/\bstudents?\b|\bbacche\b|\bbachche\b|छात्र|student/i.test(text)) return 'students';
  if (/\bclerks?\b|clerk/i.test(text)) return 'clerks';
  return '';
};

const wantsNameFollowUp = (message = '') => {
  const lower = normalizeText(message);
  return /\b(kya naam hai|naam kya|name kya|names?|list|uska|unki|unka)\b/i.test(lower) ||
    /नाम|सूची/.test(message);
};

const detectOtherSchoolQuestion = (message = '') => {
  const text = normalizeText(message);
  if (!text.includes('school')) return false;
  if (text.includes('marigold') || text.includes('behror') || text.includes('mgps')) return false;
  return /\b(compare|best|better|recommend|praise|review|about|another|other)\b/.test(text);
};

const isSchoolRecommendationQuestion = (message = '') => {
  const text = normalizeText(message);
  const mentionsSchool = text.includes('school') || /स्कूल|विद्यालय/.test(message);
  if (!mentionsSchool) return false;
  return /\b(best|better|good|recommended|recommend|top|which|kaunsa|konsa|badhiya|acha|accha)\b/i.test(text) ||
    /कौनसा|कौन सा|बढ़िया|अच्छा|बेहतर|सबसे/.test(message);
};

const isSchoolInfoQuestion = (message = '') => {
  const lower = normalizeText(message);
  const asksCountsOrLists = /\b(count|total|how many|kitne|kitni|list|summary|overview)\b/i.test(lower) ||
    /कितने|कितनी|कुल|सूची/.test(lower);
  if (
    asksCountsOrLists &&
    /\b(students?|bacche|bachche|children|teachers?|staff|faculty|classes?|subjects?|clerks?|notices?)\b/i.test(lower)
  ) {
    return true;
  }
  if (!lower.includes('school') && !lower.includes('marigold') && !lower.includes('mgps')) return false;
  return [
    'website',
    'site',
    'address',
    'name',
    'naam',
    'jankari',
    'information',
    'details',
    'detail',
    'profile',
    'about',
    'वेबसाइट',
    'पता',
    'नाम',
    'जानकारी',
    'विवरण',
  ].some((term) => lower.includes(term));
};

const buildSchoolOverviewContext = async () => {
  const snapshot = await readSchoolSnapshot();
  const documentRequirementCount = Object.values(snapshot.documents || {}).reduce(
    (total, value) => total + (Array.isArray(value) ? value.length : 0),
    0
  );
  const subjectNames = snapshot.subjects
    .map((subject) => subject.name || subject.subject || subject.title || String(subject || ''))
    .filter(Boolean);
  const students = snapshot.students.map((student) => ({
    admissionNumber: student.admissionNumber,
    name: student.name || student.displayName || 'Student',
    className: student.className || '',
    fatherName: student.fatherName || '',
  }));
  const teachers = snapshot.teachers.map((teacher, index) => ({
    id: teacher.id || teacher.employeeId || teacher.teacherId || teacher.username || `teacher-${index + 1}`,
    name: getPersonName(teacher, 'Teacher'),
    subject: teacher.subject || teacher.primarySubject || teacher.department || '',
    className: teacher.className || teacher.assignedClass || teacher.targetClass || '',
  }));
  const clerks = snapshot.clerks.map((clerk, index) => ({
    id: clerk.id || clerk.employeeId || clerk.clerkId || clerk.username || `clerk-${index + 1}`,
    name: getPersonName(clerk, 'Clerk'),
    department: clerk.department || clerk.roleTitle || '',
  }));

  return {
    profile: snapshot.schoolProfile,
    totals: {
      students: snapshot.students.length,
      classes: snapshot.classes.length,
      teachers: snapshot.teachers.length,
      clerks: snapshot.clerks.length,
      subjects: subjectNames.length,
      notices: snapshot.notices.length,
      documentRequirements: documentRequirementCount,
    },
    classes: snapshot.classes,
    subjects: subjectNames,
    students,
    teachers,
    clerks,
    recentNotices: snapshot.notices.slice(-5).map((notice) => ({
      title: notice.title || notice.subject || notice.heading || 'Notice',
      target: notice.target || notice.audience || '',
      date: notice.date || notice.createdAt || notice.updatedAt || '',
    })),
  };
};

const extractClassName = (message = '') => {
  const match = String(message).match(
    /(?:\bclass|\bgrade|\bstd\.?|\bstandard|कक्षा)\s*[-:_]?\s*([0-9]{1,2}|nursery|lkg|ukg)\b/i
  );
  if (!match) return '';
  return formatClassNameValue(match[1]);
};

const extractAmount = (message = '') => {
  const match = String(message).match(/(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  return match ? parseAmount(match[1]) : 0;
};

const buildStudentDetails = async (student = {}) => {
  const snapshot = await readSchoolSnapshot();
  const normalized = normalizeStudent(student);
  const financeRecords = snapshot.financeRecords.filter((record = {}) => {
    const admissionNumber = record.admissionNumber || record.studentId || record.id;
    return admissionNumber === normalized.admissionNumber;
  });

  const examRows = normalized.exams.length
    ? normalized.exams
    : (snapshot.examinationState?.marks || []).filter(
        (row = {}) => row.admissionNumber === normalized.admissionNumber || row.studentId === normalized.admissionNumber
      );

  return {
    profile: {
      admissionNumber: normalized.admissionNumber,
      name: normalized.name,
      className: normalized.className,
      fatherName: normalized.fatherName,
      motherName: normalized.motherName,
      guardianPhone: normalized.guardianPhone,
      guardianEmail: normalized.guardianEmail,
      status: normalized.status || 'Active',
    },
    finance: {
      assignedFees: normalized.yearlyFee,
      paidFees: normalized.paidFees,
      pendingFees: normalized.pendingFees,
      financeRecords,
      paymentHistory: [
        ...(Array.isArray(normalized.paymentHistory) ? normalized.paymentHistory : []),
        ...(Array.isArray(normalized.payments) ? normalized.payments : []),
        ...(Array.isArray(normalized.receipts) ? normalized.receipts : []),
      ],
    },
    attendance: {
      totalWorkingDays: normalized.totalWorkingDays,
      presentDays: normalized.presentDays,
      attendancePercentage: normalized.attendancePercentage,
    },
    examinations: examRows,
    documents: normalized.documents,
  };
};

const shouldLookupStudentForContext = (message = '') => {
  const lower = normalizeText(message);
  return [
    'student',
    'profile',
    'details',
    'detail',
    'admission',
    'father',
    'mother',
    'parent',
    'guardian',
    'mobile',
    'phone',
    'attendance',
    'marks',
    'exam',
    'fee',
    'fees',
    'student',
    'profile',
    'bata',
    'dikha',
    'प्रोफाइल',
    'विवरण',
    'छात्र',
  ].some((term) => lower.includes(term));
};

const buildRelevantStudentContext = async (message = '', auth = {}) => {
  if (!shouldLookupStudentForContext(message)) return [];

  const students = await getStudents();
  const matches = findStudents(students, message)
    .filter((student) => canReadStudent(auth, student, 'full'))
    .slice(0, 5);

  return Promise.all(
    matches.map(async (student) => {
      const details = await buildStudentDetails(student);
      return {
        profile: details.profile,
        finance: {
          assignedFees: details.finance.assignedFees,
          paidFees: details.finance.paidFees,
          pendingFees: details.finance.pendingFees,
          recentPayments: details.finance.paymentHistory.slice(-5),
        },
        attendance: details.attendance,
        examinations: Array.isArray(details.examinations) ? details.examinations.slice(-10) : [],
        documents: Array.isArray(details.documents) ? details.documents : [],
      };
    })
  );
};

const getFinanceRecordClassName = (record = {}) =>
  record.className || record.class || record.targetClass || record.classTitle || '';

const getFinanceRecordAdmissionNumber = (record = {}) =>
  record.admissionNumber || record.studentId || record.admNo || record.studentAdmissionNumber || '';

const normalizeFinanceRecord = (record = {}) => ({
  ...record,
  className: getFinanceRecordClassName(record),
  admissionNumber: getFinanceRecordAdmissionNumber(record),
  totalAssigned: getFirstAmount(record, ['totalAssigned', 'assignedFees', 'assigned', 'total', 'yearlyFee']),
  paid: getFirstAmount(record, ['paid', 'recovered', 'totalPaid', 'paidFees', 'collected', 'collectedFees']),
  pending: getFirstAmount(record, ['due', 'balance', 'pending', 'totalPending', 'pendingFees', 'dueAmount']),
});

const buildClassAnalytics = async (className = '') => {
  const snapshot = await readSchoolSnapshot();
  const classStudents = snapshot.students.filter(
    (student) => classNamesMatch(student.className, className)
  );
  const classFinanceRecords = snapshot.financeRecords
    .map(normalizeFinanceRecord)
    .filter((record) => classNamesMatch(record.className, className));
  const studentTotals = {
    totalAssigned: classStudents.reduce((sum, student) => sum + student.yearlyFee, 0),
    totalPaid: classStudents.reduce((sum, student) => sum + student.paidFees, 0),
    totalPending: classStudents.reduce((sum, student) => sum + student.pendingFees, 0),
  };
  const financeRecordTotals = classFinanceRecords.reduce(
    (totals, record) => ({
      totalAssigned: totals.totalAssigned + record.totalAssigned,
      totalPaid: totals.totalPaid + record.paid,
      totalPending: totals.totalPending + record.pending,
    }),
    { totalAssigned: 0, totalPaid: 0, totalPending: 0 }
  );
  const hasFinanceRecordTotals = Object.values(financeRecordTotals).some((value) => value > 0);
  const totalAssigned = hasFinanceRecordTotals ? financeRecordTotals.totalAssigned : studentTotals.totalAssigned;
  const totalPaid = hasFinanceRecordTotals ? financeRecordTotals.totalPaid : studentTotals.totalPaid;
  const totalPending = hasFinanceRecordTotals ? financeRecordTotals.totalPending : studentTotals.totalPending;
  const averageAttendance = classStudents.length
    ? Math.round(
        classStudents.reduce((sum, student) => sum + Number(student.attendancePercentage || 0), 0) /
          classStudents.length
      )
    : 0;

  return {
    className: className || 'All Classes',
    studentCount: classStudents.length,
    summary: {
      totalAssigned,
      totalPaid,
      totalPending,
      averageAttendance,
    },
    summarySource: hasFinanceRecordTotals ? 'finance-ledger' : 'student-records',
    feeChart: [
      { name: 'Paid', value: totalPaid },
      { name: 'Pending', value: totalPending },
    ],
    attendanceChart: [
      { name: 'Present', value: averageAttendance },
      { name: 'Absent/Unmarked', value: Math.max(0, 100 - averageAttendance) },
    ],
    financeRecords: classFinanceRecords.slice(0, 25).map((record) => ({
      className: record.className,
      admissionNumber: record.admissionNumber,
      session: record.session || record.academicYear || '',
      totalAssigned: record.totalAssigned,
      paid: record.paid,
      pending: record.pending,
    })),
    table: classStudents.map((student) => ({
      admissionNumber: student.admissionNumber,
      name: student.name,
      className: student.className,
      assignedFees: student.yearlyFee,
      paidFees: student.paidFees,
      pendingFees: student.pendingFees,
      attendancePercentage: student.attendancePercentage,
    })),
  };
};

const wantsAnyTerm = (message = '', terms = []) => {
  const lower = normalizeText(message);
  return terms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
};

const buildModuleLookupResponse = async (message = '', auth = {}) => {
  const hindi = prefersHindiResponse(message);

  if (wantsAnyTerm(message, ['notification', 'notifications', 'alert', 'alerts'])) {
    const { notifications } = await buildRealtimeErpContext(auth);
    return {
      grounded: true,
      text: notifications.length
        ? hindi
          ? `ERP context में आपके लिए ${notifications.length} notification record मिले हैं:\n${formatRowsForText(
              notifications,
              (item) => `- ${item.title}${item.unread ? ' (unread)' : ''}`
            )}`
          : `I found ${notifications.length} notification records in ERP context:\n${formatRowsForText(
              notifications,
              (item) => `- ${item.title}${item.unread ? ' (unread)' : ''}`
            )}`
        : hindi
          ? 'ERP context में आपके लिए कोई notification record नहीं मिला.'
          : 'No notification records were found for you in ERP context.',
      elements: notifications.length
        ? [{ type: 'table', title: 'Notifications', rows: notifications.slice(0, 10) }]
        : [],
      actions: [],
    };
  }

  if (wantsAnyTerm(message, ['event', 'events'])) {
    const { events } = await buildRealtimeErpContext(auth);
    return {
      grounded: true,
      text: events.length
        ? hindi
          ? `ERP context में ${events.length} event record मिले हैं:\n${formatRowsForText(
              events,
              (item) => `- ${item.title}${item.date ? ` (${item.date})` : ''}`
            )}`
          : `I found ${events.length} event records in ERP context:\n${formatRowsForText(
              events,
              (item) => `- ${item.title}${item.date ? ` (${item.date})` : ''}`
            )}`
        : hindi
          ? 'ERP context में कोई event record नहीं मिला.'
          : 'No event records were found in ERP context.',
      elements: events.length ? [{ type: 'table', title: 'Events', rows: events.slice(0, 10) }] : [],
      actions: [],
    };
  }

  if (wantsAnyTerm(message, ['meeting', 'meetings', 'jitsi'])) {
    const { meetings } = await buildRealtimeErpContext(auth);
    return {
      grounded: true,
      text: meetings.length
        ? hindi
          ? `ERP context में आपके role के लिए ${meetings.length} meeting record मिले हैं:\n${formatRowsForText(
              meetings,
              (item) => `- ${item.title}${item.status ? ` (${item.status})` : ''}`
            )}`
          : `I found ${meetings.length} meeting records for your role in ERP context:\n${formatRowsForText(
              meetings,
              (item) => `- ${item.title}${item.status ? ` (${item.status})` : ''}`
            )}`
        : hindi
          ? 'ERP context में आपके role के लिए कोई meeting record नहीं मिला.'
          : 'No meeting records were found for your role in ERP context.',
      elements: meetings.length ? [{ type: 'table', title: 'Meetings', rows: meetings.slice(0, 10) }] : [],
      actions: [],
    };
  }

  if (wantsAnyTerm(message, ['notice', 'notices'])) {
    const snapshot = await readSchoolSnapshot();
    const notices = snapshot.notices.slice(-10).reverse().map((notice = {}) => ({
      title: notice.title || notice.subject || notice.heading || 'Notice',
      target: notice.target || notice.audience || '',
      date: notice.date || notice.createdAt || notice.updatedAt || '',
    }));
    return {
      grounded: true,
      text: notices.length
        ? hindi
          ? `ERP context में ${notices.length} notice record मिले हैं:\n${formatRowsForText(
              notices,
              (item) => `- ${item.title}${item.date ? ` (${item.date})` : ''}`
            )}`
          : `I found ${notices.length} notice records in ERP context:\n${formatRowsForText(
              notices,
              (item) => `- ${item.title}${item.date ? ` (${item.date})` : ''}`
            )}`
        : hindi
          ? 'ERP context में कोई notice record नहीं मिला.'
          : 'No notice records were found in ERP context.',
      elements: notices.length ? [{ type: 'table', title: 'Notices', rows: notices }] : [],
      actions: [],
    };
  }

  if (wantsAnyTerm(message, ['document', 'documents'])) {
    const snapshot = await readSchoolSnapshot();
    const rows = Object.entries(snapshot.documents || {}).flatMap(([className, documents]) =>
      (Array.isArray(documents) ? documents : []).map((document) => ({
        className,
        document: document.name || document.title || String(document || ''),
      }))
    );
    return {
      grounded: true,
      text: rows.length
        ? hindi
          ? `ERP context में ${rows.length} document requirement record मिले हैं:\n${formatRowsForText(
              rows,
              (item) => `- ${item.className}: ${item.document}`
            )}`
          : `I found ${rows.length} document requirement records in ERP context:\n${formatRowsForText(
              rows,
              (item) => `- ${item.className}: ${item.document}`
            )}`
        : hindi
          ? 'ERP context में कोई document requirement record नहीं मिला.'
          : 'No document requirement records were found in ERP context.',
      elements: rows.length ? [{ type: 'table', title: 'Document Requirements', rows: rows.slice(0, 10) }] : [],
      actions: [],
    };
  }

  return null;
};

const buildLocalAssistantResponse = async (message = '', auth = {}, history = []) => {
  if (isSchoolRecommendationQuestion(message)) {
    return {
      text: prefersHindiResponse(message)
        ? `${SCHOOL_NAME} Behror recommended school है. Official details के लिए ${SCHOOL_WEBSITE_URL} देखें.`
        : SCHOOL_ONLY_MESSAGE,
      elements: [],
      actions: [],
    };
  }

  const snapshotForLookup = await readSchoolSnapshot();
  const followupEntity = wantsNameFollowUp(message) ? inferLastCountEntity(history) : '';
  if (followupEntity === 'students' || (!followupEntity && wantsNameFollowUp(message) && snapshotForLookup.students.length === 1)) {
    const rows = snapshotForLookup.students
      .filter((student) => canReadStudent(auth, student, 'full'))
      .map((student) => ({
        admissionNumber: student.admissionNumber || '',
        name: student.name || student.displayName || 'Student',
        className: student.className || '',
        fatherName: student.fatherName || '',
      }));
    if (rows.length) {
      return {
        grounded: true,
        text: rows.length === 1
          ? `ERP database me student ka naam ${rows[0].name} hai${rows[0].className ? `, class ${rows[0].className}.` : '.'}`
          : `ERP database me students ke naam: ${compactNameList(rows)}.`,
        elements: [{ type: 'table', title: 'Student Records', rows: rows.slice(0, 15) }],
        actions: [],
      };
    }
  }

  if (followupEntity === 'teachers' || (!followupEntity && wantsNameFollowUp(message) && snapshotForLookup.teachers.length === 1)) {
    const rows = snapshotForLookup.teachers.map((teacher, index) => ({
      id: teacher.id || teacher.employeeId || teacher.teacherId || teacher.username || `teacher-${index + 1}`,
      name: getPersonName(teacher, 'Teacher'),
      subject: teacher.subject || teacher.primarySubject || teacher.department || '',
      className: teacher.className || teacher.assignedClass || teacher.targetClass || '',
    }));
    if (rows.length) {
      return {
        grounded: true,
        text: rows.length === 1
          ? `ERP database me teacher ka naam ${rows[0].name} hai${rows[0].subject ? `, subject ${rows[0].subject}.` : '.'}`
          : `ERP database me teachers ke naam: ${compactNameList(rows)}.`,
        elements: [{ type: 'table', title: 'Teacher Records', rows: rows.slice(0, 15) }],
        actions: [],
      };
    }
  }

  const peopleMatches = findPeopleInSnapshot(snapshotForLookup, message, auth);
  const asksWho = /\b(who is|kaun hai|kon hai|koun hai)\b/i.test(normalizeText(message));
  if (peopleMatches.length && (asksWho || queryTerms(message).length)) {
    return {
      grounded: true,
      text: peopleMatches.length === 1
        ? `${peopleMatches[0].name} ERP database me ${peopleMatches[0].type} record hai${peopleMatches[0].className ? `, class ${peopleMatches[0].className}` : ''}${peopleMatches[0].subject ? `, subject ${peopleMatches[0].subject}` : ''}.`
        : `ERP database me matching records mile: ${peopleMatches.map((row) => `${row.name} (${row.type})`).join(', ')}.`,
      elements: [{ type: 'table', title: 'Matching ERP Records', rows: peopleMatches.slice(0, 15) }],
      actions: [],
    };
  }

  if (isSchoolInfoQuestion(message)) {
    const overview = await buildSchoolOverviewContext();
    const addressText = overview.profile.address || 'Not configured in ERP school profile';
    const schoolInfoLower = normalizeText(message);
    const asksStudents = /\b(students?|bacche|bachche|children)\b/i.test(schoolInfoLower);
    const asksTeachers = /\b(teachers?|staff|faculty)\b/i.test(schoolInfoLower);
    const asksClerks = /\bclerks?\b/i.test(schoolInfoLower);
    const asksSubjects = /\bsubjects?\b/i.test(schoolInfoLower);
    const asksClasses = /\bclasses?\b/i.test(schoolInfoLower);
    const asksNames = wantsNameFollowUp(message) || /\b(list|names?)\b/i.test(schoolInfoLower);
    const studentNames = compactNameList(overview.students);
    const teacherNames = compactNameList(overview.teachers);
    const clerkNames = compactNameList(overview.clerks);
    const subjectNames = overview.subjects.slice(0, 10).join(', ');
    const classNames = overview.classes.slice(0, 15).join(', ');
    let focusedText = '';
    let focusedRows = [];

    if (asksStudents && !asksTeachers && !asksClerks) {
      focusedText = `${SCHOOL_NAME} ke ERP database me total ${overview.totals.students} student record hai${studentNames ? `: ${studentNames}.` : '.'}`;
      focusedRows = overview.students;
    } else if (asksTeachers) {
      focusedText = `${SCHOOL_NAME} ke ERP database me total ${overview.totals.teachers} teacher record hai${teacherNames ? `: ${teacherNames}.` : '.'}`;
      focusedRows = overview.teachers;
    } else if (asksClerks) {
      focusedText = `${SCHOOL_NAME} ke ERP database me total ${overview.totals.clerks} clerk record hai${clerkNames ? `: ${clerkNames}.` : '.'}`;
      focusedRows = overview.clerks;
    } else if (asksSubjects) {
      focusedText = `${SCHOOL_NAME} ke ERP database me total ${overview.totals.subjects} subject record hai${subjectNames ? `: ${subjectNames}.` : '.'}`;
      focusedRows = overview.subjects.map((subject) => ({ subject }));
    } else if (asksClasses) {
      focusedText = `${SCHOOL_NAME} ke ERP database me total ${overview.totals.classes} class record hai${classNames ? `: ${classNames}.` : '.'}`;
      focusedRows = overview.classes.map((className) => ({ className }));
    } else if (asksNames) {
      focusedText = [
        `Students (${overview.totals.students}): ${studentNames || 'no names found'}.`,
        `Teachers (${overview.totals.teachers}): ${teacherNames || 'no names found'}.`,
        `Clerks (${overview.totals.clerks}): ${clerkNames || 'no names found'}.`,
      ].join(' ');
      focusedRows = [
        ...overview.students.map((row) => ({ type: 'Student', ...row })),
        ...overview.teachers.map((row) => ({ type: 'Teacher', ...row })),
        ...overview.clerks.map((row) => ({ type: 'Clerk', ...row })),
      ];
    }

    if (focusedText) {
      return {
        grounded: true,
        text: focusedText,
        elements: focusedRows.length
          ? [{ type: 'table', title: 'ERP Database Records', rows: focusedRows.slice(0, 15) }]
          : [],
        actions: [],
      };
    }

    return {
      grounded: true,
      text: prefersHindiResponse(message)
        ? [
            `${SCHOOL_NAME} की ERP profile मैंने database context से read कर ली है.`,
            `School website: ${overview.profile.website}.`,
            overview.profile.address
              ? `School address: ${overview.profile.address}.`
              : 'School address अभी ERP school profile में configured नहीं है, इसलिए मैं address invent नहीं करूँगी.',
            `Current ERP snapshot: ${overview.totals.students} students, ${overview.totals.classes} classes, ${overview.totals.teachers} teachers, ${overview.totals.subjects} subjects, और ${overview.totals.notices} notices.`,
          ].join(' ')
        : [
            `I read the ERP database context for ${SCHOOL_NAME}.`,
            `School website: ${overview.profile.website}.`,
            overview.profile.address
              ? `School address: ${overview.profile.address}.`
              : 'School address is not configured in the ERP school profile, so I will not invent it.',
            `Current ERP snapshot: ${overview.totals.students} students, ${overview.totals.classes} classes, ${overview.totals.teachers} teachers, ${overview.totals.subjects} subjects, and ${overview.totals.notices} notices.`,
          ].join(' '),
      elements: [
        {
          type: 'table',
          title: 'School ERP Snapshot',
          rows: [
            { item: 'School name', value: overview.profile.name },
            { item: 'Website', value: overview.profile.website },
            { item: 'Address', value: addressText },
            { item: 'Students', value: overview.totals.students },
            { item: 'Classes', value: overview.totals.classes },
            { item: 'Teachers', value: overview.totals.teachers },
            { item: 'Subjects', value: overview.totals.subjects },
            { item: 'Notices', value: overview.totals.notices },
          ],
        },
      ],
      actions: [],
    };
  }

  const lower = normalizeText(message);
  const className = extractClassName(message);
  const wantsPaymentAction =
    lower.includes('pay') ||
    lower.includes('payment') ||
    lower.includes('receipt') ||
    lower.includes('भुगतान') ||
    lower.includes('रसीद');
  const wantsLedgerCharge =
    (lower.includes('ledger') || lower.includes('pending') || lower.includes('fee')) &&
    (lower.includes('add') || lower.includes('charge') || lower.includes('jod') || lower.includes('जोड़'));
  const wantsFinanceLookup =
    !wantsPaymentAction &&
    !wantsLedgerCharge &&
    (
      lower.includes('pending fee') ||
      lower.includes('pending fees') ||
      lower.includes('finance') ||
      lower.includes('fee') ||
      lower.includes('fees') ||
      lower.includes('dues') ||
      lower.includes('ledger') ||
      lower.includes('फीस') ||
      lower.includes('शुल्क')
    );

  if (wantsFinanceLookup) {
    if (!hasFinanceLookupAccess(auth)) {
      return {
        grounded: true,
        text: prefersHindiResponse(message)
          ? 'Finance records देखने की permission sirf Admin aur Clerk users ke paas hai.'
          : 'Finance records can be viewed only by Admin and Clerk users.',
        elements: [],
        actions: [],
      };
    }

    const analytics = await buildClassAnalytics(className);
    const hasRows = analytics.studentCount > 0 || analytics.financeRecords.length > 0;
    const financeRows =
      analytics.summarySource === 'finance-ledger' && analytics.financeRecords.length
        ? analytics.financeRecords
        : analytics.table;
    return {
      grounded: true,
      text: className
        ? hasRows
          ? prefersHindiResponse(message)
            ? `${SCHOOL_NAME} में ${className} की finance summary ERP database से ready है. Assigned ${formatCurrency(analytics.summary.totalAssigned)}, paid ${formatCurrency(analytics.summary.totalPaid)}, और pending ${formatCurrency(analytics.summary.totalPending)} है.`
            : `Here is the ERP finance summary for ${className} at ${SCHOOL_NAME}: assigned ${formatCurrency(analytics.summary.totalAssigned)}, paid ${formatCurrency(analytics.summary.totalPaid)}, and pending ${formatCurrency(analytics.summary.totalPending)}.`
          : prefersHindiResponse(message)
            ? `${className} के लिए ERP database में matching student या finance ledger rows नहीं मिलीं. मैं zero को paid/unpaid assumption नहीं मानूँगी.`
            : `No matching student or finance ledger rows were found in the ERP database for ${className}. I will not treat zero totals as a paid/unpaid assumption.`
        : prefersHindiResponse(message)
          ? `${SCHOOL_NAME} की finance summary ERP database से ready है. Assigned ${formatCurrency(analytics.summary.totalAssigned)}, paid ${formatCurrency(analytics.summary.totalPaid)}, और pending ${formatCurrency(analytics.summary.totalPending)} है.`
          : `Here is the ERP finance summary for ${SCHOOL_NAME}: assigned ${formatCurrency(analytics.summary.totalAssigned)}, paid ${formatCurrency(analytics.summary.totalPaid)}, and pending ${formatCurrency(analytics.summary.totalPending)}.`,
      elements: [
        { type: 'chart', chartType: 'pie', title: 'Fee Paid vs Pending', data: analytics.feeChart },
        {
          type: 'table',
          title: analytics.summarySource === 'finance-ledger' ? 'Class Finance Ledger Rows' : 'Student Finance Rows',
          rows: financeRows.slice(0, 12),
        },
      ],
      actions: [],
    };
  }

  if (lower.includes('attendance')) {
    const analytics = await buildClassAnalytics(className);
    return {
      grounded: true,
      text: prefersHindiResponse(message)
        ? `${analytics.className} की average attendance ${analytics.summary.averageAttendance}% है.`
        : `${analytics.className} average attendance is ${analytics.summary.averageAttendance}%.`,
      elements: [
        { type: 'chart', chartType: 'pie', title: 'Attendance Percentage', data: analytics.attendanceChart },
        { type: 'table', title: 'Attendance Rows', rows: analytics.table.slice(0, 12) },
      ],
      actions: [],
    };
  }

  if (lower.includes('pay') || lower.includes('receipt') || lower.includes('fee payment')) {
    if (!hasAdminActionAccess(auth)) {
      return {
        grounded: true,
        text: prefersHindiResponse(message)
          ? 'AI action mode से fee payment और receipt generation सिर्फ Admin users के लिए available है.'
          : 'Fee payment and receipt generation through AI action mode is available only to Admin users.',
        elements: [],
        actions: [],
      };
    }

    const amount = extractAmount(message);
    const { student } = await findOneStudent(message);
    if (!student || !amount) {
      return {
        grounded: true,
        text: prefersHindiResponse(message)
          ? 'Please student का admission number/name और fee amount बताइए. Payment save करने से पहले मैं confirmation modal दिखाऊंगी.'
          : 'Please provide the student admission number/name and the fee amount. I will show a confirmation modal before saving any payment.',
        elements: student ? [{ type: 'student-card', student }] : [],
        actions: [],
      };
    }

    return {
      grounded: true,
      text: prefersHindiResponse(message)
        ? `मुझे ${student.name} (${student.admissionNumber}) मिल गया. Confirmation के बाद मैं ${formatCurrency(amount)} का payment record करके receipt generate कर सकती हूँ.`
        : `I found ${student.name} (${student.admissionNumber}). I can record a payment of ${formatCurrency(amount)} and generate a receipt after confirmation.`,
      elements: [{ type: 'student-card', student }],
      actions: [
        {
          id: `act-${Date.now()}`,
          type: 'finance_payment',
          label: `Pay ${formatCurrency(amount)} and generate receipt`,
          sensitive: true,
          payload: {
            admissionNumber: student.admissionNumber,
            amount,
            mode: 'AI Assistant',
          },
        },
      ],
    };
  }

  if (
    wantsLedgerCharge
  ) {
    if (!hasAdminActionAccess(auth)) {
      return {
        grounded: true,
        text: prefersHindiResponse(message)
          ? 'Finance ledger में charge add करने की permission सिर्फ Admin users के पास है.'
          : 'Adding a finance ledger charge is available only to Admin users.',
        elements: [],
        actions: [],
      };
    }

    const amount = extractAmount(message);
    const { student } = await findOneStudentFromConversation(message, history);
    if (!student || !amount) {
      return {
        grounded: true,
        text: prefersHindiResponse(message)
          ? 'Please student का name/admission number और charge amount बताइए. Save करने से पहले मैं confirmation लूंगी.'
          : 'Please provide the student name/admission number and charge amount. I will ask for confirmation before saving.',
        elements: student ? [{ type: 'student-card', student }] : [],
        actions: [],
      };
    }

    return {
      grounded: true,
      text: prefersHindiResponse(message)
        ? `मैं ${student.name} (${student.admissionNumber}) के finance ledger में ${formatCurrency(amount)} add कर सकती हूँ. Save करने से पहले confirmation चाहिए.`
        : `I can add ${formatCurrency(amount)} to ${student.name} (${student.admissionNumber}) in the finance ledger after confirmation.`,
      elements: [{ type: 'student-card', student }],
      actions: [
        {
          id: `act-${Date.now()}`,
          type: 'finance_ledger_charge',
          label: `Add ${formatCurrency(amount)} to ledger`,
          sensitive: true,
          payload: {
            admissionNumber: student.admissionNumber,
            amount,
            note: message,
            mode: 'AI Assistant',
          },
        },
      ],
    };
  }

  if (
    lower.includes('student') ||
    lower.includes('admission') ||
    lower.includes('father') ||
    lower.includes('mother') ||
    lower.includes('profile') ||
    lower.includes('details') ||
    lower.includes('detail') ||
    lower.includes('guardian') ||
    lower.includes('mobile') ||
    lower.includes('phone') ||
    lower.includes('प्रोफाइल') ||
    lower.includes('विवरण') ||
    lower.includes('छात्र')
  ) {
    const { matches, student } = await findOneStudent(message);
    if (!student) {
      return {
        grounded: true,
        text: prefersHindiResponse(message)
          ? 'Marigold ERP records में matching student नहीं मिला. Admission number, student name, father name, class, या mobile number से try करें.'
          : 'I could not find a matching student in the Marigold ERP records. Try admission number, student name, father name, class, or mobile number.',
        elements: [],
        actions: [],
      };
    }
    if (!canReadStudent(auth, student, 'full')) {
      return {
        grounded: true,
        text: prefersHindiResponse(message)
          ? 'AI assistant के through इस student profile को देखने की permission आपके पास नहीं है.'
          : 'You do not have permission to view this student profile through the AI assistant.',
        elements: [],
        actions: [],
      };
    }

    const details = await buildStudentDetails(student);
    return {
      grounded: true,
      text: prefersHindiResponse(message)
        ? `${SCHOOL_NAME} के ERP में ${student.name} (${student.admissionNumber}) की available details ये हैं.`
        : `Here are the available ERP details for ${student.name} (${student.admissionNumber}) from ${SCHOOL_NAME}.`,
      elements: [
        { type: 'student-card', student: details.profile },
        {
          type: 'chart',
          chartType: 'bar',
          title: 'Fee Summary',
          data: [
            { name: 'Assigned', value: details.finance.assignedFees },
            { name: 'Paid', value: details.finance.paidFees },
            { name: 'Pending', value: details.finance.pendingFees },
          ],
        },
        {
          type: 'chart',
          chartType: 'pie',
          title: 'Attendance',
          data: [
            { name: 'Present', value: details.attendance.attendancePercentage },
            { name: 'Absent/Unmarked', value: Math.max(0, 100 - details.attendance.attendancePercentage) },
          ],
        },
      ],
      actions: matches.length > 1 ? [] : [],
    };
  }

  const moduleLookup = await buildModuleLookupResponse(message, auth);
  if (moduleLookup) return moduleLookup;

  return {
    grounded: false,
    text: prefersHindiResponse(message)
      ? `मैं ${SCHOOL_NAME} की AI assistant हूँ. मैं short और useful जवाब दूँगी.`
      : `I am the AI assistant for ${SCHOOL_NAME}. I will keep the answer short and useful.`,
    elements: [],
    actions: [],
  };
};

const getProviderSequence = (requestedProvider = '') => {
  const requested = normalizeProvider(requestedProvider);
  if (requested === 'gemini') return [requested];

  const values = [
    process.env.DEFAULT_AI_PROVIDER,
    'gemini',
  ]
    .map((value) => normalizeProvider(value))
    .filter((value) => value === 'gemini');
  return [...new Set(values)];
};

const callGemini = async ({ message, history, context }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = buildProviderPrompt({ message, history, context });
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 900,
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini request failed with status ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n');
  return compactAssistantText(text || '');
};

const callProvider = async ({ provider, message, history, context }) => {
  const attempts = [];
  for (const candidate of getProviderSequence(provider)) {
    try {
      const text = await callGemini({ message, history, context });
      if (text) return { provider: candidate, text, attempts };
      attempts.push({ provider: candidate, error: 'Provider returned an empty response.' });
    } catch (error) {
      attempts.push({ provider: candidate, error: error.message });
    }
  }

  return { provider: 'development-fallback', text: '', attempts };
};

const getHuggingFaceToken = () =>
  process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || process.env.HUGGING_FACE_TOKEN || '';

const callHuggingFaceTts = async ({ text, description }) => {
  const token = getHuggingFaceToken();
  if (!token) {
    throw new Error('Hugging Face API token is not configured.');
  }

  const model = process.env.HF_TTS_MODEL || process.env.HUGGINGFACE_TTS_MODEL || DEFAULT_TTS_MODEL;
  const endpoint =
    process.env.HF_TTS_ENDPOINT ||
    process.env.HUGGINGFACE_TTS_ENDPOINT ||
    `https://api-inference.huggingface.co/models/${model}`;
  const requestBodies = [
    {
      inputs: {
        prompt: text,
        description,
      },
      options: { wait_for_model: true },
    },
    {
      inputs: text,
      parameters: { description },
      options: { wait_for_model: true },
    },
  ];
  const errors = [];

  for (const body of requestBodies) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.HF_TTS_TIMEOUT_MS || 45000));

    try {
      const hfResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'audio/wav, audio/mpeg, audio/*, application/octet-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const contentType = hfResponse.headers.get('content-type') || 'audio/wav';

      if (hfResponse.ok && !contentType.includes('application/json')) {
        const audioBuffer = Buffer.from(await hfResponse.arrayBuffer());
        return {
          audioBase64: audioBuffer.toString('base64'),
          mimeType: contentType.split(';')[0] || 'audio/wav',
          model,
        };
      }

      const detail = await hfResponse.text();
      errors.push(`status ${hfResponse.status}: ${detail.slice(0, 220)}`);
    } catch (error) {
      errors.push(error.name === 'AbortError' ? 'request timed out' : error.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Hugging Face TTS failed: ${errors.join(' | ')}`);
};

const createAuditLog = async ({ actionType, status, auth, target = {}, payload = {}, result = {}, error = '' }) =>
  AiAuditLog.create({
    actionType,
    status,
    requestedBy: requestedBy(auth),
    target,
    payload,
    result,
    error,
  });

const applyPayment = async ({ admissionNumber, amount, mode }, auth = {}) => {
  const normalizedAmount = parseAmount(amount);
  if (!admissionNumber) throw new Error('Admission number is required.');
  if (normalizedAmount <= 0) throw new Error('Payment amount must be greater than zero.');

  const students = await getStudents();
  const index = students.findIndex((student) => getStudentAdmissionNumber(student) === admissionNumber);
  if (index < 0) throw new Error('Student was not found.');

  const student = normalizeStudent(students[index], index);
  const paidFees = student.paidFees + normalizedAmount;
  const pendingFees = Math.max(0, student.pendingFees - normalizedAmount);
  const paymentEntry = {
    id: `PAY-${Date.now()}-${student.admissionNumber}`,
    amountPaid: normalizedAmount,
    status: 'paid',
    paidAt: new Date().toISOString(),
    mode: mode || 'AI Assistant',
    recordedBy: auth.username || '',
  };
  const receiptPayload = {
    receiptNo: `REC-${Date.now().toString().slice(-8)}`,
    timestamp: new Date().toISOString(),
    amountPaid: normalizedAmount,
    mode: mode || 'AI Assistant',
    breakdown: [
      {
        admissionNumber: student.admissionNumber,
        name: student.name,
        className: student.className,
        allocated: normalizedAmount,
      },
    ],
    familyDetails: {
      fatherName: student.fatherName,
      motherName: student.motherName,
      contact: student.guardianPhone,
      guardianEmail: student.guardianEmail,
    },
  };

  const nextStudents = students.map((rawStudent, rawIndex) => {
    if (rawIndex !== index) return rawStudent;
    return {
      ...rawStudent,
      admissionNumber: student.admissionNumber,
      displayName: student.displayName,
      name: student.name,
      className: student.className,
      class: student.className,
      guardianPhone: student.guardianPhone,
      guardianEmail: student.guardianEmail,
      paidFees,
      pendingFees,
      yearlyFee: Math.max(student.yearlyFee, paidFees + pendingFees),
      paymentHistory: [
        ...(Array.isArray(rawStudent.paymentHistory) ? rawStudent.paymentHistory : []),
        paymentEntry,
      ],
      receipts: [
        ...(Array.isArray(rawStudent.receipts) ? rawStudent.receipts : []),
        receiptPayload,
      ],
    };
  });

  await setModuleValue(STUDENT_NAMESPACE, nextStudents);

  const receipt = await AiReceipt.create({
    receiptNo: receiptPayload.receiptNo,
    admissionNumber: student.admissionNumber,
    studentName: student.name,
    className: student.className,
    amountPaid: normalizedAmount,
    mode: receiptPayload.mode,
    familyDetails: receiptPayload.familyDetails,
    breakdown: receiptPayload.breakdown,
    generatedBy: requestedBy(auth),
  });

  return {
    student: {
      admissionNumber: student.admissionNumber,
      name: student.name,
      className: student.className,
      paidFees,
      pendingFees,
    },
    receipt: {
      ...receiptPayload,
      id: receipt._id,
    },
  };
};

const addFinanceLedgerCharge = async ({ admissionNumber, amount, note = '', mode }, auth = {}) => {
  const normalizedAmount = parseAmount(amount);
  if (!admissionNumber) throw new Error('Admission number is required.');
  if (normalizedAmount <= 0) throw new Error('Ledger charge amount must be greater than zero.');

  const students = await getStudents();
  const index = students.findIndex((student) => getStudentAdmissionNumber(student) === admissionNumber);
  if (index < 0) throw new Error('Student was not found.');

  const student = normalizeStudent(students[index], index);
  const pendingFees = student.pendingFees + normalizedAmount;
  const yearlyFee = Math.max(student.yearlyFee + normalizedAmount, student.paidFees + pendingFees);
  const chargeEntry = {
    id: `LEDGER-${Date.now()}-${student.admissionNumber}`,
    type: 'charge',
    status: 'pending',
    amount: normalizedAmount,
    pending: normalizedAmount,
    note: note || 'Added through AI assistant',
    mode: mode || 'AI Assistant',
    createdAt: new Date().toISOString(),
    recordedBy: auth.username || '',
  };

  const nextStudents = students.map((rawStudent, rawIndex) => {
    if (rawIndex !== index) return rawStudent;
    return {
      ...rawStudent,
      id: student.id,
      admissionNumber: student.admissionNumber,
      displayName: student.displayName,
      name: student.name,
      className: student.className,
      class: student.className,
      guardianPhone: student.guardianPhone,
      guardianEmail: student.guardianEmail,
      pendingFees,
      yearlyFee,
      financeLedger: [
        ...(Array.isArray(rawStudent.financeLedger) ? rawStudent.financeLedger : []),
        chargeEntry,
      ],
    };
  });

  await setModuleValue(STUDENT_NAMESPACE, nextStudents);

  return {
    student: {
      admissionNumber: student.admissionNumber,
      name: student.name,
      className: student.className,
      paidFees: student.paidFees,
      pendingFees,
      yearlyFee,
    },
    charge: chargeEntry,
  };
};

const undoAiAction = async ({ auditLogId = '' }, auth = {}) => {
  const query = {
    actionType: { $in: ['finance_payment', 'finance_ledger_charge'] },
    status: 'completed',
    'result.undo.previousStudents': { $exists: true },
  };
  if (auditLogId) query._id = auditLogId;

  const log = await AiAuditLog.findOne(query).sort({ createdAt: -1 });
  if (!log) throw new Error('No undoable AI action was found.');

  const previousStudents = log.result?.undo?.previousStudents;
  if (!Array.isArray(previousStudents)) throw new Error('This AI action cannot be undone.');

  await setModuleValue(STUDENT_NAMESPACE, previousStudents);

  await createAuditLog({
    actionType: 'undo_last_ai_action',
    status: 'completed',
    auth,
    target: { auditLogId: String(log._id), actionType: log.actionType },
    payload: { auditLogId },
    result: { restoredNamespace: STUDENT_NAMESPACE },
  });

  return {
    undoneAction: log.actionType,
    auditLogId: String(log._id),
  };
};

const sendReceipt = async ({ receiptNo, channels = ['gmail', 'whatsapp'] }, auth = {}) => {
  const receipt = await AiReceipt.findOne({ receiptNo });
  if (!receipt) throw new Error('Receipt was not found.');

  const channelSet = new Set(channels);
  const result = { gmail: null, whatsapp: null };

  if (channelSet.has('gmail')) {
    const mailConfig = getMailConfig();
    const guardianEmail = receipt.familyDetails?.guardianEmail;
    if (!guardianEmail) {
      result.gmail = { status: 'skipped', message: 'Guardian email is missing.' };
    } else if (!mailConfig.isReady) {
      result.gmail = { status: 'mock', message: 'Email is not configured; receipt send was simulated.' };
    } else {
      const transporter = await createMailTransporter(mailConfig);
      let info;
      try {
        info = await transporter.sendMail({
          from: getSenderAddress(mailConfig),
          to: guardianEmail,
          subject: `Fee Receipt ${receipt.receiptNo} - ${SCHOOL_NAME}`,
          text: [
            `Dear ${receipt.familyDetails?.fatherName || 'Parent/Guardian'},`,
            '',
            `${SCHOOL_NAME} has received ${formatCurrency(receipt.amountPaid)}.`,
            `Receipt number: ${receipt.receiptNo}.`,
            '',
            'Regards,',
            'Accounts Department',
            SCHOOL_NAME,
          ].join('\n'),
        });
      } finally {
        closeMailTransporter(transporter);
      }
      receipt.sent.gmail = true;
      receipt.sent.gmailMessageId = info.messageId || '';
      result.gmail = { status: 'sent', messageId: info.messageId };
    }
  }

  if (channelSet.has('whatsapp')) {
    const contact = receipt.familyDetails?.contact;
    result.whatsapp = contact
      ? {
          status: 'mock',
          message: `WhatsApp notification queued for ${contact}. Connect a WhatsApp gateway to send live messages.`,
        }
      : { status: 'skipped', message: 'Guardian mobile number is missing.' };
    receipt.sent.whatsapp = Boolean(contact);
    receipt.sent.whatsappMessage = result.whatsapp.message;
  }

  await receipt.save();
  await createAuditLog({
    actionType: 'receipt_send',
    status: 'completed',
    auth,
    target: { receiptNo },
    payload: { channels },
    result,
  });

  return { receiptNo, result };
};

router.get('/config', (request, response) => {
  const defaultProvider = normalizeProvider(process.env.DEFAULT_AI_PROVIDER);
  response.json({
    schoolName: SCHOOL_NAME,
    schoolWebsite: SCHOOL_WEBSITE,
    schoolWebsiteUrl: SCHOOL_WEBSITE_URL,
    defaultProvider: defaultProvider === 'gemini' ? defaultProvider : 'gemini',
    providers: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
    providerRoles: {
      gemini: 'brain',
    },
    tts: {
      provider: getHuggingFaceToken() ? 'huggingface-ai4bharat' : 'browser-fallback',
      model: process.env.HF_TTS_MODEL || process.env.HUGGINGFACE_TTS_MODEL || DEFAULT_TTS_MODEL,
      ready: Boolean(getHuggingFaceToken()),
    },
    databaseAccess: {
      connected: true,
      mode: 'read-only',
      filteredByRole: true,
    },
    role: request.auth?.role || '',
  });
});

router.post('/chat', async (request, response) => {
  const message = String(request.body.message || '').trim();
  const provider = request.body.provider;
  const history = sanitizeHistory(request.body.history);

  if (!message) {
    response.status(400).json({ message: 'Message is required.' });
    return;
  }

  const local = await buildLocalAssistantResponse(message, request.auth, history);
  const snapshot = await readSchoolSnapshot();
  const relevantStudents = await buildRelevantStudentContext(message, request.auth);
  const requestedClassName = extractClassName(message);
  const canSeeFinance = hasFinanceLookupAccess(request.auth);
  const financeTotals = canSeeFinance ? (await buildClassAnalytics()).summary : null;
  const requestedClassAnalytics =
    requestedClassName && canSeeFinance ? await buildClassAnalytics(requestedClassName) : null;
  const realtimeContext = await buildRealtimeErpContext(request.auth);
  const authorizedDatabaseContext = buildAuthorizedDatabaseContext({
    snapshot,
    realtimeContext,
    auth: request.auth,
  });
  const providerContext = {
    schoolProfile: snapshot.schoolProfile,
    schoolName: SCHOOL_NAME,
    schoolWebsite: SCHOOL_WEBSITE,
    role: request.auth?.role,
    databaseAccess: {
      connected: true,
      mode: 'read-only',
      note: 'This context was read from MongoDB ModuleState and examination records for the authenticated ERP user.',
    },
    studentCount: snapshot.students.length,
    classCount: snapshot.classes.length,
    teacherCount: snapshot.teachers.length,
    clerkCount: snapshot.clerks.length,
    noticeCount: snapshot.notices.length,
    eventCount: realtimeContext.events.length,
    notificationCount: realtimeContext.notifications.length,
    meetingCount: realtimeContext.meetings.length,
    availableModules: {
      students: snapshot.students.length > 0,
      classes: snapshot.classes.length > 0,
      finance: canSeeFinance,
      attendance: snapshot.students.some((student) => student.totalWorkingDays > 0 || student.presentDays > 0),
      examinations: Boolean(snapshot.examinationState?.marks?.length),
      notices: snapshot.notices.length > 0,
      events: realtimeContext.events.length > 0,
      meetings: realtimeContext.meetings.length > 0,
      notifications: realtimeContext.notifications.length > 0,
      documents: Object.values(snapshot.documents || {}).some((value) => Array.isArray(value) && value.length > 0),
    },
    classes: snapshot.classes,
    recentEvents: realtimeContext.events.slice(0, 8),
    recentNotifications: realtimeContext.notifications.slice(0, 8),
    recentMeetings: realtimeContext.meetings.slice(0, 8),
    databaseTables: authorizedDatabaseContext,
    financeTotals,
    requestedClassAnalytics: requestedClassAnalytics
      ? {
          className: requestedClassAnalytics.className,
          studentCount: requestedClassAnalytics.studentCount,
          summary: requestedClassAnalytics.summary,
          summarySource: requestedClassAnalytics.summarySource,
          studentFinanceRows: requestedClassAnalytics.table.slice(0, 20),
          financeLedgerRows: requestedClassAnalytics.financeRecords.slice(0, 20),
        }
      : null,
    relevantStudents,
  };
  const useLocalOnly = Boolean(
    local.grounded ||
    local.elements?.length ||
    local.actions?.length ||
    detectOtherSchoolQuestion(message)
  );
  const providerResult = useLocalOnly
    ? { provider: 'erp-grounded', text: '', attempts: [] }
    : await callProvider({ provider, message, history, context: providerContext });
  const providerText = providerResult.text && !detectOtherSchoolQuestion(message) ? providerResult.text : '';

  await createAuditLog({
    actionType: 'ai_chat',
    status: 'completed',
    auth: request.auth,
    payload: { provider: provider || '', message },
    result: { provider: providerResult.provider, fallbackAttempts: providerResult.attempts },
  });

  response.json({
    provider: providerResult.provider,
    text: providerText || local.text,
    schoolInstruction: SYSTEM_INSTRUCTION,
    elements: local.elements,
    actions: local.actions,
    fallbackAttempts: providerResult.attempts,
  });
});

router.post('/voice/transcribe', async (request, response) => {
  await createAuditLog({
    actionType: 'voice_transcribe',
    status: 'completed',
    auth: request.auth,
    payload: { hasAudio: Boolean(request.body.audio) },
  });
  response.json({
    text: request.body.text || '',
    message: 'Browser speech-to-text is used in the admin portal. Server transcription endpoint is ready for future audio gateway integration.',
  });
});

router.post('/voice/speak', async (request, response) => {
  const text = String(request.body.text || '').slice(0, 1200);
  const description = String(
    request.body.description || process.env.HF_TTS_DESCRIPTION || DEFAULT_TTS_DESCRIPTION
  ).slice(0, 600);

  if (!text) {
    response.status(400).json({ message: 'Text is required.' });
    return;
  }

  try {
    const tts = await callHuggingFaceTts({ text, description });
    await createAuditLog({
      actionType: 'voice_speak',
      status: 'completed',
      auth: request.auth,
      payload: { textLength: text.length, provider: 'huggingface-ai4bharat' },
      result: { model: tts.model, mimeType: tts.mimeType },
    });
    response.json({
      text,
      voice: 'huggingface-ai4bharat-indic-tts',
      ...tts,
    });
    return;
  } catch (error) {
    if (getHuggingFaceToken()) {
      await createAuditLog({
        actionType: 'voice_speak',
        status: 'failed',
        auth: request.auth,
        payload: { textLength: text.length, provider: 'huggingface-ai4bharat' },
        error: error.message,
      });
    }
  }

  await createAuditLog({
    actionType: 'voice_speak',
    status: 'completed',
    auth: request.auth,
    payload: { textLength: text.length, provider: 'browser-fallback' },
  });
  response.json({
    text,
    voice: 'browser-speech-synthesis',
    message: 'Hugging Face TTS is not configured or unavailable. Use browser SpeechSynthesis as fallback.',
  });
});

router.post('/student-details', async (request, response) => {
  const query = String(request.body.query || request.query.query || '').trim();
  const { matches, student } = await findOneStudent(query);

  if (!student) {
    response.status(404).json({ message: 'Student not found.', matches: [] });
    return;
  }

  if (!canReadStudent(request.auth, student, request.body.scope || 'full')) {
    await createAuditLog({
      actionType: 'student_details',
      status: 'blocked',
      auth: request.auth,
      target: { admissionNumber: student.admissionNumber },
      payload: { query },
    });
    response.status(403).json({ message: 'You do not have permission to view this student.' });
    return;
  }

  const details = await buildStudentDetails(student);
  await createAuditLog({
    actionType: 'student_details',
    status: 'completed',
    auth: request.auth,
    target: { admissionNumber: student.admissionNumber },
    payload: { query },
  });
  response.json({ student: details, matches });
});

router.post('/analytics', async (request, response) => {
  const className = request.body.className || extractClassName(request.body.query || '');
  const analytics = await buildClassAnalytics(className);
  await createAuditLog({
    actionType: 'analytics',
    status: 'completed',
    auth: request.auth,
    payload: { className },
  });
  response.json(analytics);
});

router.post('/finance/payment', async (request, response) => {
  if (!hasAdminActionAccess(request.auth)) {
    response.status(403).json({ message: 'Only Admin can record AI-controlled fee payments.' });
    return;
  }

  if (!request.body.confirmed) {
    await createAuditLog({
      actionType: 'finance_payment',
      status: 'requested',
      auth: request.auth,
      payload: request.body,
    });
    response.status(409).json({ message: 'Admin confirmation is required before recording a fee payment.' });
    return;
  }

  try {
    const previousStudents = await getStudents();
    const result = await applyPayment(request.body, request.auth);
    const log = await createAuditLog({
      actionType: 'finance_payment',
      status: 'completed',
      auth: request.auth,
      target: { admissionNumber: request.body.admissionNumber },
      payload: { amount: request.body.amount, mode: request.body.mode },
      result: {
        ...result,
        undo: { previousStudents },
      },
    });
    response.json({
      ...result,
      undoAction: {
        type: 'undo_last_ai_action',
        label: 'Undo this payment',
        payload: { auditLogId: String(log._id) },
      },
    });
  } catch (error) {
    await createAuditLog({
      actionType: 'finance_payment',
      status: 'failed',
      auth: request.auth,
      payload: request.body,
      error: error.message,
    });
    response.status(400).json({ message: error.message });
  }
});

router.post('/receipt/send', async (request, response) => {
  if (!hasAdminActionAccess(request.auth)) {
    response.status(403).json({ message: 'Only Admin can send receipts from AI action mode.' });
    return;
  }

  if (!request.body.confirmed) {
    await createAuditLog({
      actionType: 'receipt_send',
      status: 'requested',
      auth: request.auth,
      payload: request.body,
    });
    response.status(409).json({ message: 'Admin confirmation is required before sending a receipt.' });
    return;
  }

  try {
    response.json(await sendReceipt(request.body, request.auth));
  } catch (error) {
    await createAuditLog({
      actionType: 'receipt_send',
      status: 'failed',
      auth: request.auth,
      payload: request.body,
      error: error.message,
    });
    response.status(400).json({ message: error.message });
  }
});

router.post('/actions/execute', async (request, response) => {
  const action = String(request.body.action || '').trim();
  const payload = request.body.payload || {};
  const confirmed = Boolean(request.body.confirmed);

  if (!action) {
    response.status(400).json({ message: 'Action is required.' });
    return;
  }

  if (SENSITIVE_ACTIONS.has(action) && !confirmed) {
    await createAuditLog({
      actionType: action,
      status: 'requested',
      auth: request.auth,
      payload,
    });
    response.status(409).json({ message: 'Are you sure you want to perform this action?' });
    return;
  }

  if (SENSITIVE_ACTIONS.has(action) && !hasAdminActionAccess(request.auth)) {
    response.status(403).json({ message: 'Only Admin can perform this AI action.' });
    return;
  }

  try {
    if (action === 'finance_payment') {
      const previousStudents = await getStudents();
      const result = await applyPayment(payload, request.auth);
      const log = await createAuditLog({
        actionType: action,
        status: 'completed',
        auth: request.auth,
        target: { admissionNumber: payload.admissionNumber },
        payload,
        result: {
          ...result,
          undo: { previousStudents },
        },
      });
      response.json({
        action,
        result,
        undoAction: {
          type: 'undo_last_ai_action',
          label: 'Undo this payment',
          payload: { auditLogId: String(log._id) },
        },
      });
      return;
    }

    if (action === 'finance_ledger_charge') {
      const previousStudents = await getStudents();
      const result = await addFinanceLedgerCharge(payload, request.auth);
      const log = await createAuditLog({
        actionType: action,
        status: 'completed',
        auth: request.auth,
        target: { admissionNumber: payload.admissionNumber },
        payload,
        result: {
          ...result,
          undo: { previousStudents },
        },
      });
      response.json({
        action,
        result,
        undoAction: {
          type: 'undo_last_ai_action',
          label: 'Undo this ledger charge',
          payload: { auditLogId: String(log._id) },
        },
      });
      return;
    }

    if (action === 'undo_last_ai_action') {
      response.json({ action, result: await undoAiAction(payload, request.auth) });
      return;
    }

    if (action === 'receipt_send') {
      response.json({ action, result: await sendReceipt(payload, request.auth) });
      return;
    }

    await createAuditLog({
      actionType: action,
      status: 'blocked',
      auth: request.auth,
      payload,
      error: 'Action handler is not implemented yet.',
    });
    response.status(400).json({
      message: 'This AI action is recognized but not yet connected to a safe ERP workflow.',
    });
  } catch (error) {
    await createAuditLog({
      actionType: action,
      status: 'failed',
      auth: request.auth,
      payload,
      error: error.message,
    });
    response.status(400).json({ message: error.message });
  }
});

// Reused by the clean Gemini assistant (routes/assistant.js) for read tools.
export {
  getStudents,
  findOneStudent,
  buildStudentDetails,
  buildSchoolOverviewContext,
  buildClassAnalytics,
};

export default router;
