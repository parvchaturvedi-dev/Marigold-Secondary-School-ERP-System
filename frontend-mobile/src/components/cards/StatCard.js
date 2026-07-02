import React from "react";
import { View, Text } from "react-native";
import { colors } from "../../theme/colors";
import { glassStyles } from "../../shared/theme/glass";

export default function StatCard({ label, value }) {
  return (
    <View
      style={{
        ...glassStyles.card,
        borderRadius: 18,
        padding: 18,
        width: "48%",
        marginBottom: 14
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ marginTop: 8, fontSize: 22, fontWeight: "800", color: colors.primary }}>
        {value}
      </Text>
    </View>
  );
}
