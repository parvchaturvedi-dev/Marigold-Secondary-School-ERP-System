import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

import { useAuth } from "../../../auth/AuthContext";
import { getActiveStudentProfile } from "../../../shared/profile";

export default function StudentDashboardScreen() {
  const { user, logout } = useAuth();
  const activeStudent = getActiveStudentProfile(user) || {};
  const classLabel =
    [activeStudent.className, activeStudent.section].filter(Boolean).join(" - ") ||
    "Class not assigned";

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFF", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 34, fontWeight: "900", marginBottom: 12 }}>Student Dashboard</Text>
      <Text style={{ fontSize: 18, color: "#64748B", marginBottom: 24 }}>
        {activeStudent.displayName || user?.displayName || user?.name || "Student"} | {classLabel}
      </Text>

      <TouchableOpacity onPress={logout} style={{ backgroundColor: "#EF4444", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 }}>
        <Text style={{ color: "#fff", fontWeight: "900" }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
