import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ModuleCard({ title, icon, color, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        width: "23%",
        minHeight: 98,
        backgroundColor: "#fff",
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        marginBottom: 12,
        elevation: 3,
        shadowColor: "#1E293B",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        borderWidth: 1,
        borderColor: "#EEF2F7",
      }}
    >
      <View
        style={{
          width: 47,
          height: 47,
          borderRadius: 16,
          backgroundColor: color + "15",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon} size={25} color={color} />
      </View>

      <Text
        numberOfLines={2}
        style={{
          textAlign: "center",
          fontSize: 12,
          fontWeight: "700",
          color: "#0F172A",
          lineHeight: 15,
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
