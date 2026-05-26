import React from "react";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/auth/AuthContext";

import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import StudentDashboardScreen from "./src/screens/StudentDashboardScreen";
import StudentModuleScreen from "./src/screens/StudentModuleScreen";
import TimetableScreen from "./src/screens/TimetableScreen";
import ConnectedModuleScreen from "./src/screens/ConnectedModuleScreen";

import AdminDashboardScreen from "./src/modules/admin/screens/AdminDashboardScreen";
import TeacherDashboardScreen from "./src/modules/teacher/screens/TeacherDashboardScreen";
import ClerkDashboardScreen from "./src/modules/clerk/screens/ClerkDashboardScreen";

function Navigator() {
  const { screen } = useAuth();

  if (screen === "student-dashboard") return <StudentDashboardScreen />;
  if (screen === "student-module") return <StudentModuleScreen />;
  if (screen === "timetable") return <TimetableScreen />;
  if (screen === "connected-module") return <ConnectedModuleScreen />;

  if (screen === "teacher-dashboard") return <TeacherDashboardScreen />;
  if (screen === "admin-dashboard") return <AdminDashboardScreen />;
  if (screen === "clerk-dashboard") return <ClerkDashboardScreen />;

  return <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Navigator />
    </AuthProvider>
  );
}
