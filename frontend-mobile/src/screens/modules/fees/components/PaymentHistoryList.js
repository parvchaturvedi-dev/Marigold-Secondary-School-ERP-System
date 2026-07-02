import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

const formatCurrency = (amount = 0) => `Rs. ${Number(amount || 0).toLocaleString("en-IN")}`;

export default function PaymentHistoryList({ payments = [] }) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="receipt-outline" size={16} color={glassColors.ink} />
          <Text style={styles.headerTitle}>Receipt History</Text>
        </View>
        <Text style={styles.headerCount}>{payments.length} receipts</Text>
      </View>

      {!payments.length ? (
        <Text style={styles.emptyText}>No payments recorded yet.</Text>
      ) : (
        <View style={styles.list}>
          {payments.map((payment) => (
            <View key={payment.id} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptNo}>{payment.receiptNo}</Text>
                  <Text style={styles.meta}>
                    {payment.date}{payment.date && payment.mode ? " | " : ""}{payment.mode}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{payment.status || "Paid"}</Text>
                </View>
              </View>

              <View style={styles.rowBottom}>
                <Text style={styles.head}>{payment.head}</Text>
                <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: glassColors.ink,
  },
  headerCount: {
    fontSize: 10,
    fontWeight: "800",
    color: glassColors.inkSoft,
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
  receiptNo: {
    fontSize: 13,
    fontWeight: "900",
    color: glassColors.ink,
  },
  meta: {
    fontSize: 10,
    fontWeight: "700",
    color: glassColors.inkSoft,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "900",
    color: glassColors.ink,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  rowBottom: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.06)",
  },
  head: {
    fontSize: 10,
    fontWeight: "800",
    color: glassColors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  amount: {
    fontSize: 16,
    fontWeight: "900",
    color: glassColors.ink,
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
