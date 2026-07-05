import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AuroraBackground from "../../../shared/components/AuroraBackground";
import GlassCard from "../../../shared/components/GlassCard";
import { glassColors } from "../../../shared/theme/glass";
import { colors } from "../../../shared/theme/colors";
import { fetchMyFees } from "../../../api/feesApi";

import FeeSummaryCards from "./components/FeeSummaryCards";
import InstallmentList from "./components/InstallmentList";
import PaymentHistoryList from "./components/PaymentHistoryList";
import TransportCard from "./components/TransportCard";

const normalize = (value = "") => String(value || "").trim().toUpperCase();

// The backend /fees/me now returns class-wise { totals, classLedger, concession }.
// Map it to the shape the summary/installment/payment components expect.
const mapFeeStudent = (student = {}) => {
  const totals = student.totals || {};
  const ledger = Array.isArray(student.classLedger) ? student.classLedger : [];
  return {
    ...student,
    summary: {
      annual: totals.assigned || 0,
      concession: student.concession || 0,
      paid: totals.paid || 0,
      pending: totals.pending || 0,
      status: student.status || (totals.pending > 0 ? "Pending" : "Clear"),
    },
    installments: ledger.map((row, i) => ({
      id: `${row.className || "class"}-${i}`,
      term: row.className || "Class",
      months: "",
      status: row.status || (row.pending > 0 ? (row.paid > 0 ? "Partial" : "Due") : "Paid"),
      dueDate: "-",
      amount: row.assigned || 0,
      paid: row.paid || 0,
      balance: row.pending != null ? row.pending : Math.max(0, (row.assigned || 0) - (row.paid || 0)),
    })),
    payments: ledger.flatMap((row) =>
      (Array.isArray(row.payments) ? row.payments : []).map((p, i) => ({
        id: `${row.className || "class"}-${p.receiptNo || i}`,
        receiptNo: p.receiptNo || "—",
        date: p.date || "",
        mode: p.mode || "School Desk",
        status: "Paid",
        head: row.className || "Fee",
        amount: p.amount || 0,
      }))
    ),
  };
};

export default function FeesScreen({ user }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeAdmission, setActiveAdmission] = useState("");

  const profiles = useMemo(
    () => (Array.isArray(user?.studentProfiles) ? user.studentProfiles : []),
    [user?.studentProfiles]
  );

  const defaultAdmission = useMemo(() => {
    const active = user?.activeStudent || profiles[0] || {};
    return normalize(active.admissionNumber || active.id || "");
  }, [profiles, user?.activeStudent]);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const payload = await fetchMyFees();
      const list = Array.isArray(payload?.students) ? payload.students : [];
      setStudents(list.map(mapFeeStudent));
    } catch (err) {
      setError(err.message || "Failed to load fee details.");
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeAdmission && defaultAdmission) {
      setActiveAdmission(defaultAdmission);
    }
  }, [activeAdmission, defaultAdmission]);

  const activeStudent = useMemo(() => {
    if (!students.length) return null;
    const match = students.find((student) => normalize(student.admissionNumber) === activeAdmission);
    return match || students[0];
  }, [activeAdmission, students]);

  const showSiblingSwitcher = profiles.length > 1 && students.length > 1;

  if (loading) {
    return (
      <View style={styles.screen}>
        <AuroraBackground />
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading fee details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <AuroraBackground />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} tintColor={colors.primary} />
        }
      >
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: `${glassColors.accent}1f`, borderColor: `${glassColors.accent}33` }]}>
              <Ionicons name="wallet-outline" size={20} color={glassColors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Fees &amp; Services</Text>
              {!!activeStudent && (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {activeStudent.name} | {activeStudent.className || "-"} | {activeStudent.admissionNumber}
                </Text>
              )}
            </View>
          </View>
        </GlassCard>

        {showSiblingSwitcher && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.siblingRow}
          >
            {students.map((student) => {
              const isActive = normalize(student.admissionNumber) === normalize(activeStudent?.admissionNumber);
              return (
                <TouchableOpacity
                  key={student.admissionNumber}
                  onPress={() => setActiveAdmission(normalize(student.admissionNumber))}
                  style={[styles.siblingPill, isActive && styles.siblingPillActive]}
                >
                  <Text style={[styles.siblingPillText, isActive && styles.siblingPillTextActive]} numberOfLines={1}>
                    {student.name || student.admissionNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {!!error && (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCard>
        )}

        {!error && !activeStudent && (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={30} color={glassColors.inkFaint} />
            <Text style={styles.emptyText}>No fee record on file</Text>
          </GlassCard>
        )}

        {!error && !!activeStudent && !activeStudent.hasRecord && (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={30} color={glassColors.inkFaint} />
            <Text style={styles.emptyText}>No fee record on file</Text>
          </GlassCard>
        )}

        {!error && !!activeStudent && activeStudent.hasRecord && (
          <>
            <FeeSummaryCards summary={activeStudent.summary} />
            <InstallmentList installments={activeStudent.installments} />
            <TransportCard transport={activeStudent.transport} />
            <PaymentHistoryList payments={activeStudent.payments} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "700",
    color: glassColors.inkSoft,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerCard: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: glassColors.ink,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: glassColors.inkSoft,
    marginTop: 3,
  },
  siblingRow: {
    gap: 8,
    paddingVertical: 2,
  },
  siblingPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
  },
  siblingPillActive: {
    backgroundColor: glassColors.accent,
    borderColor: glassColors.accent,
  },
  siblingPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: glassColors.inkSoft,
    maxWidth: 160,
  },
  siblingPillTextActive: {
    color: "#fff",
  },
  errorCard: {
    padding: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    color: glassColors.danger,
    textAlign: "center",
  },
  emptyCard: {
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "800",
    color: glassColors.inkFaint,
  },
});
