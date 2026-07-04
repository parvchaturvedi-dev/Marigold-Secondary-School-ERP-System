import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { Skeleton } from "../../shared/components/Skeleton";

export default function OverviewCard({ title, value, subtitle, color, loading }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: "center",
        marginHorizontal: 5,
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
      <Text style={{ fontSize: 14, color: palette.inkSoft, fontWeight: "700" }}>
        {title}
      </Text>

      {loading ? (
        <>
          <Skeleton width={64} height={26} borderRadius={8} style={{ marginTop: 10 }} />
          <Skeleton width={48} height={12} borderRadius={6} style={{ marginTop: 8 }} />
        </>
      ) : (
        <>
          <Text style={{ marginTop: 10, fontSize: 26, fontWeight: "900", color }}>
            {value}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, color, fontWeight: "600" }}>
            {subtitle}
          </Text>
        </>
      )}
    </View>
  );
}
