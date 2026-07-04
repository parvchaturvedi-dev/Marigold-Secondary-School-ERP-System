import { parseAmount, formatCurrency } from './financeData';

/* ============================================================================
   PAYROLL  (staff salary — teachers & clerks)  — manual, admin-driven.
   Mirrors the fees pattern but is TIME-BASED (one salary "due" per month).

   Each staff record (in ModuleState 'admin-teacher-management-list' /
   'admin-clerk-management-list') carries:
     monthlySalary  : number           — current salary rate
     salaryHistory  : [{ fromMonth:'YYYY-MM', amount }]  — rate changes (asc)
     salaryPayments : [{ id, month:'YYYY-MM', amount, paidOn:ISO, mode, note }]
     joinMonth      : 'YYYY-MM'         — derived from dateOfJoining if absent

   Ledger: for every month from joinMonth..currentMonth we owe the rate that was
   effective that month (salaryHistory), minus what was paid for that month.
   Aggregate mirrors (pendingSalary/paidSalary/dueSalary) are re-synced for quick
   list rendering. A new salary applies from NEXT month by default.
   ============================================================================ */

export { parseAmount, formatCurrency };

const pad2 = (n) => String(n).padStart(2, '0');

// 'YYYY-MM' for a Date (or now).
export const monthKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return monthKey(new Date());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

export const currentMonthKey = () => monthKey(new Date());

// Add n months to a 'YYYY-MM' key.
export const addMonths = (month, n = 1) => {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return month;
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
};

export const nextMonthKey = (month = currentMonthKey()) => addMonths(month, 1);

// Inclusive list of 'YYYY-MM' from -> to (capped to avoid runaway ledgers).
export const monthRange = (fromMonth, toMonth, cap = 120) => {
  if (!fromMonth || !toMonth) return [];
  const out = [];
  let cursor = fromMonth;
  let guard = 0;
  while (cursor <= toMonth && guard < cap) {
    out.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return out;
};

const staffField = (staff = {}, keys = []) => {
  const raw = staff.rawProfile || {};
  for (const key of keys) {
    if (staff?.[key] !== undefined && staff?.[key] !== null && staff?.[key] !== '') return staff[key];
    if (raw?.[key] !== undefined && raw?.[key] !== null && raw?.[key] !== '') return raw[key];
  }
  return '';
};

export const getStaffName = (staff = {}) =>
  staffField(staff, ['name', 'displayName', 'staffName', 'teacherName', 'clerkName']) || 'Staff';

export const getStaffId = (staff = {}) =>
  String(staffField(staff, ['id', 'username', 'staffId', 'employeeId']) || '').trim();

// Derive the join month from a joining date (or earliest salary history / payment).
export const getStaffJoinMonth = (staff = {}) => {
  const joinDate = staffField(staff, ['joinMonth', 'dateOfJoining', 'joiningDate', 'joinDate', 'doj']);
  if (joinDate) {
    if (/^\d{4}-\d{2}$/.test(String(joinDate))) return String(joinDate);
    const d = new Date(joinDate);
    if (!Number.isNaN(d.getTime())) return monthKey(d);
  }
  const history = Array.isArray(staff.salaryHistory) ? staff.salaryHistory : [];
  if (history.length) return history.map((h) => h.fromMonth).filter(Boolean).sort()[0];
  const payments = Array.isArray(staff.salaryPayments) ? staff.salaryPayments : [];
  if (payments.length) return payments.map((p) => p.month).filter(Boolean).sort()[0];
  return currentMonthKey();
};

const sortedSalaryHistory = (staff = {}) => {
  const history = Array.isArray(staff.salaryHistory) ? staff.salaryHistory : [];
  const normalized = history
    .map((entry) => ({ fromMonth: String(entry.fromMonth || ''), amount: parseAmount(entry.amount) }))
    .filter((entry) => /^\d{4}-\d{2}$/.test(entry.fromMonth));
  // Seed with the current monthlySalary from the join month if history is empty.
  if (!normalized.length) {
    const salary = parseAmount(staff.monthlySalary);
    if (salary > 0) normalized.push({ fromMonth: getStaffJoinMonth(staff), amount: salary });
  }
  return normalized.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
};

// Effective salary rate for a given month (latest history entry whose fromMonth <= month).
export const salaryRateForMonth = (staff = {}, month) => {
  const history = sortedSalaryHistory(staff);
  // No history at all → legacy record with only a flat monthlySalary.
  if (!history.length) return parseAmount(staff.monthlySalary);
  // With history present, months before the earliest entry owe nothing — never
  // fall back to monthlySalary (which may hold a future-dated raise and would
  // otherwise retroactively reprice earlier months).
  let rate = 0;
  for (const entry of history) {
    if (entry.fromMonth <= month) rate = entry.amount;
    else break;
  }
  return rate;
};

const paymentsByMonth = (staff = {}) => {
  const map = new Map();
  (Array.isArray(staff.salaryPayments) ? staff.salaryPayments : []).forEach((p) => {
    const month = String(p.month || '');
    if (!month) return;
    const list = map.get(month) || [];
    list.push({
      id: p.id || '',
      amount: parseAmount(p.amount),
      paidOn: p.paidOn || p.date || '',
      mode: p.mode || 'Bank',
      note: p.note || '',
    });
    map.set(month, list);
  });
  return map;
};

// Build the month-by-month payroll ledger from joinMonth to currentMonth.
export const buildPayrollLedger = (staff = {}, throughMonth = currentMonthKey()) => {
  const joinMonth = getStaffJoinMonth(staff);
  const months = monthRange(joinMonth, throughMonth);
  const payMap = paymentsByMonth(staff);

  return months.map((month) => {
    const due = salaryRateForMonth(staff, month);
    const payments = payMap.get(month) || [];
    const paid = payments.reduce((sum, p) => sum + p.amount, 0);
    const pending = Math.max(0, due - paid);
    const status = due > 0 && pending === 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';
    return { month, due, paid, pending, status, payments };
  });
};

export const payrollTotals = (ledger = []) =>
  ledger.reduce(
    (acc, row) => {
      acc.due += row.due;
      acc.paid += row.paid;
      acc.pending += row.pending;
      return acc;
    },
    { due: 0, paid: 0, pending: 0 }
  );

export const staffPayrollTotals = (staff = {}, throughMonth = currentMonthKey()) =>
  payrollTotals(buildPayrollLedger(staff, throughMonth));

// Refresh quick-display mirrors on a staff record.
export const applyPayrollMirrors = (staff = {}) => {
  const totals = staffPayrollTotals(staff);
  return {
    ...staff,
    dueSalary: totals.due,
    paidSalary: totals.paid,
    pendingSalary: totals.pending,
  };
};

// Admin sets / updates the salary. Applies from `effectiveMonth` (default = next month).
export const setStaffSalary = (staff = {}, amount, effectiveMonth = nextMonthKey()) => {
  const value = Math.max(0, parseAmount(amount));
  const history = sortedSalaryHistory(staff).filter((entry) => entry.fromMonth !== effectiveMonth);
  history.push({ fromMonth: effectiveMonth, amount: value });
  history.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  const withHistory = {
    ...staff,
    salaryHistory: history,
    joinMonth: staff.joinMonth || getStaffJoinMonth(staff),
  };
  // Keep the monthlySalary mirror aligned with the rate effective THIS month so
  // legacy readers (and the salaryRateForMonth fallback) see the correct current
  // rate rather than a future-dated raise.
  return applyPayrollMirrors({
    ...withHistory,
    monthlySalary: salaryRateForMonth(withHistory, currentMonthKey()),
  });
};

let payrollSeq = 0;
const makePaymentId = () => `SAL-${Date.now()}-${(payrollSeq += 1)}`;

// Record a salary payment for a specific month (admin types amount + clicks Paid).
export const recordSalaryPayment = (staff = {}, month, amount, mode = 'Bank', note = '') => {
  const value = Math.max(0, parseAmount(amount));
  if (!month || value <= 0) return staff;
  const payment = {
    id: makePaymentId(),
    month: String(month),
    amount: value,
    paidOn: new Date().toISOString(),
    mode,
    note,
  };
  const payments = [...(Array.isArray(staff.salaryPayments) ? staff.salaryPayments : []), payment];
  return applyPayrollMirrors({ ...staff, salaryPayments: payments });
};

// Pay the whole outstanding balance, oldest month first (waterfall), for one staff.
export const settleStaffOutstanding = (staff = {}, amount, mode = 'Bank', note = '') => {
  let remaining = Math.max(0, parseAmount(amount));
  const ledger = buildPayrollLedger(staff);
  let next = staff;
  const applied = [];
  for (const row of ledger) {
    if (remaining <= 0) break;
    if (row.pending <= 0) continue;
    const pay = Math.min(row.pending, remaining);
    remaining -= pay;
    next = recordSalaryPayment(next, row.month, pay, mode, note);
    applied.push({ month: row.month, amount: pay });
  }
  return { staff: next, applied, remaining };
};

export const buildSalarySlip = ({ staffName = '', staffId = '', month = '', amount = 0, mode = 'Bank', note = '' } = {}) => ({
  slipNo: `SAL-${Date.now().toString().slice(-6)}`,
  timestamp: new Date().toLocaleString(),
  staffName,
  staffId,
  month,
  amount: parseAmount(amount),
  mode,
  note,
});
