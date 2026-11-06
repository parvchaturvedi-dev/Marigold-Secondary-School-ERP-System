import React, { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, ToastAndroid, Platform, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";

import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";

import LoginScreen from "./src/modules/auth/screens/LoginScreen";
import BrandSplashScreen from "./src/modules/auth/screens/BrandSplashScreen";
import OnboardingScreen from "./src/modules/auth/screens/OnboardingScreen";
import PasswordChangeScreen from "./src/modules/auth/screens/PasswordChangeScreen";
import StudentDashboardScreen from "./src/screens/StudentDashboardScreen";
import StudentModuleScreen from "./src/screens/StudentModuleScreen";
import TimetableScreen from "./src/screens/TimetableScreen";
import ConnectedModuleScreen from "./src/screens/ConnectedModuleScreen";

import AdminDashboardScreen from "./src/modules/admin/screens/AdminDashboardScreen";
import TeacherDashboardScreen from "./src/modules/teacher/screens/TeacherDashboardScreen";
import ClerkDashboardScreen from "./src/modules/clerk/screens/ClerkDashboardScreen";
import EmployeeDashboardScreen from "./src/modules/employee/screens/EmployeeDashboardScreen";

function ScreenPrivacyProtection() {
  ScreenCapture.usePreventScreenCapture("mghub-app");

  useEffect(() => {
    if (Platform.OS !== "ios") return undefined;

    ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch((error) => {
      console.error("Could not enable app-switcher privacy protection:", error);
    });

    return () => {
      ScreenCapture.disableAppSwitcherProtectionAsync().catch((error) => {
        console.error("Could not disable app-switcher privacy protection:", error);
      });
    };
  }, []);

  return null;
}

// Screens that are "inside" the app — hardware/gesture back should return to the
// dashboard instead of quitting the whole app.
const SUB_SCREENS = new Set(["student-module", "timetable", "connected-module"]);

function Navigator() {
  const { screen, goBack } = useAuth();
  const lastBackPress = useRef(0);
  const [authStage, setAuthStage] = useState("splash");
  const [previousScreen, setPreviousScreen] = useState(screen);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  if (screen !== previousScreen) {
    setPreviousScreen(screen);
    if (screen === "login") setAuthStage("splash");
  }

  useEffect(() => {
    if (screen !== "login") return undefined;

    let active = true;
    slideAnim.setValue(0);
    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: width,
        duration: 450,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!active || !finished) return;
        setAuthStage("onboarding");
        slideAnim.setValue(-width);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    return () => {
      active = false;
      clearTimeout(timer);
      slideAnim.stopAnimation();
    };
  }, [screen, slideAnim, width]);

  // Handle the Android hardware/gesture back button so it navigates within the
  // app instead of always exiting. On a dashboard, require a double-tap to exit.
  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const onBack = () => {
      if (SUB_SCREENS.has(screen)) {
        goBack();
        return true; // handled — don't exit the app
      }
      if (screen === "login" && authStage === "login") {
        setAuthStage("onboarding");
        return true;
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
  }, [screen, goBack, authStage]);

  if (screen === "splash") return null;
  if (screen === "login" && authStage === "splash") {
    return (
      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <BrandSplashScreen />
      </Animated.View>
    );
  }
  if (screen === "login" && authStage === "onboarding") {
    return (
      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <OnboardingScreen onLogin={() => setAuthStage("login")} />
      </Animated.View>
    );
  }
  if (screen === "login" && authStage === "login") return <LoginScreen />;
  if (screen === "password-change") return <PasswordChangeScreen />;
  if (screen === "student-dashboard") return <StudentDashboardScreen />;
  if (screen === "student-module") return <StudentModuleScreen />;
  if (screen === "timetable") return <TimetableScreen />;
  if (screen === "connected-module") return <ConnectedModuleScreen />;

  if (screen === "teacher-dashboard") return <TeacherDashboardScreen />;
  if (screen === "admin-dashboard") return <AdminDashboardScreen />;
  if (screen === "clerk-dashboard") return <ClerkDashboardScreen />;
  if (screen === "employee-dashboard") return <EmployeeDashboardScreen />;

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
        {Platform.OS !== "web" ? <ScreenPrivacyProtection /> : null}
        <ThemedStatusBar />
        <Navigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
