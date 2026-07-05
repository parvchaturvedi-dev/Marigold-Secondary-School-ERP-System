// Class Management — full parity with web Admin/ClassManagement + ClassDetail + ClassPreferences.
// One bespoke mobile screen: class workspace grid, per-class detail (assign class teacher,
// map subjects, roster with retention toggle + remove-to-alumni), session "Next Journey"
// promotion, and class-preference hierarchy (add / reorder / rename / remove).
//
// Persisted shapes mirror the web pages EXACTLY so web and mobile stay interoperable:
//   admin-class-management-classes   -> [{ id, name, classTeacherId, classTeacherName, teacher, studentCount, ... }]
//   admin-class-preferences          -> [{ id, name }]
//   admin-subjects-class-mapping     -> [{ className, subjects: [name] }]
//   admin-student-management-students-> student records (isRepeating flag, feeLedger, class/className)
//   admin-finance-alumni-pending     -> [{ ...student, status, removedFrom?, removedAt?, promotedOut? }]
//   admin-teacher-management-list    -> teacher records (read + class-teacher picker)
//   admin-subjects-global            -> [{ name }] (read + subject picker)
//
// Finance/promotion helpers (ensureFeeLedger, getClassOrder, isLastClass, nextClassName,
// studentHasPending, ensureClassRow, etc.) are re-implemented INLINE from
// frontend/src/components/common/financeData.js since mobile cannot import from frontend/src.
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  IconButton,
  LoadingCard,
  MultiSelect,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  Select,
  SmallButton,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";

/* ============================================================================
   Inline helpers re-implemented from financeData.js / masterData.js
   (mobile cannot import from frontend/src — persisted shapes kept identical).
   ============================================================================ */

const parseAmount = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const amount = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

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

const getPaidFees = (student = {}) =>
  getFirstAmount(student, ["paidFees", "collectedFees", "feesPaid", "paid"]);

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

const normalizeClassName = (value = "") => String(value || "").trim();

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

const studentHasPending = (student = {}) => studentFeeTotals(student).pending > 0;

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

// Ensure a (possibly empty) ledger row exists for a class — used on promotion so
// the new class shows up ready for the admin to set its fee.
const ensureClassRow = (student = {}, className) => {
  const target = normalizeClassName(className);
  if (!target) return student;
  const ledger = ensureFeeLedger(student);
  if (ledger.some((entry) => entry.className.toLowerCase() === target.toLowerCase())) {
    return applyLedgerToStudent(student, ledger);
  }
  return applyLedgerToStudent(student, [...ledger, normalizeLedgerEntry({ className: target, assigned: 0, paid: 0 })]);
};

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

const isLastClass = (className, classOrder = []) =>
  classOrder.length > 0 && classRankIn(className, classOrder) === classOrder.length - 1;

const nextClassName = (className, classOrder = []) => {
  const idx = classRankIn(className, classOrder);
  if (idx === Number.MAX_SAFE_INTEGER || idx >= classOrder.length - 1) return "";
  return classOrder[idx + 1];
};

// ---- masterData.js helpers -------------------------------------------------
const getClassName = (classRecord = {}) =>
  classRecord.name || classRecord.className || classRecord.class || "";

const getPreferenceClassName = (classRecord = {}) =>
  classRecord.name || classRecord.className || classRecord.class || String(classRecord || "");

const classRank = (className = "") => {
  const normalized = String(className).trim().toLowerCase();
  if (normalized === "nursery") return -3;
  if (normalized === "lkg") return -2;
  if (normalized === "ukg") return -1;
  return Number(String(className).match(/\d+/)?.[0] || 999);
};

const sortClassNames = (classNames = [], preferredClassNames = []) => {
  const preferenceRank = new Map(
    (Array.isArray(preferredClassNames) ? preferredClassNames : [])
      .map(getPreferenceClassName)
      .filter(Boolean)
      .map((name, index) => [String(name).trim().toLowerCase(), index])
  );
  const hasPreferences = preferenceRank.size > 0;

  return [...new Set(classNames.filter(Boolean))].sort((a, b) => {
    const normalizedA = String(a).trim().toLowerCase();
    const normalizedB = String(b).trim().toLowerCase();
    const preferredA = preferenceRank.get(normalizedA);
    const preferredB = preferenceRank.get(normalizedB);

    if (hasPreferences && preferredA !== undefined && preferredB !== undefined) {
      return preferredA - preferredB;
    }
    if (hasPreferences && preferredA !== undefined) return -1;
    if (hasPreferences && preferredB !== undefined) return 1;

    return classRank(a) - classRank(b) || String(a).localeCompare(String(b));
  });
};

// ---- Teacher shape helpers (from ClassManagement/ClassDetail) --------------
const getTeacherId = (teacher = {}) =>
  teacher.id || teacher.teacherId || teacher.empId || teacher.employeeId || "";
const getTeacherName = (teacher = {}) => teacher.name || teacher.displayName || "";

const normalizeClassKey = (className = "") => String(className).trim().toLowerCase();

// Promote a student into the next class, keeping the ledger intact and
// pre-creating an empty fee row for the new class.
const promoteStudentToClass = (student, nextClass, currentClassName) => {
  const withNewRow = ensureClassRow(student, nextClass);
  return {
    ...withNewRow,
    previousClass: currentClassName,
    class: nextClass,
    className: nextClass,
    targetClass: nextClass,
    promotedOut: false,
    status: withNewRow.status || "Active",
    rawProfile: {
      ...(withNewRow.rawProfile || {}),
      targetClass: nextClass,
    },
  };
};

// Mark a student as graduated/passed-out, moving them out of the active roster.
const markStudentPassedOut = (student, currentClassName) => ({
  ...student,
  previousClass: currentClassName,
  promotedOut: true,
  status: "Passed Out",
  rawProfile: {
    ...(student.rawProfile || {}),
    targetClass: "",
  },
});

const resolveClassTeacher = (classRecord = {}, teachers = []) => {
  const storedTeacherId = classRecord.classTeacherId || classRecord.teacherId || "";
  const storedTeacherName = classRecord.classTeacherName || classRecord.teacher || "";
  const byStoredId = storedTeacherId
    ? teachers.find((teacher) => getTeacherId(teacher) === storedTeacherId)
    : null;
  const byCharge = teachers.find(
    (teacher) => teacher.isClassTeacher === "Yes" && teacher.assignedClassTeacherFor === classRecord.name
  );
  const teacher = byStoredId || byCharge;

  return {
    id: teacher ? getTeacherId(teacher) : storedTeacherId,
    name: teacher?.name || storedTeacherName || "",
  };
};

/* ============================================================================
   Screen
   ============================================================================ */

export default function ClassManagementScreen({ user }) {
  const banner = useBanner();
  const { palette } = useTheme();

  // Seven module-state namespaces (mirrors web useMongoState usage).
  const classesNs = useModuleState("admin-class-management-classes");
  const prefsNs = useModuleState("admin-class-preferences");
  const alumniNs = useModuleState("admin-finance-alumni-pending");
  const studentsNs = useModuleState("admin-student-management-students");
  const teachersNs = useModuleState("admin-teacher-management-list");
  const subjectsGlobalNs = useModuleState("admin-subjects-global");
  const classSubjectsNs = useModuleState("admin-subjects-class-mapping");

  const classes = classesNs.items;
  const orderedClasses = prefsNs.items;
  const allTeachers = teachersNs.items;
  const allStudents = studentsNs.items;
  const globalSubjects = subjectsGlobalNs.items;
  const classSubjectMappings = classSubjectsNs.items;

  const loading =
    classesNs.loading ||
    prefsNs.loading ||
    studentsNs.loading ||
    teachersNs.loading ||
    subjectsGlobalNs.loading ||
    classSubjectsNs.loading ||
    alumniNs.loading;

  const [view, setView] = useState("workspace"); // "workspace" | "detail" | "preferences"
  const [selectedClassContext, setSelectedClassContext] = useState(null);

  const onRefresh = useCallback(() => {
    classesNs.reload();
    prefsNs.reload();
    alumniNs.reload();
    studentsNs.reload();
    teachersNs.reload();
    subjectsGlobalNs.reload();
    classSubjectsNs.reload();
  }, [classesNs, prefsNs, alumniNs, studentsNs, teachersNs, subjectsGlobalNs, classSubjectsNs]);

  // ---- Derived class list (mirrors useMasterData/deriveMasterData) ---------
  // Class names sourced from configured classes + student rosters + subject
  // mappings + preferences, sorted by preferences then natural class rank.
  const displayClasses = useMemo(() => {
    const preferredClassNames = orderedClasses.map(getPreferenceClassName).filter(Boolean);
    const configuredClassNames = classes.map(getClassName);
    const studentClassNames = allStudents.map((s) => getStudentClassName(s));
    const mappedClassNames = classSubjectMappings.map((item) => item.className);
    const classNames = sortClassNames(
      [...configuredClassNames, ...studentClassNames, ...mappedClassNames, ...preferredClassNames],
      preferredClassNames
    );
    return classNames.map((name) => {
      const source = classes.find((item) => getClassName(item) === name) || {};
      const classTeacher = resolveClassTeacher({ ...source, name }, allTeachers);
      return {
        ...source,
        id: source.id || name,
        name,
        classTeacherId: classTeacher.id,
        classTeacherName: classTeacher.name,
        teacher: classTeacher.name,
        studentCount: allStudents.filter((s) => getStudentClassName(s) === name).length,
      };
    });
  }, [classes, orderedClasses, allStudents, classSubjectMappings, allTeachers]);

  // ---- SESSION PROMOTION (mirrors handleNextJourneyPromotion) --------------
  const runPromotion = useCallback(async () => {
    const classOrder = getClassOrder(orderedClasses);
    if (classOrder.length === 0) {
      banner.showError("Please configure class hierarchy in Class Preferences before promotion.");
      return;
    }

    let promotedCount = 0;
    let retainedCount = 0;
    let graduatedCount = 0;
    let movedToPendingCount = 0;
    const newAlumni = [];
    const remainingStudents = [];

    allStudents.forEach((student) => {
      const currentClassName = getStudentClassName(student);

      // Retained: repeating students stay exactly as-is.
      if (student.isRepeating) {
        retainedCount += 1;
        remainingStudents.push(student);
        return;
      }

      // Unknown/unranked class: leave untouched.
      if (
        !currentClassName ||
        classOrder.every((name) => normalizeClassKey(name) !== normalizeClassKey(currentClassName))
      ) {
        remainingStudents.push(student);
        return;
      }

      if (isLastClass(currentClassName, classOrder)) {
        if (studentHasPending(student)) {
          movedToPendingCount += 1;
          newAlumni.push(markStudentPassedOut(student, currentClassName));
        } else {
          graduatedCount += 1;
        }
        return;
      }

      const nextClass = nextClassName(currentClassName, classOrder);
      promotedCount += 1;
      remainingStudents.push(promoteStudentToClass(student, nextClass, currentClassName));
    });

    if (promotedCount === 0 && graduatedCount === 0 && movedToPendingCount === 0) {
      banner.showError("No eligible students found for promotion. Please check class hierarchy and roster allocation.");
      return;
    }

    const studentCountByClass = remainingStudents.reduce((acc, student) => {
      const className = getStudentClassName(student);
      if (className) acc[className] = (acc[className] || 0) + 1;
      return acc;
    }, {});

    // Persist students, alumni bucket, and refreshed class counts.
    const classMap = new Map(classes.map((classRecord) => [getClassName(classRecord), classRecord]));
    classOrder.forEach((className) => {
      if (!classMap.has(className)) classMap.set(className, { id: className, name: className });
    });
    const nextClasses = [...classMap.values()].map((classRecord) => ({
      ...classRecord,
      studentCount: studentCountByClass[getClassName(classRecord)] || 0,
    }));

    try {
      await studentsNs.persist(remainingStudents);
      if (newAlumni.length) {
        await alumniNs.persist([...(alumniNs.items || []), ...newAlumni]);
      }
      await classesNs.persist(nextClasses);
    } catch (err) {
      banner.showError(err);
      return;
    }

    let resetNote = "";
    try {
      await apiRequest("/assignments/reset", { method: "POST" });
    } catch (resetError) {
      resetNote = ` Note: assignment reset failed (${resetError.message}). Retry from Assignments.`;
    }

    banner.showSuccess(
      `Academic journey shifted. Promoted: ${promotedCount}, Retained: ${retainedCount}, ` +
        `Graduated: ${graduatedCount}, Moved to pending: ${movedToPendingCount}.${resetNote}`
    );
  }, [orderedClasses, allStudents, classes, studentsNs, alumniNs, classesNs, banner]);

  const handleNextJourneyPromotion = () => {
    banner.clear();
    Alert.alert(
      "Move to Next Journey",
      "CRITICAL ACTION: Trigger the 'Next Journey' promotion? All students will be shifted to their immediate next hierarchical class level.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Promote All", style: "destructive", onPress: runPromotion },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  if (view === "preferences") {
    return (
      <PreferencesView
        banner={banner}
        loading={prefsNs.loading || classesNs.loading}
        orderedClasses={orderedClasses}
        prefsNs={prefsNs}
        classesNs={classesNs}
        onBack={() => {
          banner.clear();
          setView("workspace");
        }}
      />
    );
  }

  if (view === "detail" && selectedClassContext) {
    return (
      <ClassDetailView
        classContext={selectedClassContext}
        user={user}
        banner={banner}
        allTeachers={allTeachers}
        globalSubjects={globalSubjects}
        classSubjectMappings={classSubjectMappings}
        classSubjectsNs={classSubjectsNs}
        classesNs={classesNs}
        studentsNs={studentsNs}
        allStudents={allStudents}
        alumniNs={alumniNs}
        onBack={() => {
          banner.clear();
          setSelectedClassContext(null);
          setView("workspace");
        }}
      />
    );
  }

  return (
    <ScreenShell title="Class Management" refreshing={loading} onRefresh={onRefresh}>
      <Hero
        icon="layers-outline"
        title="Class Management"
        subtitle="Tap a class to explore its roster, faculty and records."
      />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Card>
        <SectionTitle
          right={<SmallButton label="Preferences" icon="settings-outline" onPress={() => setView("preferences")} />}
        >
          Session Control
        </SectionTitle>
        <Text style={[styles.sub, { color: palette.inkSoft }]}>
          Move every student to the next hierarchical class level for a new academic session.
        </Text>
        <PrimaryButton
          icon="swap-horizontal-outline"
          label="Move to Next Journey"
          onPress={handleNextJourneyPromotion}
        />
      </Card>

      <SectionTitle>Classes ({displayClasses.length})</SectionTitle>
      {loading ? (
        <LoadingCard text="Loading classes..." />
      ) : displayClasses.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title="No classes yet"
          text="Add class levels from Preferences to begin."
        />
      ) : (
        displayClasses.map((cls) => (
          <Card key={cls.id}>
            <View style={styles.rowHead}>
              <View style={[styles.badge, { backgroundColor: palette.tile }]}>
                <Text style={[styles.badgeText, { color: palette.ink }]}>
                  {String(cls.name).replace(/\D/g, "") || String(cls.name).charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: palette.ink }]}>{cls.name}</Text>
                <Text style={[styles.sub, { color: palette.inkSoft }]}>
                  Teacher:{" "}
                  <Text style={{ color: cls.classTeacherName ? palette.ink : "#DC2626", fontWeight: "900" }}>
                    {cls.classTeacherName || "N/A"}
                  </Text>
                </Text>
                <Text style={[styles.sub, { color: palette.inkSoft }]}>Strength: {cls.studentCount} students</Text>
              </View>
            </View>
            <Divider />
            <SmallButton
              label="Open Class"
              icon="arrow-forward-outline"
              onPress={() => {
                banner.clear();
                setSelectedClassContext(cls);
                setView("detail");
              }}
            />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

/* ============================================================================
   Class Detail (mirrors ClassDetail.jsx)
   ============================================================================ */

function ClassDetailView({
  classContext,
  user,
  banner,
  allTeachers,
  globalSubjects,
  classSubjectMappings,
  classSubjectsNs,
  classesNs,
  studentsNs,
  allStudents,
  alumniNs,
  onBack,
}) {
  const { palette } = useTheme();
  const availableSubjects = globalSubjects.map((subject) => subject.name).filter(Boolean);
  const classSubjectMapping = classSubjectMappings.find((item) => item.className === classContext.name);
  const persistedSubjectNames = useMemo(
    () => (Array.isArray(classSubjectMapping?.subjects) ? classSubjectMapping.subjects : []),
    [classSubjectMapping]
  );

  const storedTeacherId = classContext.classTeacherId || classContext.teacherId || "";
  const initialClassTeacher = useMemo(() => {
    const fallback = allTeachers.find(
      (teacher) => teacher.isClassTeacher === "Yes" && teacher.assignedClassTeacherFor === classContext.name
    );
    return (
      (storedTeacherId && allTeachers.find((teacher) => getTeacherId(teacher) === storedTeacherId)) ||
      fallback ||
      null
    );
  }, [allTeachers, storedTeacherId, classContext.name]);

  const [currentClassTeacher, setCurrentClassTeacher] = useState({
    id: initialClassTeacher ? getTeacherId(initialClassTeacher) : storedTeacherId,
    name: initialClassTeacher
      ? getTeacherName(initialClassTeacher)
      : classContext.classTeacherName || classContext.teacher || "N/A",
  });
  const [assignedSubjects, setAssignedSubjects] = useState(
    persistedSubjectNames.length ? persistedSubjectNames : classContext.subjects || []
  );
  const [teacherPickerOpen, setTeacherPickerOpen] = useState(false);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- Board-class flag (mirrors ClassDetail board toggle) -----------------
  // A class is "board" when its name is present in the Examination state's
  // `boardClasses` array (read/written via /examinations/state read-modify-write).
  const [isBoard, setIsBoard] = useState(false);
  const [boardSaving, setBoardSaving] = useState(false);

  const loadBoardFlag = useCallback(async () => {
    try {
      const data = await apiRequest("/examinations/state");
      const boardClasses = Array.isArray(data?.boardClasses) ? data.boardClasses : [];
      setIsBoard(boardClasses.includes(classContext.name));
    } catch {
      // Non-fatal: leave the flag as-is if the state can't be read.
    }
  }, [classContext.name]);

  useEffect(() => {
    if (persistedSubjectNames.length) setAssignedSubjects(persistedSubjectNames);
  }, [persistedSubjectNames]);

  useEffect(() => {
    loadBoardFlag();
  }, [loadBoardFlag]);

  // ---- Toggle board-class status (optimistic, reverts on failure) ----------
  const persistBoardClass = async (next) => {
    const previous = isBoard;
    setIsBoard(next); // optimistic
    setBoardSaving(true);
    banner.clear();
    try {
      const updatedBy = user?.username || user?.displayName || "mobile";
      // Read-modify-write the WHOLE examination state so we don't clobber other keys.
      const current = (await apiRequest("/examinations/state")) || {};
      const existing = Array.isArray(current.boardClasses) ? current.boardClasses : [];
      const set = new Set(existing);
      if (next) set.add(classContext.name);
      else set.delete(classContext.name);
      const updatedState = { ...current, boardClasses: [...set] };
      await apiRequest("/examinations/state", {
        method: "PUT",
        body: JSON.stringify({ state: updatedState, updatedBy }),
      });
      banner.showSuccess(
        next
          ? `${classContext.name} marked as a Board Class.`
          : `Board Class status removed from ${classContext.name}.`
      );
      await loadBoardFlag(); // refetch to confirm
    } catch (err) {
      setIsBoard(previous); // revert
      banner.showError(err);
    } finally {
      setBoardSaving(false);
    }
  };

  const handleToggleBoardClass = () => {
    const next = !isBoard;
    banner.clear();
    const message = next
      ? `Mark ${classContext.name} as a BOARD CLASS?\n\nBoard classes take their FINAL exam at an external board centre, controlled from the Board Examination desk (external timetable + student-wise result upload). School exams stay the same for this class.`
      : `Remove BOARD CLASS status from ${classContext.name}?\n\nIts final exam will go back to being handled inside School Examination.`;
    Alert.alert(next ? "Mark as Board Class" : "Remove Board Class", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => persistBoardClass(next) },
    ]);
  };

  const studentsList = allStudents.filter(
    (student) => student.class === classContext.name || student.className === classContext.name
  );

  // Subject teachers mapped to this class (from teacher.classAssignments).
  const subjectTeacherRows = allTeachers
    .flatMap((teacher) =>
      (teacher.classAssignments || [])
        .filter((assignment) => assignment.className === classContext.name)
        .map((assignment) => ({
          subject: assignment.subject || "Subject",
          teacherId: getTeacherId(teacher),
          teacherName: getTeacherName(teacher),
        }))
    )
    .filter(
      (row, index, rows) =>
        row.teacherId &&
        rows.findIndex((item) => item.teacherId === row.teacherId && item.subject === row.subject) === index
    );

  // ---- Persist class teacher (mirrors persistClassTeacher) ----------------
  const persistClassTeacher = async (teacher) => {
    const teacherId = getTeacherId(teacher);
    const teacherName = getTeacherName(teacher);
    setSaving(true);
    banner.clear();
    try {
      const currentClasses = classesNs.items;
      const hasClass = currentClasses.some((classRecord) => classRecord.name === classContext.name);
      const base = hasClass
        ? currentClasses
        : [...currentClasses, { id: classContext.id || classContext.name, name: classContext.name }];
      const nextClasses = base.map((classRecord) =>
        classRecord.name === classContext.name
          ? { ...classRecord, classTeacherId: teacherId, classTeacherName: teacherName, teacher: teacherName }
          : classRecord
      );
      await classesNs.persist(nextClasses);
      setCurrentClassTeacher({ id: teacherId, name: teacherName });
      setTeacherPickerOpen(false);
      banner.showSuccess(`Class teacher set to ${teacherName || "N/A"}.`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  };

  // ---- Persist subject mapping (mirrors persistSubjectMapping) -------------
  const persistSubjectMapping = async () => {
    setSaving(true);
    banner.clear();
    try {
      const currentMappings = classSubjectsNs.items;
      const hasMapping = currentMappings.some((mapping) => mapping.className === classContext.name);
      const nextMappings = hasMapping
        ? currentMappings.map((mapping) =>
            mapping.className === classContext.name ? { ...mapping, subjects: assignedSubjects } : mapping
          )
        : [...currentMappings, { className: classContext.name, subjects: assignedSubjects }];
      await classSubjectsNs.persist(nextMappings);
      setSubjectPickerOpen(false);
      banner.showSuccess("Subject mapping saved.");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  };

  // ---- Retention toggle (mirrors handleToggleRetention) -------------------
  const handleToggleRetention = (student) => {
    const studentId = student.id || student.admissionNumber;
    const studentName = student.name || student.displayName || "this student";
    const actionText = student.isRepeating
      ? `Cancel the class-repetition request for ${studentName}? They will be promoted normally in the next journey.`
      : `Mark ${studentName} for CLASS REPETITION? On 'Next Journey', this student will NOT change grade level and will remain retained in ${classContext.name}.`;

    Alert.alert("Repeat Class", actionText, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          banner.clear();
          try {
            const nextStudents = studentsNs.items.map((st) =>
              st.id === studentId || st.admissionNumber === studentId
                ? { ...st, isRepeating: !st.isRepeating }
                : st
            );
            await studentsNs.persist(nextStudents);
            banner.showSuccess("Retention status updated.");
          } catch (err) {
            banner.showError(err);
          }
        },
      },
    ]);
  };

  // ---- Remove student (mirrors handleDeleteStudent) -----------------------
  const handleDeleteStudent = (student) => {
    const studentId = student.id || student.admissionNumber;
    const studentName = student.name || student.displayName || "this student";
    const hasPending = studentHasPending(student);

    const confirmText = hasPending
      ? `Remove ${studentName} from ${classContext.name}? This student has PENDING FEE DUES and will be moved to Alumni/Pending Dues so their balance stays tracked.`
      : `Permanently remove ${studentName} from ${classContext.name}? This action cannot be undone.`;

    Alert.alert("Remove Student", confirmText, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          banner.clear();
          try {
            if (hasPending) {
              const records = alumniNs.items || [];
              await alumniNs.persist([
                ...records.filter((rec) => (rec.id || rec.admissionNumber) !== studentId),
                { ...student, status: "Removed", removedFrom: classContext.name, removedAt: new Date().toISOString() },
              ]);
            }
            const nextStudents = studentsNs.items.filter(
              (st) => (st.id || st.admissionNumber) !== studentId
            );
            await studentsNs.persist(nextStudents);
            banner.showSuccess(hasPending ? "Student moved to Alumni/Pending Dues." : "Student removed.");
          } catch (err) {
            banner.showError(err);
          }
        },
      },
    ]);
  };

  return (
    <ScreenShell title={`${classContext.name} · Detail`}>
      <ButtonRow>
        <SmallButton label="Back to Workspace" icon="arrow-back-outline" onPress={onBack} />
      </ButtonRow>
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Hero
        icon="school-outline"
        title={currentClassTeacher.name && currentClassTeacher.name !== "N/A" ? currentClassTeacher.name : "No class mentor"}
        subtitle={`${classContext.name} dashboard${currentClassTeacher.id ? ` · ID: ${currentClassTeacher.id}` : ""}`}
      />

      <Card>
        <View style={styles.rowHead}>
          <View style={{ flex: 1 }}>
            <SectionTitle>Board Examination</SectionTitle>
            <Text style={[styles.sub, { color: palette.inkSoft }]}>
              Board classes take their final exam at an external board centre, controlled from the Board Examination desk.
            </Text>
          </View>
          {isBoard && (
            <View style={styles.boardPill}>
              <Text style={styles.boardPillText}>BOARD CLASS</Text>
            </View>
          )}
        </View>
        <SmallButton
          label={isBoard ? "Board Class ✓" : "Mark as Board Class"}
          icon="school-outline"
          active={isBoard}
          disabled={boardSaving}
          onPress={handleToggleBoardClass}
        />
      </Card>

      <Card>
        <SectionTitle>Assignments</SectionTitle>
        <ButtonRow>
          <SmallButton
            label="Assign Class Teacher"
            icon="person-outline"
            onPress={() => {
              banner.clear();
              setTeacherPickerOpen((v) => !v);
              setSubjectPickerOpen(false);
            }}
            active={teacherPickerOpen}
          />
          <SmallButton
            label="Map Subjects"
            icon="book-outline"
            onPress={() => {
              banner.clear();
              setSubjectPickerOpen((v) => !v);
              setTeacherPickerOpen(false);
            }}
            active={subjectPickerOpen}
          />
        </ButtonRow>

        {teacherPickerOpen && (
          <View style={{ marginTop: 12 }}>
            {allTeachers.length === 0 ? (
              <Text style={[styles.sub, { color: palette.inkSoft }]}>No teachers available.</Text>
            ) : (
              <Select
                label="Class teacher (mentor)"
                placeholder="Select a class teacher"
                hint="Sets the class mentor for this class."
                value={currentClassTeacher.id || ""}
                options={allTeachers.map((t) => ({
                  value: getTeacherId(t),
                  label: getTeacherName(t) || "Unnamed",
                }))}
                onChange={(teacherId) => {
                  const teacher = allTeachers.find((t) => getTeacherId(t) === teacherId);
                  if (teacher) persistClassTeacher(teacher);
                }}
              />
            )}
          </View>
        )}

        {subjectPickerOpen && (
          <View style={{ marginTop: 12 }}>
            {availableSubjects.length === 0 ? (
              <Text style={[styles.sub, { color: palette.inkSoft }]}>No global subjects defined.</Text>
            ) : (
              <MultiSelect
                label="Subjects for this class"
                hint="Tap subjects to toggle them on or off for this class."
                options={availableSubjects}
                values={assignedSubjects}
                onChange={setAssignedSubjects}
              />
            )}
            <PrimaryButton
              icon="save-outline"
              label="Save Subject Mapping"
              onPress={persistSubjectMapping}
              loading={saving}
            />
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle right={<Text style={[styles.countPill, { color: palette.inkSoft, backgroundColor: palette.tile }]}>{subjectTeacherRows.length} subjects</Text>}>
          Faculty Assignments
        </SectionTitle>
        <View style={[styles.assignBox, { backgroundColor: palette.tile, borderColor: palette.cardBorder }]}>
          <Text style={[styles.assignLabel, { color: palette.inkFaint }]}>CLASS TEACHER</Text>
          <Text style={[styles.name, { color: palette.ink }]}>{currentClassTeacher.name || "N/A"}</Text>
          <Text style={[styles.subSmall, { color: palette.inkFaint }]}>{currentClassTeacher.id || "Teacher ID not assigned"}</Text>
        </View>
        {subjectTeacherRows.length ? (
          subjectTeacherRows.map((row) => (
            <View key={`${row.teacherId}-${row.subject}`} style={[styles.assignBoxSoft, { backgroundColor: palette.cardSoft, borderColor: palette.cardBorder }]}>
              <Text style={[styles.assignLabel, { color: palette.inkFaint }]}>{row.subject}</Text>
              <Text style={[styles.name, { color: palette.ink }]}>{row.teacherName}</Text>
              <Text style={[styles.subSmall, { color: palette.inkFaint }]}>{row.teacherId}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.sub, { color: palette.inkSoft }]}>No subject teachers are mapped to this class yet.</Text>
        )}
        {assignedSubjects.length > 0 && (
          <>
            <Divider />
            <Text style={[styles.pickerHint, { color: palette.inkLabel }]}>Mapped subjects:</Text>
            <View style={styles.chipWrap}>
              {assignedSubjects.map((sub, idx) => (
                <View key={idx} style={[styles.subjectChip, { backgroundColor: palette.tile }]}>
                  <Text style={[styles.subjectChipText, { color: palette.ink }]}>{sub}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      <SectionTitle right={<Text style={[styles.countPill, { color: palette.inkSoft, backgroundColor: palette.tile }]}>{studentsList.length} students</Text>}>
        Active Roster
      </SectionTitle>
      {studentsList.length === 0 ? (
        <EmptyState icon="people-outline" title="No students" text="No students are enrolled in this class." />
      ) : (
        studentsList.map((st) => {
          const studentId = st.id || st.admissionNumber;
          const studentName = st.name || st.displayName || "Student";
          const attendance = st.attendancePercentage || "0%";
          return (
            <Card key={studentId}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.ink }]}>{studentName}</Text>
                  <Text style={[styles.subSmall, { color: palette.inkFaint }]}>ID: {studentId}</Text>
                  <Text style={[styles.sub, { color: palette.inkSoft }]}>
                    Periods: {st.attendedClasses || 0} / {st.totalClasses || 0} · Attendance: {attendance}
                  </Text>
                </View>
                {st.isRepeating && (
                  <View style={styles.repeatPill}>
                    <Text style={styles.repeatPillText}>REPEATING</Text>
                  </View>
                )}
              </View>
              <Divider />
              <ButtonRow>
                <SmallButton
                  label={st.isRepeating ? "Cancel Repeat" : "Repeat Class"}
                  icon={st.isRepeating ? "checkbox-outline" : "square-outline"}
                  active={st.isRepeating}
                  onPress={() => handleToggleRetention(st)}
                />
                <View style={{ marginLeft: "auto" }}>
                  <IconButton icon="trash-outline" tone="danger" onPress={() => handleDeleteStudent(st)} />
                </View>
              </ButtonRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

/* ============================================================================
   Class Preferences (mirrors ClassPreferences.jsx) + rename
   ============================================================================ */

function PreferencesView({ banner, loading, orderedClasses, prefsNs, classesNs, onBack }) {
  const { palette } = useTheme();
  const [newClassName, setNewClassName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  // ---- Add class (mirrors handleAddClass) ---------------------------------
  const handleAddClass = async () => {
    const formattedName = newClassName.trim();
    if (!formattedName) return;
    const isDuplicate = orderedClasses.some((c) => (c.name || "").toLowerCase() === formattedName.toLowerCase());
    if (isDuplicate) {
      banner.showError("This class level already exists in preferences!");
      return;
    }
    setSaving(true);
    banner.clear();
    try {
      const classRecord = { id: `CLS-${Date.now()}`, name: formattedName, teacher: "", studentCount: 0 };
      await prefsNs.persist([...orderedClasses, { id: classRecord.id, name: formattedName }]);
      const managed = classesNs.items;
      if (!managed.some((c) => (c.name || "").toLowerCase() === formattedName.toLowerCase())) {
        await classesNs.persist([...managed, classRecord]);
      }
      setNewClassName("");
      banner.showSuccess("Class added to sequence.");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = async (updated) => {
    banner.clear();
    try {
      await prefsNs.persist(updated);
    } catch (err) {
      banner.showError(err);
    }
  };

  // ---- Reorder (mirrors moveUp / moveDown) --------------------------------
  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...orderedClasses];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    persistOrder(updated);
  };
  const moveDown = (index) => {
    if (index === orderedClasses.length - 1) return;
    const updated = [...orderedClasses];
    [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
    persistOrder(updated);
  };

  // ---- Remove (mirrors handleRemoveClass) ---------------------------------
  const handleRemoveClass = (cls) => {
    Alert.alert("Remove Class", `Remove "${cls.name}" from the preference sequence?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          banner.clear();
          try {
            await prefsNs.persist(orderedClasses.filter((c) => c.id !== cls.id));
            const managed = classesNs.items;
            await classesNs.persist(managed.filter((c) => c.name !== cls.name));
            banner.showSuccess("Class removed from sequence.");
          } catch (err) {
            banner.showError(err);
          }
        },
      },
    ]);
  };

  // ---- Rename (keeps preference + managed class names in sync) -------------
  const startRename = (cls) => {
    setEditingId(cls.id);
    setEditName(cls.name);
  };
  const saveRename = async (cls) => {
    const nextName = editName.trim();
    if (!nextName) return;
    if (
      nextName.toLowerCase() !== cls.name.toLowerCase() &&
      orderedClasses.some((c) => (c.name || "").toLowerCase() === nextName.toLowerCase())
    ) {
      banner.showError("Another class already uses that name.");
      return;
    }
    banner.clear();
    try {
      await prefsNs.persist(orderedClasses.map((c) => (c.id === cls.id ? { ...c, name: nextName } : c)));
      const managed = classesNs.items;
      await classesNs.persist(managed.map((c) => (c.name === cls.name ? { ...c, name: nextName } : c)));
      setEditingId(null);
      setEditName("");
      banner.showSuccess("Class renamed.");
    } catch (err) {
      banner.showError(err);
    }
  };

  return (
    <ScreenShell title="Class Preferences" refreshing={loading} onRefresh={() => prefsNs.reload()}>
      <ButtonRow>
        <SmallButton label="Back to Workspace" icon="arrow-back-outline" onPress={onBack} />
      </ButtonRow>
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Hero
        icon="settings-outline"
        title="Class Preferences & Hierarchy"
        subtitle="Order defines lowest → highest grade and drives promotion logic."
      />

      <Card>
        <SectionTitle>Add Class to Sequence</SectionTitle>
        <TextField
          label="Class Title Name"
          value={newClassName}
          onChangeText={setNewClassName}
          placeholder="e.g. Nursery, Class 1, Class 2"
        />
        <PrimaryButton icon="add-circle-outline" label="Insert Into Sequence" onPress={handleAddClass} loading={saving} />
      </Card>

      <SectionTitle>Active Class Sequence ({orderedClasses.length})</SectionTitle>
      <Text style={[styles.sub, { color: palette.inkSoft }]}>Top = lowest grade. Bottom = highest grade.</Text>
      {orderedClasses.length === 0 ? (
        <EmptyState icon="list-outline" title="No sequence yet" text="Add a class to build the hierarchy." />
      ) : (
        orderedClasses.map((cls, index) => (
          <Card key={cls.id || cls.name}>
            {editingId === cls.id ? (
              <View>
                <TextField label="Rename class" value={editName} onChangeText={setEditName} placeholder="New name" />
                <ButtonRow>
                  <SmallButton label="Save" icon="checkmark-outline" onPress={() => saveRename(cls)} />
                  <SmallButton
                    label="Cancel"
                    icon="close-outline"
                    onPress={() => {
                      setEditingId(null);
                      setEditName("");
                    }}
                  />
                </ButtonRow>
              </View>
            ) : (
              <>
                <View style={styles.rowHead}>
                  <View style={[styles.badge, { backgroundColor: palette.tile }]}>
                    <Text style={[styles.badgeText, { color: palette.ink }]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.name, { flex: 1, color: palette.ink }]}>{cls.name}</Text>
                </View>
                <Divider />
                <ButtonRow>
                  <IconButton icon="arrow-up-outline" onPress={() => moveUp(index)} disabled={index === 0} />
                  <IconButton
                    icon="arrow-down-outline"
                    onPress={() => moveDown(index)}
                    disabled={index === orderedClasses.length - 1}
                  />
                  <SmallButton label="Rename" icon="create-outline" onPress={() => startRename(cls)} />
                  <View style={{ marginLeft: "auto" }}>
                    <IconButton icon="trash-outline" tone="danger" onPress={() => handleRemoveClass(cls)} />
                  </View>
                </ButtonRow>
              </>
            )}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    width: 44,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
  },
  badgeText: { color: "#0F172A", fontWeight: "900", fontSize: 14 },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3 },
  subSmall: { color: "#94A3B8", fontWeight: "700", fontSize: 11, marginTop: 2 },
  pickerHint: { color: "#475569", fontSize: 12, fontWeight: "900", marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  subjectChip: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
  },
  subjectChipText: { color: "#0F172A", fontWeight: "800", fontSize: 11 },
  countPill: {
    color: "#64748B",
    fontWeight: "900",
    fontSize: 11,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  assignBox: {
    backgroundColor: "rgba(99,102,241,0.08)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.4)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  assignBoxSoft: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  assignLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "900", letterSpacing: 0.5, marginBottom: 4 },
  repeatPill: { backgroundColor: "#FEF3C7", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  repeatPillText: { color: "#B45309", fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
  boardPill: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  boardPillText: { color: "#B45309", fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
};
