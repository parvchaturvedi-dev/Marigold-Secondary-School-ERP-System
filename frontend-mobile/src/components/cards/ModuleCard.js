import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";

export default function ModuleCard({ title, icon, color, onPress }) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        width: "23%",
        minHeight: 100,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        padding: 10,
        marginBottom: 12,
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
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 15,
          backgroundColor: color + "22",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon} size={26} color={color} />
      </View>

      <Text
        numberOfLines={2}
        style={{
          textAlign: "center",
          fontSize: 12,
          fontWeight: "800",
          color: palette.ink,
          lineHeight: 15,
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
