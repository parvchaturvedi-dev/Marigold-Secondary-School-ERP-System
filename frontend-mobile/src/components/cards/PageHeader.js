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
        backgroundColor: colors.background,
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
          backgroundColor: "#fff",
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
          backgroundColor: "#fff",
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
