import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

const TEACHER_NAMESPACE = 'admin-teacher-management-list';
const CLERK_NAMESPACE = 'admin-clerk-management-list';

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

/* ----------------------------------------------------------------------------
   Payroll math — mirrored server-side from
   frontend/src/components/common/payrollData.js so /me and /all agree with the
   web ledger. Keep the two in sync if either changes.
   -------------------------------------------------------------------------- */

const parseAmount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const amount = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
};

const pad2 = (n) => String(n).padStart(2, '0');

const monthKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return monthKey(new Date());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const currentMonthKey = () => monthKey(new Date());

const addMonths = (month, n = 1) => {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return month;
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
};

const monthRange = (fromMonth, toMonth, cap = 120) => {
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

const getStaffName = (staff = {}) =>
  staffField(staff, ['name', 'displayName', 'staffName', 'teacherName', 'clerkName']) || 'Staff';

const getStaffId = (staff = {}) =>
  String(staffField(staff, ['id', 'username', 'staffId', 'employeeId']) || '').trim();

const getStaffJoinMonth = (staff = {}) => {
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
  if (!normalized.length) {
    const salary = parseAmount(staff.monthlySalary);
    if (salary > 0) normalized.push({ fromMonth: getStaffJoinMonth(staff), amount: salary });
  }
  return normalized.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
};

const salaryRateForMonth = (staff = {}, month) => {
  const history = sortedSalaryHistory(staff);
  let rate = 0;
  for (const entry of history) {
    if (entry.fromMonth <= month) rate = entry.amount;
    else break;
  }
  if (!rate) rate = parseAmount(staff.monthlySalary);
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

const buildPayrollLedger = (staff = {}, throughMonth = currentMonthKey()) => {
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

const payrollTotals = (ledger = []) =>
  ledger.reduce(
    (acc, row) => {
      acc.due += row.due;
      acc.paid += row.paid;
      acc.pending += row.pending;
      return acc;
    },
    { due: 0, paid: 0, pending: 0 }
  );

/* -------------------------------------------------------------------------- */

const readStaffList = async (namespace) => {
  const record = await ModuleState.findOne({ namespace }).lean();
  return Array.isArray(record?.value) ? record.value : [];
};

const findOwnRecord = (list = [], username = '') => {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return null;
  return (
    list.find((staff) => {
      const id = String(staff?.id ?? '').trim().toLowerCase();
      const uname = String(staff?.username ?? '').trim().toLowerCase();
      return (id && id === target) || (uname && uname === target);
    }) || null
  );
};

const staffSummary = (staff = {}) => ({
  name: getStaffName(staff),
  id: getStaffId(staff),
  monthlySalary: parseAmount(staff.monthlySalary),
  joinMonth: getStaffJoinMonth(staff),
});

// Any authenticated teacher/clerk can pull their own payroll ledger.
router.get('/me', ensureMongo, requireRole('teacher', 'clerk'), async (request, response) => {
  const namespace = request.auth?.role === 'clerk' ? CLERK_NAMESPACE : TEACHER_NAMESPACE;
  const list = await readStaffList(namespace);
  const record = findOwnRecord(list, request.auth?.username);

  if (!record) {
    response.json({ staff: null, ledger: [], totals: { due: 0, paid: 0, pending: 0 } });
    return;
  }

  const ledger = buildPayrollLedger(record);
  response.json({
    staff: staffSummary(record),
    ledger,
    totals: payrollTotals(ledger),
  });
});

// Admin roster: totals for every teacher + clerk.
router.get('/all', ensureMongo, requireRole('admin'), async (_request, response) => {
  const [teachers, clerks] = await Promise.all([
    readStaffList(TEACHER_NAMESPACE),
    readStaffList(CLERK_NAMESPACE),
  ]);

  const summarize = (staff) => ({
    id: getStaffId(staff),
    name: getStaffName(staff),
    monthlySalary: parseAmount(staff.monthlySalary),
    totals: payrollTotals(buildPayrollLedger(staff)),
  });

  response.json({
    teachers: teachers.map(summarize),
    clerks: clerks.map(summarize),
  });
});

export default router;
