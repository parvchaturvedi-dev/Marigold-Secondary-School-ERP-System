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
import { Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  Card,
  DateField,
  Divider,
  EmptyState,
  Field,
  Hero,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  Segmented,
  Select,
  SectionTitle,
  TextField,
  todayIso,
  useBanner,
  useModuleState,
} from "../shared/formKit";

const PAPER_TYPES = ["Written", "Oral", "Practical", "Worksheet"];
const SECTIONS = [
  { value: "exam", label: "Exam" },
  { value: "paper", label: "Paper" },
  { value: "schedule", label: "Schedule" },
  { value: "marks", label: "Marks" },
];

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
  const banner = useBanner();
  const [section, setSection] = useState("exam");

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

  return (
    <ScreenShell title="Examination Management" refreshing={refreshing} onRefresh={onRefresh}>
      <Hero
        icon="school-outline"
        title="Examination Desk"
        subtitle="Create exams, papers, schedules, and enter student marks."
      />

      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <View style={{ marginBottom: 14 }}>
        <Segmented options={SECTIONS} value={section} onChange={setSection} />
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
          updatedBy={updatedBy}
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
  updatedBy,
}) {
  const { palette } = useTheme();
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
        examPapers.map((paper) => (
          <Card key={paper.id}>
            <Text style={[styles.title, { color: palette.ink }]}>{paper.title}</Text>
            <Text style={[styles.sub, { color: palette.inkSoft }]}>
              {paper.className} · {paper.subject} · {paper.type} · {paper.status}
            </Text>
          </Card>
        ))
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
};
