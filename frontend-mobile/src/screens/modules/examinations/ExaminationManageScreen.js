// Examination Management (WRITE / admin counterpart to the read-only ExaminationsScreen).
// Brings the web ExaminationHub to full write-parity on mobile: create exams, papers,
// schedules, and enter marks. Persists via the REST examination state:
//   GET  /examinations/state -> { exams, papers, schedules, marks, deliveries, boardClasses, boardResults }
//   PUT  /examinations/state  { state: <whole state>, updatedBy }  (read-modify-write)
// Record shapes are copied EXACTLY from web frontend/src/components/common/examinationStore.js
// so web and mobile stay interoperable:
//   exam     { id: `EXAM-<ts>`, name, academicYear, createdByName, createdByRole, createdAt, updatedAt }
//   paper    { id: `PAPER-<ts>`, examId, className, subject, type, title, content, status,
//              createdByName, createdByUsername, teacherName, teacherUsername,
//              teacherApprovedAt, adminApprovedAt, revision, comments[], createdAt, updatedAt }
//   schedule { id: `SCH-<ts>-<subject>`, examId, className, subject, date, startTime, endTime }
//   marks    { id: `MARK-<ts>`, examId, className, subject, maxMarks, enteredByRole, enteredByName,
//              submittedAt, updatedAt, teacherEditUnlockedUntil/By/At, rows[] }
//   marks.row { studentId, admissionNumber, studentName, rollNo, marks, remark }
// Rosters read from module-state namespaces:
//   admin-class-management-classes, admin-student-management-students,
//   admin-subjects-global, admin-subjects-class-mapping
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, BackHandler, Linking, Platform, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { apiRequest, API_BASE_URL } from "../../../api/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  Card,
  DateField,
  Divider,
  EmptyState,
  Field,
  Hero,
  IconButton,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  Segmented,
  Select,
  SectionTitle,
  SmallButton,
  TextField,
  todayIso,
  useBanner,
  useModuleState,
} from "../shared/formKit";
import { printReportCardsForClass, printAdmitCardsForClass, printReportCard, printAdmitCard } from "./printDocs";

const PAPER_TYPES = ["Written", "Oral", "Practical", "Worksheet"];
// School Examination desk sections. The old "board" entry moved to the dedicated
// Board Examination desk (top-level toggle), so it is intentionally absent here.
const SECTIONS = [
  { value: "exam", label: "Exam" },
  { value: "paper", label: "Paper" },
  { value: "schedule", label: "Schedule" },
  { value: "marks", label: "Marks" },
];
// Report Cards & Admit Cards are admin/clerk only (web parity: roleCanManageReportCards).
const REPORTS_SECTION = { value: "reports", label: "Report Cards" };
// Top-level desk toggle (School vs Board examination).
const DESKS = [
  { value: "school", label: "School Examination", icon: "school-outline" },
  { value: "board", label: "Board Examination", icon: "ribbon-outline" },
];

// Match web isFinalExam — prefer a final/annual exam as the default board exam.
const isFinalExam = (exam) => /final|annual/i.test(exam?.name || "");

const nowIso = () => new Date().toISOString();

const EMPTY_STATE = {
  exams: [],
  papers: [],
  schedules: [],
  marks: [],
  deliveries: [],
  boardClasses: [],
  boardResults: [],
};

const normalizeState = (state = {}) => ({
  exams: Array.isArray(state.exams) ? state.exams : [],
  papers: Array.isArray(state.papers) ? state.papers : [],
  schedules: Array.isArray(state.schedules) ? state.schedules : [],
  marks: Array.isArray(state.marks) ? state.marks : [],
  deliveries: Array.isArray(state.deliveries) ? state.deliveries : [],
  boardClasses: Array.isArray(state.boardClasses) ? state.boardClasses : [],
  boardResults: Array.isArray(state.boardResults) ? state.boardResults : [],
});

const getClassName = (rec = {}) =>
  typeof rec === "string" ? rec : rec.name || rec.className || rec.class || rec.id || "";

const getExamLabel = (exam) => (exam ? `${exam.name} Examination` : "Examination");

// Approval-workflow status pill meta (dot color + label + ink color).
const getPaperStatusMeta = (status) => {
  switch (status) {
    case "pending_admin":
    case "teacher_review":
    case "admin_review":
      return { label: "Pending admin review", dot: "#f59e0b", ink: "#b45309" };
    case "approved":
    case "selected":
    case "teacher_approved":
      return { label: status === "selected" ? "Selected" : "Approved", dot: "#10b981", ink: "#047857" };
    case "rejected":
    case "admin_rejected":
    case "teacher_rejected":
      return { label: "Rejected", dot: "#f43f5e", ink: "#be123c" };
    default:
      return { label: "Draft", dot: "#94a3b8", ink: "#475569" };
  }
};

const calculateGrade = (marks, maxMarks = 100) => {
  const pct = maxMarks ? (Number(marks) / Number(maxMarks)) * 100 : 0;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "Needs Support";
};

const getFocusRemark = (marks, maxMarks = 100) => {
  const pct = maxMarks ? (Number(marks) / Number(maxMarks)) * 100 : 0;
  if (pct >= 85) return "Strong performance";
  if (pct >= 70) return "Revise for consistency";
  if (pct >= 50) return "Needs guided practice";
  return "Needs urgent attention";
};

// Normalize a raw student record (module-state) to the exam roster shape web uses.
const normalizeStudent = (student = {}, index = 0, className = "") => ({
  id: student.id || student.admissionNumber || `student-${className}-${index + 1}`,
  displayName: student.displayName || student.name || `Student ${index + 1}`,
  className: student.className || student.class || className,
  section: student.section || "A",
  rollNo: student.rollNo || index + 1,
  admissionNumber: student.admissionNumber || student.id || "",
});

export default function ExaminationManageScreen({ user }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const [section, setSection] = useState("exam");
  // Top-level desk: "school" (existing sections) or "board" (Board Examination).
  const [desk, setDesk] = useState("school");
  const role = user?.role || "";
  const isBoardManager = role === "admin" || role === "clerk";

  // Hardware Back: step back through the desk/section toggles before the app-level
  // handler goes to the dashboard. Board desk → School desk first, then a non-default
  // section → the first ("Exam") section.
  useEffect(() => {
    const onBack = () => {
      if (desk === "board") {
        setDesk("school"); // board desk open → back to the school examination desk
        return true;
      }
      if (section !== "exam") {
        setSection("exam"); // a non-default section is open → back to the Exam section
        return true;
      }
      return false; // top level → let the app go to the dashboard
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [desk, section]);

  // ---- REST examination state (read-modify-write) --------------------------
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadState = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await apiRequest("/examinations/state");
      setState(normalizeState(data));
    } catch (err) {
      banner.showError(err.message || "Could not load examination records.");
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const updatedBy = user?.username || user?.displayName || "mobile";
  const actorName = user?.displayName || user?.username || "Admin";
  const actorRole = user?.role || "admin";

  // GET current state, apply a mutator to produce the next state, PUT it back.
  // The mutator receives the freshly fetched state (avoids clobbering concurrent edits).
  const commit = useCallback(
    async (mutate) => {
      setSaving(true);
      banner.clear();
      try {
        const current = normalizeState(await apiRequest("/examinations/state"));
        const next = normalizeState(mutate(current));
        await apiRequest("/examinations/state", {
          method: "PUT",
          body: JSON.stringify({ state: next, updatedBy }),
        });
        setState(next);
        return next;
      } catch (err) {
        banner.showError(err.message || "Save failed.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updatedBy]
  );

  // ---- Roster / class / subject namespaces --------------------------------
  const classesNs = useModuleState("admin-class-management-classes");
  const studentsNs = useModuleState("admin-student-management-students");
  const globalSubjectsNs = useModuleState("admin-subjects-global");
  const classSubjectsNs = useModuleState("admin-subjects-class-mapping");

  const classNames = useMemo(() => {
    const names = (Array.isArray(classesNs.items) ? classesNs.items : [])
      .map(getClassName)
      .filter(Boolean);
    return [...new Set(names)];
  }, [classesNs.items]);

  // Subjects for a class: prefer the class mapping, fall back to the global registry.
  const subjectsForClass = useCallback(
    (className) => {
      const mapping = (Array.isArray(classSubjectsNs.items) ? classSubjectsNs.items : []).find(
        (rec) => getClassName(rec) === className
      );
      const mapped = Array.isArray(mapping?.subjects) ? mapping.subjects : [];
      const names = mapped
        .map((s) => (typeof s === "string" ? s : s.name || s.subject || ""))
        .filter(Boolean);
      if (names.length) return [...new Set(names)];
      const globals = (Array.isArray(globalSubjectsNs.items) ? globalSubjectsNs.items : [])
        .map((s) => (typeof s === "string" ? s : s.name || s.subject || ""))
        .filter(Boolean);
      return [...new Set(globals)];
    },
    [classSubjectsNs.items, globalSubjectsNs.items]
  );

  const studentsForClass = useCallback(
    (className) => {
      if (!className) return [];
      const directory = Array.isArray(studentsNs.items) ? studentsNs.items : [];
      return directory
        .filter((s) => (s.className || s.class) === className)
        .map((s, i) => normalizeStudent(s, i, className))
        .sort((a, b) => Number(a.rollNo) - Number(b.rollNo));
    },
    [studentsNs.items]
  );

  const onRefresh = useCallback(() => {
    loadState({ isRefresh: true });
    classesNs.reload();
    studentsNs.reload();
    globalSubjectsNs.reload();
    classSubjectsNs.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState]);

  if (loading) {
    return (
      <ScreenShell title="Examination Management">
        <LoadingCard text="Loading examination records..." />
      </ScreenShell>
    );
  }

  const showBoardDesk = desk === "board" && isBoardManager;

  return (
    <ScreenShell title="Examination Management" refreshing={refreshing} onRefresh={onRefresh}>
      <Hero
        icon={showBoardDesk ? "ribbon-outline" : "school-outline"}
        title={showBoardDesk ? "Board Examination Desk" : "Examination Desk"}
        subtitle={
          showBoardDesk
            ? "Publish the board timetable and each student's final result."
            : "Create exams, papers, schedules, and enter student marks."
        }
      />

      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      {/* Top-level desk toggle: School vs Board examination. Board is admin/clerk only. */}
      {isBoardManager && (
        <View style={styles.deskRow}>
          {DESKS.map((d) => {
            const active = desk === d.value;
            return (
              <TouchableOpacity
                key={d.value}
                activeOpacity={0.85}
                onPress={() => {
                  banner.clear();
                  setDesk(d.value);
                }}
                style={[
                  styles.deskBtn,
                  {
                    backgroundColor: active ? palette.accentDeep : palette.tile,
                    borderColor: active ? palette.accentDeep : palette.cardBorder,
                  },
                ]}
              >
                <Ionicons name={d.icon} size={20} color={active ? "#fff" : palette.accentDeep} />
                <Text style={[styles.deskLabel, { color: active ? "#fff" : palette.accentDeep }]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {showBoardDesk ? (
        <BoardExaminationDesk
          state={state}
          banner={banner}
          user={user}
          studentsForClass={studentsForClass}
          reloadState={loadState}
        />
      ) : (
        <>
          <View style={{ marginBottom: 14 }}>
            <Segmented
              options={isBoardManager ? [...SECTIONS, REPORTS_SECTION] : SECTIONS}
              value={section}
              onChange={setSection}
            />
          </View>

          {section === "exam" && (
            <ExamSection
              state={state}
              saving={saving}
              commit={commit}
              banner={banner}
              actorName={actorName}
              actorRole={actorRole}
            />
          )}
          {section === "paper" && (
            <PaperSection
              state={state}
              saving={saving}
              commit={commit}
              banner={banner}
              classNames={classNames}
              subjectsForClass={subjectsForClass}
              actorName={actorName}
              actorRole={actorRole}
              updatedBy={updatedBy}
              setState={setState}
            />
          )}
          {section === "schedule" && (
            <ScheduleSection
              state={state}
              saving={saving}
              commit={commit}
              banner={banner}
              classNames={classNames}
              subjectsForClass={subjectsForClass}
            />
          )}
          {section === "marks" && (
            <MarksSection
              state={state}
              saving={saving}
              commit={commit}
              banner={banner}
              classNames={classNames}
              subjectsForClass={subjectsForClass}
              studentsForClass={studentsForClass}
              actorName={actorName}
              actorRole={actorRole}
            />
          )}
          {section === "reports" && isBoardManager && (
            <ReportCardsSection
              state={state}
              banner={banner}
              classNames={classNames}
              studentsForClass={studentsForClass}
            />
          )}
        </>
      )}
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Create Exam
// ---------------------------------------------------------------------------
function ExamSection({ state, saving, commit, banner, actorName, actorRole }) {
  const { palette } = useTheme();
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-27");

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return banner.showError("Examination name is required.");
    try {
      await commit((current) => ({
        ...current,
        exams: [
          {
            id: `EXAM-${Date.now()}`,
            name: trimmed,
            academicYear: academicYear.trim() || "2026-27",
            createdByName: actorName,
            createdByRole: actorRole,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
          ...current.exams,
        ],
      }));
      setName("");
      banner.showSuccess(`Examination "${trimmed}" created.`);
    } catch {
      /* banner already shown */
    }
  };

  return (
    <>
      <Card>
        <SectionTitle>Create Examination</SectionTitle>
        <Text style={[styles.help, { color: palette.inkFaint }]}>Create exam cycles like SA-1, SA-2, Half Yearly, Final.</Text>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="SA-1"
          autoCapitalize="characters"
        />
        <TextField
          label="Academic Year"
          value={academicYear}
          onChangeText={setAcademicYear}
          placeholder="2026-27"
        />
        <PrimaryButton icon="add-circle-outline" label="Add Examination" onPress={handleCreate} loading={saving} />
      </Card>

      <SectionTitle>Examinations ({state.exams.length})</SectionTitle>
      {!state.exams.length ? (
        <EmptyState icon="calendar-outline" title="No examinations yet" text="Create your first exam cycle above." />
      ) : (
        state.exams.map((exam) => {
          const papers = state.papers.filter((p) => p.examId === exam.id);
          const selected = papers.filter((p) => p.status === "selected");
          const marks = state.marks.filter((m) => m.examId === exam.id);
          return (
            <Card key={exam.id}>
              <Text style={[styles.title, { color: palette.ink }]}>{getExamLabel(exam)}</Text>
              <Text style={[styles.sub, { color: palette.inkSoft }]}>
                {exam.academicYear} · by {exam.createdByName || "-"}
              </Text>
              <Divider />
              <View style={styles.metricRow}>
                <Metric label="Papers" value={papers.length} />
                <Metric label="Selected" value={selected.length} />
                <Metric label="Marks Lists" value={marks.length} />
              </View>
            </Card>
          );
        })
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Create Paper
// ---------------------------------------------------------------------------
function PaperSection({
  state,
  saving,
  commit,
  banner,
  classNames,
  subjectsForClass,
  actorName,
  actorRole,
  updatedBy,
  setState,
}) {
  const { palette } = useTheme();
  const [busyPaperId, setBusyPaperId] = useState("");
  const [rejectCommentByPaperId, setRejectCommentByPaperId] = useState({});
  const canDecideAsAdmin = actorRole === "admin";
  const canSubmitDrafts = ["teacher", "admin", "clerk"].includes(actorRole);

  // POST /examinations/papers/:id/submit-for-approval  → draft → pending_admin
  // Server broadcasts mgps-erp-examinations-updated and notifies admins.
  const submitForApproval = useCallback(
    async (paper) => {
      setBusyPaperId(paper.id);
      banner.clear();
      try {
        const result = await apiRequest(
          `/examinations/papers/${encodeURIComponent(paper.id)}/submit-for-approval`,
          { method: "PATCH" }
        );
        if (result?.state) setState(normalizeState(result.state));
        banner.showSuccess(`Paper "${paper.title}" submitted for admin approval.`);
      } catch (err) {
        banner.showError(err.message || "Could not submit paper.");
      } finally {
        setBusyPaperId("");
      }
    },
    [banner, setState]
  );

  // POST /examinations/papers/:id/admin-decision  → pending_admin → approved | rejected
  const decideAsAdmin = useCallback(
    async (paper, decision) => {
      const comment = (rejectCommentByPaperId[paper.id] || "").trim();
      if (decision === "rejected" && !comment) {
        banner.showError("Please write a rejection comment before rejecting.");
        return;
      }
      setBusyPaperId(paper.id);
      banner.clear();
      try {
        const result = await apiRequest(
          `/examinations/papers/${encodeURIComponent(paper.id)}/admin-decision`,
          {
            method: "PATCH",
            body: JSON.stringify({ decision, comment }),
          }
        );
        if (result?.state) setState(normalizeState(result.state));
        setRejectCommentByPaperId((prev) => ({ ...prev, [paper.id]: "" }));
        banner.showSuccess(
          decision === "approved"
            ? `Approved "${paper.title}".`
            : `Rejected "${paper.title}".`
        );
      } catch (err) {
        banner.showError(err.message || "Could not save decision.");
      } finally {
        setBusyPaperId("");
      }
    },
    [banner, rejectCommentByPaperId, setState]
  );
  const [examId, setExamId] = useState(state.exams[0]?.id || "");
  const [className, setClassName] = useState(classNames[0] || "");
  const subjects = useMemo(() => subjectsForClass(className), [className, subjectsForClass]);
  const [subject, setSubject] = useState(subjects[0] || "");
  const [type, setType] = useState(PAPER_TYPES[0]);
  const [maxMarks, setMaxMarks] = useState("80");

  useEffect(() => {
    if (!examId && state.exams[0]) setExamId(state.exams[0].id);
  }, [examId, state.exams]);
  useEffect(() => {
    if (!className && classNames[0]) setClassName(classNames[0]);
  }, [className, classNames]);
  useEffect(() => {
    if (!subjects.includes(subject)) setSubject(subjects[0] || "");
  }, [subjects, subject]);

  const exam = state.exams.find((e) => e.id === examId);

  const handleCreate = async () => {
    if (!examId) return banner.showError("Select an examination first.");
    if (!className) return banner.showError("Select a class first.");
    if (!subject) return banner.showError("Select a subject first.");
    const title = `${exam?.name || "Exam"} ${className} ${subject} Paper`;
    const content = `<h1>${exam?.name || "Exam"} Examination</h1><p>Class: ${className} | Subject: ${subject} | Type: ${type} | Maximum Marks: ${
      Number(maxMarks) || 80
    }</p>`;
    try {
      await commit((current) => ({
        ...current,
        papers: [
          {
            id: `PAPER-${Date.now()}`,
            examId,
            className,
            subject,
            type,
            title,
            content,
            maxMarks: Number(maxMarks) || 80,
            status: "draft",
            createdByName: actorName,
            createdByUsername: updatedBy,
            teacherName: "",
            teacherUsername: "",
            teacherApprovedAt: "",
            adminApprovedAt: "",
            revision: 1,
            comments: [],
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
          ...current.papers,
        ],
      }));
      banner.showSuccess(`Paper created for ${className} · ${subject}.`);
    } catch {
      /* banner already shown */
    }
  };

  if (!state.exams.length) {
    return <EmptyState icon="document-outline" title="No exams yet" text="Create an examination first, then add papers." />;
  }

  const examPapers = state.papers.filter((p) => p.examId === examId);

  return (
    <>
      <Card>
        <SectionTitle>Create Paper</SectionTitle>
        <Select
          label="Examination"
          options={state.exams.map((e) => ({ value: e.id, label: e.name }))}
          value={examId}
          onChange={setExamId}
          placeholder="Select examination"
        />
        <Select
          label="Class"
          options={classNames}
          value={className}
          onChange={setClassName}
          placeholder={classNames.length ? "Select class" : "No classes found."}
        />
        <Select
          label="Subject"
          options={subjects}
          value={subject}
          onChange={setSubject}
          placeholder={subjects.length ? "Select subject" : "No subjects mapped for this class."}
        />
        <Select label="Paper Type" options={PAPER_TYPES} value={type} onChange={setType} placeholder="Select type" />
        <TextField
          label="Maximum Marks"
          value={maxMarks}
          onChangeText={setMaxMarks}
          keyboardType="number-pad"
          placeholder="80"
        />
        <PrimaryButton icon="create-outline" label="Create Paper" onPress={handleCreate} loading={saving} />
      </Card>

      <SectionTitle>Papers · {getExamLabel(exam)} ({examPapers.length})</SectionTitle>
      {!examPapers.length ? (
        <EmptyState icon="documents-outline" title="No papers yet" text="No papers created for this exam." />
      ) : (
        examPapers.map((paper) => {
          const meta = getPaperStatusMeta(paper.status);
          const isBusy = busyPaperId === paper.id;
          const commentDraft = rejectCommentByPaperId[paper.id] || "";
          return (
            <Card key={paper.id}>
              <View style={styles.pillRow}>
                <View style={[styles.dot, { backgroundColor: meta.dot }]} />
                <Text style={[styles.pillLabel, { color: meta.ink }]}>{meta.label}</Text>
              </View>
              <Text style={[styles.title, { color: palette.ink }]}>{paper.title}</Text>
              <Text style={[styles.sub, { color: palette.inkSoft }]}>
                {paper.className} · {paper.subject} · {paper.type}
              </Text>

              {/* Teacher draft: submit-for-approval */}
              {canSubmitDrafts && paper.status === "draft" ? (
                <PrimaryButton
                  icon="paper-plane-outline"
                  label="Submit for approval"
                  onPress={() => submitForApproval(paper)}
                  loading={isBusy}
                />
              ) : null}

              {/* Teacher pending: awaiting badge only */}
              {!canDecideAsAdmin && paper.status === "pending_admin" ? (
                <Text style={[styles.help, { color: palette.inkFaint }]}>
                  Awaiting admin review.
                </Text>
              ) : null}

              {/* Admin pending: approve/reject with comment */}
              {canDecideAsAdmin && paper.status === "pending_admin" ? (
                <>
                  <TextField
                    label="Rejection comment (required to reject)"
                    value={commentDraft}
                    onChangeText={(v) =>
                      setRejectCommentByPaperId((prev) => ({ ...prev, [paper.id]: v }))
                    }
                    placeholder="Explain what needs correction..."
                  />
                  <PrimaryButton
                    icon="checkmark-circle-outline"
                    label="Approve"
                    onPress={() => decideAsAdmin(paper, "approved")}
                    loading={isBusy}
                  />
                  <PrimaryButton
                    icon="close-circle-outline"
                    label="Reject"
                    onPress={() => decideAsAdmin(paper, "rejected")}
                    loading={isBusy}
                  />
                </>
              ) : null}

              {/* Comments trail */}
              {Array.isArray(paper.comments) && paper.comments.length ? (
                <>
                  <Divider />
                  <Text style={[styles.help, { color: palette.inkFaint }]}>
                    Comments trail
                  </Text>
                  {paper.comments.slice(-3).map((entry) => (
                    <Text
                      key={entry.id || `${entry.action}-${entry.createdAt}`}
                      style={[styles.sub, { color: palette.inkSoft }]}
                    >
                      {entry.action} · {entry.actorName || entry.role || "-"}
                      {entry.comment ? ` — ${entry.comment}` : ""}
                    </Text>
                  ))}
                </>
              ) : null}
            </Card>
          );
        })
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Create Schedule
// ---------------------------------------------------------------------------
function ScheduleSection({ state, saving, commit, banner, classNames, subjectsForClass }) {
  const { palette } = useTheme();
  const [examId, setExamId] = useState(state.exams[0]?.id || "");
  const [className, setClassName] = useState(classNames[0] || "");
  const subjects = useMemo(() => subjectsForClass(className), [className, subjectsForClass]);
  const [subject, setSubject] = useState(subjects[0] || "");
  const [date, setDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");

  useEffect(() => {
    if (!examId && state.exams[0]) setExamId(state.exams[0].id);
  }, [examId, state.exams]);
  useEffect(() => {
    if (!className && classNames[0]) setClassName(classNames[0]);
  }, [className, classNames]);
  useEffect(() => {
    if (!subjects.includes(subject)) setSubject(subjects[0] || "");
  }, [subjects, subject]);

  const handleSave = async () => {
    if (!examId) return banner.showError("Select an examination first.");
    if (!className) return banner.showError("Select a class first.");
    if (!subject) return banner.showError("Select a subject first.");
    if (!date) return banner.showError("Pick a date.");
    try {
      await commit((current) => {
        // Upsert the schedule row for this exam+class+subject (web replaces matching rows).
        const others = current.schedules.filter(
          (row) => !(row.examId === examId && row.className === className && row.subject === subject)
        );
        const existing = current.schedules.find(
          (row) => row.examId === examId && row.className === className && row.subject === subject
        );
        const nextRow = {
          id: existing?.id || `SCH-${Date.now()}-${subject}`,
          examId,
          className,
          subject,
          date,
          startTime: startTime || "",
          endTime: endTime || "",
        };
        return { ...current, schedules: [...others, nextRow] };
      });
      banner.showSuccess(`Schedule saved for ${subject} on ${date}.`);
    } catch {
      /* banner already shown */
    }
  };

  if (!state.exams.length) {
    return <EmptyState icon="calendar-outline" title="No exams yet" text="Create an examination first, then add schedules." />;
  }

  const examSchedules = state.schedules
    .filter((row) => row.examId === examId && row.className === className)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <>
      <Card>
        <SectionTitle>Create Schedule</SectionTitle>
        <Select
          label="Examination"
          options={state.exams.map((e) => ({ value: e.id, label: e.name }))}
          value={examId}
          onChange={setExamId}
          placeholder="Select examination"
        />
        <Select
          label="Class"
          options={classNames}
          value={className}
          onChange={setClassName}
          placeholder={classNames.length ? "Select class" : "No classes found."}
        />
        <Select
          label="Subject"
          options={subjects}
          value={subject}
          onChange={setSubject}
          placeholder={subjects.length ? "Select subject" : "No subjects mapped for this class."}
        />
        <DateField label="Date" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
        <View style={styles.timeRow}>
          <View style={{ flex: 1 }}>
            <TextField label="Start Time" value={startTime} onChangeText={setStartTime} placeholder="09:00" />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <TextField label="End Time" value={endTime} onChangeText={setEndTime} placeholder="12:00" />
          </View>
        </View>
        <PrimaryButton icon="time-outline" label="Save Schedule" onPress={handleSave} loading={saving} />
      </Card>

      <SectionTitle>Schedule · {className || "-"} ({examSchedules.length})</SectionTitle>
      {!examSchedules.length ? (
        <EmptyState icon="calendar-clear-outline" title="No schedule yet" text="No papers scheduled for this class." />
      ) : (
        examSchedules.map((row) => (
          <Card key={row.id}>
            <Text style={[styles.title, { color: palette.ink }]}>{row.subject}</Text>
            <Text style={[styles.sub, { color: palette.inkSoft }]}>
              {row.date} · {row.startTime || "-"} to {row.endTime || "-"}
            </Text>
          </Card>
        ))
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Marks Entry
// ---------------------------------------------------------------------------
function MarksSection({
  state,
  saving,
  commit,
  banner,
  classNames,
  subjectsForClass,
  studentsForClass,
  actorName,
  actorRole,
}) {
  const { palette } = useTheme();
  const [examId, setExamId] = useState(state.exams[0]?.id || "");
  const [className, setClassName] = useState(classNames[0] || "");
  const subjects = useMemo(() => subjectsForClass(className), [className, subjectsForClass]);
  const [subject, setSubject] = useState(subjects[0] || "");
  const [maxMarks, setMaxMarks] = useState("100");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!examId && state.exams[0]) setExamId(state.exams[0].id);
  }, [examId, state.exams]);
  useEffect(() => {
    if (!className && classNames[0]) setClassName(classNames[0]);
  }, [className, classNames]);
  useEffect(() => {
    if (!subjects.includes(subject)) setSubject(subjects[0] || "");
  }, [subjects, subject]);

  const existingRecord = useMemo(
    () =>
      state.marks.find(
        (r) => r.examId === examId && r.className === className && r.subject === subject
      ),
    [state.marks, examId, className, subject]
  );

  // Load the class roster and merge any previously saved marks (web parity).
  useEffect(() => {
    const roster = studentsForClass(className);
    setMaxMarks(String(existingRecord?.maxMarks || 100));
    setRows(
      roster.map((student) => {
        const saved = (existingRecord?.rows || []).find(
          (row) => row.studentId === student.id || row.admissionNumber === student.admissionNumber
        );
        return {
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          studentName: student.displayName,
          rollNo: student.rollNo,
          marks: saved?.marks ?? "",
          remark: saved?.remark || "",
        };
      })
    );
  }, [className, subject, examId, existingRecord, studentsForClass]);

  const updateRow = (studentId, field, value) => {
    setRows((current) =>
      current.map((row) => (row.studentId === studentId ? { ...row, [field]: value } : row))
    );
  };

  const handleSave = async () => {
    if (!examId) return banner.showError("Select an examination first.");
    if (!className) return banner.showError("Select a class first.");
    if (!subject) return banner.showError("Select a subject first.");
    if (!rows.length) return banner.showError("No students found in this class roster.");
    try {
      await commit((current) => {
        const existing = current.marks.find(
          (r) => r.examId === examId && r.className === className && r.subject === subject
        );
        const nextRecord = {
          id: existing?.id || `MARK-${Date.now()}`,
          examId,
          className,
          subject,
          maxMarks: Number(maxMarks) || 100,
          enteredByRole: actorRole,
          enteredByName: actorName,
          submittedAt: existing?.submittedAt || nowIso(),
          updatedAt: nowIso(),
          teacherEditUnlockedUntil: existing?.teacherEditUnlockedUntil || "",
          teacherEditUnlockedByName: existing?.teacherEditUnlockedByName || "",
          teacherEditUnlockedAt: existing?.teacherEditUnlockedAt || "",
          rows,
        };
        return {
          ...current,
          marks: existing
            ? current.marks.map((r) => (r.id === existing.id ? nextRecord : r))
            : [nextRecord, ...current.marks],
        };
      });
      banner.showSuccess(`Marks saved for ${className} · ${subject}.`);
    } catch {
      /* banner already shown */
    }
  };

  if (!state.exams.length) {
    return <EmptyState icon="bar-chart-outline" title="No exams yet" text="Create an examination first, then enter marks." />;
  }

  const maxNum = Number(maxMarks) || 100;

  return (
    <>
      <Card>
        <SectionTitle>Marks Entry</SectionTitle>
        <Select
          label="Examination"
          options={state.exams.map((e) => ({ value: e.id, label: e.name }))}
          value={examId}
          onChange={setExamId}
          placeholder="Select examination"
        />
        <Select
          label="Class"
          options={classNames}
          value={className}
          onChange={setClassName}
          placeholder={classNames.length ? "Select class" : "No classes found."}
        />
        <Select
          label="Subject"
          options={subjects}
          value={subject}
          onChange={setSubject}
          placeholder={subjects.length ? "Select subject" : "No subjects mapped for this class."}
        />
        <TextField
          label="Max Marks"
          value={maxMarks}
          onChangeText={setMaxMarks}
          keyboardType="number-pad"
          placeholder="100"
        />
        {existingRecord ? (
          <Text style={[styles.help, { color: palette.inkFaint }]}>
            Last saved by {existingRecord.enteredByName || "-"}. Editing overwrites the saved list.
          </Text>
        ) : (
          <Text style={[styles.help, { color: palette.inkFaint }]}>No marks submitted yet for this exam/class/subject.</Text>
        )}
      </Card>

      <SectionTitle>
        Roster · {className || "-"} ({rows.length})
      </SectionTitle>
      {!rows.length ? (
        <EmptyState
          icon="people-outline"
          title="No students"
          text="No students found for this class. Add students in Student Management."
        />
      ) : (
        <>
          {rows.map((row) => {
            const grade = row.marks === "" ? "-" : calculateGrade(row.marks, maxNum);
            return (
              <Card key={row.studentId}>
                <Text style={[styles.title, { color: palette.ink }]}>{row.studentName}</Text>
                <Text style={[styles.sub, { color: palette.inkSoft }]}>
                  Roll {row.rollNo} · {row.admissionNumber || "-"} · Grade {grade}
                </Text>
                <Field label={`Marks (out of ${maxNum})`}>
                  <TextField
                    value={String(row.marks)}
                    onChangeText={(v) => updateRow(row.studentId, "marks", v)}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </Field>
                <TextField
                  label="Remark"
                  value={row.remark}
                  onChangeText={(v) => updateRow(row.studentId, "remark", v)}
                  placeholder={row.marks === "" ? "Remark" : getFocusRemark(row.marks, maxNum)}
                />
              </Card>
            );
          })}
          <PrimaryButton icon="save-outline" label="Save Marks" onPress={handleSave} loading={saving} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Report Cards & Admit Cards (admin / clerk only) — web parity
// ---------------------------------------------------------------------------
// Bulk (whole-class) + optional single-student generation of the Annual Progress
// Report card and the Admit Card. Everything renders to a shareable PDF via
// ./printDocs (expo-print + expo-sharing) — printing opens the share sheet, so no
// success banner is needed here.
function ReportCardsSection({ state, banner, classNames, studentsForClass }) {
  const { palette } = useTheme();
  const [className, setClassName] = useState(classNames[0] || "");
  const [examId, setExamId] = useState(state.exams[0]?.id || "");
  const [studentId, setStudentId] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!className && classNames[0]) setClassName(classNames[0]);
  }, [className, classNames]);
  useEffect(() => {
    if (!examId && state.exams[0]) setExamId(state.exams[0].id);
  }, [examId, state.exams]);

  const selectedExam = useMemo(
    () => state.exams.find((e) => e.id === examId) || null,
    [state.exams, examId]
  );

  // Roster for the picked class (already normalized: id, displayName, className,
  // section, rollNo, admissionNumber). printDocs picks name || displayName defensively.
  const students = useMemo(
    () => (className ? studentsForClass(className) : []),
    [className, studentsForClass]
  );

  // Reset the single-student picker whenever the class roster changes.
  useEffect(() => {
    if (!students.some((s) => s.id === studentId)) {
      setStudentId(students[0]?.id || "");
    }
  }, [students, studentId]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) || null,
    [students, studentId]
  );

  const scheduleForSelection = useMemo(
    () =>
      state.schedules.filter(
        (row) => row.examId === selectedExam?.id && row.className === className
      ),
    [state.schedules, selectedExam, className]
  );

  const schoolInfo = useMemo(
    () => ({ academicYear: selectedExam?.academicYear }),
    [selectedExam]
  );

  // Run a print helper with shared guards: no double-run, class must have students,
  // errors surface in the banner. No success banner — the share sheet is the feedback.
  const runPrint = useCallback(
    async (action) => {
      if (generating) return;
      setGenerating(true);
      banner.clear();
      try {
        await action();
      } catch (err) {
        banner.showError(err?.message || "Could not generate the document.");
      } finally {
        setGenerating(false);
      }
    },
    [generating, banner]
  );

  const printClassReports = () =>
    runPrint(() => {
      if (!students.length) throw new Error("No students found in this class.");
      return printReportCardsForClass({
        students,
        exams: state.exams,
        marks: state.marks,
        className,
        schoolInfo,
      });
    });

  const printClassAdmits = () =>
    runPrint(() => {
      if (!students.length) throw new Error("No students found in this class.");
      if (!selectedExam) throw new Error("Select an examination first.");
      return printAdmitCardsForClass({
        students,
        exam: selectedExam,
        schedule: scheduleForSelection,
        schoolInfo,
      });
    });

  const printOneReport = () =>
    runPrint(() => {
      if (!selectedStudent) throw new Error("Select a student first.");
      return printReportCard({
        student: selectedStudent,
        exams: state.exams,
        marks: state.marks,
        className,
        schoolInfo,
      });
    });

  const printOneAdmit = () =>
    runPrint(() => {
      if (!selectedStudent) throw new Error("Select a student first.");
      if (!selectedExam) throw new Error("Select an examination first.");
      return printAdmitCard({
        student: selectedStudent,
        exam: selectedExam,
        schedule: scheduleForSelection,
        schoolInfo,
      });
    });

  if (!state.exams.length) {
    return (
      <EmptyState
        icon="print-outline"
        title="No exams yet"
        text="Create an examination first, then generate report cards and admit cards."
      />
    );
  }

  return (
    <>
      <Card>
        <SectionTitle>Report Cards &amp; Admit Cards</SectionTitle>
        <Text style={[styles.help, { color: palette.inkFaint }]}>
          Generates a PDF you can print or share.
        </Text>
        <Select
          label="Class"
          options={classNames}
          value={className}
          onChange={setClassName}
          placeholder={classNames.length ? "Select class" : "No classes found."}
        />
        <Select
          label="Examination"
          options={state.exams.map((e) => ({
            value: e.id,
            label: `${e.name}${e.academicYear ? ` · ${e.academicYear}` : ""}`,
          }))}
          value={examId}
          onChange={setExamId}
          placeholder="Select examination"
        />
        <Text style={[styles.help, { color: palette.inkFaint }]}>
          {students.length
            ? `${students.length} student${students.length === 1 ? "" : "s"} in ${className}.`
            : "No students found in this class."}
        </Text>
      </Card>

      <Card>
        <SectionTitle>Whole Class</SectionTitle>
        <PrimaryButton
          icon="document-text-outline"
          label="Print / Share Report Cards (whole class)"
          onPress={printClassReports}
          loading={generating}
          disabled={generating || !students.length}
        />
        <View style={{ height: 10 }} />
        <PrimaryButton
          icon="reader-outline"
          label="Print / Share Admit Cards (whole class)"
          onPress={printClassAdmits}
          loading={generating}
          disabled={generating || !students.length || !selectedExam}
        />
      </Card>

      <Card>
        <SectionTitle>Single Student</SectionTitle>
        {students.length ? (
          <>
            <Select
              label="Student"
              options={students.map((s) => ({
                value: s.id,
                label: `${s.displayName}${s.rollNo ? ` · Roll ${s.rollNo}` : ""}`,
              }))}
              value={studentId}
              onChange={setStudentId}
              placeholder="Select student"
            />
            <PrimaryButton
              icon="document-outline"
              label="Report Card"
              onPress={printOneReport}
              loading={generating}
              disabled={generating || !selectedStudent}
            />
            <View style={{ height: 10 }} />
            <PrimaryButton
              icon="card-outline"
              label="Admit Card"
              onPress={printOneAdmit}
              loading={generating}
              disabled={generating || !selectedStudent || !selectedExam}
            />
          </>
        ) : (
          <Text style={[styles.help, { color: palette.inkFaint }]}>
            No students found for this class. Add students in Student Management.
          </Text>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Board Examination desk — authed helpers
// ---------------------------------------------------------------------------
// apiRequest already handles JSON + multipart auth, so board JSON/multipart calls
// reuse it. File BYTES, however, are streamed raw (not JSON), so we download them
// straight to a cache file with the bearer token and open via the OS.

const readAuthToken = async () => {
  try {
    const sessionStr = await AsyncStorage.getItem("mgps_erp_auth_session");
    if (!sessionStr) return null;
    return JSON.parse(sessionStr)?.token || null;
  } catch {
    return null;
  }
};

// Download an authed raw-bytes endpoint to the cache dir, then open/share it.
const downloadAndOpen = async (endpoint, fileName, mimeType) => {
  const token = await readAuthToken();
  const safeName = String(fileName || "board-file")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 120) || "board-file";
  const fileUri = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;
  const { uri, status } = await FileSystem.downloadAsync(
    `${API_BASE_URL}${endpoint}`,
    fileUri,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (status && status >= 400) {
    throw new Error("The file could not be found on the server.");
  }

  if (Platform.OS === "android") {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1,
        type: mimeType || "application/pdf",
      });
      return;
    } catch {
      /* fall through to the share sheet */
    }
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: mimeType || "application/pdf" });
  } else {
    await Linking.openURL(uri);
  }
};

// Guess a mime type from a filename extension (for the OS open intent).
const mimeForName = (name = "") => {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/pdf";
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ---------------------------------------------------------------------------
// Board Examination Desk (admin / approved-clerk only)
// ---------------------------------------------------------------------------
// Board classes sit their FINAL exam at an external centre. Admin/clerk upload
// the board timetable (one PDF per class+exam) and each student's result
// (PDF/JPG/PNG). Clerks must be granted access by an admin first.
function BoardExaminationDesk({ state, banner, user, studentsForClass, reloadState }) {
  const { palette } = useTheme();
  const role = user?.role || "";
  const isAdmin = role === "admin";

  const boardClasses = useMemo(
    () => (Array.isArray(state?.boardClasses) ? state.boardClasses.filter(Boolean) : []),
    [state]
  );
  const exams = useMemo(() => (Array.isArray(state?.exams) ? state.exams : []), [state]);

  // ---- Access gate ---------------------------------------------------------
  const [accessStatus, setAccessStatus] = useState("none"); // clerk: none|requested|approved
  const [accessRecords, setAccessRecords] = useState([]); // admin: array
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessBusy, setAccessBusy] = useState(false);

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    try {
      const payload = await apiRequest("/examinations/board-access/status");
      if (isAdmin) {
        setAccessRecords(Array.isArray(payload) ? payload : payload?.records || []);
      } else {
        const status =
          (Array.isArray(payload) ? payload[0]?.status : payload?.status) || "none";
        setAccessStatus(status);
      }
    } catch (err) {
      banner.showError(err.message || "Could not load board access status.");
    } finally {
      setAccessLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const requestAccess = async () => {
    setAccessBusy(true);
    banner.clear();
    try {
      await apiRequest("/examinations/board-access/request", { method: "POST" });
      setAccessStatus("requested");
    } catch (err) {
      banner.showError(err.message || "Could not send the request.");
    } finally {
      setAccessBusy(false);
    }
  };

  const grantAccess = async (clerkUsername) => {
    setAccessBusy(true);
    banner.clear();
    try {
      await apiRequest("/examinations/board-access/grant", {
        method: "POST",
        body: JSON.stringify({ clerkUsername }),
      });
      await loadAccess();
    } catch (err) {
      banner.showError(err.message || "Could not grant access.");
    } finally {
      setAccessBusy(false);
    }
  };

  const revokeAccess = async (clerkUsername) => {
    setAccessBusy(true);
    banner.clear();
    try {
      await apiRequest("/examinations/board-access/revoke", {
        method: "POST",
        body: JSON.stringify({ clerkUsername }),
      });
      await loadAccess();
    } catch (err) {
      banner.showError(err.message || "Could not revoke access.");
    } finally {
      setAccessBusy(false);
    }
  };

  const clerkApproved = isAdmin || accessStatus === "approved";

  // ---- Selectors -----------------------------------------------------------
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");

  useEffect(() => {
    if (!boardClasses.length) return;
    if (!selectedClass || !boardClasses.includes(selectedClass)) {
      setSelectedClass(boardClasses[0]);
    }
  }, [boardClasses, selectedClass]);

  useEffect(() => {
    if (!exams.length) return;
    const existing = exams.some((exam) => exam.id === selectedExamId);
    if (!selectedExamId || !existing) {
      const finalExam = exams.find((exam) => isFinalExam(exam));
      setSelectedExamId((finalExam || exams[0]).id);
    }
  }, [exams, selectedExamId]);

  // ---- Timetable -----------------------------------------------------------
  const [timetable, setTimetable] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableBusy, setTimetableBusy] = useState(false);
  const [openingTimetable, setOpeningTimetable] = useState(false);

  const loadTimetable = useCallback(async () => {
    if (!clerkApproved || !selectedClass || !selectedExamId) {
      setTimetable([]);
      return;
    }
    setTimetableLoading(true);
    try {
      const payload = await apiRequest(
        `/examinations/board-timetable?className=${encodeURIComponent(
          selectedClass
        )}&examId=${encodeURIComponent(selectedExamId)}`
      );
      setTimetable(Array.isArray(payload) ? payload : payload?.items || []);
    } catch (err) {
      banner.showError(err.message || "Could not load timetable.");
      setTimetable([]);
    } finally {
      setTimetableLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkApproved, selectedClass, selectedExamId]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const uploadTimetable = async () => {
    if (!selectedClass || !selectedExamId) return banner.showError("Pick a class and exam first.");
    let picked;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        multiple: false,
        copyToCacheDirectory: true,
      });
    } catch (err) {
      banner.showError(err.message || "Could not open the file picker.");
      return;
    }
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];

    setTimetableBusy(true);
    banner.clear();
    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name || "board-timetable.pdf",
        type: asset.mimeType || "application/pdf",
      });
      form.append("className", selectedClass);
      form.append("examId", selectedExamId);
      await apiRequest("/examinations/board-timetable", { method: "POST", body: form });
      banner.showSuccess("Board timetable uploaded.");
      await loadTimetable();
      reloadState?.();
    } catch (err) {
      banner.showError(err.message || "Upload failed.");
    } finally {
      setTimetableBusy(false);
    }
  };

  const viewTimetable = async (item) => {
    setOpeningTimetable(true);
    banner.clear();
    try {
      await downloadAndOpen(
        `/examinations/board-timetable/${encodeURIComponent(
          selectedClass
        )}/${encodeURIComponent(selectedExamId)}`,
        item?.fileName || "board-timetable.pdf",
        "application/pdf"
      );
    } catch (err) {
      Alert.alert("Could not open timetable", err?.message || "Try again later.");
    } finally {
      setOpeningTimetable(false);
    }
  };

  const deleteTimetable = (item) => {
    Alert.alert("Delete timetable?", `${selectedClass} · ${item?.fileName || "PDF"}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setTimetableBusy(true);
          banner.clear();
          try {
            await apiRequest(`/examinations/board-timetable/${encodeURIComponent(item.id)}`, {
              method: "DELETE",
            });
            banner.showSuccess("Timetable removed.");
            await loadTimetable();
            reloadState?.();
          } catch (err) {
            banner.showError(err.message || "Could not delete.");
          } finally {
            setTimetableBusy(false);
          }
        },
      },
    ]);
  };

  // ---- Student-wise results ------------------------------------------------
  const students = useMemo(
    () => (selectedClass ? studentsForClass(selectedClass) : []),
    [selectedClass, studentsForClass]
  );

  const [results, setResults] = useState([]); // metadata array
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultBusyAdm, setResultBusyAdm] = useState(""); // admissionNumber currently busy
  const [studentSearch, setStudentSearch] = useState("");

  const loadResults = useCallback(async () => {
    if (!clerkApproved || !selectedClass || !selectedExamId) {
      setResults([]);
      return;
    }
    setResultsLoading(true);
    try {
      const payload = await apiRequest(
        `/examinations/board-student-result?className=${encodeURIComponent(
          selectedClass
        )}&examId=${encodeURIComponent(selectedExamId)}`
      );
      setResults(Array.isArray(payload) ? payload : payload?.items || []);
    } catch (err) {
      banner.showError(err.message || "Could not load results.");
      setResults([]);
    } finally {
      setResultsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkApproved, selectedClass, selectedExamId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const resultByAdmission = useMemo(() => {
    const map = new Map();
    results.forEach((rec) => {
      if (rec?.admissionNumber) map.set(String(rec.admissionNumber), rec);
    });
    return map;
  }, [results]);

  const uploadStudentResult = async (student) => {
    const admission = student.admissionNumber;
    if (!admission) return banner.showError("This student has no admission number.");
    if (!selectedExamId) return banner.showError("Pick an exam first.");

    let picked;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        multiple: false,
        copyToCacheDirectory: true,
      });
    } catch (err) {
      banner.showError(err.message || "Could not open the file picker.");
      return;
    }
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];

    setResultBusyAdm(admission);
    banner.clear();
    try {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name || "board-result",
        type: asset.mimeType || mimeForName(asset.name),
      });
      form.append("admissionNumber", admission);
      form.append("studentName", student.displayName || "");
      form.append("className", selectedClass);
      form.append("examId", selectedExamId);
      await apiRequest("/examinations/board-student-result", { method: "POST", body: form });
      banner.showSuccess(`Result uploaded for ${student.displayName || admission}.`);
      await loadResults();
      reloadState?.();
    } catch (err) {
      banner.showError(err.message || "Upload failed.");
    } finally {
      setResultBusyAdm("");
    }
  };

  const viewStudentResult = async (record) => {
    setResultBusyAdm(record.admissionNumber || "x");
    banner.clear();
    try {
      await downloadAndOpen(
        `/examinations/board-student-result/${encodeURIComponent(
          record.admissionNumber
        )}/${encodeURIComponent(selectedExamId)}`,
        record.fileName || "board-result",
        record.mimeType || mimeForName(record.fileName)
      );
    } catch (err) {
      Alert.alert("Could not open result", err?.message || "Try again later.");
    } finally {
      setResultBusyAdm("");
    }
  };

  const deleteStudentResult = (record) => {
    if (!record?.id) return;
    Alert.alert("Delete result?", `${record.studentName || record.admissionNumber}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setResultBusyAdm(record.admissionNumber || "x");
          banner.clear();
          try {
            await apiRequest(
              `/examinations/board-student-result/${encodeURIComponent(record.id)}`,
              { method: "DELETE" }
            );
            banner.showSuccess("Result removed.");
            await loadResults();
            reloadState?.();
          } catch (err) {
            banner.showError(err.message || "Could not delete.");
          } finally {
            setResultBusyAdm("");
          }
        },
      },
    ]);
  };

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) return students;
    return students.filter((student) => {
      const name = String(student.displayName || "").toLowerCase();
      const adm = String(student.admissionNumber || "").toLowerCase();
      return name.includes(term) || adm.includes(term);
    });
  }, [students, studentSearch]);

  // -------------------------------------------------------------------------
  // Access gate render (clerk, not yet approved)
  // -------------------------------------------------------------------------
  if (!isAdmin && !clerkApproved) {
    if (accessLoading) {
      return <LoadingCard text="Checking board access..." rows={2} hero={false} />;
    }
    return (
      <Card style={{ marginTop: 6 }}>
        <View style={styles.lockWrap}>
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={44} color="#fff" />
          </View>
          {accessStatus === "requested" ? (
            <>
              <Text style={[styles.lockTitle, { color: palette.ink }]}>
                Waiting for admin approval
              </Text>
              <Text style={[styles.lockText, { color: palette.inkSoft }]}>
                Your request has been sent. An administrator must approve it before you can use the
                Board Examination desk.
              </Text>
              <View style={styles.waitPill}>
                <Ionicons name="time-outline" size={14} color="#b45309" />
                <Text style={styles.waitPillText}>Approval requested — waiting for an admin.</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.lockTitle, { color: palette.ink }]}>This desk is locked.</Text>
              <Text style={[styles.lockText, { color: palette.inkSoft }]}>
                Take admin approval to access.
              </Text>
              <PrimaryButton
                icon="shield-checkmark-outline"
                label={accessBusy ? "Sending..." : "Send for Approval"}
                onPress={requestAccess}
                loading={accessBusy}
              />
            </>
          )}
        </View>
      </Card>
    );
  }

  // -------------------------------------------------------------------------
  // Desk content (admin or approved clerk)
  // -------------------------------------------------------------------------
  const requestedClerks = accessRecords.filter((rec) => rec?.status === "requested");
  const approvedClerks = accessRecords.filter((rec) => rec?.status === "approved");
  const uploadedCount = resultByAdmission.size;

  return (
    <>
      <Card>
        <SectionTitle>Board Examination</SectionTitle>
        <Text style={[styles.help, { color: palette.inkFaint }]}>
          Board classes take their FINAL exam at an external centre. Upload the board timetable and
          each student&apos;s result (PDF/JPG/PNG) here — students see their own.
        </Text>
      </Card>

      {/* Admin: clerk access requests */}
      {isAdmin && (
        <Card>
          <SectionTitle>Clerk Access Requests</SectionTitle>
          {accessLoading ? (
            <Text style={[styles.help, { color: palette.inkFaint }]}>Loading...</Text>
          ) : requestedClerks.length === 0 && approvedClerks.length === 0 ? (
            <Text style={[styles.help, { color: palette.inkFaint }]}>No requests yet.</Text>
          ) : (
            <>
              {requestedClerks.map((rec) => (
                <View key={`req-${rec.clerkUsername}`} style={styles.accessRow}>
                  <View style={styles.accessName}>
                    <Ionicons name="time-outline" size={15} color="#b45309" />
                    <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
                      {rec.clerkUsername}
                    </Text>
                  </View>
                  <SmallButton
                    icon="checkmark"
                    label="Grant"
                    onPress={() => grantAccess(rec.clerkUsername)}
                    disabled={accessBusy}
                  />
                </View>
              ))}
              {approvedClerks.map((rec) => (
                <View key={`ok-${rec.clerkUsername}`} style={styles.accessRow}>
                  <View style={styles.accessName}>
                    <Ionicons name="checkmark-circle" size={15} color="#047857" />
                    <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
                      {rec.clerkUsername}
                    </Text>
                  </View>
                  <SmallButton
                    icon="close"
                    label="Revoke"
                    tone="danger"
                    onPress={() => revokeAccess(rec.clerkUsername)}
                    disabled={accessBusy}
                  />
                </View>
              ))}
            </>
          )}
        </Card>
      )}

      {boardClasses.length === 0 ? (
        <EmptyState
          icon="alert-circle-outline"
          title="No board classes yet"
          text="No classes are marked as Board yet. Mark a class as a Board Class in Class Management."
        />
      ) : (
        <>
          {/* Selectors */}
          <Card>
            <Select
              label="Board Class"
              options={boardClasses}
              value={selectedClass}
              onChange={setSelectedClass}
              placeholder="Select board class"
            />
            <Select
              label="Examination"
              options={exams.map((exam) => ({
                value: exam.id,
                label: `${getExamLabel(exam)}${exam.academicYear ? ` · ${exam.academicYear}` : ""}`,
              }))}
              value={selectedExamId}
              onChange={setSelectedExamId}
              placeholder={exams.length ? "Select exam" : "No exams available"}
            />
          </Card>

          {/* Board Timetable */}
          <SectionTitle>Board Timetable</SectionTitle>
          <Card>
            {timetableLoading ? (
              <Text style={[styles.help, { color: palette.inkFaint }]}>Loading timetable...</Text>
            ) : timetable.length === 0 ? (
              <Text style={[styles.help, { color: palette.inkFaint }]}>
                No timetable uploaded for this class &amp; exam yet.
              </Text>
            ) : (
              timetable.map((item) => (
                <View key={item.id || item.fileName} style={styles.fileRow}>
                  <View style={styles.fileMeta}>
                    <Ionicons name="document-text-outline" size={18} color={palette.accentDeep} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
                        {item.fileName || "Timetable.pdf"}
                      </Text>
                      {!!item.uploadedAt && (
                        <Text style={[styles.sub, { color: palette.inkSoft }]} numberOfLines={1}>
                          {formatDateTime(item.uploadedAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.fileActions}>
                    <SmallButton
                      icon="open-outline"
                      label={openingTimetable ? "..." : "View"}
                      onPress={() => viewTimetable(item)}
                      disabled={openingTimetable}
                    />
                    <IconButton
                      icon="trash-outline"
                      tone="danger"
                      onPress={() => deleteTimetable(item)}
                      disabled={timetableBusy || !item.id}
                    />
                  </View>
                </View>
              ))
            )}
            <View style={{ marginTop: 12 }}>
              <PrimaryButton
                icon="cloud-upload-outline"
                label={timetableBusy ? "Uploading..." : "Upload Timetable PDF"}
                onPress={uploadTimetable}
                loading={timetableBusy}
                disabled={!selectedClass || !selectedExamId}
              />
            </View>
          </Card>

          {/* Student-wise Final Results */}
          <SectionTitle
            right={
              <Text style={[styles.countPill, { color: palette.accentDeep }]}>
                {uploadedCount}/{students.length} uploaded
              </Text>
            }
          >
            Student-wise Final Results
          </SectionTitle>
          <Card>
            <TextField
              value={studentSearch}
              onChangeText={setStudentSearch}
              placeholder="Search name or admission no..."
              autoCapitalize="none"
            />
          </Card>

          {resultsLoading ? (
            <Text style={[styles.help, { color: palette.inkFaint, marginLeft: 2 }]}>
              Loading results...
            </Text>
          ) : students.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No students"
              text={`No students found for ${selectedClass || "this class"}. Add them in Student Management.`}
            />
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="No matches"
              text={`No students match "${studentSearch}".`}
            />
          ) : (
            filteredStudents.map((student) => {
              const admission = student.admissionNumber;
              const record = admission ? resultByAdmission.get(String(admission)) : null;
              const uploaded = Boolean(record);
              const busy = resultBusyAdm === admission;
              return (
                <Card key={student.id}>
                  <View style={styles.studentTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: palette.ink }]} numberOfLines={1}>
                        {student.displayName}
                      </Text>
                      <Text style={[styles.sub, { color: palette.inkSoft }]} numberOfLines={1}>
                        Roll {student.rollNo} · Adm {admission || "—"}
                      </Text>
                    </View>
                    <View style={[styles.chip, uploaded ? styles.chipOk : styles.chipPending]}>
                      <Text
                        style={[
                          styles.chipText,
                          { color: uploaded ? "#047857" : "#64748B" },
                        ]}
                      >
                        {uploaded ? "Uploaded" : "Pending"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.studentActions}>
                    <SmallButton
                      icon="cloud-upload-outline"
                      label={busy ? "..." : uploaded ? "Replace" : "Upload"}
                      onPress={() => uploadStudentResult(student)}
                      disabled={busy || !admission}
                    />
                    {uploaded && (
                      <>
                        <SmallButton
                          icon="open-outline"
                          label="View"
                          onPress={() => viewStudentResult(record)}
                          disabled={busy}
                        />
                        <SmallButton
                          icon="trash-outline"
                          label="Delete"
                          tone="danger"
                          onPress={() => deleteStudentResult(record)}
                          disabled={busy}
                        />
                      </>
                    )}
                  </View>
                </Card>
              );
            })
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------
function Metric({ label, value }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: palette.tile }]}>
      <Text style={[styles.metricValue, { color: palette.ink }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.inkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = {
  title: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontSize: 12, fontWeight: "700", marginTop: 4 },
  help: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginTop: 4, marginBottom: 8 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeRow: { flexDirection: "row" },
  metricRow: { flexDirection: "row", gap: 10 },
  metric: {
    flex: 1,
    backgroundColor: "rgba(99,102,241,0.08)",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  metricValue: { color: "#0F172A", fontSize: 18, fontWeight: "900" },
  metricLabel: { color: "#64748B", fontSize: 10, fontWeight: "900", textTransform: "uppercase", marginTop: 2 },
  pillRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  pillLabel: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },

  // ---- Board Examination desk ----
  deskRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  deskBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  deskLabel: { fontSize: 12.5, fontWeight: "900", textAlign: "center" },
  lockWrap: { alignItems: "center", paddingVertical: 14, gap: 12 },
  lockBadge: {
    width: 92,
    height: 92,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8b5cf6",
    shadowColor: "#6d28d9",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  lockTitle: { fontSize: 17, fontWeight: "900", textAlign: "center" },
  lockText: { fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 19, maxWidth: 320 },
  waitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.35)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  waitPillText: { color: "#b45309", fontSize: 12, fontWeight: "900" },
  accessRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
  },
  accessName: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
  },
  fileMeta: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  fileActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  countPill: { fontSize: 12, fontWeight: "900" },
  studentTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  studentActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  chipOk: { backgroundColor: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.35)" },
  chipPending: { backgroundColor: "rgba(148,163,184,0.14)", borderColor: "rgba(148,163,184,0.35)" },
  chipText: { fontSize: 11, fontWeight: "900" },
};
