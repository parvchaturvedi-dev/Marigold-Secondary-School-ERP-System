import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "../src/auth/AuthContext";

import LoginScreen from "../src/modules/auth/screens/LoginScreen";
import StudentDashboardScreen from "../src/screens/StudentDashboardScreen";
import StudentModuleScreen from "../src/screens/StudentModuleScreen";
import TimetableScreen from "../src/screens/TimetableScreen";
import ConnectedModuleScreen from "../src/screens/ConnectedModuleScreen";
import AdminDashboardScreen from "../src/modules/admin/screens/AdminDashboardScreen";
import TeacherDashboardScreen from "../src/modules/teacher/screens/TeacherDashboardScreen";
import ClerkDashboardScreen from "../src/modules/clerk/screens/ClerkDashboardScreen";

function SplashScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0F172A" }}>
      <Text style={{ fontSize: 28, fontWeight: "900", color: "#fff", marginBottom: 8 }}>
        MGPS ERP
      </Text>
      <Text style={{ fontSize: 14, color: "#94A3B8", marginBottom: 24 }}>
        Loading your session...
      </Text>
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}

function AppShell() {
  const { screen } = useAuth();

  // Show splash while checking cached session
  if (screen === "splash") return <SplashScreen />;

  // Role dashboards
  if (screen === "student-dashboard") return <StudentDashboardScreen />;
  if (screen === "student-module") return <StudentModuleScreen />;
  if (screen === "timetable") return <TimetableScreen />;
  if (screen === "connected-module") return <ConnectedModuleScreen />;
  if (screen === "admin-dashboard") return <AdminDashboardScreen />;
  if (screen === "teacher-dashboard") return <TeacherDashboardScreen />;
  if (screen === "clerk-dashboard") return <ClerkDashboardScreen />;

  // Default: login
  return <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppShell />
    </AuthProvider>
  );
}
