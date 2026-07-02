import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

import { colors } from "../../../shared/theme/colors";
import { glassColors, glassStyles } from "../../../shared/theme/glass";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import GlassCard from "../../../shared/components/GlassCard";
import { useAuth } from "../../../auth/AuthContext";
import { getActiveStudentProfile } from "../../../shared/profile";

export default function StudentDashboardScreen() {
  const { user, logout } = useAuth();
  const activeStudent = getActiveStudentProfile(user) || {};
  const classLabel =
    [activeStudent.className, activeStudent.section].filter(Boolean).join(" - ") ||
    "Class not assigned";

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <AuroraBackground />
      <GlassCard strong style={{ width: "100%", maxWidth: 380 }}>
        <View style={{ padding: 28, alignItems: "center" }}>
          <Text style={{ fontSize: 30, fontWeight: "900", color: colors.text, marginBottom: 12, textAlign: "center" }}>
            Student Dashboard
          </Text>
          <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 24, textAlign: "center" }}>
            {activeStudent.displayName || user?.displayName || user?.name || "Student"} | {classLabel}
          </Text>

          <TouchableOpacity
            onPress={logout}
            style={{ backgroundColor: glassColors.danger, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </View>
  );
}
