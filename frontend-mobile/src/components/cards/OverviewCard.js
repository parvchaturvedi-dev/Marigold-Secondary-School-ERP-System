import React from "react";
import { View, Text } from "react-native";
import { glassStyles } from "../../shared/theme/glass";

export default function OverviewCard({ title, value, subtitle, color }) {
  return (
    <View
      style={{
        ...glassStyles.card,
        flex: 1,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: "center",
        marginHorizontal: 5,
      }}
    >
      <Text style={{ fontSize: 14, color: "#475569", fontWeight: "700" }}>
        {title}
      </Text>

      <Text
        style={{
          marginTop: 10,
          fontSize: 26,
          fontWeight: "900",
          color,
        }}
      >
        {value}
      </Text>

      <Text style={{ marginTop: 4, fontSize: 13, color, fontWeight: "600" }}>
        {subtitle}
      </Text>
    </View>
  );
}
