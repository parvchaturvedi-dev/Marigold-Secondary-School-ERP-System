// Finance — admin manual fee collection, mobile parity with web Admin/Finance.jsx.
// Assign class fee, collect individual/family payments (waterfall = lowest unpaid
// class first), build an on-screen receipt, and optionally POST a reminder/receipt
// notification. All money-core lives in ./feeCore (ported 1:1 from frontend/src/
// components/common/financeData.js) so the persisted student.feeLedger shape stays
// IDENTICAL to web (so /api/fees and the web page keep working unchanged). The AI
// Assistant screen reuses the same feeCore helpers.
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  ButtonRow,
  Card,
  DateField,
  Divider,
  EmptyState,
  Hero,
  IconButton,
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
import {
  assignClassFeeToStudent,
  buildClassWiseReceipt,
  collectFamilyPayment,
  collectStudentPayment,
  deleteLedgerPayment,
  editLedgerPayment,
  ensureFeeLedger,
  entryPending,
  entryStatus,
  formatCurrency,
  formatPaymentDateTime,
  getClassOrder,
  getFamilyKey,
  getManagedClassNames,
  getStudentAdmissionNumber,
  getStudentClassName,
  getStudentDisplayName,
  ledgerTotals,
  normalizeFinanceStudent,
  parseAmount,
  sortedFeeLedger,
  studentFeeTotals,
} from "./feeCore";

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

  // Inline editor for correcting a single recorded payment.
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [editPayAmount, setEditPayAmount] = useState("");
  const [editPayDate, setEditPayDate] = useState("");

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
      // Notify the student that a fee was assigned.
      apiRequest("/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: "Fee Assigned",
          description: `A fee of ${formatCurrency(amount)} has been assigned for ${target}.`,
          type: "fee",
          linkPage: "Fees",
          recipientRole: "student",
          recipientStudentId: getStudentAdmissionNumber(updated),
        }),
      }).catch(() => {});
      setAssignAmount("");
      setAssignNote("");
      banner.showSuccess(`Fee of ${formatCurrency(amount)} set for ${target}.`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  const startEditPayment = (payment) => {
    setEditingPaymentId(payment.id);
    setEditPayAmount(String(parseAmount(payment.amount)));
    setEditPayDate((payment.date || "").slice(0, 10));
  };

  const cancelEditPayment = () => {
    setEditingPaymentId("");
    setEditPayAmount("");
    setEditPayDate("");
  };

  // Save a correction to one recorded payment (amount and/or date). The original
  // time-of-day is preserved when only the date is changed.
  async function handleSavePaymentEdit(entry, payment) {
    const amount = parseAmount(editPayAmount);
    if (amount <= 0) return banner.showError("Enter a valid payment amount.");
    setSaving(true);
    banner.clear();
    try {
      let newIso = payment.date;
      if (editPayDate) {
        const d = new Date(payment.date || Date.now());
        const [y, m, day] = editPayDate.split("-").map(Number);
        if (y && m && day) {
          d.setFullYear(y, m - 1, day);
          newIso = d.toISOString();
        }
      }
      const updated = editLedgerPayment(selectedStudent, entry.className, payment.id, { amount, date: newIso });
      const map = new Map([[getStudentAdmissionNumber(updated), updated]]);
      await persistUpdatedStudents(map);
      cancelEditPayment();
      banner.showSuccess("Payment updated.");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  function handleDeletePayment(entry, payment) {
    Alert.alert(
      "Delete Payment",
      `Remove ${formatCurrency(payment.amount)} recorded on ${formatPaymentDateTime(payment.date)} for ${entry.className}? The paid total will be recalculated.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            banner.clear();
            try {
              const updated = deleteLedgerPayment(selectedStudent, entry.className, payment.id);
              const map = new Map([[getStudentAdmissionNumber(updated), updated]]);
              await persistUpdatedStudents(map);
              banner.showSuccess("Payment deleted.");
            } catch (err) {
              banner.showError(err);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
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

                    {entry.payments && entry.payments.length > 0 && (
                      <View style={styles.payList}>
                        <Text style={[styles.payListTitle, { color: palette.inkSoft }]}>Payments</Text>
                        {entry.payments.map((payment) => (
                          <View key={payment.id} style={[styles.payRow, { borderTopColor: palette.cardBorder }]}>
                            {editingPaymentId === payment.id ? (
                              <View style={{ flex: 1 }}>
                                <TextField
                                  label="Amount"
                                  value={editPayAmount}
                                  onChangeText={setEditPayAmount}
                                  placeholder="Amount"
                                  keyboardType="numeric"
                                />
                                <DateField label="Date" value={editPayDate} onChange={setEditPayDate} />
                                <ButtonRow>
                                  <SmallButton label="Save" icon="checkmark-outline" onPress={() => handleSavePaymentEdit(entry, payment)} disabled={saving} />
                                  <SmallButton label="Cancel" icon="close-outline" onPress={cancelEditPayment} />
                                </ButtonRow>
                              </View>
                            ) : (
                              <>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.payAmount, { color: palette.ink }]}>{formatCurrency(payment.amount)}</Text>
                                  <Text style={[styles.payMeta, { color: palette.inkSoft }]}>
                                    {formatPaymentDateTime(payment.date)}
                                    {payment.mode ? ` · ${payment.mode}` : ""}
                                    {payment.receiptNo ? ` · ${payment.receiptNo}` : ""}
                                  </Text>
                                </View>
                                <View style={styles.payActions}>
                                  <IconButton icon="create-outline" onPress={() => startEditPayment(payment)} />
                                  <IconButton icon="trash-outline" tone="danger" onPress={() => handleDeletePayment(entry, payment)} />
                                </View>
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
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
  payList: { marginTop: 8 },
  payListTitle: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  payRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: 1, gap: 8 },
  payAmount: { fontSize: 13, fontWeight: "900" },
  payMeta: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  payActions: { flexDirection: "row", alignItems: "center", gap: 6 },
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
