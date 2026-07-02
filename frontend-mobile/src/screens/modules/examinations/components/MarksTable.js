import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

const calculateGrade = (marks, maxMarks = 100) => {
  const percentage = maxMarks ? (Number(marks) / Number(maxMarks)) * 100 : 0;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  return "Needs Support";
};

const gradeColor = (grade) => {
  if (grade === "A+" || grade === "A") return glassColors.success;
  if (grade === "B+" || grade === "B") return glassColors.accentDeep;
  if (grade === "C") return glassColors.warning;
  return glassColors.danger;
};

/**
 * Subject-wise marks table for one exam, with a total/percentage/grade footer.
 *
 * Props:
 *  - examName: label for the exam group heading
 *  - subjects: array of { subject, marks, maxMarks, grade, remark }
 */
export default function MarksTable({ examName = "Examination", subjects = [] }) {
  const totals = subjects.reduce(
    (acc, item) => ({
      marks: acc.marks + Number(item.marks || 0),
      maxMarks: acc.maxMarks + Number(item.maxMarks || 0),
    }),
    { marks: 0, maxMarks: 0 }
  );
  const percentage = totals.maxMarks ? (totals.marks / totals.maxMarks) * 100 : 0;
  const overallGrade = calculateGrade(totals.marks, totals.maxMarks || 100);

  return (
    <GlassCard style={{ padding: 16, marginBottom: 16 }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.examName}>{examName}</Text>
          <Text style={styles.subCount}>
            {subjects.length} subject{subjects.length === 1 ? "" : "s"} recorded
          </Text>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: `${gradeColor(overallGrade)}22` }]}>
          <Text style={[styles.gradeBadgeText, { color: gradeColor(overallGrade) }]}>
            {overallGrade}
          </Text>
        </View>
      </View>

      <View style={styles.tableHeadRow}>
        <Text style={[styles.th, { flex: 1.4 }]}>Subject</Text>
        <Text style={[styles.th, styles.thCenter]}>Marks</Text>
        <Text style={[styles.th, styles.thCenter]}>Max</Text>
        <Text style={[styles.th, styles.thCenter]}>Grade</Text>
      </View>

      {subjects.map((item, index) => {
        const grade = item.grade || calculateGrade(item.marks, item.maxMarks || 100);
        return (
          <View
            key={`${item.subject}-${index}`}
            style={[styles.tableRow, index === subjects.length - 1 && { borderBottomWidth: 0 }]}
          >
            <View style={{ flex: 1.4 }}>
              <Text style={styles.subjectText}>{item.subject}</Text>
              {!!item.remark && <Text style={styles.remarkText}>{item.remark}</Text>}
            </View>
            <Text style={[styles.td, styles.tdCenter]}>{item.marks}</Text>
            <Text style={[styles.td, styles.tdCenter]}>{item.maxMarks}</Text>
            <Text style={[styles.td, styles.tdCenter, { color: gradeColor(grade), fontWeight: "900" }]}>
              {grade}
            </Text>
          </View>
        );
      })}

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="stats-chart-outline" size={16} color={glassColors.accentDeep} />
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerValue}>
            {totals.marks} / {totals.maxMarks}
          </Text>
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.footerItem}>
          <Ionicons name="pie-chart-outline" size={16} color={glassColors.accentDeep} />
          <Text style={styles.footerLabel}>Percentage</Text>
          <Text style={styles.footerValue}>{percentage.toFixed(1)}%</Text>
        </View>
        <View style={styles.footerDivider} />
        <View style={styles.footerItem}>
          <Ionicons name="ribbon-outline" size={16} color={glassColors.accentDeep} />
          <Text style={styles.footerLabel}>Grade</Text>
          <Text style={[styles.footerValue, { color: gradeColor(overallGrade) }]}>
            {overallGrade}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = {
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  examName: {
    fontSize: 16,
    fontWeight: "900",
    color: glassColors.ink,
  },
  subCount: {
    marginTop: 3,
    fontSize: 12,
    color: glassColors.inkSoft,
  },
  gradeBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },
  tableHeadRow: {
    flexDirection: "row",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.1)",
    marginBottom: 4,
  },
  th: {
    flex: 1,
    fontSize: 11,
    fontWeight: "900",
    color: glassColors.inkSoft,
    textTransform: "uppercase",
  },
  thCenter: {
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  subjectText: {
    fontSize: 13,
    fontWeight: "800",
    color: glassColors.ink,
  },
  remarkText: {
    marginTop: 2,
    fontSize: 11,
    color: glassColors.inkFaint,
  },
  td: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: glassColors.ink,
  },
  tdCenter: {
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.1)",
  },
  footerItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  footerDivider: {
    width: 1,
    height: 34,
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: glassColors.inkSoft,
    textTransform: "uppercase",
  },
  footerValue: {
    fontSize: 14,
    fontWeight: "900",
    color: glassColors.ink,
  },
};
