import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

const formatCurrency = (amount = 0) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const METRICS = [
  {
    key: "annual",
    label: "Annual Fee",
    icon: "receipt-outline",
    tone: glassColors.accent,
  },
  {
    key: "concession",
    label: "Concession",
    icon: "ribbon-outline",
    tone: glassColors.violet,
  },
  {
    key: "paid",
    label: "Paid",
    icon: "checkmark-circle-outline",
    tone: glassColors.success,
  },
];

export default function FeeSummaryCards({ summary = {} }) {
  const pending = Number(summary.pending || 0);
  const isClear = pending <= 0;

  return (
    <View style={styles.grid}>
      {METRICS.map((metric) => (
        <GlassCard key={metric.key} style={styles.card}>
          <View style={styles.cardInner}>
            <View style={[styles.iconChip, { backgroundColor: `${metric.tone}1f`, borderColor: `${metric.tone}33` }]}>
              <Ionicons name={metric.icon} size={18} color={metric.tone} />
            </View>
            <Text style={styles.label}>{metric.label}</Text>
            <Text style={styles.value}>{formatCurrency(summary[metric.key])}</Text>
          </View>
        </GlassCard>
      ))}

      <GlassCard style={styles.card}>
        <View style={styles.cardInner}>
          <View
            style={[
              styles.iconChip,
              {
                backgroundColor: isClear ? `${glassColors.success}1f` : `${glassColors.warning}1f`,
                borderColor: isClear ? `${glassColors.success}33` : `${glassColors.warning}33`,
              },
            ]}
          >
            <Ionicons
              name={isClear ? "checkmark-circle-outline" : "alert-circle-outline"}
              size={18}
              color={isClear ? glassColors.success : glassColors.warning}
            />
          </View>
          <Text style={styles.label}>Balance</Text>
          <Text style={styles.value}>{formatCurrency(pending)}</Text>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: isClear ? `${glassColors.success}1a` : `${glassColors.warning}1a`,
                borderColor: isClear ? `${glassColors.success}40` : `${glassColors.warning}40`,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: isClear ? glassColors.success : glassColors.warning }]}>
              {summary.status || (isClear ? "Clear" : "Pending")}
            </Text>
          </View>
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flexBasis: "47%",
    flexGrow: 1,
  },
  cardInner: {
    padding: 14,
    minHeight: 118,
    justifyContent: "space-between",
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    color: glassColors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 18,
    fontWeight: "900",
    color: glassColors.ink,
    marginTop: 4,
  },
  pill: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
