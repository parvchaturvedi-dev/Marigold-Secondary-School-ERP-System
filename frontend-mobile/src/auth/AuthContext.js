import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginApi } from "../api/authApi";
import { apiRequest } from "../api/apiClient";
import { getActiveStudentProfile, getTeacherProfile } from "../shared/profile";
import {
  registerForPushNotifications,
  setupNotificationHandler,
} from "../notifications/registerPush";
import { connectRealtime, disconnectRealtime } from "../notifications/realtime";

const AuthContext = createContext(null);
const SESSION_KEY = "mgps_erp_auth_session";

setupNotificationHandler();

async function registerPushToken() {
  try {
    const token = await registerForPushNotifications();
    if (token) {
      await apiRequest("/notifications/register-token", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    }
  } catch (error) {
    console.warn("Push token registration failed:", error?.message || error);
  }
}

function hydrateUser(session = {}) {
  const activeStudent = getActiveStudentProfile(session);
  const teacherProfile = session.role === "teacher" ? getTeacherProfile(session) : null;

  return {
    ...session,
    activeStudent: activeStudent || session.activeStudent,
    name:
      activeStudent?.displayName ||
      teacherProfile?.displayName ||
      session.displayName ||
      session.username,
  };
}

export function AuthProvider({ children }) {
  // Start with "splash" so the app doesn't flash login before checking session
  const [screen, setScreen] = useState("splash");
  const [user, setUser] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        const sessionStr = await AsyncStorage.getItem(SESSION_KEY);

        if (!sessionStr) {
          // No saved session - show login
          setScreen("login");
          return;
        }

        const session = JSON.parse(sessionStr);

        if (!session || !session.role || !session.token) {
          // Corrupted/incomplete session - clear and show login
          await AsyncStorage.removeItem(SESSION_KEY);
          setScreen("login");
          return;
        }

        // Validate session with backend
        try {
          const serverSession = await apiRequest("/auth/session");

          if (serverSession && serverSession.role && serverSession.username) {
            // Session is valid - auto-login
            const userData = hydrateUser(serverSession);
            setUser(userData);
            setScreen(`${serverSession.role}-dashboard`);

            // Update stored session with fresh data from server
            await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(serverSession));
            registerPushToken();
            connectRealtime(serverSession.token || session.token);
            return;
          }
        } catch (validationError) {
          console.log("Session validation failed:", validationError.message);
        }

        // Validation failed or server unreachable - clear session, show login
        await AsyncStorage.removeItem(SESSION_KEY);
        setScreen("login");
      } catch (e) {
        console.error("Failed to load session:", e);
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
        setScreen("login");
      }
    }

    loadSession();
  }, []);

  async function login(username, password) {
    setLoading(true);

    try {
      const response = await loginApi(username, password);

      const role = response.role || "student";
      const sessionData = hydrateUser({ ...response, role });

      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      setUser(sessionData);
      setScreen(`${role}-dashboard`);
      registerPushToken();
      connectRealtime(sessionData.token);
    } catch (error) {
      // Re-throw so LoginScreen can show the error in an Alert
      throw error;
    } finally {
      setLoading(false);
    }
  }

  function openStudentModule(moduleName) {
    setSelectedModule(moduleName);
    setScreen("student-module");
  }

  function openConnectedModule(moduleName) {
    const isTimetable = moduleName === "Timetable" || String(moduleName || "").endsWith("> Timetable");
    // Admin/clerk get the timetable EDITOR (via the connected-module registry);
    // students/teachers get the read-only viewer.
    const canEditTimetable = user?.role === "admin" || user?.role === "clerk";
    if (isTimetable && !canEditTimetable) {
      setSelectedModule(moduleName);
      setScreen("timetable");
      return;
    }

    setSelectedModule(moduleName);
    setScreen("connected-module");
  }

  function goHome() {
    if (!user) {
      setScreen("login");
      return;
    }

    setSelectedModule(null);
    setScreen(`${user.role}-dashboard`);
  }

  async function logout() {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error("Failed to clear session:", e);
    }
    disconnectRealtime();
    setUser(null);
    setSelectedModule(null);
    setScreen("login");
  }

  async function selectStudent(studentId) {
    if (!user || !Array.isArray(user.studentProfiles)) return;
    const selected = user.studentProfiles.find((student) => student.id === studentId || student.admissionNumber === studentId);
    if (!selected) return;

    const nextUser = hydrateUser({
      ...user,
      selectedStudentId: selected.id || selected.admissionNumber,
      activeStudent: selected,
    });
    setUser(nextUser);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
  }

  return (
    <AuthContext.Provider
      value={{
        screen,
        setScreen,
        user,
        selectedModule,
        loading,
        login,
        logout,
        openStudentModule,
        openTimetable: () => {
          setSelectedModule("Timetable");
          setScreen("timetable");
        },
        openConnectedModule,
        selectStudent,
        goHome,
        goBack: goHome,
        setHome: goHome,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
