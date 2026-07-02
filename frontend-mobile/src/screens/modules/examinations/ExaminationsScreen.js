import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiRequest } from "../../../api/apiClient";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import GlassCard from "../../../shared/components/GlassCard";
import PageHeader from "../../../shared/components/PageHeader";
import { glassColors } from "../../../shared/theme/glass";

import MarksTable from "./components/MarksTable";
import ExamScheduleList from "./components/ExamScheduleList";
import ResultSummaryCard from "./components/ResultSummaryCard";

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

const normalize = (value = "") => String(value || "").trim().toUpperCase();

const calculateGrade = (marks, maxMarks = 100) => {
  const percentage = maxMarks ? (Number(marks) / Number(maxMarks)) * 100 : 0;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  return "Needs Support";
};

const getFocusRemark = (marks, maxMarks = 100) => {
  const percentage = maxMarks ? (Number(marks) / Number(maxMarks)) * 100 : 0;
  if (percentage >= 85) return "Strong performance";
  if (percentage >= 70) return "Revise for consistency";
  if (percentage >= 50) return "Needs guided practice";
  return "Needs urgent attention";
};

// A marks-record "row" (per-student line inside a subject's marks record)
// matches the active student on studentId, admissionNumber, or studentName —
// mirroring web's marksRowBelongsToStudent().
const rowBelongsToStudent = (row = {}, student = {}) =>
  Boolean(
    (row.studentId && student?.id && String(row.studentId) === String(student.id)) ||
      (row.admissionNumber &&
        student?.admissionNumber &&
        normalize(row.admissionNumber) === normalize(student.admissionNumber)) ||
      (row.studentName &&
        student?.displayName &&
        normalize(row.studentName) === normalize(student.displayName))
  );

// Board-result rows match on examId + className + (admissionNumber | studentId | studentName).
const boardResultBelongsToStudent = (result = {}, student = {}) =>
  Boolean(
    (result.admissionNumber &&
      student?.admissionNumber &&
      normalize(result.admissionNumber) === normalize(student.admissionNumber)) ||
      (result.studentId && student?.id && String(result.studentId) === String(student.id)) ||
      (result.studentName &&
        student?.displayName &&
        normalize(result.studentName) === normalize(student.displayName))
  );

function resolveActiveStudent(user = {}) {
  const profiles = Array.isArray(user?.studentProfiles) ? user.studentProfiles : [];
  return user?.activeStudent || profiles[0] || null;
}

function buildExamGroups(state, student) {
  const examsById = new Map(state.exams.map((exam) => [exam.id, exam]));
  const studentClassName = student?.className || "";

  // Marks: every subject record for the student's class, filtered to rows
  // belonging to this student.
  const relevantMarkRecords = state.marks.filter(
    (record) => !studentClassName || record.className === studentClassName
  );

  const groupsByExamId = new Map();

  relevantMarkRecords.forEach((record) => {
    const matchedRow = (record.rows || []).find((row) => rowBelongsToStudent(row, student));
    if (!matchedRow) return;

    const examId = record.examId;
    if (!groupsByExamId.has(examId)) {
      groupsByExamId.set(examId, {
        examId,
        exam: examsById.get(examId),
        updatedAt: record.updatedAt || record.submittedAt || "",
        subjects: [],
      });
    }

    const group = groupsByExamId.get(examId);
    const maxMarks = Number(record.maxMarks || 100);
    const marks = Number(matchedRow.marks || 0);
    group.subjects.push({
      subject: record.subject,
      marks,
      maxMarks,
      grade: calculateGrade(marks, maxMarks),
      remark: matchedRow.remark || getFocusRemark(marks, maxMarks),
    });
    if ((record.updatedAt || "") > (group.updatedAt || "")) {
      group.updatedAt = record.updatedAt || record.submittedAt || "";
    }
  });

  return Array.from(groupsByExamId.values()).sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  });
}

export default function ExaminationsScreen({ rows, user }) {
  const [state, setState] = useState(() =>
    rows ? normalizeState(rows) : EMPTY_STATE
  );
  const [loading, setLoading] = useState(!rows);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const shouldFetch = rows === undefined;

  const load = async ({ isRefresh = false } = {}) => {
    if (!shouldFetch) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/examinations/state");
      setState(normalizeState(data));
    } catch (err) {
      setError(err.message || "Could not load examination records.");
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => {
    if (rows) {
      setState(normalizeState(rows));
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const student = useMemo(() => resolveActiveStudent(user), [user]);

  const examsById = useMemo(() => new Map(state.exams.map((exam) => [exam.id, exam])), [state.exams]);

  const examGroups = useMemo(() => buildExamGroups(state, student), [state, student]);

  const classSchedules = useMemo(() => {
    if (!student?.className) return [];
    return state.schedules.filter((row) => row.className === student.className);
  }, [state.schedules, student]);

  const boardResults = useMemo(
    () => state.boardResults.filter((result) => boardResultBelongsToStudent(result, student)),
    [state.boardResults, student]
  );

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <AuroraBackground />
        <PageHeader title="Examinations" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={glassColors.accentDeep} size="large" />
        </View>
      </View>
    );
  }

  if (!student) {
    return (
      <View style={{ flex: 1 }}>
        <AuroraBackground />
        <PageHeader title="Examinations" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <GlassCard style={{ padding: 24, alignItems: "center" }}>
            <Ionicons name="person-remove-outline" size={30} color={glassColors.inkFaint} />
            <Text style={styles.emptyTitle}>No student profile found</Text>
            <Text style={styles.emptyText}>
              We could not find an active student profile on this account.
            </Text>
          </GlassCard>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <PageHeader title="Examinations" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          shouldFetch ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} />
          ) : undefined
        }
      >
        <GlassCard style={{ padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.studentIconChip}>
              <Ionicons name="school-outline" size={22} color={glassColors.accentDeep} />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.studentName}>{student.displayName || student.name || "Student"}</Text>
              <Text style={styles.studentMeta}>
                Class {student.className || "-"}
                {student.section ? ` - ${student.section}` : ""} · Roll No. {student.rollNo || "-"}
              </Text>
            </View>
          </View>
        </GlassCard>

        {!!error && (
          <GlassCard style={{ padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="alert-circle-outline" size={20} color={glassColors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </GlassCard>
        )}

        <ResultSummaryCard results={boardResults} examsById={examsById} />

        <Text style={styles.sectionTitle}>Marks and Results</Text>
        {!examGroups.length ? (
          <GlassCard style={{ padding: 24, alignItems: "center", marginBottom: 16 }}>
            <Ionicons name="document-text-outline" size={28} color={glassColors.inkFaint} />
            <Text style={styles.emptyText}>No marks have been published for this student yet.</Text>
          </GlassCard>
        ) : (
          examGroups.map((group) => (
            <MarksTable
              key={group.examId}
              examName={group.exam ? `${group.exam.name} Examination` : "Examination"}
              subjects={group.subjects}
            />
          ))
        )}

        <ExamScheduleList schedules={classSchedules} examsById={examsById} />
      </ScrollView>
    </View>
  );
}

const styles = {
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: glassColors.ink,
    marginBottom: 10,
  },
  studentIconChip: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(99,102,241,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  studentName: {
    fontSize: 16,
    fontWeight: "900",
    color: glassColors.ink,
  },
  studentMeta: {
    marginTop: 3,
    fontSize: 12,
    color: glassColors.inkSoft,
    fontWeight: "600",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "900",
    color: glassColors.ink,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: glassColors.inkSoft,
    textAlign: "center",
  },
  errorText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "700",
    color: glassColors.danger,
    flex: 1,
  },
};
