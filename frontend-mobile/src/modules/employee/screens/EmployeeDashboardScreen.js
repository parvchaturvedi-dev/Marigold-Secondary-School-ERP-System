import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AuroraBackground from "../../../shared/components/AuroraBackground";
import { useAuth } from "../../../auth/AuthContext";
import { useTheme } from "../../../theme/ThemeContext";
import AttendanceScreen from "../../../screens/AttendanceScreen";
import { employeeModules } from "../data/employeeModules";

export default function EmployeeDashboardScreen() {
  const { user, logout, openConnectedModule } = useAuth();
  const { palette } = useTheme();
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  if (attendanceOpen) {
    return <AttendanceScreen role="employee" onBack={() => setAttendanceOpen(false)} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 55, paddingBottom: 40 }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: palette.ink, fontSize: 24, fontWeight: "900" }}>Employee Desk</Text>
          <Text style={{ color: palette.inkSoft, marginTop: 4, fontWeight: "700" }}>
            Welcome, {user?.employeeProfile?.name || user?.name || user?.displayName || "Employee"}
          </Text>
          <Text style={{ color: palette.inkFaint, marginTop: 2 }}>
            {user?.employeeProfile?.designation || "Employee"} · {user?.username}
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          {employeeModules.map((module) => (
            <TouchableOpacity
              key={module.title}
              onPress={() => module.title === "Attendance" ? setAttendanceOpen(true) : openConnectedModule(module.title)}
              style={{
                minHeight: 76,
                padding: 16,
                borderRadius: 20,
                backgroundColor: palette.card,
                borderWidth: 1,
                borderColor: palette.cardBorder,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: `${module.color}1A`, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={module.icon} size={22} color={module.color} />
              </View>
              <Text style={{ color: palette.ink, flex: 1, fontWeight: "900" }}>{module.title}</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={logout} style={{ alignSelf: "center", marginTop: 26, padding: 12 }}>
          <Text style={{ color: palette.danger, fontWeight: "900" }}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
