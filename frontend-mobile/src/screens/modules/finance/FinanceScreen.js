// Finance — admin manual fee collection, mobile parity with web Admin/Finance.jsx.
// Assign class fee, collect individual/family payments (waterfall = lowest unpaid
// class first), build an on-screen receipt, and optionally POST a reminder/receipt
// notification. All money-core is ported INLINE from frontend/src/components/common/
// financeData.js so the persisted student.feeLedger shape stays IDENTICAL to web
// (so /api/fees and the web page keep working unchanged).
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  ButtonRow,
  Card,
  Divider,
  EmptyState,
  Hero,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  Segmented,
  Select,
  SmallButton,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";

// ============================================================================
// PORTED FINANCE-CORE (identical logic to frontend/src/components/common/financeData.js)
// Keeps student.feeLedger = [{ className, assigned, paid, note, payments:[
//   { id, amount, date, mode, receiptNo } ] }] and the legacy aggregate mirrors
// (paidFees / pendingFees / yearlyFee / annualFee / assignedFees) identical to web.
// ============================================================================

const parseAmount = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const amount = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const formatCurrency = (amount) => `Rs. ${Math.round(parseAmount(amount)).toLocaleString("en-IN")}`;

const getFirstAmount = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== "") {
      return parseAmount(source[key]);
    }
  }
  return 0;
};

const getStudentClassName = (student = {}) =>
  student.className || student.class || student.rawProfile?.targetClass || "Unassigned";

const getStudentDisplayName = (student = {}) =>
  student.displayName || student.name || student.rawProfile?.studentName || "Student";

const getStudentAdmissionNumber = (student = {}) =>
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

const normalizeFinanceStudent = (student = {}, index = 0) => {
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

const getFamilyKey = (student = {}) => {
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
const getClassOrder = (classPreferences = []) => {
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
const ensureFeeLedger = (student = {}) => {
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

const entryPending = (entry = {}) => Math.max(0, parseAmount(entry.assigned) - parseAmount(entry.paid));

const entryStatus = (entry = {}) => {
  const assigned = parseAmount(entry.assigned);
  const paid = parseAmount(entry.paid);
  if (assigned > 0 && entryPending(entry) === 0) return "Paid";
  if (paid > 0) return "Partial";
  return "Due";
};

const sortedFeeLedger = (feeLedger = [], classOrder = []) =>
  [...feeLedger].sort((a, b) => classRankIn(a.className, classOrder) - classRankIn(b.className, classOrder));

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

const studentFeeTotals = (student = {}) => ledgerTotals(ensureFeeLedger(student));

// Write a ledger back onto a student and refresh the legacy aggregate mirrors.
const applyLedgerToStudent = (student = {}, feeLedger = []) => {
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
const assignClassFeeToStudent = (student = {}, className, amount, note = "") => {
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
const collectStudentPayment = (student = {}, amount, classOrder = [], receiptNo = "", date = "") => {
  const ledger = ensureFeeLedger(student);
  const result = waterfallLedger(ledger, amount, classOrder, receiptNo, date);
  return {
    student: applyLedgerToStudent(student, result.feeLedger),
    breakdown: result.breakdown,
    remaining: result.remaining,
  };
};

// Collect a family payment across siblings; each sibling waterfalls their classes.
const collectFamilyPayment = (familyStudents = [], amount, classOrder = [], receiptNo = "", date = "") => {
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
const buildClassWiseReceipt = ({
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
const getManagedClassNames = (classRecords = []) =>
  (Array.isArray(classRecords) ? classRecords : [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.name || entry?.className || entry?.class || ""))
    .map(normalizeClassName)
    .filter(Boolean);

// ============================================================================
// SCREEN
// ============================================================================

const STUDENTS_NS = "admin-student-management-students";
const CLASSES_NS = "admin-class-management-classes";
const PREFERENCES_NS = "admin-class-preferences";

const StatusPill = ({ status }) => {
  const palette =
    status === "Paid"
      ? { bg: "#DCFCE7", fg: "#15803D" }
      : status === "Partial"
      ? { bg: "#FEF3C7", fg: "#B45309" }
      : { bg: "#FEE2E2", fg: "#B91C1C" };
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.fg }]}>{status}</Text>
    </View>
  );
};

export default function FinanceScreen({ user }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const studentsState = useModuleState(STUDENTS_NS);
  const classesState = useModuleState(CLASSES_NS);
  const preferencesState = useModuleState(PREFERENCES_NS);

  const [search, setSearch] = useState("");
  const [selectedClassName, setSelectedClassName] = useState(""); // class drill-down (like web)
  const [selectedAdmission, setSelectedAdmission] = useState("");
  const [saving, setSaving] = useState(false);

  // assign form
  const [assignClass, setAssignClass] = useState("");
  const [assignAmount, setAssignAmount] = useState("");
  const [assignNote, setAssignNote] = useState("");

  // collect form
  const [paymentMode, setPaymentMode] = useState("individual"); // individual | family
  const [collectTargetId, setCollectTargetId] = useState("");
  const [collectAmount, setCollectAmount] = useState("");

  const [latestReceipt, setLatestReceipt] = useState(null);

  const loading = studentsState.loading || classesState.loading || preferencesState.loading;

  const rawStudents = studentsState.items;

  const students = useMemo(() => rawStudents.map(normalizeFinanceStudent), [rawStudents]);

  const classOrder = useMemo(() => getClassOrder(preferencesState.items), [preferencesState.items]);
  const managedClassNames = useMemo(() => getManagedClassNames(classesState.items), [classesState.items]);
  // Assign-dropdown / waterfall order source: preferences first (matches web getClassOrder),
  // falling back to the class-management list so a fee can always be assigned.
  const classNameOptions = classOrder.length ? classOrder : managedClassNames;

  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) => {
      const haystack = [student.name, student.admissionNumber, student.fatherName, student.guardianPhone, student.className]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [search, students]);

  // Class-first drill-down (like the web): summarise every class, then list its students.
  const classSummaries = useMemo(() => {
    const byClass = new Map();
    students.forEach((student) => {
      const cn = getStudentClassName(student) || "Unassigned";
      const totals = studentFeeTotals(student);
      const cur = byClass.get(cn) || { className: cn, count: 0, collected: 0, pending: 0 };
      cur.count += 1;
      cur.collected += totals.paid;
      cur.pending += totals.pending;
      byClass.set(cn, cur);
    });
    const ordered = [];
    classNameOptions.forEach((cn) => {
      if (byClass.has(cn)) {
        ordered.push(byClass.get(cn));
        byClass.delete(cn);
      }
    });
    byClass.forEach((v) => ordered.push(v));
    return ordered;
  }, [students, classNameOptions]);

  const classStudents = useMemo(() => {
    if (!selectedClassName) return [];
    return students.filter((student) => (getStudentClassName(student) || "Unassigned") === selectedClassName);
  }, [students, selectedClassName]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.admissionNumber === selectedAdmission) || null,
    [students, selectedAdmission]
  );

  // Class options for the assign-fee dropdown: managed/preference classes plus the
  // selected student's own class (kept even when it's not in the managed list),
  // matching the previous chip behaviour. Values are the class name strings.
  const classSelectOptions = useMemo(() => {
    const list = [...classNameOptions];
    const own = selectedStudent?.className;
    if (own && !list.includes(own)) list.push(own);
    return list;
  }, [classNameOptions, selectedStudent]);

  const familyStudents = useMemo(() => {
    if (!selectedStudent) return [];
    const key = getFamilyKey(selectedStudent);
    const group = students.filter((student) => getFamilyKey(student) === key);
    return group.length ? group : [selectedStudent];
  }, [students, selectedStudent]);

  const ledgerEntries = useMemo(() => {
    if (!selectedStudent) return [];
    return sortedFeeLedger(ensureFeeLedger(selectedStudent), classOrder);
  }, [selectedStudent, classOrder]);

  const ledgerFeeTotals = useMemo(() => ledgerTotals(ledgerEntries), [ledgerEntries]);

  const overallTotals = useMemo(() => {
    return students.reduce(
      (acc, student) => {
        const totals = studentFeeTotals(student);
        acc.collected += totals.paid;
        acc.pending += totals.pending;
        return acc;
      },
      { collected: 0, pending: 0 }
    );
  }, [students]);

  const openLedger = useCallback((student) => {
    setSelectedAdmission(student.admissionNumber);
    setPaymentMode("individual");
    setCollectTargetId(student.id || student.admissionNumber);
    setAssignClass(student.className || "");
    setAssignAmount("");
    setAssignNote("");
    setCollectAmount("");
    setLatestReceipt(null);
    banner.clear();
  }, [banner]);

  // Persist an array of updated student records back into the students namespace,
  // matching web semantics (match on normalized admission number, replace in place).
  const persistUpdatedStudents = useCallback(
    async (updatedByAdmission) => {
      const next = rawStudents.map((student, index) => {
        const admission = normalizeFinanceStudent(student, index).admissionNumber;
        return updatedByAdmission.get(admission) || student;
      });
      await studentsState.persist(next);
    },
    [rawStudents, studentsState]
  );

  // POST an optional in-app notification (NO email; matches web notifyFeePayment shape).
  const notifyFeePayment = useCallback((admissionNumber, amount) => {
    if (!admissionNumber) return;
    apiRequest("/notifications", {
      method: "POST",
      body: JSON.stringify({
        title: "Fee Payment Received",
        description: `A payment of ${formatCurrency(amount)} was recorded to your account.`,
        type: "fee",
        linkPage: "Fees",
        recipientRole: "student",
        recipientStudentId: admissionNumber,
      }),
    }).catch(() => {
      /* notifications are best-effort; never block the collection */
    });
  }, []);

  const notifyFeeReminder = useCallback((student) => {
    const admission = getStudentAdmissionNumber(student);
    if (!admission) return Promise.resolve();
    const pending = studentFeeTotals(student).pending;
    return apiRequest("/notifications", {
      method: "POST",
      body: JSON.stringify({
        title: "Fee Reminder",
        description: `Pending fee for ${getStudentDisplayName(student)} is ${formatCurrency(pending)}. Please clear the dues at the earliest.`,
        type: "fee",
        linkPage: "Fees",
        recipientRole: "student",
        recipientStudentId: admission,
      }),
    });
  }, []);

  async function handleAssignFee() {
    if (!selectedStudent) return banner.showError("Select a student before assigning fees.");
    const target = assignClass.trim();
    if (!target) return banner.showError("Choose a class to assign fees for.");
    const amount = parseAmount(assignAmount);
    if (amount <= 0) return banner.showError("Enter a valid fee amount.");
    setSaving(true);
    banner.clear();
    try {
      const updated = assignClassFeeToStudent(selectedStudent, target, amount, assignNote);
      const map = new Map([[getStudentAdmissionNumber(updated), updated]]);
      await persistUpdatedStudents(map);
      setAssignAmount("");
      setAssignNote("");
      banner.showSuccess(`Fee of ${formatCurrency(amount)} set for ${target}.`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleCollectPayment() {
    if (!selectedStudent) return banner.showError("Select a student before collecting a payment.");
    const amount = parseAmount(collectAmount);
    if (amount <= 0) return banner.showError("Enter a valid payment amount.");

    const receiptNo = `REC-${Date.now().toString().slice(-6)}`;
    const nowISO = new Date().toISOString();
    setSaving(true);
    banner.clear();

    try {
      if (paymentMode === "individual") {
        const targetStudent =
          familyStudents.find((student) => student.id === collectTargetId || student.admissionNumber === collectTargetId) ||
          selectedStudent;
        const result = collectStudentPayment(targetStudent, amount, classOrder, receiptNo, nowISO);
        if (!result.breakdown.length) {
          banner.showError("No pending balance found for the selected student.");
          setSaving(false);
          return;
        }
        const map = new Map([[getStudentAdmissionNumber(result.student), result.student]]);
        await persistUpdatedStudents(map);

        const receipt = buildClassWiseReceipt({
          payerName: getStudentDisplayName(result.student),
          admissionNumber: getStudentAdmissionNumber(result.student),
          amount,
          breakdown: result.breakdown,
          mode: "individual",
          contact: result.student.guardianPhone,
          guardianEmail: result.student.guardianEmail,
        });
        setLatestReceipt(receipt);
        setCollectAmount("");
        notifyFeePayment(getStudentAdmissionNumber(result.student), amount);
        banner.showSuccess(`Receipt ${receipt.receiptNo} committed.`);
        setSaving(false);
        return;
      }

      // family mode — waterfall across siblings (student-by-student, lowest class first)
      const result = collectFamilyPayment(familyStudents, amount, classOrder, receiptNo, nowISO);
      if (!result.breakdown.length) {
        banner.showError("No pending balance found for this family.");
        setSaving(false);
        return;
      }
      const map = new Map(result.students.map((student) => [getStudentAdmissionNumber(student), student]));
      await persistUpdatedStudents(map);

      const receipt = buildClassWiseReceipt({
        payerName: selectedStudent.fatherName || selectedStudent.motherName || "Guardian",
        admissionNumber: selectedStudent.admissionNumber,
        amount,
        breakdown: result.breakdown,
        mode: "family",
        contact: selectedStudent.guardianPhone,
        guardianEmail: selectedStudent.guardianEmail,
      });
      setLatestReceipt(receipt);
      setCollectAmount("");

      const perStudentTotals = new Map();
      result.breakdown.forEach((row) => {
        if (!row.admissionNumber) return;
        perStudentTotals.set(row.admissionNumber, (perStudentTotals.get(row.admissionNumber) || 0) + parseAmount(row.amount));
      });
      perStudentTotals.forEach((studentAmount, admissionNumber) => notifyFeePayment(admissionNumber, studentAmount));
      banner.showSuccess(`Family receipt ${receipt.receiptNo} committed.`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  function handleSendReminder() {
    if (!selectedStudent) return;
    Alert.alert(
      "Send fee reminder",
      `Notify ${selectedStudent.name} about ${formatCurrency(studentFeeTotals(selectedStudent).pending)} pending?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            try {
              await notifyFeeReminder(selectedStudent);
              banner.showSuccess("Fee reminder notification sent.");
            } catch (err) {
              banner.showError(err);
            }
          },
        },
      ]
    );
  }

  // ---- render -------------------------------------------------------------

  if (loading) {
    return (
      <ScreenShell title="Finance">
        <LoadingCard text="Loading finance ledger..." />
      </ScreenShell>
    );
  }

  const renderStudentCard = (student) => {
    const totals = studentFeeTotals(student);
    return (
      <Card key={student.admissionNumber}>
        <View style={styles.rowHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: palette.ink }]}>{student.name}</Text>
            <Text style={[styles.sub, { color: palette.inkSoft }]}>
              {student.admissionNumber} · {student.className}
              {student.fatherName ? ` · ${student.fatherName}` : ""}
            </Text>
          </View>
          <StatusPill status={totals.pending > 0 ? (totals.paid > 0 ? "Partial" : "Due") : "Paid"} />
        </View>
        <Divider />
        <View style={styles.metaRow}>
          <Meta label="Assigned" value={formatCurrency(totals.assigned)} />
          <Meta label="Paid" value={formatCurrency(totals.paid)} tone="#15803D" />
          <Meta label="Pending" value={formatCurrency(totals.pending)} tone="#DC2626" />
        </View>
        <ButtonRow>
          <SmallButton label="Open Ledger" icon="eye-outline" onPress={() => openLedger(student)} />
        </ButtonRow>
      </Card>
    );
  };

  return (
    <ScreenShell title="Finance" refreshing={loading} onRefresh={() => {
      studentsState.reload();
      classesState.reload();
      preferencesState.reload();
    }}>
      <Hero
        icon="cash-outline"
        title={`${formatCurrency(overallTotals.collected)} collected`}
        subtitle={`${formatCurrency(overallTotals.pending)} pending across ${students.length} student(s). Class-wise ledger, waterfall collection.`}
      />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      {!selectedStudent ? (
        <>
          <Card>
            <SectionTitle right={selectedClassName ? (
              <SmallButton label="All Classes" icon="grid-outline" onPress={() => setSelectedClassName("")} />
            ) : null}>
              {search.trim() ? "Search Results" : selectedClassName || "Classes"}
            </SectionTitle>
            <TextField
              label="Search any student"
              value={search}
              onChangeText={setSearch}
              placeholder="Name, admission no., father or phone"
              autoCapitalize="none"
            />
          </Card>

          {search.trim() ? (
            // Global search across all classes
            !filteredStudents.length ? (
              <EmptyState icon="wallet-outline" title="No students found" text="Adjust your search." />
            ) : (
              filteredStudents.slice(0, 60).map(renderStudentCard)
            )
          ) : selectedClassName ? (
            // Students inside the chosen class
            !classStudents.length ? (
              <EmptyState icon="people-outline" title="No students" text={`No students in ${selectedClassName}.`} />
            ) : (
              classStudents.map(renderStudentCard)
            )
          ) : (
            // Class list first (like the web)
            !classSummaries.length ? (
              <EmptyState icon="school-outline" title="No classes yet" text="No student records synced yet." />
            ) : (
              classSummaries.map((cls) => (
                <Card key={cls.className}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.name, { color: palette.ink }]}>{cls.className}</Text>
                      <Text style={[styles.sub, { color: palette.inkSoft }]}>
                        {cls.count} student{cls.count === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <StatusPill status={cls.pending > 0 ? "Due" : "Paid"} />
                  </View>
                  <Divider />
                  <View style={styles.metaRow}>
                    <Meta label="Collected" value={formatCurrency(cls.collected)} tone="#15803D" />
                    <Meta label="Pending" value={formatCurrency(cls.pending)} tone="#DC2626" />
                  </View>
                  <ButtonRow>
                    <SmallButton label="View Students" icon="arrow-forward-outline" onPress={() => setSelectedClassName(cls.className)} />
                  </ButtonRow>
                </Card>
              ))
            )
          )}
        </>
      ) : (
        <>
          <Card>
            <View style={styles.rowHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: palette.ink }]}>{selectedStudent.name}</Text>
                <Text style={[styles.sub, { color: palette.inkSoft }]}>
                  {selectedStudent.admissionNumber} · {selectedStudent.className}
                </Text>
              </View>
              <SmallButton label="Back" icon="arrow-back-outline" onPress={() => setSelectedAdmission("")} />
            </View>
            <Divider />
            <View style={styles.metaRow}>
              <Meta label="Father" value={selectedStudent.fatherName || "-"} />
              <Meta label="Contact" value={selectedStudent.guardianPhone || "-"} />
            </View>
            <View style={styles.metaRow}>
              <Meta label="Assigned" value={formatCurrency(ledgerFeeTotals.assigned)} />
              <Meta label="Paid" value={formatCurrency(ledgerFeeTotals.paid)} tone="#15803D" />
              <Meta label="Pending" value={formatCurrency(ledgerFeeTotals.pending)} tone="#DC2626" />
            </View>
            <ButtonRow>
              <SmallButton label="Send Reminder" icon="notifications-outline" onPress={handleSendReminder} />
            </ButtonRow>
          </Card>

          <Card>
            <SectionTitle>Class-wise Fee Ledger</SectionTitle>
            {!ledgerEntries.length ? (
              <Text style={[styles.empty, { color: palette.inkSoft }]}>No class fee assigned yet. Use Assign Fee below to set one.</Text>
            ) : (
              ledgerEntries.map((entry) => (
                <View key={entry.className} style={[styles.ledgerRow, { borderBottomColor: palette.cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.ledgerHead}>
                      <Text style={[styles.ledgerClass, { color: palette.ink }]}>{entry.className}</Text>
                      <StatusPill status={entryStatus(entry)} />
                    </View>
                    <Text style={[styles.ledgerLine, { color: palette.inkLabel }]}>
                      Assigned {formatCurrency(entry.assigned)} · Paid{" "}
                      <Text style={{ color: "#15803D" }}>{formatCurrency(entry.paid)}</Text> · Pending{" "}
                      <Text style={{ color: entryPending(entry) > 0 ? "#DC2626" : palette.inkFaint }}>
                        {formatCurrency(entryPending(entry))}
                      </Text>
                    </Text>
                    {!!entry.note && <Text style={[styles.ledgerNote, { color: palette.inkFaint }]}>Note: {entry.note}</Text>}
                  </View>
                </View>
              ))
            )}
          </Card>

          <Card>
            <SectionTitle>Assign / Edit Class Fee</SectionTitle>
            <Text style={[styles.hintText, { color: palette.inkSoft }]}>Set the annual fee for a class on {selectedStudent.name}.</Text>
            {classSelectOptions.length ? (
              <Select
                label="Class"
                options={classSelectOptions}
                value={assignClass}
                onChange={setAssignClass}
                placeholder="Select class"
              />
            ) : (
              <TextField
                label="Class"
                value={assignClass}
                onChangeText={setAssignClass}
                placeholder="Class name (e.g. Class 6)"
              />
            )}
            <TextField
              label="Amount"
              value={assignAmount}
              onChangeText={setAssignAmount}
              placeholder="Fee amount"
              keyboardType="numeric"
            />
            <TextField
              label="Note (optional)"
              value={assignNote}
              onChangeText={setAssignNote}
              placeholder="Accounts note"
            />
            <PrimaryButton icon="pricetag-outline" label="Save Fee" onPress={handleAssignFee} loading={saving} />
          </Card>

          <Card>
            <SectionTitle>Collect Payment</SectionTitle>
            {familyStudents.length > 1 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: palette.inkLabel }]}>Mode</Text>
                <Segmented
                  options={[
                    { value: "individual", label: "Individual" },
                    { value: "family", label: "Family" },
                  ]}
                  value={paymentMode}
                  onChange={setPaymentMode}
                />
              </View>
            )}

            {paymentMode === "individual" && familyStudents.length > 1 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.fieldLabel, { color: palette.inkLabel }]}>Student</Text>
                <View style={styles.chipWrap}>
                  {familyStudents.map((student) => {
                    const id = student.id || student.admissionNumber;
                    const due = studentFeeTotals(student).pending;
                    return (
                      <SmallButton
                        key={id}
                        label={`${student.name} · ${formatCurrency(due)}`}
                        active={collectTargetId === id}
                        onPress={() => setCollectTargetId(id)}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            <Text style={[styles.hintText, { color: palette.inkSoft }]}>
              Amount waterfalls into unpaid classes in class order (lowest class first)
              {paymentMode === "family" ? ", repeated across each sibling." : "."}
            </Text>
            <TextField
              label="Amount to collect"
              value={collectAmount}
              onChangeText={setCollectAmount}
              placeholder="Amount"
              keyboardType="numeric"
            />
            <PrimaryButton icon="send-outline" label="Commit Receipt" onPress={handleCollectPayment} loading={saving} />
          </Card>

          {!!latestReceipt && (
            <Card>
              <SectionTitle>Receipt {latestReceipt.receiptNo}</SectionTitle>
              <Text style={[styles.receiptMeta, { color: palette.inkFaint }]}>{latestReceipt.timestamp}</Text>
              <View style={styles.metaRow}>
                <Meta label="Payer" value={latestReceipt.payerName || "-"} />
                <Meta label="Mobile" value={latestReceipt.contact || "-"} />
              </View>
              <Divider />
              <Text style={[styles.fieldLabel, { color: palette.inkLabel }]}>Class-wise Allocation</Text>
              {latestReceipt.breakdown.map((item, index) => (
                <View key={`${item.admissionNumber || ""}-${item.className}-${index}`} style={[styles.allocRow, { borderBottomColor: palette.cardBorder }]}>
                  <Text style={[styles.allocName, { color: palette.ink }]}>
                    {item.name ? `${item.name} · ` : ""}
                    {item.className}
                  </Text>
                  <Text style={[styles.allocAmount, { color: palette.ink }]}>{formatCurrency(item.amount)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Collected</Text>
                <Text style={styles.totalValue}>{formatCurrency(latestReceipt.amountPaid)}</Text>
              </View>
            </Card>
          )}
        </>
      )}
    </ScreenShell>
  );
}

function Meta({ label, value, tone }) {
  const { palette } = useTheme();
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaLabel, { color: palette.inkFaint }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: palette.ink }, tone && { color: tone }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center" },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  pillText: { fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 8 },
  meta: { minWidth: 90 },
  metaLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "900", marginBottom: 2 },
  metaValue: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  hintText: { color: "#64748B", fontSize: 12, fontWeight: "700", marginBottom: 10, lineHeight: 17 },
  fieldLabel: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 6, marginLeft: 2 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  empty: { color: "#64748B", fontWeight: "700", fontSize: 13, paddingVertical: 6 },
  ledgerRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  ledgerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  ledgerClass: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  ledgerLine: { color: "#475569", fontSize: 12, fontWeight: "700" },
  ledgerNote: { color: "#94A3B8", fontSize: 11, fontWeight: "700", marginTop: 3 },
  receiptMeta: { color: "#94A3B8", fontSize: 11, fontWeight: "700", marginBottom: 10 },
  allocRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  allocName: { color: "#0F172A", fontSize: 13, fontWeight: "700", flex: 1, marginRight: 8 },
  allocAmount: { color: "#0F172A", fontSize: 13, fontWeight: "900" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  totalLabel: { color: "#fff", fontWeight: "900", fontSize: 13 },
  totalValue: { color: "#fff", fontWeight: "900", fontSize: 15 },
};
