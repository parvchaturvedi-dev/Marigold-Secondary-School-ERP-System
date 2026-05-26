import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useAuth } from "../../auth/AuthContext";

export default function PageHeader({ title }) {
  const { goBack, goHome } = useAuth();

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
      <TouchableOpacity onPress={goBack} style={styles.btn}>
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
      </TouchableOpacity>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <TouchableOpacity onPress={goHome} style={styles.btn}>
        <Ionicons name="home" size={22} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  btn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  title: {
    flex: 1,
    marginHorizontal: 12,
    textAlign: "center",
    fontSize: 19,
    fontWeight: "900",
    color: colors.text,
  },
};
