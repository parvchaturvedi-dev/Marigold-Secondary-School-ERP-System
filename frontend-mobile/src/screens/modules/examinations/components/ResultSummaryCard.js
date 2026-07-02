import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

/**
 * Shows the uploaded board-exam final result (PDF) for the active student,
 * when the school has marked their class as a board class for a final exam.
 *
 * Props:
 *  - results: array of boardResults rows already filtered to this student
 *  - examsById: Map of examId -> exam record (for labelling)
 */
export default function ResultSummaryCard({ results = [], examsById = new Map() }) {
  if (!results.length) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.sectionTitle}>Board Result</Text>
      {results.map((result) => {
        const exam = examsById.get(result.examId);
        return (
          <GlassCard key={result.id} style={{ padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.iconChip}>
                <Ionicons name="ribbon-outline" size={24} color={glassColors.accentDeep} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>
                  {exam ? `${exam.name} Examination` : "Board Examination"} Result
                </Text>
                <Text style={styles.subtitle}>
                  {result.className ? `Class ${result.className}` : "Final result"} · Uploaded by{" "}
                  {result.uploadedByName || "School"}
                </Text>
              </View>
              <View style={styles.badge}>
                <Ionicons name="document-text-outline" size={14} color={glassColors.success} />
                <Text style={styles.badgeText}>PDF</Text>
              </View>
            </View>
            {!!result.fileName && (
              <View style={styles.fileRow}>
                <Ionicons name="attach-outline" size={16} color={glassColors.inkSoft} />
                <Text style={styles.fileName} numberOfLines={1}>
                  {result.fileName}
                </Text>
              </View>
            )}
            <Text style={styles.hint}>
              Ask your school office to reprint or re-share this file if it does not load correctly.
            </Text>
          </GlassCard>
        );
      })}
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
  iconChip: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(99,102,241,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "900",
    color: glassColors.ink,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: glassColors.inkSoft,
    fontWeight: "600",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(16,185,129,0.14)",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: glassColors.success,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.08)",
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    color: glassColors.inkSoft,
    fontWeight: "700",
  },
  hint: {
    marginTop: 8,
    fontSize: 11,
    color: glassColors.inkFaint,
    lineHeight: 16,
  },
};
