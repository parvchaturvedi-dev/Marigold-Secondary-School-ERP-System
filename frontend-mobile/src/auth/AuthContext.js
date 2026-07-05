import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginApi } from "../api/authApi";
import { apiRequest } from "../api/apiClient";
import { getActiveStudentProfile, getTeacherProfile } from "../shared/profile";
import {
  registerForPushNotifications,
  setupNotificationHandler,
  getLastRegisteredToken,
  clearLastRegisteredToken,
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

        // OPTIMISTIC: trust the cached session and go straight to the dashboard.
        // The backend validation runs in the background — if it fails we log out.
        const cachedUser = hydrateUser(session);
        setUser(cachedUser);
        setScreen(`${session.role}-dashboard`);
        registerPushToken();
        connectRealtime(session.token);

        // Fire-and-forget refresh (doesn't block the dashboard from rendering).
        apiRequest("/auth/session")
          .then(async (serverSession) => {
            if (serverSession && serverSession.role && serverSession.username) {
              setUser(hydrateUser(serverSession));
              await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(serverSession));
            } else {
              // Server explicitly rejected — clear + go to login.
              await AsyncStorage.removeItem(SESSION_KEY);
              setUser(null);
              setScreen("login");
            }
          })
          .catch((validationError) => {
            // Network hiccup — keep the cached session; the user can retry.
            console.log("Session validation failed:", validationError?.message || validationError);
          });
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

  // Open the page a notification points at (its `linkPage`). Role-aware, mirrors
  // openStudentModule / openConnectedModule. Used by both a tapped push and a
  // tapped in-app notification row.
  function openNotificationTarget(linkPage) {
    const page = String(linkPage || "").trim();
    if (!page) return;
    // App tapped-open from a killed state before the session finished loading:
    // stash the target and route it once the user is hydrated (effect below).
    if (!user) {
      pendingLinkRef.current = page;
      return;
    }
    const isTimetable = page === "Timetable" || page.endsWith("> Timetable");
    const canEditTimetable = user.role === "admin" || user.role === "clerk";
    if (user.role === "student") {
      setSelectedModule(page);
      setScreen("student-module");
    } else if (isTimetable && !canEditTimetable) {
      setSelectedModule(page);
      setScreen("timetable");
    } else {
      setSelectedModule(page);
      setScreen("connected-module");
    }
  }

  // Keep a live ref so the push-tap listener (registered once) always routes with
  // the current user/role instead of a stale closure.
  const openTargetRef = useRef(openNotificationTarget);
  openTargetRef.current = openNotificationTarget;

  // Route a notification tap that arrived before the session was ready, once the
  // user is hydrated.
  const pendingLinkRef = useRef(null);
  useEffect(() => {
    if (user && pendingLinkRef.current) {
      const page = pendingLinkRef.current;
      pendingLinkRef.current = null;
      openTargetRef.current(page);
    }
  }, [user]);

  // Route taps on push notifications (banner/lock-screen/action buttons) to the
  // linked page — including a tap that cold-launched the app from a killed state.
  useEffect(() => {
    const route = (response) => {
      const linkPage = response?.notification?.request?.content?.data?.linkPage;
      if (linkPage) openTargetRef.current(linkPage);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(route);
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) route(response);
      })
      .catch(() => {});
    return () => sub.remove();
  }, []);

  function goHome() {
    if (!user) {
      setScreen("login");
      return;
    }

    setSelectedModule(null);
    setScreen(`${user.role}-dashboard`);
  }

  async function logout() {
    // Detach this device's push token from the account BEFORE clearing the
    // session, so the next person to sign in on this device doesn't inherit the
    // previous user's push notifications. apiRequest reads the bearer token from
    // the still-present session, so this must run first.
    const pushToken = getLastRegisteredToken();
    if (pushToken) {
      try {
        await apiRequest("/notifications/unregister-token", {
          method: "POST",
          body: JSON.stringify({ token: pushToken }),
        });
      } catch (unregisterError) {
        console.warn("Push token unregister failed:", unregisterError?.message || unregisterError);
      }
      clearLastRegisteredToken();
    }
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error("Failed to clear session:", e);
    }
    disconnectRealtime();
    try { globalThis.__mgpsUsersCache = null; } catch { /* noop */ }
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
        openNotificationTarget,
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
