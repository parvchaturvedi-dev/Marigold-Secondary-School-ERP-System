import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { colors } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";

export default function PageHeader({ title }) {
  const { goBack, setHome } = useAuth();
  const { palette } = useTheme();
  const btnStyle = {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.headerChipBg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  };

  return (
    <View
      style={{
        paddingTop: 46,
        paddingHorizontal: 18,
        paddingBottom: 14,
        backgroundColor: "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity onPress={goBack} style={btnStyle}>
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
      </TouchableOpacity>

      <Text style={{ fontSize: 18, fontWeight: "900", color: palette.headerInk }}>
        {title}
      </Text>

      <TouchableOpacity onPress={setHome} style={btnStyle}>
        <Ionicons name="home" size={22} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
