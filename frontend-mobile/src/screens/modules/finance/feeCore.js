// Fee-core — pure (non-React) money helpers shared by FinanceScreen and the AI
// Assistant. Ported 1:1 from frontend/src/components/common/financeData.js so the
// persisted student.feeLedger shape stays IDENTICAL to web (so /api/fees and the
// web page keep working unchanged). No React imports here — safe to reuse anywhere.
//
// student.feeLedger = [{ className, assigned, paid, note,
//   payments: [{ id, amount, date, mode, receiptNo }] }]
// plus the legacy aggregate mirrors (paidFees / pendingFees / yearlyFee /
// annualFee / assignedFees) kept identical to web.

export const parseAmount = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const amount = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

export const formatCurrency = (amount) => `Rs. ${Math.round(parseAmount(amount)).toLocaleString("en-IN")}`;

const getFirstAmount = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== "") {
      return parseAmount(source[key]);
    }
  }
  return 0;
};

export const getStudentClassName = (student = {}) =>
  student.className || student.class || student.rawProfile?.targetClass || "Unassigned";

export const getStudentDisplayName = (student = {}) =>
  student.displayName || student.name || student.rawProfile?.studentName || "Student";

export const getStudentAdmissionNumber = (student = {}) =>
  student.admissionNumber || student.admNo || student.id || "";

const getPaidFees = (student = {}) => getFirstAmount(student, ["paidFees", "collectedFees", "feesPaid", "paid"]);

const getPendingFees = (student = {}) =>
  getFirstAmount(student, ["pendingFees", "feePending", "balanceFees", "unpaidFees", "dueAmount"]);

const getAssignedFees = (student = {}) => {
  const assigned = getFirstAmount(student, [
    "yearlyFee",
    "annualFee",
    "totalFees",
    "assignedFees",
    "feeAmount",
    "totalAssigned",
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
    fatherName: student.fatherName || student.rawProfile?.fatherName || "",
    motherName: student.motherName || student.rawProfile?.motherName || "",
    guardianName: student.guardianName || student.rawProfile?.guardianName || "",
    guardianPhone:
      student.guardianPhone ||
      student.mobile ||
      student.mobileNo ||
      student.rawProfile?.guardianMobile ||
      student.rawProfile?.mobileNo ||
      "",
    guardianEmail: student.guardianEmail || student.email || student.rawProfile?.email || "",
    paidFees,
    pendingFees,
    yearlyFee: getAssignedFees(student) || paidFees + pendingFees,
    status: student.status || "Active",
  };
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
  return parts.length ? parts.join("|") : getStudentAdmissionNumber(student);
};

const normalizeClassName = (value = "") => String(value || "").trim();

// Ordered class names from the `admin-class-preferences` namespace value.
export const getClassOrder = (classPreferences = []) => {
  const list = Array.isArray(classPreferences) ? classPreferences : [];
  return list
    .map((entry) => (typeof entry === "string" ? entry : entry?.name || entry?.className || entry?.class || ""))
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
  mode: payment.mode || "School Desk",
  receiptNo: payment.receiptNo || payment.id || "",
});

const normalizeLedgerEntry = (entry = {}) => {
  const assigned = Math.max(0, parseAmount(entry.assigned ?? entry.totalFees ?? entry.amount ?? entry.assignedFees));
  const paid = Math.max(0, parseAmount(entry.paid ?? entry.paidFees ?? entry.collected));
  const payments = Array.isArray(entry.payments) ? entry.payments.map(normalizeLedgerPayment) : [];
  return {
    className: normalizeClassName(entry.className || entry.class),
    assigned,
    paid,
    note: entry.note || "",
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
    amount: getFirstAmount(entry, ["amountPaid", "amount", "paid"]),
    date: entry.paidAt || entry.date || entry.createdAt,
    mode: entry.mode || "School Desk",
    receiptNo: entry.receiptNo || entry.id,
  }));
  return [normalizeLedgerEntry({ className, assigned, paid, payments })];
};

export const entryPending = (entry = {}) => Math.max(0, parseAmount(entry.assigned) - parseAmount(entry.paid));

export const entryStatus = (entry = {}) => {
  const assigned = parseAmount(entry.assigned);
  const paid = parseAmount(entry.paid);
  if (assigned > 0 && entryPending(entry) === 0) return "Paid";
  if (paid > 0) return "Partial";
  return "Due";
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
export const assignClassFeeToStudent = (student = {}, className, amount, note = "") => {
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
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Waterfall an amount across one ledger (class-order first). Pure helper.
const waterfallLedger = (feeLedger = [], amount, classOrder = [], receiptNo = "", date = "") => {
  let remaining = Math.max(0, parseAmount(amount));
  const stamp = date || new Date().toISOString();
  const ordered = sortedFeeLedger(feeLedger, classOrder);
  const breakdown = [];
  const nextLedger = ordered.map((entry) => {
    const pending = entryPending(entry);
    if (remaining <= 0 || pending <= 0) return entry;
    const applied = Math.min(pending, remaining);
    remaining -= applied;
    breakdown.push({ className: entry.className, amount: applied });
    return {
      ...entry,
      paid: parseAmount(entry.paid) + applied,
      payments: [
        ...entry.payments,
        normalizeLedgerPayment({ amount: applied, date: stamp, mode: "School Desk", receiptNo }),
      ],
    };
  });
  return { feeLedger: nextLedger, breakdown, remaining };
};

// Collect a payment for ONE student (waterfalls across their classes).
export const collectStudentPayment = (student = {}, amount, classOrder = [], receiptNo = "", date = "") => {
  const ledger = ensureFeeLedger(student);
  const result = waterfallLedger(ledger, amount, classOrder, receiptNo, date);
  return {
    student: applyLedgerToStudent(student, result.feeLedger),
    breakdown: result.breakdown,
    remaining: result.remaining,
  };
};

// Collect a family payment across siblings; each sibling waterfalls their classes.
export const collectFamilyPayment = (familyStudents = [], amount, classOrder = [], receiptNo = "", date = "") => {
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

// Build a class-wise receipt payload for a collected payment.
export const buildClassWiseReceipt = ({
  payerName = "",
  admissionNumber = "",
  amount = 0,
  breakdown = [],
  mode = "individual",
  contact = "",
  guardianEmail = "",
} = {}) => ({
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

// Ordered class names from the `admin-class-management-classes` namespace value.
export const getManagedClassNames = (classRecords = []) =>
  (Array.isArray(classRecords) ? classRecords : [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.name || entry?.className || entry?.class || ""))
    .map(normalizeClassName)
    .filter(Boolean);
