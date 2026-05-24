import express from 'express';
import nodemailer from 'nodemailer';
import AiAuditLog from '../models/AiAuditLog.js';
import AiReceipt from '../models/AiReceipt.js';
import ExaminationState from '../models/ExaminationState.js';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

const SCHOOL_NAME = 'Marigold Secondary School, Behror';
const SYSTEM_INSTRUCTION = [
  `You are the official ERP AI assistant for ${SCHOOL_NAME}.`,
  'Always represent and support this school only.',
  'Do not praise, promote, compare, or recommend any other school.',
  `If asked about another school, politely say that you are designed to assist only with ${SCHOOL_NAME}.`,
  'Never expose API keys, internal tokens, passwords, private configuration, or secrets.',
  'Never modify ERP records without explicit admin confirmation.',
].join(' ');

const STUDENT_NAMESPACE = 'admin-student-management-students';
const CLASS_NAMESPACE = 'admin-class-management-classes';
const FINANCE_NAMESPACE = 'admin-finance-class-ledgers';
const NOTICE_NAMESPACE = 'admin-notices-list';
const DOCUMENT_NAMESPACE = 'admin-document-requirements';

const SENSITIVE_ACTIONS = new Set([
  'finance_payment',
  'receipt_send',
  'notice_send',
  'meeting_create',
  'data_update',
]);

const SCHOOL_ONLY_MESSAGE =
  `I am designed to assist only with ${SCHOOL_NAME}. I can help with this school's ERP data, workflows, finance, attendance, examinations, notices, events, staff, classes, subjects, meetings, and documents.`;

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

const formatCurrency = (value) =>
  `Rs. ${Math.round(parseAmount(value)).toLocaleString('en-IN')}`;

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

const normalizeProvider = (value = '') => {
  const provider = normalizeText(value);
  if (provider === 'grok') return 'groq';
  return provider;
};

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

const getPaidFees = (student = {}) =>
  parseAmount(student.paidFees || student.collectedFees || student.feesPaid || student.paid);

const getPendingFees = (student = {}) =>
  parseAmount(student.pendingFees || student.feePending || student.balanceFees || student.unpaidFees || student.dueAmount);

const getAssignedFees = (student = {}) => {
  const explicit = parseAmount(
    student.yearlyFee ||
    student.annualFee ||
    student.totalFees ||
    student.assignedFees ||
    student.feeAmount ||
    student.totalAssigned
  );
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
    .filter(Boolean);

  if (!terms.length) return students.slice(0, 10).map(normalizeStudent);

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
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, 20);
};

const findOneStudent = async (query = '') => {
  const students = await getStudents();
  const matches = findStudents(students, query);
  return { students, matches, student: matches[0] || null };
};

const readSchoolSnapshot = async () => {
  const [students, classes, financeRecords, notices, documents, examinationRecord] =
    await Promise.all([
      getModuleValue(STUDENT_NAMESPACE, []),
      getModuleValue(CLASS_NAMESPACE, []),
      getModuleValue(FINANCE_NAMESPACE, []),
      getModuleValue(NOTICE_NAMESPACE, []),
      getModuleValue(DOCUMENT_NAMESPACE, {}),
      ExaminationState.findOne().sort({ updatedAt: -1 }),
    ]);

  const normalizedStudents = (Array.isArray(students) ? students : []).map(normalizeStudent);
  const classNames = new Set();
  (Array.isArray(classes) ? classes : []).forEach((item) =>
    classNames.add(item.name || item.className || item.class)
  );
  normalizedStudents.forEach((student) => classNames.add(student.className));

  return {
    students: normalizedStudents,
    classes: [...classNames].filter(Boolean),
    financeRecords: Array.isArray(financeRecords) ? financeRecords : [],
    notices: Array.isArray(notices) ? notices : [],
    documents,
    examinationState: examinationRecord?.state || {},
  };
};

const detectOtherSchoolQuestion = (message = '') => {
  const text = normalizeText(message);
  if (!text.includes('school')) return false;
  if (text.includes('marigold') || text.includes('behror') || text.includes('mgps')) return false;
  return /\b(compare|best|better|recommend|praise|review|about|another|other)\b/.test(text);
};

const extractClassName = (message = '') => {
  const match = String(message).match(/\bclass\s*([0-9]{1,2}|nursery|lkg|ukg)\b/i);
  if (!match) return '';
  const value = match[1].toUpperCase();
  if (['NURSERY', 'LKG', 'UKG'].includes(value)) return value.charAt(0) + value.slice(1).toLowerCase();
  return `Class ${Number(value)}`;
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

const buildClassAnalytics = async (className = '') => {
  const snapshot = await readSchoolSnapshot();
  const classStudents = snapshot.students.filter(
    (student) => !className || student.className.toLowerCase() === className.toLowerCase()
  );
  const totalAssigned = classStudents.reduce((sum, student) => sum + student.yearlyFee, 0);
  const totalPaid = classStudents.reduce((sum, student) => sum + student.paidFees, 0);
  const totalPending = classStudents.reduce((sum, student) => sum + student.pendingFees, 0);
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
    feeChart: [
      { name: 'Paid', value: totalPaid },
      { name: 'Pending', value: totalPending },
    ],
    attendanceChart: [
      { name: 'Present', value: averageAttendance },
      { name: 'Absent/Unmarked', value: Math.max(0, 100 - averageAttendance) },
    ],
    table: classStudents.map((student) => ({
      admissionNumber: student.admissionNumber,
      name: student.name,
      className: student.className,
      paidFees: student.paidFees,
      pendingFees: student.pendingFees,
      attendancePercentage: student.attendancePercentage,
    })),
  };
};

const buildLocalAssistantResponse = async (message = '', auth = {}) => {
  if (detectOtherSchoolQuestion(message)) {
    return {
      text: SCHOOL_ONLY_MESSAGE,
      elements: [],
      actions: [],
    };
  }

  const lower = normalizeText(message);
  const className = extractClassName(message);

  if (lower.includes('pending fee') || lower.includes('pending fees') || lower.includes('finance')) {
    const analytics = await buildClassAnalytics(className);
    return {
      text: className
        ? `Here is the finance summary for ${className} at ${SCHOOL_NAME}. Pending fees are ${formatCurrency(analytics.summary.totalPending)}.`
        : `Here is the finance summary for ${SCHOOL_NAME}. Pending fees across visible records are ${formatCurrency(analytics.summary.totalPending)}.`,
      elements: [
        { type: 'chart', chartType: 'pie', title: 'Fee Paid vs Pending', data: analytics.feeChart },
        { type: 'table', title: 'Student Finance Rows', rows: analytics.table.slice(0, 12) },
      ],
      actions: [],
    };
  }

  if (lower.includes('attendance')) {
    const analytics = await buildClassAnalytics(className);
    return {
      text: `${analytics.className} average attendance is ${analytics.summary.averageAttendance}%.`,
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
        text: 'Fee payment and receipt generation through AI action mode is available only to Admin users.',
        elements: [],
        actions: [],
      };
    }

    const amount = extractAmount(message);
    const { student } = await findOneStudent(message);
    if (!student || !amount) {
      return {
        text: 'Please provide the student admission number/name and the fee amount. I will show a confirmation modal before saving any payment.',
        elements: student ? [{ type: 'student-card', student }] : [],
        actions: [],
      };
    }

    return {
      text: `I found ${student.name} (${student.admissionNumber}). I can record a payment of ${formatCurrency(amount)} and generate a receipt after confirmation.`,
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

  if (lower.includes('student') || lower.includes('admission') || lower.includes('father')) {
    const { matches, student } = await findOneStudent(message);
    if (!student) {
      return {
        text: 'I could not find a matching student in the Marigold ERP records. Try admission number, student name, father name, class, or mobile number.',
        elements: [],
        actions: [],
      };
    }
    if (!canReadStudent(auth, student, 'full')) {
      return {
        text: 'You do not have permission to view this student profile through the AI assistant.',
        elements: [],
        actions: [],
      };
    }

    const details = await buildStudentDetails(student);
    return {
      text: `Here are the available ERP details for ${student.name} (${student.admissionNumber}) from ${SCHOOL_NAME}.`,
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

  return {
    text: `I am the AI assistant for ${SCHOOL_NAME}. I can help with students, parents, fees, attendance, examinations, assignments, notices, events, staff, classes, subjects, meetings, documents, and admin-confirmed ERP actions.`,
    elements: [],
    actions: [],
  };
};

const getProviderSequence = (requestedProvider = '') => {
  const values = [
    requestedProvider,
    process.env.DEFAULT_AI_PROVIDER,
    'groq',
    'gemini',
  ]
    .map((value) => normalizeProvider(value))
    .filter((value) => value === 'gemini' || value === 'groq');
  return [...new Set(values)];
};

const callGemini = async ({ message, history, context }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
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
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  `ERP context: ${JSON.stringify(context).slice(0, 12000)}`,
                  `Conversation history: ${JSON.stringify(history || []).slice(0, 8000)}`,
                  `Admin message: ${message}`,
                ].join('\n\n'),
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
  return text || '';
};

const callGroq = async ({ message, history, context }) => {
  const apiKey = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) {
    throw new Error('Groq API key is not configured.');
  }

  const model = process.env.GROQ_MODEL || process.env.GROK_MODEL || 'llama-3.1-8b-instant';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        {
          role: 'user',
          content: [
            `ERP context: ${JSON.stringify(context).slice(0, 12000)}`,
            `Conversation history: ${JSON.stringify(history || []).slice(0, 8000)}`,
            `Admin message: ${message}`,
          ].join('\n\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq request failed with status ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content || '';
};

const callProvider = async ({ provider, message, history, context }) => {
  const attempts = [];
  for (const candidate of getProviderSequence(provider)) {
    try {
      const text =
        candidate === 'gemini'
          ? await callGemini({ message, history, context })
          : await callGroq({ message, history, context });
      if (text) return { provider: candidate, text, attempts };
      attempts.push({ provider: candidate, error: 'Provider returned an empty response.' });
    } catch (error) {
      attempts.push({ provider: candidate, error: error.message });
    }
  }

  return { provider: 'development-fallback', text: '', attempts };
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

const getMailConfig = () => {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  const fromName = process.env.EMAIL_FROM_NAME || process.env.GMAIL_FROM_NAME || 'MGPS ERP Portal';
  return { user, pass, fromName, isReady: Boolean(user && pass) };
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
      result.gmail = { status: 'mock', message: 'Gmail is not configured; receipt send was simulated.' };
    } else {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: mailConfig.user,
          pass: mailConfig.pass,
        },
      });
      const info = await transporter.sendMail({
        from: `"${mailConfig.fromName}" <${mailConfig.user}>`,
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
    defaultProvider: defaultProvider === 'gemini' || defaultProvider === 'groq' ? defaultProvider : 'groq',
    providers: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY || process.env.GROK_API_KEY),
    },
    providerRoles: {
      groq: 'fast',
      gemini: 'brain',
    },
    role: request.auth?.role || '',
  });
});

router.post('/chat', async (request, response) => {
  const message = String(request.body.message || '').trim();
  const provider = request.body.provider;
  const history = Array.isArray(request.body.history) ? request.body.history.slice(-12) : [];

  if (!message) {
    response.status(400).json({ message: 'Message is required.' });
    return;
  }

  const local = await buildLocalAssistantResponse(message, request.auth);
  const snapshot = await readSchoolSnapshot();
  const providerContext = {
    schoolName: SCHOOL_NAME,
    role: request.auth?.role,
    studentCount: snapshot.students.length,
    classCount: snapshot.classes.length,
    classes: snapshot.classes,
    financeTotals: (await buildClassAnalytics()).summary,
  };
  const providerResult = await callProvider({ provider, message, history, context: providerContext });
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
  const text = String(request.body.text || '').slice(0, 4000);
  await createAuditLog({
    actionType: 'voice_speak',
    status: 'completed',
    auth: request.auth,
    payload: { textLength: text.length },
  });
  response.json({
    text,
    voice: 'browser-speech-synthesis',
    message: 'Use the browser SpeechSynthesis API for secure client-side text-to-speech.',
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
    const result = await applyPayment(request.body, request.auth);
    await createAuditLog({
      actionType: 'finance_payment',
      status: 'completed',
      auth: request.auth,
      target: { admissionNumber: request.body.admissionNumber },
      payload: { amount: request.body.amount, mode: request.body.mode },
      result,
    });
    response.json(result);
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
      const result = await applyPayment(payload, request.auth);
      await createAuditLog({
        actionType: action,
        status: 'completed',
        auth: request.auth,
        target: { admissionNumber: payload.admissionNumber },
        payload,
        result,
      });
      response.json({ action, result });
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

export default router;
