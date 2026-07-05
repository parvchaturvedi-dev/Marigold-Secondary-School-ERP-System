import React, { useEffect, useRef } from "react";
import { BackHandler, ToastAndroid, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";

import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import StudentDashboardScreen from "./src/screens/StudentDashboardScreen";
import StudentModuleScreen from "./src/screens/StudentModuleScreen";
import TimetableScreen from "./src/screens/TimetableScreen";
import ConnectedModuleScreen from "./src/screens/ConnectedModuleScreen";

import AdminDashboardScreen from "./src/modules/admin/screens/AdminDashboardScreen";
import TeacherDashboardScreen from "./src/modules/teacher/screens/TeacherDashboardScreen";
import ClerkDashboardScreen from "./src/modules/clerk/screens/ClerkDashboardScreen";

// Screens that are "inside" the app — hardware/gesture back should return to the
// dashboard instead of quitting the whole app.
const SUB_SCREENS = new Set(["student-module", "timetable", "connected-module"]);

function Navigator() {
  const { screen, goBack } = useAuth();
  const lastBackPress = useRef(0);

  // Handle the Android hardware/gesture back button so it navigates within the
  // app instead of always exiting. On a dashboard, require a double-tap to exit.
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const onBack = () => {
      if (SUB_SCREENS.has(screen)) {
        goBack();
        return true; // handled — don't exit the app
      }
      if (screen && screen.endsWith("-dashboard")) {
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          return false; // second press within 2s → allow default (exit)
        }
        lastBackPress.current = now;
        ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
        return true;
      }
      return false; // login/splash → default behaviour
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [screen, goBack]);

  if (screen === "student-dashboard") return <StudentDashboardScreen />;
  if (screen === "student-module") return <StudentModuleScreen />;
  if (screen === "timetable") return <TimetableScreen />;
  if (screen === "connected-module") return <ConnectedModuleScreen />;

  if (screen === "teacher-dashboard") return <TeacherDashboardScreen />;
  if (screen === "admin-dashboard") return <AdminDashboardScreen />;
  if (screen === "clerk-dashboard") return <ClerkDashboardScreen />;

  return <LoginScreen />;
}

function ThemedStatusBar() {
  const { palette } = useTheme();
  return <StatusBar style={palette.statusBar} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <Navigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
