import React from "react";
import { View, Text } from "react-native";
import { colors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";

export default function StatCard({ label, value }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        borderRadius: 18,
        padding: 18,
        width: "48%",
        marginBottom: 14,
        backgroundColor: palette.card,
        borderWidth: 1,
        borderColor: palette.cardBorder,
        shadowColor: palette.shadow,
        shadowOpacity: palette.shadowOpacity,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      <Text style={{ color: palette.inkSoft, fontSize: 13 }}>{label}</Text>
      <Text style={{ marginTop: 8, fontSize: 22, fontWeight: "800", color: colors.primary }}>
        {value}
      </Text>
    </View>
  );
}
