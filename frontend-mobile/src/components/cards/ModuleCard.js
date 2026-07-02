import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { glassStyles, glassColors } from "../../shared/theme/glass";

export default function ModuleCard({ title, icon, color, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        ...glassStyles.card,
        width: "23%",
        minHeight: 98,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        marginBottom: 12,
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
          color: glassColors.ink,
          lineHeight: 15,
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}
