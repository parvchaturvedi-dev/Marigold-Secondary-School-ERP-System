import React from "react";
import { View, Text } from "react-native";
import { colors } from "../../theme/colors";

export default function StatCard({ label, value }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 18,
        width: "48%",
        marginBottom: 14,
        elevation: 2
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ marginTop: 8, fontSize: 22, fontWeight: "800", color: colors.primary }}>
        {value}
      </Text>
    </View>
  );
}
