import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

const formatDate = (dateValue) => {
  if (!dateValue) return "Date to be announced";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return String(dateValue);
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTimeRange = (startTime, endTime) => {
  if (!startTime && !endTime) return "";
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime;
};

const isUpcoming = (dateValue) => {
  if (!dateValue) return true;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed >= today;
};

/**
 * Upcoming exam schedule (date sheet) for the active student's class,
 * grouped by exam.
 *
 * Props:
 *  - schedules: array of schedule rows already filtered to this student's class
 *  - examsById: Map of examId -> exam record (for labelling)
 */
export default function ExamScheduleList({ schedules = [], examsById = new Map() }) {
  const sorted = [...schedules].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : Infinity;
    const dateB = b.date ? new Date(b.date).getTime() : Infinity;
    return dateA - dateB;
  });

  const upcoming = sorted.filter((row) => isUpcoming(row.date));
  const past = sorted.filter((row) => !isUpcoming(row.date));
  const orderedRows = [...upcoming, ...past];

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.sectionTitle}>Exam Schedule</Text>
      {!orderedRows.length ? (
        <GlassCard style={{ padding: 24, alignItems: "center" }}>
          <Ionicons name="calendar-outline" size={28} color={glassColors.inkFaint} />
          <Text style={styles.emptyText}>No exam schedule has been published yet.</Text>
        </GlassCard>
      ) : (
        <GlassCard style={{ padding: 6 }}>
          {orderedRows.map((row, index) => {
            const exam = examsById.get(row.examId);
            const upcomingRow = isUpcoming(row.date);
            return (
              <View
                key={row.id}
                style={[
                  styles.row,
                  index === orderedRows.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.dateChip, !upcomingRow && styles.dateChipPast]}>
                  <Text style={[styles.dateChipDay, !upcomingRow && styles.dateChipDayPast]}>
                    {row.date ? new Date(row.date).getDate() : "-"}
                  </Text>
                  <Text style={[styles.dateChipMonth, !upcomingRow && styles.dateChipDayPast]}>
                    {row.date
                      ? new Date(row.date).toLocaleDateString("en-US", { month: "short" })
                      : ""}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.subject}>{row.subject || "Subject"}</Text>
                  <Text style={styles.examLabel}>
                    {exam ? `${exam.name} Examination` : "Examination"}
                  </Text>
                  <Text style={styles.meta}>{formatDate(row.date)}</Text>
                </View>
                {!!formatTimeRange(row.startTime, row.endTime) && (
                  <View style={styles.timeBadge}>
                    <Ionicons name="time-outline" size={12} color={glassColors.accentDeep} />
                    <Text style={styles.timeBadgeText}>
                      {formatTimeRange(row.startTime, row.endTime)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </GlassCard>
      )}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  dateChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  dateChipPast: {
    backgroundColor: "rgba(148,163,184,0.18)",
  },
  dateChipDay: {
    fontSize: 15,
    fontWeight: "900",
    color: glassColors.accentDeep,
    lineHeight: 18,
  },
  dateChipMonth: {
    fontSize: 10,
    fontWeight: "800",
    color: glassColors.accentDeep,
    textTransform: "uppercase",
  },
  dateChipDayPast: {
    color: glassColors.inkFaint,
  },
  subject: {
    fontSize: 14,
    fontWeight: "900",
    color: glassColors.ink,
  },
  examLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: glassColors.accent,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: glassColors.inkSoft,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.10)",
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: glassColors.accentDeep,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: glassColors.inkSoft,
    textAlign: "center",
  },
};
