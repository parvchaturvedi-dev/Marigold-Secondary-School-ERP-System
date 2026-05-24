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
