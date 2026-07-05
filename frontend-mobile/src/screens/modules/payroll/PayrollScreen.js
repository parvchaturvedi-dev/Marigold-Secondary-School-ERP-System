// Staff Payroll — set salary (effective next month), record salary payments
// (settle outstanding via waterfall OR pay a specific month), and generate a
// salary slip. Teaching & non-teaching staff.
//
// Mirrors web frontend/src/pages/Admin/Payroll.jsx + payrollData.js EXACTLY.
// The payroll-core functions from payrollData.js are re-implemented inline here
// (mobile cannot import from frontend/src). Persisted shapes on each staff record
// are IDENTICAL to web so /api/payroll and the web page keep working:
//   monthlySalary  : number
//   salaryHistory  : [{ fromMonth:'YYYY-MM', amount }]  (asc)
//   salaryPayments : [{ id, month:'YYYY-MM', amount, paidOn:ISO, mode, note }]
//   joinMonth      : 'YYYY-MM'
//   + mirrors dueSalary / paidSalary / pendingSalary
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  ButtonRow,
  Card,
  Divider,
  Hero,
  ScreenShell,
  SectionTitle,
  Segmented,
  Select,
  SmallButton,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";

const NAMESPACE_BY_TAB = {
  teachers: "admin-teacher-management-list",
  clerks: "admin-clerk-management-list",
};

const PAY_MODES = ["Bank", "Cash", "Cheque", "UPI"];

/* ============================================================================
   PAYROLL CORE — ported verbatim from frontend/src/components/common/payrollData.js
   ============================================================================ */

const parseAmount = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const amount = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const formatCurrency = (amount) => `Rs. ${Math.round(parseAmount(amount)).toLocaleString("en-IN")}`;

const pad2 = (n) => String(n).padStart(2, "0");

const monthKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return monthKey(new Date());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const currentMonthKey = () => monthKey(new Date());

const addMonths = (month, n = 1) => {
  const [y, m] = String(month).split("-").map(Number);
  if (!y || !m) return month;
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
};

const nextMonthKey = (month = currentMonthKey()) => addMonths(month, 1);

// Recent + near-future YYYY-MM keys (desc) for month dropdowns. Same string
// format the payroll-core stores, so no record shape changes.
const recentMonthKeys = (back = 15, forward = 2) => {
  const base = currentMonthKey();
  const out = [];
  for (let i = forward; i >= -back; i -= 1) out.push(addMonths(base, i));
  return out;
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
    if (staff?.[key] !== undefined && staff?.[key] !== null && staff?.[key] !== "") return staff[key];
    if (raw?.[key] !== undefined && raw?.[key] !== null && raw?.[key] !== "") return raw[key];
  }
  return "";
};

const getStaffName = (staff = {}) =>
  staffField(staff, ["name", "displayName", "staffName", "teacherName", "clerkName"]) || "Staff";

const getStaffId = (staff = {}) =>
  String(staffField(staff, ["id", "username", "staffId", "employeeId"]) || "").trim();

const getStaffJoinMonth = (staff = {}) => {
  const joinDate = staffField(staff, ["joinMonth", "dateOfJoining", "joiningDate", "joinDate", "doj"]);
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
    .map((entry) => ({ fromMonth: String(entry.fromMonth || ""), amount: parseAmount(entry.amount) }))
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
    const month = String(p.month || "");
    if (!month) return;
    const list = map.get(month) || [];
    list.push({
      id: p.id || "",
      amount: parseAmount(p.amount),
      paidOn: p.paidOn || p.date || "",
      mode: p.mode || "Bank",
      note: p.note || "",
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
    const status = due > 0 && pending === 0 ? "Paid" : paid > 0 ? "Partial" : "Pending";
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

const staffPayrollTotals = (staff = {}, throughMonth = currentMonthKey()) =>
  payrollTotals(buildPayrollLedger(staff, throughMonth));

const applyPayrollMirrors = (staff = {}) => {
  const totals = staffPayrollTotals(staff);
  return {
    ...staff,
    dueSalary: totals.due,
    paidSalary: totals.paid,
    pendingSalary: totals.pending,
  };
};

const setStaffSalary = (staff = {}, amount, effectiveMonth = nextMonthKey()) => {
  const value = Math.max(0, parseAmount(amount));
  const history = sortedSalaryHistory(staff).filter((entry) => entry.fromMonth !== effectiveMonth);
  history.push({ fromMonth: effectiveMonth, amount: value });
  history.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  return applyPayrollMirrors({
    ...staff,
    monthlySalary: value,
    salaryHistory: history,
    joinMonth: staff.joinMonth || getStaffJoinMonth(staff),
  });
};

let payrollSeq = 0;
const makePaymentId = () => `SAL-${Date.now()}-${(payrollSeq += 1)}`;

const recordSalaryPayment = (staff = {}, month, amount, mode = "Bank", note = "") => {
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

const settleStaffOutstanding = (staff = {}, amount, mode = "Bank", note = "") => {
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

const buildSalarySlip = ({ staffName = "", staffId = "", month = "", amount = 0, mode = "Bank", note = "" } = {}) => ({
  slipNo: `SAL-${Date.now().toString().slice(-6)}`,
  timestamp: new Date().toLocaleString(),
  staffName,
  staffId,
  month,
  amount: parseAmount(amount),
  mode,
  note,
});

/* ============================================================================
   UI helpers
   ============================================================================ */

const STATUS_STYLE = {
  Paid: { bg: "#DCFCE7", fg: "#15803D" },
  Partial: { bg: "#FEF3C7", fg: "#B45309" },
  Pending: { bg: "#FEE2E2", fg: "#B91C1C" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Pending;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{status}</Text>
    </View>
  );
}

/* ============================================================================
   Screen
   ============================================================================ */

export default function PayrollScreen({ user }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const [activeTab, setActiveTab] = useState("teachers");

  const teacherState = useModuleState(NAMESPACE_BY_TAB.teachers);
  const clerkState = useModuleState(NAMESPACE_BY_TAB.clerks);

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState("");

  // Set / update salary form (per staff, inline)
  const [salaryStaffId, setSalaryStaffId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryEffMonth, setSalaryEffMonth] = useState(nextMonthKey());

  // Pay salary form (per staff, inline)
  const [payStaffId, setPayStaffId] = useState("");
  const [payTab, setPayTab] = useState("settle"); // 'settle' | 'month'
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Bank");
  const [payNote, setPayNote] = useState("");
  const [payMonth, setPayMonth] = useState("");
  const [salarySlip, setSalarySlip] = useState(null);

  // Hardware Back: close an open inline panel one at a time (pay form → salary form
  // → expanded ledger) before the app-level handler goes to the dashboard.
  useEffect(() => {
    const onBack = () => {
      if (payStaffId) {
        setPayStaffId("");
        setSalarySlip(null);
        return true;
      }
      if (salaryStaffId) {
        setSalaryStaffId("");
        return true;
      }
      if (expandedId) {
        setExpandedId("");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [payStaffId, salaryStaffId, expandedId]);

  const state = activeTab === "teachers" ? teacherState : clerkState;
  const list = state.items;
  const loading = state.loading;

  const staffList = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    const normalized = arr.map((staff) => applyPayrollMirrors(staff));
    const term = searchTerm.trim().toLowerCase();
    return normalized
      .filter((staff) => {
        if (!term) return true;
        const haystack = `${getStaffName(staff)} ${getStaffId(staff)}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => getStaffName(a).localeCompare(getStaffName(b)));
  }, [list, searchTerm]);

  const summary = useMemo(() => {
    const arr = Array.isArray(list) ? list : [];
    return arr.reduce(
      (acc, staff) => {
        const totals = staffPayrollTotals(staff);
        acc.count += 1;
        acc.monthlyPayroll += parseAmount(staff.monthlySalary);
        acc.paid += totals.paid;
        acc.pending += totals.pending;
        return acc;
      },
      { count: 0, monthlyPayroll: 0, paid: 0, pending: 0 }
    );
  }, [list]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchTerm("");
    setExpandedId("");
    setSalaryStaffId("");
    setPayStaffId("");
    setSalarySlip(null);
  };

  // Persist a single updated staff record back into the active namespace (identical shape).
  const persistStaff = async (updatedStaff) => {
    const current = Array.isArray(list) ? list : [];
    const next = current.map((staff) =>
      getStaffId(staff) === getStaffId(updatedStaff) ? updatedStaff : staff
    );
    await state.persist(next);
  };

  // ---- Set / update salary ----
  const openSalaryForm = (staff) => {
    setPayStaffId("");
    setSalarySlip(null);
    setSalaryStaffId(getStaffId(staff));
    setSalaryAmount(staff.monthlySalary ? String(staff.monthlySalary) : "");
    setSalaryEffMonth(nextMonthKey());
  };

  const submitSalaryUpdate = async (staff) => {
    const amount = parseAmount(salaryAmount);
    if (amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid salary amount.");
      return;
    }
    try {
      const updated = setStaffSalary(staff, amount, salaryEffMonth);
      await persistStaff(updated);
      setSalaryStaffId("");
      banner.showSuccess(
        `Salary set to ${formatCurrency(amount)} effective ${salaryEffMonth} for ${getStaffName(staff)}.`
      );
    } catch (err) {
      banner.showError(err);
    }
  };

  // ---- Pay salary ----
  const openPayForm = (staff) => {
    setSalaryStaffId("");
    setPayStaffId(getStaffId(staff));
    setPayTab("settle");
    setPayAmount("");
    setPayMode("Bank");
    setPayNote("");
    const ledger = buildPayrollLedger(staff);
    const firstPending = ledger.find((row) => row.pending > 0);
    setPayMonth(firstPending ? firstPending.month : currentMonthKey());
    setSalarySlip(null);
  };

  const notifySalaryPayment = (staff, amount) => {
    const staffId = getStaffId(staff);
    if (!staffId) return;
    apiRequest("/notifications", {
      method: "POST",
      body: JSON.stringify({
        title: "Salary Credited",
        description: `Your salary payment of ${formatCurrency(amount)} was recorded.`,
        type: "salary",
        linkPage: "My Salary",
        recipientRole: activeTab === "teachers" ? "teacher" : "clerk",
        recipientUsername: staffId,
      }),
    }).catch((error) => {
      console.warn("Failed to send salary payment notification", error);
    });
  };

  const submitPayment = async (staff) => {
    const amount = parseAmount(payAmount);
    if (amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid payment amount.");
      return;
    }
    try {
      if (payTab === "settle") {
        const result = settleStaffOutstanding(staff, amount, payMode, payNote);
        await persistStaff(result.staff);
        const slip = buildSalarySlip({
          staffName: getStaffName(result.staff),
          staffId: getStaffId(result.staff),
          month: result.applied.map((a) => a.month).join(", ") || "-",
          amount: amount - result.remaining,
          mode: payMode,
          note: payNote,
        });
        setSalarySlip(slip);
        if (result.remaining > 0) {
          Alert.alert(
            "Partial application",
            `Applied ${formatCurrency(amount - result.remaining)}. ${formatCurrency(
              result.remaining
            )} could not be applied (no further pending months).`
          );
        }
        if (amount - result.remaining > 0) {
          notifySalaryPayment(result.staff, amount - result.remaining);
        }
      } else {
        const updated = recordSalaryPayment(staff, payMonth, amount, payMode, payNote);
        await persistStaff(updated);
        const slip = buildSalarySlip({
          staffName: getStaffName(updated),
          staffId: getStaffId(updated),
          month: payMonth,
          amount,
          mode: payMode,
          note: payNote,
        });
        setSalarySlip(slip);
        notifySalaryPayment(updated, amount);
      }
      setPayAmount("");
      setPayNote("");
    } catch (err) {
      banner.showError(err);
    }
  };

  const closePayForm = () => {
    setPayStaffId("");
    setSalarySlip(null);
  };

  // Month dropdown options (YYYY-MM, desc) that always contain the current value,
  // so a long-outstanding month selected outside the recent window still renders.
  const baseMonthOptions = useMemo(() => recentMonthKeys(), []);
  const monthOptionsWith = useCallback(
    (current) => {
      if (current && !baseMonthOptions.includes(current)) {
        return [current, ...baseMonthOptions];
      }
      return baseMonthOptions;
    },
    [baseMonthOptions]
  );

  return (
    <ScreenShell title="Staff Payroll" refreshing={loading} onRefresh={state.reload}>
      <Hero
        icon="cash-outline"
        title="Staff Payroll"
        subtitle="Month-wise salary ledger for teaching and non-teaching staff."
      />

      <Segmented
        options={[
          { value: "teachers", label: "Teachers" },
          { value: "clerks", label: "Clerks" },
        ]}
        value={activeTab}
        onChange={switchTab}
      />

      <View style={{ height: 12 }} />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />
      {!!state.error && <Banner type="error" message={state.error} />}

      {/* Summary */}
      <Card>
        <View style={styles.summaryGrid}>
          <SummaryCell label="Total Staff" value={String(summary.count)} />
          <SummaryCell label="Monthly Payroll" value={formatCurrency(summary.monthlyPayroll)} />
          <SummaryCell label="Total Paid" value={formatCurrency(summary.paid)} tone="#059669" />
          <SummaryCell
            label="Total Pending"
            value={formatCurrency(summary.pending)}
            tone={summary.pending ? "#DC2626" : "#64748B"}
          />
        </View>
      </Card>

      <TextField
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder="Search by name or ID..."
        autoCapitalize="none"
      />

      <SectionTitle>{activeTab === "teachers" ? "Teachers" : "Clerks"}</SectionTitle>

      {loading && !staffList.length ? (
        <Card>
          <Text style={[styles.muted, { color: palette.inkSoft }]}>Loading staff…</Text>
        </Card>
      ) : !staffList.length ? (
        <Card>
          <Text style={[styles.emptyText, { color: palette.inkSoft }]}>
            No {activeTab === "teachers" ? "teacher" : "clerk"} records found.
          </Text>
        </Card>
      ) : (
        staffList.map((staff) => {
          const staffId = getStaffId(staff);
          const totals = staffPayrollTotals(staff);
          const ledger = buildPayrollLedger(staff);
          const isExpanded = expandedId === staffId;
          const isSalaryOpen = salaryStaffId === staffId;
          const isPayOpen = payStaffId === staffId;
          const pendingRows = ledger.filter((row) => row.pending > 0);

          return (
            <Card key={staffId || getStaffName(staff)}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.ink }]}>{getStaffName(staff)}</Text>
                  <Text style={[styles.sub, { color: palette.inkSoft }]}>{staffId || "—"}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <Metric label="Monthly" value={formatCurrency(staff.monthlySalary)} />
                <Metric label="Paid" value={formatCurrency(totals.paid)} tone="#059669" />
                <Metric
                  label="Pending"
                  value={formatCurrency(totals.pending)}
                  tone={totals.pending > 0 ? "#DC2626" : "#94A3B8"}
                />
                <Metric label="Total Due" value={formatCurrency(totals.due)} />
              </View>

              <ButtonRow>
                <SmallButton
                  label="Set / Update Salary"
                  icon="pencil-outline"
                  onPress={() => openSalaryForm(staff)}
                  active={isSalaryOpen}
                />
                <SmallButton
                  label="Pay Salary"
                  icon="card-outline"
                  onPress={() => openPayForm(staff)}
                  active={isPayOpen}
                />
                <SmallButton
                  label={isExpanded ? "Hide Ledger" : "Ledger"}
                  icon={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                  onPress={() => setExpandedId(isExpanded ? "" : staffId)}
                />
              </ButtonRow>

              {/* Set / Update Salary form */}
              {isSalaryOpen && (
                <View style={styles.formBox}>
                  <Divider />
                  <Text style={[styles.formTitle, { color: palette.ink }]}>Set / Update Salary</Text>
                  <Text style={[styles.formHint, { color: palette.inkSoft }]}>
                    New rate applies from {salaryEffMonth} onward (defaults to next month).
                  </Text>
                  <TextField
                    label="Monthly Salary Amount (Rs.)"
                    value={salaryAmount}
                    onChangeText={setSalaryAmount}
                    placeholder="Salary amount"
                    keyboardType="numeric"
                  />
                  <Select
                    label="Effective From (YYYY-MM)"
                    value={salaryEffMonth}
                    onChange={setSalaryEffMonth}
                    options={monthOptionsWith(salaryEffMonth)}
                    placeholder={nextMonthKey()}
                  />
                  <ButtonRow>
                    <SmallButton label="Save Salary" icon="save-outline" onPress={() => submitSalaryUpdate(staff)} />
                    <SmallButton label="Cancel" icon="close-outline" tone="danger" onPress={() => setSalaryStaffId("")} />
                  </ButtonRow>
                </View>
              )}

              {/* Pay Salary form */}
              {isPayOpen && (
                <View style={styles.formBox}>
                  <Divider />
                  {!salarySlip ? (
                    <>
                      <Text style={[styles.formTitle, { color: palette.ink }]}>Pay Salary</Text>
                      <Text style={[styles.formHint, { color: palette.inkSoft }]}>
                        Paying {getStaffName(staff)}. Outstanding: {formatCurrency(totals.pending)}
                      </Text>

                      {/* Pending months */}
                      {pendingRows.length ? (
                        <View style={[styles.ledgerBox, { borderColor: palette.cardBorder }]}>
                          {pendingRows.map((row) => (
                            <View key={row.month} style={[styles.ledgerRow, { borderBottomColor: palette.cardBorder }]}>
                              <Text style={[styles.ledgerMonth, { color: palette.ink }]}>{row.month}</Text>
                              <StatusBadge status={row.status} />
                              <Text style={styles.ledgerPending}>{formatCurrency(row.pending)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.muted, { color: palette.inkSoft }]}>No outstanding months.</Text>
                      )}

                      <View style={{ height: 8 }} />
                      <Segmented
                        options={[
                          { value: "settle", label: "Settle Outstanding" },
                          { value: "month", label: "Specific Month" },
                        ]}
                        value={payTab}
                        onChange={setPayTab}
                      />
                      <View style={{ height: 12 }} />

                      {payTab === "month" && (
                        <Select
                          label="Month (YYYY-MM)"
                          value={payMonth}
                          onChange={setPayMonth}
                          options={monthOptionsWith(payMonth)}
                          placeholder={currentMonthKey()}
                        />
                      )}
                      <TextField
                        label="Amount (Rs.)"
                        value={payAmount}
                        onChangeText={setPayAmount}
                        placeholder="Amount to pay"
                        keyboardType="numeric"
                      />
                      <Text style={[styles.fieldLabel, { color: palette.inkLabel }]}>Mode</Text>
                      <Segmented options={PAY_MODES} value={payMode} onChange={setPayMode} />
                      <View style={{ height: 12 }} />
                      <TextField
                        label="Note (optional)"
                        value={payNote}
                        onChangeText={setPayNote}
                        placeholder="Accounts note"
                      />
                      <ButtonRow>
                        <SmallButton label="Confirm Payment" icon="cash-outline" onPress={() => submitPayment(staff)} />
                        <SmallButton label="Cancel" icon="close-outline" tone="danger" onPress={closePayForm} />
                      </ButtonRow>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.slipTitle, { color: palette.ink }]}>Salary Payment Slip</Text>
                      <Text style={[styles.slipMeta, { color: palette.inkFaint }]}>
                        {salarySlip.timestamp} | Ref: {salarySlip.slipNo}
                      </Text>
                      <View style={styles.slipBody}>
                        <Text style={[styles.slipLine, { color: palette.ink }]}>
                          <Text style={styles.slipStrong}>Staff: </Text>
                          {salarySlip.staffName} ({salarySlip.staffId})
                        </Text>
                        <Text style={[styles.slipLine, { color: palette.ink }]}>
                          <Text style={styles.slipStrong}>Month(s): </Text>
                          {salarySlip.month}
                        </Text>
                        <Text style={[styles.slipLine, { color: palette.ink }]}>
                          <Text style={styles.slipStrong}>Mode: </Text>
                          {salarySlip.mode}
                        </Text>
                        {!!salarySlip.note && (
                          <Text style={[styles.slipLine, { color: palette.ink }]}>
                            <Text style={styles.slipStrong}>Note: </Text>
                            {salarySlip.note}
                          </Text>
                        )}
                      </View>
                      <View style={styles.slipAmount}>
                        <Text style={styles.slipAmountLabel}>Amount Paid</Text>
                        <Text style={styles.slipAmountValue}>{formatCurrency(salarySlip.amount)}</Text>
                      </View>
                      <ButtonRow>
                        <SmallButton label="Done" icon="checkmark-outline" onPress={closePayForm} />
                      </ButtonRow>
                    </>
                  )}
                </View>
              )}

              {/* Payroll ledger */}
              {isExpanded && (
                <View style={styles.formBox}>
                  <Divider />
                  <Text style={[styles.formTitle, { color: palette.ink }]}>Payroll Ledger</Text>
                  {ledger.length ? (
                    <View style={[styles.ledgerBox, { borderColor: palette.cardBorder }]}>
                      <View style={[styles.ledgerRow, styles.ledgerHeadRow, { backgroundColor: palette.tile, borderBottomColor: palette.cardBorder }]}>
                        <Text style={[styles.ledgerHead, { flex: 1 }, { color: palette.inkFaint }]}>Month</Text>
                        <Text style={[styles.ledgerHead, styles.ledgerNum, { color: palette.inkFaint }]}>Due</Text>
                        <Text style={[styles.ledgerHead, styles.ledgerNum, { color: palette.inkFaint }]}>Paid</Text>
                        <Text style={[styles.ledgerHead, styles.ledgerNum, { color: palette.inkFaint }]}>Pending</Text>
                      </View>
                      {ledger.map((row) => (
                        <View key={row.month} style={[styles.ledgerRow, { borderBottomColor: palette.cardBorder }]}>
                          <Text style={[styles.ledgerMonth, { flex: 1 }, { color: palette.ink }]}>{row.month}</Text>
                          <Text style={[styles.ledgerCell, styles.ledgerNum, { color: palette.ink }]}>{formatCurrency(row.due)}</Text>
                          <Text style={[styles.ledgerCell, styles.ledgerNum, { color: "#059669" }]}>
                            {formatCurrency(row.paid)}
                          </Text>
                          <Text
                            style={[
                              styles.ledgerCell,
                              styles.ledgerNum,
                              { color: row.pending > 0 ? "#DC2626" : palette.inkFaint },
                            ]}
                          >
                            {formatCurrency(row.pending)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.muted, { color: palette.inkSoft }]}>No salary set yet for this staff member.</Text>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

function SummaryCell({ label, value, tone }) {
  const { palette } = useTheme();
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryLabel, { color: palette.inkSoft }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.ink }, tone && { color: tone }]}>{value}</Text>
    </View>
  );
}

function Metric({ label, value, tone }) {
  const { palette } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: palette.inkFaint }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.ink }, tone && { color: tone }]}>{value}</Text>
    </View>
  );
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center" },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3, fontFamily: "monospace" },
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 12 },
  metric: { minWidth: 74 },
  metricLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: "#0F172A", fontSize: 13, fontWeight: "900", marginTop: 2 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap" },
  summaryCell: { width: "50%", paddingVertical: 6 },
  summaryLabel: { color: "#64748B", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  summaryValue: { color: "#0F172A", fontSize: 18, fontWeight: "900", marginTop: 3 },
  formBox: { marginTop: 4 },
  formTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900", marginBottom: 4 },
  formHint: { color: "#64748B", fontSize: 11, fontWeight: "700", marginBottom: 10 },
  fieldLabel: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 6, marginLeft: 2 },
  muted: { color: "#64748B", fontWeight: "700", fontSize: 13 },
  emptyText: { color: "#64748B", fontWeight: "800", fontSize: 13, textAlign: "center", paddingVertical: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontWeight: "900", fontSize: 9, textTransform: "uppercase" },
  ledgerBox: { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: "#EEF2F7", overflow: "hidden" },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  ledgerHeadRow: { backgroundColor: "#EEF2FF" },
  ledgerHead: { color: "#94A3B8", fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  ledgerMonth: { color: "#0F172A", fontWeight: "900", fontSize: 12, fontFamily: "monospace" },
  ledgerCell: { color: "#0F172A", fontWeight: "800", fontSize: 12, fontFamily: "monospace" },
  ledgerNum: { width: 80, textAlign: "right" },
  ledgerPending: { color: "#DC2626", fontWeight: "900", fontSize: 12, fontFamily: "monospace", marginLeft: "auto" },
  slipTitle: { color: "#0F172A", fontSize: 14, fontWeight: "900", textAlign: "center", textTransform: "uppercase" },
  slipMeta: { color: "#94A3B8", fontSize: 10, textAlign: "center", marginTop: 2, marginBottom: 10, fontFamily: "monospace" },
  slipBody: { gap: 4, marginBottom: 12 },
  slipLine: { color: "#0F172A", fontWeight: "700", fontSize: 12, fontFamily: "monospace" },
  slipStrong: { fontWeight: "900" },
  slipAmount: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  slipAmountLabel: { color: "#fff", fontWeight: "900" },
  slipAmountValue: { color: "#fff", fontWeight: "900" },
};
