import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import GlassCard from "../../../../shared/components/GlassCard";
import { glassColors } from "../../../../shared/theme/glass";

export default function TransportCard({ transport = {} }) {
  const rows = [
    ["Route", transport.route],
    ["Pickup", transport.pickupPoint],
    ["Time", transport.pickupTime],
    ["Vehicle", transport.vehicleNo],
    ["Driver", transport.driver],
  ];

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="bus-outline" size={16} color={glassColors.ink} />
        <Text style={styles.headerTitle}>Transport</Text>
      </View>

      <View style={styles.list}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value} numberOfLines={1}>
              {value || "Not applicable"}
            </Text>
          </View>
        ))}
      </View>
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
    gap: 8,
    paddingBottom: 12,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.06)",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: glassColors.ink,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: glassColors.cardBgSoft,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: glassColors.inkSoft,
  },
  value: {
    fontSize: 12,
    fontWeight: "800",
    color: glassColors.ink,
    flexShrink: 1,
    textAlign: "right",
  },
});
