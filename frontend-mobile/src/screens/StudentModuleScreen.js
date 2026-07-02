import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/cards/PageHeader";
import AuroraBackground from "../shared/components/AuroraBackground";
import GlassCard from "../shared/components/GlassCard";
import { glassColors } from "../shared/theme/glass";
import { colors } from "../shared/theme/colors";
import { fetchClassInfo } from "../api/classInfoApi";
import AttendanceScreen from "./AttendanceScreen";
import TimetableScreen from "./TimetableScreen";
import ConnectedModuleScreen from "./ConnectedModuleScreen";
import FeesScreen from "./modules/fees/FeesScreen";
import ExaminationsScreen from "./modules/examinations/ExaminationsScreen";

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
  if (selectedModule === "Fees") return <FeesScreen user={user} />;
  if (selectedModule === "Examinations") return <ExaminationsScreen user={user} />;

  return <ConnectedModuleScreen />;
}

function ScreenShell({ title, children, refreshControl }) {
  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <PageHeader title={title} />
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 34 }}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function InfoCard({ icon, title, subtitle, color = colors.primary }) {
  return (
    <GlassCard style={{ borderRadius: 20, marginBottom: 14 }}>
      <View style={{ padding: 18, flexDirection: "row", alignItems: "center" }}>
        <LinearGradient
          colors={[color, color]}
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 14,
            opacity: 0.92,
          }}
        >
          <Ionicons name={icon} size={25} color="#fff" />
        </LinearGradient>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "900", color: "#0F172A" }}>
            {title}
          </Text>
          <Text style={{ marginTop: 5, fontSize: 14, color: "#64748B", lineHeight: 20 }}>
            {subtitle}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

function MyClass({ student }) {
  const [classInfo, setClassInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const payload = await fetchClassInfo();
      setClassInfo(payload || null);
    } catch (err) {
      setError(err.message || "Failed to load class information.");
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const roster = Array.isArray(classInfo?.roster) ? classInfo.roster : [];
  const subjects = Array.isArray(classInfo?.subjects) ? classInfo.subjects : [];
  const className = classInfo?.className || student.classLabel;

  if (loading) {
    return (
      <ScreenShell title="My Class">
        <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ fontSize: 12, fontWeight: "700", color: glassColors.inkSoft }}>
            Loading class information...
          </Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="My Class"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load({ isRefresh: true })} tintColor={colors.primary} />
      }
    >
      <InfoCard
        icon="school-outline"
        title={`${className || "Class not assigned"} • Roll No. ${student.roll}`}
        subtitle={`Admission No: ${student.admission}`}
      />

      {!!error && (
        <GlassCard style={{ padding: 16, marginBottom: 14 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: glassColors.danger, textAlign: "center" }}>
            {error}
          </Text>
        </GlassCard>
      )}

      <Text style={styles.sectionTitle}>Subjects &amp; Teachers</Text>
      {!error && subjects.length === 0 && (
        <GlassCard soft style={{ padding: 24, alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Ionicons name="book-outline" size={26} color={glassColors.inkFaint} />
          <Text style={{ fontSize: 13, fontWeight: "800", color: glassColors.inkFaint }}>
            No subjects mapped for this class yet
          </Text>
        </GlassCard>
      )}
      {subjects.map((item, index) => (
        <InfoCard
          key={`${item.subject}-${index}`}
          icon="book-outline"
          title={item.subject}
          subtitle={item.teacher ? `Taught by ${item.teacher}` : "Teacher not assigned yet"}
          color="#4F46E5"
        />
      ))}

      <Text style={styles.sectionTitle}>Class Roster ({roster.length})</Text>
      {!error && roster.length === 0 && (
        <GlassCard soft style={{ padding: 24, alignItems: "center", gap: 8 }}>
          <Ionicons name="people-outline" size={26} color={glassColors.inkFaint} />
          <Text style={{ fontSize: 13, fontWeight: "800", color: glassColors.inkFaint }}>
            No roster records found for this class
          </Text>
        </GlassCard>
      )}
      {roster.map((mate) => {
        const isSelf = String(mate.admissionNumber || "") === String(student.admission || "");
        return (
          <GlassCard key={mate.admissionNumber || mate.rollNo} soft style={styles.rosterCard}>
            <View style={styles.rollCircle}>
              <Text style={{ color: colors.primaryDark, fontWeight: "900" }}>{mate.rollNo}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{mate.displayName}</Text>
              <Text style={styles.rowSub}>
                {mate.admissionNumber}
                {mate.section ? ` • Sec ${mate.section}` : ""}
              </Text>
            </View>
            {isSelf && (
              <Text style={{ color: glassColors.success, fontSize: 11, fontWeight: "900" }}>ACTIVE USER</Text>
            )}
          </GlassCard>
        );
      })}
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
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  rowTime: {
    width: 98,
    color: colors.primaryDark,
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
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  rollCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
};
