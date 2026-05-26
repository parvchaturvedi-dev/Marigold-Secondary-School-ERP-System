import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/cards/PageHeader";
import AttendanceScreen from "./AttendanceScreen";
import TimetableScreen from "./TimetableScreen";
import ConnectedModuleScreen from "./ConnectedModuleScreen";

export default function StudentModuleScreen() {
  const { selectedModule, user } = useAuth();
  const activeStudent = user?.activeStudent || user?.studentProfiles?.[0] || {};
  const student = {
    name: activeStudent.displayName || user?.displayName || user?.name || "Student",
    classLabel: [activeStudent.className, activeStudent.section].filter(Boolean).join(" - ") || "Class not assigned",
    roll: activeStudent.rollNo || "-",
    admission: activeStudent.admissionNumber || activeStudent.id || user?.username || "-",
  };

  if (selectedModule === "My Class") return <MyClass student={student} />;
  if (selectedModule === "Timetable") return <TimetableScreen />;
  if (selectedModule === "Attendance") return <AttendanceScreen role="student" />;

  return <ConnectedModuleScreen />;
}

function ScreenShell({ title, children }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFF" }}>
      <PageHeader title={title} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 34 }}>
        {children}
      </ScrollView>
    </View>
  );
}

function InfoCard({ icon, title, subtitle, color = "#4F46E5" }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        elevation: 3,
        borderWidth: 1,
        borderColor: "#EEF2F7",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: color + "18",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
          }}
        >
          <Ionicons name={icon} size={25} color={color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: "#0F172A" }}>
            {title}
          </Text>
          <Text style={{ marginTop: 5, fontSize: 14, color: "#64748B", lineHeight: 20 }}>
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MyClass({ student }) {
  return (
    <ScreenShell title="My Class">
      <InfoCard
        icon="school-outline"
        title={`${student.classLabel} • Roll No. ${student.roll}`}
        subtitle={`Admission No: ${student.admission}`}
      />

      <InfoCard
        icon="person-outline"
        title="Class Teacher"
        subtitle="Class teacher data is read from ERP teacher assignment records."
        color="#F97316"
      />

      <Text style={styles.sectionTitle}>Today Timetable</Text>
      <InfoCard
        icon="calendar-outline"
        title="Class timetable"
        subtitle="Timetable rows are scoped to the active student's class in ERP."
        color="#4F46E5"
      />

      <Text style={styles.sectionTitle}>Class Roster</Text>
      <View style={styles.rosterCard}>
        <View style={styles.rollCircle}>
          <Text style={{ color: "#4F46E5", fontWeight: "900" }}>{student.roll}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{student.name}</Text>
          <Text style={styles.rowSub}>{student.admission}</Text>
        </View>
        <Text style={{ color: "#22C55E", fontSize: 11, fontWeight: "900" }}>ACTIVE USER</Text>
      </View>
    </ScreenShell>
  );
}

const styles = {
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 20,
    marginBottom: 12,
  },
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  rowTime: {
    width: 98,
    color: "#4F46E5",
    fontWeight: "900",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
  },
  rowSub: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 13,
  },
  rosterCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  rollCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
};
