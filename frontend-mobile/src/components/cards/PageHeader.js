import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/AuthContext";
import { colors } from "../../theme/colors";

export default function PageHeader({ title }) {
  const { goBack, setHome } = useAuth();

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
      <TouchableOpacity
        onPress={goBack}
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: "rgba(255,255,255,0.7)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.8)",
          alignItems: "center",
          justifyContent: "center",
          elevation: 2,
        }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
      </TouchableOpacity>

      <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
        {title}
      </Text>

      <TouchableOpacity
        onPress={setHome}
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: "rgba(255,255,255,0.7)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.8)",
          alignItems: "center",
          justifyContent: "center",
          elevation: 2,
        }}
      >
        <Ionicons name="home" size={22} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
