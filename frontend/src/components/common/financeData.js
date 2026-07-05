const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const parseAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const amount = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
};

export const formatCurrency = (amount) => `Rs. ${Math.round(parseAmount(amount)).toLocaleString('en-IN')}`;

export const getFirstAmount = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return parseAmount(source[key]);
    }
  }
  return 0;
};

export const getStudentClassName = (student = {}) =>
  student.className || student.class || student.rawProfile?.targetClass || 'Unassigned';

export const getStudentDisplayName = (student = {}) =>
  student.displayName || student.name || student.rawProfile?.studentName || 'Student';

export const getStudentAdmissionNumber = (student = {}) =>
  student.admissionNumber || student.admNo || student.id || '';

export const getPaidFees = (student = {}) =>
  getFirstAmount(student, ['paidFees', 'collectedFees', 'feesPaid', 'paid']);

export const getPendingFees = (student = {}) =>
  getFirstAmount(student, ['pendingFees', 'feePending', 'balanceFees', 'unpaidFees', 'dueAmount']);

export const getAssignedFees = (student = {}) => {
  const assigned = getFirstAmount(student, [
    'yearlyFee',
    'annualFee',
    'totalFees',
    'assignedFees',
    'feeAmount',
    'totalAssigned',
  ]);

  return assigned || getPaidFees(student) + getPendingFees(student);
};

export const normalizeFinanceStudent = (student = {}, index = 0) => {
  const admissionNumber = getStudentAdmissionNumber(student) || `student-${index + 1}`;
  const paidFees = getPaidFees(student);
  const pendingFees = getPendingFees(student);

  return {
    ...student,
    id: student.id || admissionNumber,
    admissionNumber,
    admNo: admissionNumber,
    displayName: getStudentDisplayName(student),
    name: getStudentDisplayName(student),
    className: getStudentClassName(student),
    class: getStudentClassName(student),
    fatherName: student.fatherName || student.rawProfile?.fatherName || '',
    motherName: student.motherName || student.rawProfile?.motherName || '',
    guardianName: student.guardianName || student.rawProfile?.guardianName || '',
    guardianPhone:
      student.guardianPhone ||
      student.mobile ||
      student.mobileNo ||
      student.rawProfile?.guardianMobile ||
      student.rawProfile?.mobileNo ||
      '',
    guardianEmail: student.guardianEmail || student.email || student.rawProfile?.email || '',
    paidFees,
    pendingFees,
    yearlyFee: getAssignedFees(student) || paidFees + pendingFees,
    status: student.status || 'Active',
  };
};

const getMonthIndex = (entry = {}) => {
  const monthValue = entry.month || entry.monthName || entry.feeMonth || entry.period;
  if (monthValue) {
    const monthText = String(monthValue).slice(0, 3).toLowerCase();
    const index = MONTHS.findIndex((month) => month.toLowerCase() === monthText);
    if (index >= 0) return index;
  }

  const dateValue = entry.date || entry.paidAt || entry.createdAt || entry.receiptDate || entry.dueDate;
  const parsedDate = dateValue ? new Date(dateValue) : null;
  return parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : new Date().getMonth();
};

export const getMonthlyEntries = (student = {}) => [
  ...(Array.isArray(student.feeInstallments) ? student.feeInstallments : []),
  ...(Array.isArray(student.monthlyFees) ? student.monthlyFees : []),
  ...(Array.isArray(student.financeLedger) ? student.financeLedger : []),
  ...(Array.isArray(student.feeLedger) ? student.feeLedger : []),
  ...(Array.isArray(student.paymentHistory) ? student.paymentHistory : []),
  ...(Array.isArray(student.feePayments) ? student.feePayments : []),
  ...(Array.isArray(student.payments) ? student.payments : []),
  ...(Array.isArray(student.receipts) ? student.receipts : []),
];

const getEntryCollected = (entry = {}) => {
  const explicit = getFirstAmount(entry, ['collected', 'collectedFees', 'paid', 'paidFees', 'amountPaid']);
  if (explicit > 0) return explicit;
  const amount = getFirstAmount(entry, ['amount', 'value']);
  const status = String(entry.status || entry.type || '').toLowerCase();
  return status.includes('paid') || status.includes('collect') || status.includes('receipt') ? amount : 0;
};

const getEntryPending = (entry = {}) => {
  const explicit = getFirstAmount(entry, ['pending', 'pendingFees', 'due', 'dueAmount', 'balance', 'balanceFees']);
  if (explicit > 0) return explicit;
  const amount = getFirstAmount(entry, ['amount', 'value']);
  const status = String(entry.status || entry.type || '').toLowerCase();
  return status.includes('pending') || status.includes('due') || status.includes('balance') ? amount : 0;
};

export const buildFinanceAnalytics = (students = [], classNames = []) => {
  const normalizedStudents = students.map(normalizeFinanceStudent);
  const classSet = new Set(classNames);
  normalizedStudents.forEach((student) => classSet.add(student.className));
  const classes = [...classSet].filter(Boolean);
  const chartData = MONTHS.map((month) => {
    const row = { month };
    classes.forEach((className) => {
      row[className] = 0;
      row[`${className} Pending`] = 0;
    });
    return row;
  });

  normalizedStudents.forEach((student) => {
    const entries = getMonthlyEntries(student);
    if (entries.length) {
      entries.forEach((entry) => {
        const monthIndex = getMonthIndex(entry);
        chartData[monthIndex][student.className] += getEntryCollected(entry);
        chartData[monthIndex][`${student.className} Pending`] += getEntryPending(entry);
      });
      return;
    }

    const currentMonthIndex = new Date().getMonth();
    chartData[currentMonthIndex][student.className] += student.paidFees;
    chartData[currentMonthIndex][`${student.className} Pending`] += student.pendingFees;
  });

  // Roll up per-class numbers into single Total Collected / Total Pending
  // series per month so charts stay readable (tooltips can still break down by class).
  chartData.forEach((row) => {
    let collected = 0;
    let pending = 0;
    classes.forEach((className) => {
      collected += Number(row[className] || 0);
      pending += Number(row[`${className} Pending`] || 0);
    });
    row.Collected = collected;
    row.Pending = pending;
  });

  return { classes, chartData, normalizedStudents };
};

export const buildClassFinanceSummaries = (students = [], classNames = []) => {
  const normalizedStudents = students.map(normalizeFinanceStudent);
  const classSet = new Set(classNames);
  normalizedStudents.forEach((student) => classSet.add(student.className));

  return [...classSet].filter(Boolean).map((className) => {
    const classStudents = normalizedStudents.filter((student) => student.className === className);
    const collectedValue = classStudents.reduce((total, student) => total + student.paidFees, 0);
    const pendingValue = classStudents.reduce((total, student) => total + student.pendingFees, 0);
    const totalValue = collectedValue + pendingValue;

    return {
      id: className,
      className,
      studentCount: classStudents.length,
      collectedValue,
      pendingValue,
      collectedPercent: totalValue ? Math.round((collectedValue / totalValue) * 100) : 0,
      pendingPercent: totalValue ? Math.round((pendingValue / totalValue) * 100) : 0,
    };
  });
};

export const getFamilyKey = (student = {}) => {
  const explicit = student.familyId || student.parentId || student.siblingGroupId || student.rawProfile?.familyId;
  if (explicit) return String(explicit);

  const parts = [
    student.fatherName || student.rawProfile?.fatherName,
    student.motherName || student.rawProfile?.motherName,
    student.guardianPhone || student.mobile || student.rawProfile?.mobileNo,
  ]
    .filter(Boolean)
    .map((part) => String(part).trim().toLowerCase());

  return parts.length ? parts.join('|') : getStudentAdmissionNumber(student);
};

export const buildFamilyLedger = (students = [], selectedAdmissionNumber = '') => {
  const normalizedStudents = students.map(normalizeFinanceStudent);
  const selected =
    normalizedStudents.find((student) => student.admissionNumber === selectedAdmissionNumber) ||
    normalizedStudents[0];

  if (!selected) {
    return {
      familyId: '',
      fatherName: '',
      motherName: '',
      contact: '',
      guardianEmail: '',
      category: '',
      students: [],
      totalPending: 0,
    };
  }

  const familyKey = getFamilyKey(selected);
  const familyStudents = normalizedStudents.filter((student) => getFamilyKey(student) === familyKey);
  const ledgerStudents = familyStudents.length ? familyStudents : [selected];

  return {
    familyId: selected.familyId || selected.parentId || selected.siblingGroupId || `FAM-${familyKey.slice(0, 12).toUpperCase()}`,
    fatherName: selected.fatherName,
    motherName: selected.motherName,
    contact: selected.guardianPhone,
    guardianEmail: selected.guardianEmail,
    category: selected.category || '',
    selectedStudent: selected,
    students: ledgerStudents,
    totalPending: ledgerStudents.reduce((total, student) => total + student.pendingFees, 0),
  };
};

export const allocatePayment = (familyStudents = [], amount = 0, mode = 'family', selectedId = '') => {
  let remaining = parseAmount(amount);
  const allocations = [];
  const candidates =
    mode === 'individual'
      ? familyStudents.filter((student) => student.id === selectedId || student.admissionNumber === selectedId)
      : familyStudents.filter((student) => student.pendingFees > 0);

  if (mode === 'family') {
    candidates.forEach((student) => {
      if (remaining <= 0 || student.pendingFees <= 0) return;
      const share = Math.min(student.pendingFees, remaining / Math.max(1, candidates.length - allocations.length));
      const allocated = Number(share.toFixed(2));
      remaining -= allocated;
      allocations.push({ studentId: student.id, admissionNumber: student.admissionNumber, name: student.name, allocated });
    });
    return allocations;
  }

  const target = candidates[0];
  if (!target) return [];
  const allocated = Math.min(target.pendingFees, remaining);
  return [{ studentId: target.id, admissionNumber: target.admissionNumber, name: target.name, allocated }];
};

export const applyPaymentToStudents = (students = [], allocations = []) => {
  const allocationByAdmission = new Map(allocations.map((item) => [item.admissionNumber, item.allocated]));

  return students.map((student, index) => {
    const normalized = normalizeFinanceStudent(student, index);
    const allocated = allocationByAdmission.get(normalized.admissionNumber) || 0;
    if (!allocated) return student;

    const paidFees = normalized.paidFees + allocated;
    const pendingFees = Math.max(0, normalized.pendingFees - allocated);
    const nextPayment = {
      id: `PAY-${Date.now()}-${normalized.admissionNumber}`,
      amountPaid: allocated,
      status: 'paid',
      paidAt: new Date().toISOString(),
    };

    return {
      ...student,
      id: normalized.id,
      admissionNumber: normalized.admissionNumber,
      displayName: normalized.displayName,
      name: normalized.name,
      className: normalized.className,
      class: normalized.class,
      guardianPhone: normalized.guardianPhone,
      guardianEmail: normalized.guardianEmail,
      paidFees,
      pendingFees,
      yearlyFee: Math.max(normalized.yearlyFee, paidFees + pendingFees),
      paymentHistory: [...(Array.isArray(student.paymentHistory) ? student.paymentHistory : []), nextPayment],
    };
  });
};

export const buildFeeAssignmentPayload = (student = {}, totalFees = 0, note = '') => {
  const normalized = normalizeFinanceStudent(student);
  const assignedFees = parseAmount(totalFees);
  const pendingFees = Math.max(0, assignedFees - normalized.paidFees);

  return {
    id: `FEE-${Date.now()}-${normalized.admissionNumber}`,
    admissionNumber: normalized.admissionNumber,
    name: normalized.name,
    className: normalized.className,
    fatherName: normalized.fatherName,
    guardianEmail: normalized.guardianEmail,
    guardianPhone: normalized.guardianPhone,
    totalFees: assignedFees,
    previousTotalFees: normalized.yearlyFee,
    paidFees: normalized.paidFees,
    pendingFees,
    note: String(note || '').trim(),
    assignedAt: new Date().toLocaleString(),
  };
};

export const applyFeeAssignmentToStudents = (students = [], assignment = {}) =>
  students.map((student, index) => {
    const normalized = normalizeFinanceStudent(student, index);
    if (normalized.admissionNumber !== assignment.admissionNumber) return student;

    const totalFees = parseAmount(assignment.totalFees);
    const paidFees = normalized.paidFees;
    const pendingFees = Math.max(0, totalFees - paidFees);
    const assignmentEntry = {
      ...assignment,
      totalFees,
      paidFees,
      pendingFees,
      previousTotalFees: normalized.yearlyFee,
    };

    return {
      ...student,
      id: normalized.id,
      admissionNumber: normalized.admissionNumber,
      displayName: normalized.displayName,
      name: normalized.name,
      className: normalized.className,
      class: normalized.class,
      guardianPhone: normalized.guardianPhone,
      guardianEmail: normalized.guardianEmail,
      paidFees,
      pendingFees,
      yearlyFee: totalFees,
      annualFee: totalFees,
      assignedFees: totalFees,
      feeAssignments: [
        ...(Array.isArray(student.feeAssignments) ? student.feeAssignments : []),
        assignmentEntry,
      ],
      rawProfile: {
        ...(student.rawProfile || {}),
        yearlyFee: totalFees,
        annualFee: totalFees,
        assignedFees: totalFees,
        paidFees,
        pendingFees,
      },
    };
  });

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildFeeAssignmentNoticeMessage = (assignment = {}) => {
  const totalFees = formatCurrency(assignment.totalFees);
  const paidFees = formatCurrency(assignment.paidFees);
  const pendingFees = formatCurrency(assignment.pendingFees);
  const studentLine = `${assignment.name || 'Student'} (${assignment.admissionNumber || 'Admission No. pending'})`;
  const noteLine = assignment.note ? `Accounts note: ${assignment.note}` : '';
  const safeStudentLine = escapeHtml(studentLine);
  const safeClassName = escapeHtml(assignment.className || '-');
  const safeNote = escapeHtml(assignment.note || '');
  const safeAssignedAt = escapeHtml(assignment.assignedAt || new Date().toLocaleString());
  const text = [
    `Dear ${assignment.fatherName || 'Parent/Guardian'},`,
    '',
    'This is an official fee assignment notice from Marigold Secondary School, Behror.',
    '',
    `Student: ${studentLine}`,
    `Class: ${assignment.className || '-'}`,
    `Total fee fixed: ${totalFees}`,
    `Already paid: ${paidFees}`,
    `Current pending balance: ${pendingFees}`,
    `Assignment date: ${assignment.assignedAt || new Date().toLocaleString()}`,
    noteLine,
    '',
    'Please keep this message for your records. For any clarification, contact the school accounts office.',
    '',
    'Regards,',
    'Accounts Department',
    'Marigold Secondary School, Behror',
  ].filter(Boolean).join('\n');

  return {
    to: assignment.guardianEmail,
    subject: `Fee Assigned: ${studentLine}`,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
        <h2 style="margin:0 0 8px">Marigold Secondary School, Behror</h2>
        <p style="margin:0 0 16px">Official fee assignment notice</p>
        <table style="border-collapse:collapse;width:100%;max-width:560px">
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Student</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${safeStudentLine}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Class</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${safeClassName}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Total fee fixed</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${totalFees}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Already paid</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${paidFees}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Pending balance</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${pendingFees}</td></tr>
          <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Date</strong></td><td style="padding:8px;border:1px solid #e5e7eb">${safeAssignedAt}</td></tr>
        </table>
        ${assignment.note ? `<p style="margin-top:14px"><strong>Accounts note:</strong> ${safeNote}</p>` : ''}
        <p style="margin-top:16px">Please keep this message for your records. For any clarification, contact the school accounts office.</p>
        <p style="margin-top:20px">Regards,<br/>Accounts Department<br/>Marigold Secondary School, Behror</p>
      </div>
    `,
  };
};

export const buildReceiptPayload = (familyLedger, amount, breakdown, mode) => ({
  receiptNo: `REC-${Date.now().toString().slice(-6)}`,
  timestamp: new Date().toLocaleString(),
  amountPaid: parseAmount(amount),
  mode,
  breakdown,
  familyDetails: {
    familyId: familyLedger.familyId,
    fatherName: familyLedger.fatherName,
    motherName: familyLedger.motherName,
    contact: familyLedger.contact,
    guardianEmail: familyLedger.guardianEmail,
    category: familyLedger.category,
  },
});

/* ============================================================================
   CLASS-WISE FEE LEDGER  (per-student, per-class) + WATERFALL ALLOCATION
   ----------------------------------------------------------------------------
   Source of truth on each student record:
     student.feeLedger = [ { className, assigned, paid, note, payments:[
                              { id, amount, date, mode, receiptNo } ] } ]
   pending(entry) = max(assigned - paid, 0).
   Legacy aggregate mirrors (paidFees / pendingFees / yearlyFee / annualFee /
   assignedFees) are always re-synced from the ledger so older readers
   (dashboards, /api/fees, class summaries) keep working unchanged.

   Payment rule (admin-driven, manual): a collected amount waterfalls across a
   student's UNPAID class entries in CLASS-PREFERENCE ORDER (lowest class first),
   e.g. Class 6 pending 5000 + parent pays 7000  ->  Class 6 cleared, 2000 flows
   into Class 7. Family mode repeats this student-by-student across siblings.
   ============================================================================ */

const normalizeClassName = (value = '') => String(value || '').trim();

// Ordered class names from the `admin-class-preferences` namespace value.
export const getClassOrder = (classPreferences = []) => {
  const list = Array.isArray(classPreferences) ? classPreferences : [];
  return list
    .map((entry) =>
      typeof entry === 'string' ? entry : entry?.name || entry?.className || entry?.class || ''
    )
    .map(normalizeClassName)
    .filter(Boolean);
};

const classRankIn = (className, classOrder = []) => {
  const target = normalizeClassName(className).toLowerCase();
  const idx = classOrder.findIndex((c) => normalizeClassName(c).toLowerCase() === target);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
};

let ledgerSeq = 0;
const makePaymentId = () => `PAY-${Date.now()}-${(ledgerSeq += 1)}`;

const normalizeLedgerPayment = (payment = {}) => ({
  id: payment.id || makePaymentId(),
  amount: parseAmount(payment.amount ?? payment.amountPaid ?? payment.paid),
  date: payment.date || payment.paidAt || payment.createdAt || new Date().toISOString(),
  mode: payment.mode || 'School Desk',
  receiptNo: payment.receiptNo || payment.id || '',
});

const normalizeLedgerEntry = (entry = {}) => {
  const assigned = Math.max(0, parseAmount(entry.assigned ?? entry.totalFees ?? entry.amount ?? entry.assignedFees));
  const paid = Math.max(0, parseAmount(entry.paid ?? entry.paidFees ?? entry.collected));
  const payments = Array.isArray(entry.payments) ? entry.payments.map(normalizeLedgerPayment) : [];
  return {
    className: normalizeClassName(entry.className || entry.class),
    assigned,
    paid,
    note: entry.note || '',
    payments,
  };
};

// Always returns a normalized ledger; migrates legacy flat fields when absent.
export const ensureFeeLedger = (student = {}) => {
  if (Array.isArray(student.feeLedger) && student.feeLedger.length) {
    return student.feeLedger.map(normalizeLedgerEntry).filter((entry) => entry.className);
  }

  const className = getStudentClassName(student);
  const assigned = getAssignedFees(student);
  const paid = getPaidFees(student);

  if (!className) return [];
  if (!assigned && !paid) return [normalizeLedgerEntry({ className, assigned: 0, paid: 0 })];

  const payments = (Array.isArray(student.paymentHistory) ? student.paymentHistory : []).map((entry) => ({
    id: entry.id,
    amount: getFirstAmount(entry, ['amountPaid', 'amount', 'paid']),
    date: entry.paidAt || entry.date || entry.createdAt,
    mode: entry.mode || 'School Desk',
    receiptNo: entry.receiptNo || entry.id,
  }));

  return [normalizeLedgerEntry({ className, assigned, paid, payments })];
};

export const entryPending = (entry = {}) =>
  Math.max(0, parseAmount(entry.assigned) - parseAmount(entry.paid));

export const entryStatus = (entry = {}) => {
  const assigned = parseAmount(entry.assigned);
  const paid = parseAmount(entry.paid);
  if (assigned > 0 && entryPending(entry) === 0) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Due';
};

export const sortedFeeLedger = (feeLedger = [], classOrder = []) =>
  [...feeLedger].sort((a, b) => classRankIn(a.className, classOrder) - classRankIn(b.className, classOrder));

export const ledgerTotals = (feeLedger = []) =>
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

export const studentFeeTotals = (student = {}) => ledgerTotals(ensureFeeLedger(student));

export const studentHasPending = (student = {}) => studentFeeTotals(student).pending > 0;

// Write a ledger back onto a student and refresh the legacy aggregate mirrors.
export const applyLedgerToStudent = (student = {}, feeLedger = []) => {
  const totals = ledgerTotals(feeLedger);
  return {
    ...student,
    feeLedger,
    paidFees: totals.paid,
    pendingFees: totals.pending,
    yearlyFee: totals.assigned,
    annualFee: totals.assigned,
    assignedFees: totals.assigned,
  };
};

// Admin assigns (or edits) the fee for ONE class on a student.
export const assignClassFeeToStudent = (student = {}, className, amount, note = '') => {
  const target = normalizeClassName(className);
  if (!target) return student;
  const assigned = Math.max(0, parseAmount(amount));
  const ledger = ensureFeeLedger(student);
  const has = ledger.some((entry) => entry.className.toLowerCase() === target.toLowerCase());
  const nextLedger = has
    ? ledger.map((entry) =>
        entry.className.toLowerCase() === target.toLowerCase()
          ? { ...entry, assigned, note: note || entry.note }
          : entry
      )
    : [...ledger, normalizeLedgerEntry({ className: target, assigned, paid: 0, note })];
  return applyLedgerToStudent(student, nextLedger);
};

// Ensure a (possibly empty) ledger row exists for a class — used on promotion so
// the new class shows up ready for the admin to set its fee.
export const ensureClassRow = (student = {}, className) => {
  const target = normalizeClassName(className);
  if (!target) return student;
  const ledger = ensureFeeLedger(student);
  if (ledger.some((entry) => entry.className.toLowerCase() === target.toLowerCase())) {
    return applyLedgerToStudent(student, ledger);
  }
  return applyLedgerToStudent(student, [...ledger, normalizeLedgerEntry({ className: target, assigned: 0, paid: 0 })]);
};

// Recompute a class entry's paid total from its payments (after edit/delete).
const recomputeEntryPaid = (payments = []) =>
  payments.reduce((sum, p) => sum + Math.max(0, parseAmount(p.amount)), 0);

// Edit ONE payment inside a class entry (amount / date / mode). Recomputes paid
// so the class + student aggregates stay correct. Used to fix data-entry mistakes.
export const editLedgerPayment = (student = {}, className, paymentId, patch = {}) => {
  const target = normalizeClassName(className);
  if (!target || !paymentId) return student;
  const ledger = ensureFeeLedger(student);
  const nextLedger = ledger.map((entry) => {
    if (entry.className.toLowerCase() !== target.toLowerCase()) return entry;
    const payments = entry.payments.map((p) =>
      p.id === paymentId ? normalizeLedgerPayment({ ...p, ...patch, id: p.id }) : p
    );
    return { ...entry, payments, paid: recomputeEntryPaid(payments) };
  });
  return applyLedgerToStudent(student, nextLedger);
};

// Delete ONE payment from a class entry. Recomputes paid.
export const deleteLedgerPayment = (student = {}, className, paymentId) => {
  const target = normalizeClassName(className);
  if (!target || !paymentId) return student;
  const ledger = ensureFeeLedger(student);
  const nextLedger = ledger.map((entry) => {
    if (entry.className.toLowerCase() !== target.toLowerCase()) return entry;
    const payments = entry.payments.filter((p) => p.id !== paymentId);
    return { ...entry, payments, paid: recomputeEntryPaid(payments) };
  });
  return applyLedgerToStudent(student, nextLedger);
};

// Human-friendly "12 Jun 2026, 3:45 PM" for a payment's ISO date (with time).
export const formatPaymentDateTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Waterfall an amount across one ledger (class-order first). Pure helper.
const waterfallLedger = (feeLedger = [], amount, classOrder = [], receiptNo = '', date = '') => {
  let remaining = Math.max(0, parseAmount(amount));
  const stamp = date || new Date().toISOString();
  const ordered = sortedFeeLedger(feeLedger, classOrder);
  const breakdown = [];
  const nextLedger = ordered.map((entry) => {
    const pending = entryPending(entry);
    const assigned = parseAmount(entry.assigned);
    // Only skip when nothing to collect (no money left OR class has no assigned
    // fee at all). A class with assigned > 0 but pending 0 (fully paid) is
    // correctly skipped by `pending <= 0`.
    if (remaining <= 0 || assigned <= 0 || pending <= 0) return entry;
    const applied = Math.min(pending, remaining);
    remaining -= applied;
    breakdown.push({ className: entry.className, amount: applied });
    return {
      ...entry,
      paid: parseAmount(entry.paid) + applied,
      payments: [
        ...entry.payments,
        normalizeLedgerPayment({ amount: applied, date: stamp, mode: 'School Desk', receiptNo }),
      ],
    };
  });
  return { feeLedger: nextLedger, breakdown, remaining };
};

// Collect a payment for ONE student (waterfalls across their classes).
export const collectStudentPayment = (student = {}, amount, classOrder = [], receiptNo = '', date = '') => {
  const ledger = ensureFeeLedger(student);
  const result = waterfallLedger(ledger, amount, classOrder, receiptNo, date);
  return {
    student: applyLedgerToStudent(student, result.feeLedger),
    breakdown: result.breakdown,
    remaining: result.remaining,
  };
};

// Collect a family payment across siblings; each sibling waterfalls their classes.
export const collectFamilyPayment = (familyStudents = [], amount, classOrder = [], receiptNo = '', date = '') => {
  let remaining = Math.max(0, parseAmount(amount));
  const stamp = date || new Date().toISOString();
  const breakdown = [];
  const students = familyStudents.map((student) => {
    if (remaining <= 0) return student;
    const ledger = ensureFeeLedger(student);
    const result = waterfallLedger(ledger, remaining, classOrder, receiptNo, stamp);
    remaining = result.remaining;
    result.breakdown.forEach((row) =>
      breakdown.push({
        admissionNumber: getStudentAdmissionNumber(student),
        name: getStudentDisplayName(student),
        className: row.className,
        amount: row.amount,
      })
    );
    return applyLedgerToStudent(student, result.feeLedger);
  });
  return { students, breakdown, remaining };
};

// Class-sequence helpers for session promotion.
export const isLastClass = (className, classOrder = []) =>
  classOrder.length > 0 && classRankIn(className, classOrder) === classOrder.length - 1;

export const nextClassName = (className, classOrder = []) => {
  const idx = classRankIn(className, classOrder);
  if (idx === Number.MAX_SAFE_INTEGER || idx >= classOrder.length - 1) return '';
  return classOrder[idx + 1];
};

// Build a class-wise receipt payload for a collected payment.
export const buildClassWiseReceipt = ({ payerName = '', admissionNumber = '', amount = 0, breakdown = [], mode = 'individual', contact = '', guardianEmail = '' } = {}) => ({
  receiptNo: `REC-${Date.now().toString().slice(-6)}`,
  timestamp: new Date().toLocaleString(),
  amountPaid: parseAmount(amount),
  mode,
  payerName,
  admissionNumber,
  contact,
  guardianEmail,
  breakdown, // [{ admissionNumber?, name?, className, amount }]
});
