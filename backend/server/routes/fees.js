import express from 'express';
import AiReceipt from '../models/AiReceipt.js';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

const STUDENTS_NAMESPACE = 'admin-student-management-students';
const CLASS_PREFERENCES_NAMESPACE = 'admin-class-preferences';

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

// Mirror of frontend/src/components/common/financeData.js parseAmount.
const parseAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const amount = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
};

const getFirstAmount = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return parseAmount(source[key]);
    }
  }
  return 0;
};

const normalizeAdmission = (value = '') => String(value || '').trim().toUpperCase();

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getRecordField = (record = {}, keys = []) => {
  const raw = record.rawProfile || {};
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') {
      return record[key];
    }
    if (raw?.[key] !== undefined && raw?.[key] !== null && raw?.[key] !== '') {
      return raw[key];
    }
  }
  return '';
};

const getRecordAdmission = (record = {}) =>
  normalizeAdmission(
    record.admissionNumber || record.id || record.rawProfile?.admissionNumber || ''
  );

const normalizeClassName = (value = '') => String(value || '').trim();

// Mirror of frontend getClassOrder: value is array of strings or { name/className/class }.
const getClassOrder = (classPreferences = []) => {
  const list = Array.isArray(classPreferences) ? classPreferences : [];
  return list
    .map((entry) =>
      typeof entry === 'string' ? entry : entry?.name || entry?.className || entry?.class || ''
    )
    .map(normalizeClassName)
    .filter(Boolean);
};

// Build a lowercase-name -> rank index. Unknown classes sort last (MAX_SAFE_INTEGER).
const buildClassRankIndex = (classOrder = []) => {
  const index = new Map();
  classOrder.forEach((name, position) => {
    const key = normalizeClassName(name).toLowerCase();
    if (key && !index.has(key)) index.set(key, position);
  });
  return index;
};

const classRankIn = (className, rankIndex) => {
  const key = normalizeClassName(className).toLowerCase();
  const rank = rankIndex.get(key);
  return rank === undefined ? Number.MAX_SAFE_INTEGER : rank;
};

// Mirror of frontend normalizeLedgerPayment.
const normalizeLedgerPayment = (payment = {}) => ({
  amount: parseAmount(payment.amount ?? payment.amountPaid ?? payment.paid),
  date: payment.date || payment.paidAt || payment.createdAt || '',
  mode: payment.mode || 'School Desk',
  receiptNo: payment.receiptNo || payment.id || '',
});

// Mirror of frontend normalizeLedgerEntry.
const normalizeLedgerEntry = (entry = {}) => {
  const assigned = Math.max(
    0,
    parseAmount(entry.assigned ?? entry.totalFees ?? entry.amount ?? entry.assignedFees)
  );
  const paid = Math.max(0, parseAmount(entry.paid ?? entry.paidFees ?? entry.collected));
  const payments = Array.isArray(entry.payments) ? entry.payments.map(normalizeLedgerPayment) : [];
  return {
    className: normalizeClassName(entry.className || entry.class),
    assigned,
    paid,
    payments,
  };
};

const entryPending = (entry = {}) =>
  Math.max(0, parseAmount(entry.assigned) - parseAmount(entry.paid));

// Mirror of frontend entryStatus.
const entryStatus = (entry = {}) => {
  const assigned = parseAmount(entry.assigned);
  const paid = parseAmount(entry.paid);
  if (assigned > 0 && entryPending(entry) === 0) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Due';
};

// Mirror of frontend ensureFeeLedger: use record.feeLedger when present, else migrate legacy.
const ensureFeeLedger = (record = {}) => {
  if (Array.isArray(record.feeLedger) && record.feeLedger.length) {
    return record.feeLedger.map(normalizeLedgerEntry).filter((entry) => entry.className);
  }

  const className = normalizeClassName(
    getRecordField(record, ['className', 'class', 'targetClass'])
  );
  const paid = getFirstAmount(record, ['paidFees', 'collectedFees', 'feesPaid', 'paid']);
  const pending = getFirstAmount(record, [
    'pendingFees',
    'feePending',
    'balanceFees',
    'unpaidFees',
    'dueAmount',
  ]);
  const assigned =
    getFirstAmount(record, [
      'yearlyFee',
      'annualFee',
      'totalFees',
      'assignedFees',
      'feeAmount',
      'totalAssigned',
    ]) || paid + pending;

  if (!className) return [];
  if (!assigned && !paid) return [normalizeLedgerEntry({ className, assigned: 0, paid: 0 })];

  const payments = (Array.isArray(record.paymentHistory) ? record.paymentHistory : []).map(
    (entry) => ({
      id: entry.id,
      amount: getFirstAmount(entry, ['amountPaid', 'amount', 'paid']),
      date: entry.paidAt || entry.date || entry.createdAt,
      mode: entry.mode || 'School Desk',
      receiptNo: entry.receiptNo || entry.id,
    })
  );

  return [normalizeLedgerEntry({ className, assigned, paid, payments })];
};

// Mirror of frontend ledgerTotals.
const ledgerTotals = (feeLedger = []) =>
  feeLedger.reduce(
    (acc, entry) => {
      const assigned = parseAmount(entry.assigned);
      const paid = parseAmount(entry.paid);
      acc.assigned += assigned;
      acc.paid += paid;
      acc.pending += Math.max(0, assigned - paid);
      return acc;
    },
    { assigned: 0, paid: 0, pending: 0 }
  );

const buildTransport = (record) => {
  const route = getRecordField(record, ['busRoute']);
  const pickupPoint = getRecordField(record, ['pickupPoint']);
  const pickupTime = getRecordField(record, ['pickupTime']);
  const vehicleNo = getRecordField(record, ['vehicleNo']);
  const driver = getRecordField(record, ['driver']);
  const contact = getRecordField(record, ['transportContact']);

  const routeValue = String(route || '').trim();
  const opted = routeValue && !/^self$/i.test(routeValue);

  return {
    route: routeValue || 'Self',
    pickupPoint: opted ? String(pickupPoint || '').trim() || 'Not assigned' : 'Not applicable',
    pickupTime: opted ? String(pickupTime || '').trim() || 'Not assigned' : 'Not applicable',
    vehicleNo: opted ? String(vehicleNo || '').trim() || 'Not assigned' : 'Not applicable',
    driver: opted ? String(driver || '').trim() || 'Not assigned' : 'Not applicable',
    contact: opted ? String(contact || '').trim() || 'Not assigned' : 'Not applicable',
  };
};

// AI-desk receipts for a student, normalized as ledger payments (mode 'AI Assistant').
const loadAiPayments = async (admissionNumber) => {
  let aiReceipts = [];
  try {
    // AiReceipt.admissionNumber is stored un-normalized, so match case-insensitively.
    const admissionPattern = new RegExp(`^${escapeRegExp(admissionNumber)}$`, 'i');
    aiReceipts = await AiReceipt.find({ admissionNumber: admissionPattern }).lean();
  } catch {
    aiReceipts = [];
  }

  return aiReceipts.map((receipt) =>
    normalizeLedgerPayment({
      amount: receipt.amountPaid,
      date: receipt.createdAt || '',
      mode: receipt.mode || 'AI Assistant',
      receiptNo: receipt.receiptNo,
    })
  );
};

// Shape a normalized ledger entry into the response's classLedger row.
const buildLedgerRow = (entry) => {
  const assigned = parseAmount(entry.assigned);
  const paid = parseAmount(entry.paid);
  return {
    className: entry.className,
    assigned,
    paid,
    pending: Math.max(0, assigned - paid),
    status: entryStatus(entry),
    payments: entry.payments.map((payment) => ({
      amount: parseAmount(payment.amount),
      date: payment.date || '',
      mode: payment.mode || 'School Desk',
      receiptNo: payment.receiptNo || '',
    })),
  };
};

const emptyTransport = () => ({
  route: 'Self',
  pickupPoint: 'Not applicable',
  pickupTime: 'Not applicable',
  vehicleNo: 'Not applicable',
  driver: 'Not applicable',
  contact: 'Not applicable',
});

const buildPerStudent = async (admissionNumber, record, fallbackName = '', rankIndex = new Map()) => {
  const normalizedAdmission = normalizeAdmission(admissionNumber);

  if (!record) {
    return {
      admissionNumber: normalizedAdmission,
      name: fallbackName || 'Student',
      className: '',
      hasRecord: false,
      status: 'Clear',
      totals: { assigned: 0, paid: 0, pending: 0 },
      nextDueClass: '',
      concession: 0,
      classLedger: [],
      transport: emptyTransport(),
    };
  }

  const currentClassName = normalizeClassName(
    getRecordField(record, ['className', 'class', 'targetClass'])
  );

  // Build the normalized ledger (feeLedger when present, else migrate legacy fields).
  const ledger = ensureFeeLedger(record);

  // Merge AI-desk receipts into the CURRENT-class entry's payments (paid stays a mirror).
  const aiPayments = await loadAiPayments(normalizedAdmission);
  if (aiPayments.length) {
    const currentKey = currentClassName.toLowerCase();
    let currentEntry = ledger.find((entry) => entry.className.toLowerCase() === currentKey);
    if (!currentEntry && currentClassName) {
      currentEntry = normalizeLedgerEntry({ className: currentClassName, assigned: 0, paid: 0 });
      ledger.push(currentEntry);
    } else if (!currentEntry && ledger.length) {
      currentEntry = ledger[0];
    }
    if (currentEntry) {
      currentEntry.payments = [...currentEntry.payments, ...aiPayments];
    }
  }

  // Sort by class-preference order; unknown classes go last.
  const sortedLedger = [...ledger].sort(
    (a, b) => classRankIn(a.className, rankIndex) - classRankIn(b.className, rankIndex)
  );

  const totals = ledgerTotals(sortedLedger);
  const status = totals.pending > 0 ? 'Pending' : 'Clear';
  const nextDueEntry = sortedLedger.find((entry) => entryPending(entry) > 0);
  const nextDueClass = nextDueEntry ? nextDueEntry.className : '';
  const concession = parseAmount(record.feeConcession) || 0;

  return {
    admissionNumber: normalizedAdmission,
    name:
      getRecordField(record, ['name', 'displayName', 'studentName']) || fallbackName || 'Student',
    className: currentClassName,
    hasRecord: true,
    status,
    totals,
    nextDueClass,
    concession,
    classLedger: sortedLedger.map(buildLedgerRow),
    transport: buildTransport(record),
  };
};

const loadStudentRecords = async () => {
  const record = await ModuleState.findOne({ namespace: STUDENTS_NAMESPACE }).lean();
  const value = record?.value;
  return Array.isArray(value) ? value : [];
};

const loadClassRankIndex = async () => {
  const record = await ModuleState.findOne({ namespace: CLASS_PREFERENCES_NAMESPACE }).lean();
  return buildClassRankIndex(getClassOrder(record?.value));
};

router.get('/me', ensureMongo, requireRole('student'), async (request, response) => {
  const profiles = Array.isArray(request.auth?.studentProfiles) ? request.auth.studentProfiles : [];
  const admissionNumbers = [
    ...new Set(
      profiles
        .map((profile) => normalizeAdmission(profile.admissionNumber || profile.id))
        .filter(Boolean)
    ),
  ];

  const records = await loadStudentRecords();
  const recordByAdmission = new Map();
  records.forEach((entry) => {
    const key = getRecordAdmission(entry);
    if (key && !recordByAdmission.has(key)) {
      recordByAdmission.set(key, entry);
    }
  });

  const rankIndex = await loadClassRankIndex();

  const students = [];
  for (const profile of profiles) {
    const admissionNumber = normalizeAdmission(profile.admissionNumber || profile.id);
    if (!admissionNumber) continue;
    const record = recordByAdmission.get(admissionNumber) || null;
    students.push(
      await buildPerStudent(
        admissionNumber,
        record,
        profile.displayName || profile.name || '',
        rankIndex
      )
    );
  }

  response.json({ students });
});

router.get(
  '/student/:admissionNumber',
  ensureMongo,
  requireRole('admin', 'clerk', 'teacher'),
  async (request, response) => {
    const admissionNumber = normalizeAdmission(request.params.admissionNumber);

    if (!admissionNumber) {
      response.status(404).json({ message: 'Student fee record was not found.' });
      return;
    }

    const records = await loadStudentRecords();
    const record = records.find((entry) => getRecordAdmission(entry) === admissionNumber) || null;

    if (!record) {
      response.status(404).json({ message: 'Student fee record was not found.' });
      return;
    }

    // Teachers may only look up students in their own allotted classes (avoid IDOR).
    if (request.auth?.role === 'teacher') {
      const allotted = (Array.isArray(request.auth.allottedClasses) ? request.auth.allottedClasses : [])
        .map((entry) => String(entry).trim().toLowerCase());
      const studentClass = String(getRecordField(record, ['className', 'class', 'targetClass']) || '')
        .trim()
        .toLowerCase();
      if (!studentClass || !allotted.includes(studentClass)) {
        response.status(403).json({
          message: 'You can only view fee records for students in your allotted classes.',
        });
        return;
      }
    }

    const rankIndex = await loadClassRankIndex();
    const student = await buildPerStudent(admissionNumber, record, '', rankIndex);
    response.json({ student });
  }
);

export default router;
