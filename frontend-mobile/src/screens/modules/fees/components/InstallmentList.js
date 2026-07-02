import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

const formatCurrency = (amount = 0) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  Paid: { bg: `${glassColors.success}1a`, border: `${glassColors.success}40`, text: glassColors.success },
  Partial: { bg: `${glassColors.sky}1a`, border: `${glassColors.sky}40`, text: glassColors.sky },
  Due: { bg: `${glassColors.warning}1a`, border: `${glassColors.warning}40`, text: glassColors.warning },
};

export default function InstallmentList({ installments = [] }) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={16} color={glassColors.ink} />
        <Text style={styles.headerTitle}>Installment Ledger</Text>
      </View>

      {!installments.length ? (
        <Text style={styles.emptyText}>No installment schedule available.</Text>
      ) : (
        <View style={styles.list}>
          {installments.map((installment) => {
            const statusStyle = STATUS_STYLE[installment.status] || STATUS_STYLE.Due;
            return (
              <View key={installment.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.term}>{installment.term}</Text>
                    <Text style={styles.months}>{installment.months}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                      {installment.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dueDate}>Due {installment.dueDate}</Text>

                <View style={styles.figuresRow}>
                  <Figure label="Amount" value={formatCurrency(installment.amount)} />
                  <Figure label="Paid" value={formatCurrency(installment.paid)} color={glassColors.success} />
                  <Figure label="Balance" value={formatCurrency(installment.balance)} color={glassColors.warning} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </GlassCard>
  );
}

function Figure({ label, value, color = glassColors.ink }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: glassColors.ink,
  },
  list: {
    gap: 10,
  },
  row: {
    backgroundColor: glassColors.cardBgSoft,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    padding: 12,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  term: {
    fontSize: 13,
    fontWeight: "900",
    color: glassColors.ink,
  },
  months: {
    fontSize: 11,
    fontWeight: "700",
    color: glassColors.inkSoft,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dueDate: {
    fontSize: 11,
    fontWeight: "700",
    color: glassColors.inkSoft,
    marginTop: 8,
  },
  figuresRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.06)",
  },
  figure: {
    flex: 1,
  },
  figureLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: glassColors.inkFaint,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  figureValue: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 3,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "700",
    color: glassColors.inkFaint,
    textAlign: "center",
    paddingVertical: 20,
  },
});
