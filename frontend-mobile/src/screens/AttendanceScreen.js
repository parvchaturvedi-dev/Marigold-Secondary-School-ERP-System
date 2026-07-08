import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

import PageHeader from "../components/cards/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { getDeviceIdentity } from "../api/deviceIdentity";
import { apiRequest } from "../api/apiClient";
import {
  clockAttendance,
  fetchAttendanceDirectory,
  fetchAttendanceLogs,
  fetchAttendanceOverview,
  saveAttendanceSettings,
  saveStudentAttendanceBatch,
} from "../api/attendanceApi";
import { colors } from "../shared/theme/colors";
import { gradients, glassColors, glassStyles } from "../shared/theme/glass";
import AuroraBackground from "../shared/components/AuroraBackground";
import GlassCard from "../shared/components/GlassCard";
import { Segmented, Banner, useBanner } from "./modules/shared/formKit";
import MobileStaffAttendanceReport from "./MobileStaffAttendanceReport";

// Local-time YYYY-MM-DD formatter. IMPORTANT: never use toISOString() here — it
// converts to UTC and shifts the calendar day backwards in IST (and any tz east
// of GMT), which used to make "today" resolve to yesterday after ~05:30 local.
const pad2 = (value) => String(value).padStart(2, "0");
const formatDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const todayKey = () => formatDateKey(new Date());
const addDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
};
const formatClockTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
const normalize = (value = "") => String(value || "").trim();
const isPresentStatus = (status) => ["present", "manual", "half-day"].includes(status);

function distanceMeters(pointA = {}, pointB = {}) {
  const lat1 = Number(pointA.latitude);
  const lon1 = Number(pointA.longitude);
  const lat2 = Number(pointB.latitude);
  const lon2 = Number(pointB.longitude);
  if ([lat1, lon1, lat2, lon2].some((value) => !Number.isFinite(value))) return Infinity;

  const radius = 6371000;
  const toRad = (degree) => (degree * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getLocation() {
  const nativeAttendance = globalThis.MGPSAttendanceDevice;
  if (nativeAttendance?.getLocation) {
    return nativeAttendance.getLocation();
  }

  // Preferred path: expo-location.
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission is required for attendance.");
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    isMockLocation: Boolean(position.mocked),
  };
}

export default function AttendanceScreen({ role, onBack }) {
  const { user } = useAuth();
  const clockBanner = useBanner();
  // Desk sub-menu tab. admin: students | staff | manage. clerk/teacher: my | class.
  const [activeTab, setActiveTab] = useState(role === "admin" ? "students" : "my");
  const [clockStatus, setClockStatus] = useState(null);
  const [clockStatusLoading, setClockStatusLoading] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [selectedClass, setSelectedClass] = useState("");
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [draft, setDraft] = useState({});
  const [settingsDraft, setSettingsDraft] = useState({});
  const [locationState, setLocationState] = useState({ checking: false, point: null, message: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [overrideToken, setOverrideToken] = useState("");

  const isAdmin = role === "admin";
  const isClerk = role === "clerk";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const teacherClass = normalize(user?.assignedClassTeacherFor || user?.teacherProfile?.assignedClassTeacherFor);
  const canEditStudents = isAdmin || isClerk || (isTeacher && Boolean(teacherClass));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const className = isTeacher ? teacherClass : selectedClass;
      const [overviewPayload, logPayload, directoryPayload] = await Promise.all([
        isStudent ? Promise.resolve(null) : fetchAttendanceOverview({ date, className }),
        fetchAttendanceLogs({
        date: isStudent ? undefined : date,
        period: isStudent ? "yearly" : "monthly",
        className: isStudent ? undefined : className,
        entityType: isStudent ? "student" : undefined,
        }),
        isStudent || isTeacher ? Promise.resolve({ rows: [] }) : fetchAttendanceDirectory({ type: "student" }),
      ]);

      setOverview(overviewPayload);
      setLogs(logPayload.logs || []);
      if (directoryPayload?.rows?.length) {
        setClassOptions(Array.from(new Set(directoryPayload.rows.map((row) => row.className).filter(Boolean))).sort());
      }
      if (overviewPayload?.settings) {
        setSettingsDraft({
          schoolAddress: overviewPayload.settings.schoolAddress || "",
          geofenceLatitude: String(overviewPayload.settings.geofenceLatitude ?? ""),
          geofenceLongitude: String(overviewPayload.settings.geofenceLongitude ?? ""),
          geofenceRadiusMeters: String(overviewPayload.settings.geofenceRadiusMeters || 50),
          authorizedWifiBssid: overviewPayload.settings.authorizedWifiBssid || "",
          enforceReceptionQr: overviewPayload.settings.enforceReceptionQr === true,
          presentUntil: overviewPayload.settings.presentUntil || "08:30",
          halfDayUntil: overviewPayload.settings.halfDayUntil || "10:30",
          closeAfter: overviewPayload.settings.closeAfter || "11:00",
          allowTeacherQrScan: overviewPayload.settings.allowTeacherQrScan !== false,
        });
      }
    } catch (error) {
      Alert.alert("Attendance", error.message);
    } finally {
      setLoading(false);
    }
  }, [date, isStudent, isTeacher, selectedClass, teacherClass]);

  useEffect(() => {
    load();
  }, [load]);

  const isSelfClockRole = role === "clerk" || role === "teacher";
  const refetchClockStatus = useCallback(async () => {
    if (!isSelfClockRole) return;
    setClockStatusLoading(true);
    try {
      const payload = await apiRequest("/attendance/my-clock-status");
      setClockStatus(payload || null);
    } catch {
      setClockStatus(null);
    } finally {
      setClockStatusLoading(false);
    }
  }, [isSelfClockRole]);

  useEffect(() => {
    refetchClockStatus();
  }, [refetchClockStatus]);

  useEffect(() => {
    const roster = overview?.roster || [];
    const nextDraft = {};
    roster.forEach((student) => {
      nextDraft[student.entityId] = isPresentStatus(student.todayLog?.status) ? "present" : "absent";
    });
    setDraft(nextDraft);
    if (!selectedClass && !isTeacher) {
      const firstClass = roster.find((student) => student.className)?.className;
      if (firstClass) setSelectedClass(firstClass);
    }
  }, [isTeacher, overview?.roster, selectedClass]);

  const settings = overview?.settings || {};
  const className = isTeacher ? teacherClass : selectedClass;
  const classNames = useMemo(() => {
    const names = new Set([
      ...classOptions,
      ...(overview?.roster || []).map((student) => student.className).filter(Boolean),
    ]);
    return Array.from(names).sort();
  }, [classOptions, overview?.roster]);

  const roster = useMemo(() => {
    return (overview?.roster || [])
      .filter((student) => !className || student.className === className)
      .sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0));
  }, [className, overview?.roster]);

  const studentLogs = useMemo(() => {
    const activeIds = new Set(
      (user?.studentProfiles || [])
        .map((student) => normalize(student.admissionNumber || student.id).toUpperCase())
        .filter(Boolean)
    );
    return logs.filter((log) => !activeIds.size || activeIds.has(normalize(log.entityId || log.admissionNumber).toUpperCase()));
  }, [logs, user?.studentProfiles]);

  const monthDays = useMemo(() => {
    const cursor = new Date();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const byDate = new Map(studentLogs.map((log) => [log.attendanceDate, log]));
    return Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(`${key}T00:00:00`).getDay();
      const log = byDate.get(key);
      return { day, key, status: log?.status || (weekday === 0 ? "holiday" : "none") };
    });
  }, [studentLogs]);

  const studentMetrics = useMemo(() => {
    const working = studentLogs.length || monthDays.filter((item) => item.status !== "holiday").length;
    const present = studentLogs.filter((log) => isPresentStatus(log.status)).length;
    const absent = studentLogs.filter((log) => log.status === "absent").length;
    const percentage = working ? Math.round((present / working) * 100) : 0;
    return { working, present, absent, percentage };
  }, [monthDays, studentLogs]);

  async function checkLocation() {
    setLocationState({ checking: true, point: null, message: "" });
    try {
      const point = await getLocation();
      const schoolPoint = {
        latitude: settings.geofenceLatitude,
        longitude: settings.geofenceLongitude,
      };
      const distance = distanceMeters(point, schoolPoint);
      const radius = Number(settings.geofenceRadiusMeters || 50);
      const inside = distance <= radius;
      setLocationState({
        checking: false,
        point: { ...point, distance: Math.round(distance), inside },
        message: inside ? "GPS verified inside school boundary." : "Out of school boundary.",
      });
    } catch (error) {
      setLocationState({ checking: false, point: null, message: error.message });
    }
  }

  async function handleClock(action) {
    clockBanner.clear();
    const point = locationState.point;
    if (!point?.inside) {
      clockBanner.showError("Please verify GPS inside the school boundary first.");
      return;
    }
    if (point.isMockLocation) {
      clockBanner.showError("Mock location detected. Disable it and try again.");
      return;
    }

    setSaving(true);
    try {
      const device = await getDeviceIdentity();
      const payload = await clockAttendance({
        action,
        source: isTeacher ? "teacher-mobile" : "clerk-self",
        requiresGeofence: true,
        gpsLatitude: point.latitude,
        gpsLongitude: point.longitude,
        isMockLocation: false,
        deviceId: device.deviceId,
        deviceType: device.deviceType,
        metadata: {
          latitude: point.latitude,
          longitude: point.longitude,
          isMockLocation: false,
        },
      });
      clockBanner.showSuccess(payload.message || "Attendance recorded.");
      // Refetch the once-per-day clock state so the UI collapses to the next
      // valid action (or the "done for today" card). Also refresh overview.
      await refetchClockStatus();
      load();
    } catch (error) {
      // The clock endpoint now returns 409 for already-clocked-in / clock-in-first
      // / already-clocked-out. apiRequest surfaces the server message — show it as
      // a friendly banner and resync the status so buttons reflect reality.
      clockBanner.showError(error.message || "Could not record attendance.");
      await refetchClockStatus();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      await saveAttendanceSettings({
        ...settingsDraft,
        geofenceLatitude: Number(settingsDraft.geofenceLatitude),
        geofenceLongitude: Number(settingsDraft.geofenceLongitude),
        geofenceRadiusMeters: Number(settingsDraft.geofenceRadiusMeters || 50),
      });
      Alert.alert("Settings", "Attendance security settings saved.");
      load();
    } catch (error) {
      Alert.alert("Settings", error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRegister() {
    if (!className) {
      Alert.alert("Class required", "Select a class before saving attendance.");
      return;
    }
    if (isTeacher && date !== todayKey() && !overrideToken.trim()) {
      Alert.alert("Admin override required", "Historical edits require an Admin override token.");
      return;
    }

    setSaving(true);
    try {
      const payload = await saveStudentAttendanceBatch({
        attendanceDate: date,
        className,
        adminOverrideToken: overrideToken,
        records: roster.map((student) => ({
          entityId: student.entityId,
          admissionNumber: student.admissionNumber,
          status: draft[student.entityId] === "absent" ? "absent" : "present",
        })),
      });
      Alert.alert("Attendance", payload.message || "Attendance saved.");
      load();
    } catch (error) {
      Alert.alert("Attendance", error.message);
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    const next = {};
    roster.forEach((student) => {
      next[student.entityId] = isPresentStatus(student.todayLog?.status) ? "present" : "absent";
    });
    setDraft(next);
  }

  const deskTabs = isAdmin
    ? [
        { value: "students", label: "Students" },
        { value: "staff", label: "Staff" },
        { value: "manage", label: "Manage" },
      ]
    : [
        { value: "my", label: "My Attendance" },
        { value: "class", label: "Class" },
      ];
  // The register (with its sticky Save bar) lives on the "students" tab for admin
  // and the "class" tab for clerk/teacher.
  const registerTabActive = isAdmin ? activeTab === "students" : activeTab === "class";

  if (loading && !overview && !isStudent) {
    return (
      <View style={{ flex: 1 }}>
        <AuroraBackground />
        <AttendanceHeader onBack={onBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <AttendanceHeader onBack={onBack} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, paddingBottom: canEditStudents && registerTabActive ? 112 : 28 }}
      >
        {isStudent ? (
          <StudentLedger metrics={studentMetrics} monthDays={monthDays} logs={studentLogs} />
        ) : (
          <>
            <View style={{ marginBottom: 14 }}>
              <Segmented options={deskTabs} value={activeTab} onChange={setActiveTab} />
            </View>

            {/* ---- Admin: Students Attendance ---- */}
            {isAdmin && activeTab === "students" && (
              <RegisterCard
                isAdmin={isAdmin}
                isClerk={isClerk}
                isTeacher={isTeacher}
                date={date}
                setDate={setDate}
                calendarOpen={calendarOpen}
                setCalendarOpen={setCalendarOpen}
                className={className}
                selectedClass={selectedClass}
                setSelectedClass={setSelectedClass}
                classNames={classNames}
                roster={roster}
                draft={draft}
                setDraft={setDraft}
                overrideToken={overrideToken}
                setOverrideToken={setOverrideToken}
              />
            )}

            {/* ---- Admin: Staff Attendance (self-contained sibling) ---- */}
            {isAdmin && activeTab === "staff" && <MobileStaffAttendanceReport />}

            {/* ---- Admin: Attendance Management (settings + summary) ---- */}
            {isAdmin && activeTab === "manage" && (
              <>
                <SecurityConfigurator
                  settingsDraft={settingsDraft}
                  setSettingsDraft={setSettingsDraft}
                  onSave={handleSaveSettings}
                  saving={saving}
                />
                <RoleSummary roleSummary={overview?.roleSummary} counts={overview?.counts} />
              </>
            )}

            {/* ---- Clerk / Teacher: My Attendance (self clock-in/out) ---- */}
            {(isClerk || isTeacher) && activeTab === "my" && (
              <ClockCard
                role={role}
                locationState={locationState}
                onCheck={checkLocation}
                onClock={handleClock}
                saving={saving}
                status={clockStatus}
                statusLoading={clockStatusLoading}
                banner={clockBanner}
              />
            )}

            {/* ---- Clerk / Teacher: Class Attendance (register) ---- */}
            {(isClerk || isTeacher) && activeTab === "class" && (
              isTeacher && !teacherClass ? (
                <AccessDenied />
              ) : (
                <>
                  <RoleSummary roleSummary={overview?.roleSummary} counts={overview?.counts} />
                  <RegisterCard
                    isAdmin={isAdmin}
                    isClerk={isClerk}
                    isTeacher={isTeacher}
                    date={date}
                    setDate={setDate}
                    calendarOpen={calendarOpen}
                    setCalendarOpen={setCalendarOpen}
                    className={className}
                    selectedClass={selectedClass}
                    setSelectedClass={setSelectedClass}
                    classNames={classNames}
                    roster={roster}
                    draft={draft}
                    setDraft={setDraft}
                    overrideToken={overrideToken}
                    setOverrideToken={setOverrideToken}
                  />
                </>
              )
            )}
          </>
        )}
      </ScrollView>

      {canEditStudents && registerTabActive && roster.length > 0 && (
        <View style={styles.stickyBar}>
          <ActionButton label="Cancel" color="#64748B" onPress={load} />
          <ActionButton label="Reset" color="#F97316" onPress={resetDraft} />
          <ActionButton label="Save" color="#16A34A" onPress={handleSaveRegister} disabled={saving} />
        </View>
      )}
    </View>
  );
}

function AttendanceHeader({ onBack }) {
  if (!onBack) return <PageHeader title="Attendance" />;
  return (
    <View
      style={{
        paddingTop: 46,
        paddingHorizontal: 18,
        paddingBottom: 14,
        backgroundColor: "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: "900", color: "#0F172A" }}>Attendance</Text>
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="home" size={22} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function RoleSummary({ roleSummary = {}, counts = {} }) {
  const cards = [
    ["Clerk Attendance Summary", roleSummary.clerk],
    ["Teacher Attendance Summary", roleSummary.teacher],
    ["Student Attendance Summary", roleSummary.student || counts],
  ];
  return (
    <GlassCard style={styles.card}>
      {cards.map(([title, data]) => (
        <View key={title} style={styles.metricCard}>
          <Text style={styles.metricTitle}>{title}</Text>
          <View style={styles.metricRow}>
            <Metric label="P" value={data?.present || 0} color="#16A34A" />
            <Metric label="A" value={data?.absent || 0} color="#DC2626" />
            <Metric label="L" value={data?.late || data?.["half-day"] || 0} color="#D97706" />
          </View>
        </View>
      ))}
    </GlassCard>
  );
}

function Metric({ label, value, color }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: "#64748B", fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

function SecurityConfigurator({ settingsDraft, setSettingsDraft, onSave, saving }) {
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.cardTitle}>Geofencing and Security</Text>
      <Input label="School address" value={settingsDraft.schoolAddress} onChangeText={(value) => setSettingsDraft((draft) => ({ ...draft, schoolAddress: value }))} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Input label="Latitude" value={settingsDraft.geofenceLatitude} keyboardType="numeric" onChangeText={(value) => setSettingsDraft((draft) => ({ ...draft, geofenceLatitude: value }))} />
        <Input label="Longitude" value={settingsDraft.geofenceLongitude} keyboardType="numeric" onChangeText={(value) => setSettingsDraft((draft) => ({ ...draft, geofenceLongitude: value }))} />
      </View>
      <TouchableOpacity
        onPress={async () => {
          try {
            const loc = await getLocation();
            if (loc?.isMockLocation) {
              Alert.alert("Mock location", "Mock location provider detected. Disable it and try again.");
              return;
            }
            setSettingsDraft((draft) => ({
              ...draft,
              geofenceLatitude: String(loc.latitude.toFixed(6)),
              geofenceLongitude: String(loc.longitude.toFixed(6)),
            }));
            Alert.alert("Location captured", `Lat ${loc.latitude.toFixed(6)}, Lng ${loc.longitude.toFixed(6)}`);
          } catch (err) {
            Alert.alert("Location error", err?.message || "Could not fetch location.");
          }
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: 44,
          borderRadius: 12,
          backgroundColor: "rgba(99,102,241,0.14)",
          marginBottom: 14,
        }}
      >
        <Ionicons name="locate-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "900" }}>Use My Current Location as School</Text>
      </TouchableOpacity>
      <Text style={styles.label}>Allowed Radius (metres)</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {["25", "50", "100"].map((radius) => (
          <TouchableOpacity
            key={radius}
            onPress={() => setSettingsDraft((draft) => ({ ...draft, geofenceRadiusMeters: radius }))}
            style={[styles.pill, settingsDraft.geofenceRadiusMeters === radius && styles.pillActive]}
          >
            <Text style={[styles.pillText, settingsDraft.geofenceRadiusMeters === radius && styles.pillTextActive]}>{radius}m</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Input label="Authorized WiFi BSSID" value={settingsDraft.authorizedWifiBssid} onChangeText={(value) => setSettingsDraft((draft) => ({ ...draft, authorizedWifiBssid: value }))} />
      <ToggleRow
        label="Enforce QR scanning at reception"
        active={settingsDraft.enforceReceptionQr}
        onPress={() => setSettingsDraft((draft) => ({ ...draft, enforceReceptionQr: !draft.enforceReceptionQr }))}
      />
      <TouchableOpacity onPress={onSave} disabled={saving} activeOpacity={0.85} style={{ borderRadius: 16, overflow: "hidden" }}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Save Security Config</Text>
        </LinearGradient>
      </TouchableOpacity>
    </GlassCard>
  );
}

function ClockCard({ role, locationState, onCheck, onClock, saving, status, statusLoading, banner }) {
  const enabled = Boolean(locationState.point?.inside && !locationState.point?.isMockLocation);
  const clockedIn = Boolean(status?.clockedIn);
  const clockedOut = Boolean(status?.clockedOut);
  const done = clockedIn && clockedOut;

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.cardTitle}>My Attendance</Text>
      <Text style={styles.muted}>{role === "teacher" ? "Teacher" : "Clerk"} self-service clock-in and clock-out requires verified GPS.</Text>

      {!!banner?.error && <Banner type="error" message={banner.error} />}
      {!!banner?.success && <Banner type="success" message={banner.success} />}

      {statusLoading && !status ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : done ? (
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={30} color="#16A34A" />
          <Text style={styles.doneTitle}>Done for today</Text>
          <Text style={styles.doneMeta}>
            In: {formatClockTime(status?.clockInAt)}   •   Out: {formatClockTime(status?.clockOutAt)}
          </Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.secondaryButton} onPress={onCheck} disabled={locationState.checking}>
            <Ionicons name="locate-outline" size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>{locationState.checking ? "Checking GPS..." : "Check School Boundary"}</Text>
          </TouchableOpacity>
          {!!locationState.message && (
            <Text style={[styles.statusText, enabled ? { color: "#16A34A" } : { color: "#DC2626" }]}>
              {locationState.message}
              {locationState.point?.distance !== undefined ? ` (${locationState.point.distance}m)` : ""}
            </Text>
          )}
          {clockedIn && (
            <Text style={styles.clockedInHint}>
              Clocked in at {formatClockTime(status?.clockInAt)}. Clock out when you leave.
            </Text>
          )}
          {/* Show ONLY the next valid action: Clock In if not yet in, else Clock Out. */}
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!enabled || saving}
            onPress={() => onClock(clockedIn ? "clock-out" : "clock-in")}
            style={[{ borderRadius: 16, overflow: "hidden" }, !enabled && styles.disabled]}
          >
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.clockButton}>
              <Text style={styles.clockText}>{clockedIn ? "Clock Out" : "Clock In"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </GlassCard>
  );
}

function RegisterCard(props) {
  const {
    isAdmin,
    isClerk,
    isTeacher,
    date,
    setDate,
    calendarOpen,
    setCalendarOpen,
    className,
    selectedClass,
    setSelectedClass,
    classNames,
    roster,
    draft,
    setDraft,
    overrideToken,
    setOverrideToken,
  } = props;
  // Future dates are never markable — block the forward arrow (and picker) at today.
  const atToday = date >= todayKey();
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.cardTitle}>{isAdmin ? "Global Override Register" : "Student Attendance Register"}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setDate(addDays(date, -1))}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.inputBox, { flex: 1 }]} onPress={() => setCalendarOpen(true)}>
          <Text style={{ fontWeight: "900", color: "#0F172A", textAlign: "center" }}>{date}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, atToday && styles.disabled]}
          disabled={atToday}
          onPress={() => !atToday && setDate(addDays(date, 1))}
        >
          <Ionicons name="chevron-forward" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>
      {!isTeacher && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {classNames.map((name) => (
            <TouchableOpacity
              key={name}
              onPress={() => setSelectedClass(name)}
              style={[styles.pill, selectedClass === name && styles.pillActive, { marginRight: 8 }]}
            >
              <Text style={[styles.pillText, selectedClass === name && styles.pillTextActive]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {isTeacher && date !== todayKey() && (
        <Input label="Admin override token" value={overrideToken} onChangeText={setOverrideToken} />
      )}
      <Text style={styles.muted}>
        {className || "Select class"} | Roll No, name, and present/absent controls sync with the database.
      </Text>
      {roster.map((student) => (
        <View key={student.entityId} style={styles.studentRow}>
          <View style={styles.rollBadge}>
            <Text style={styles.rollText}>{student.rollNo || "-"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.studentName}>{student.displayName}</Text>
            <Text style={styles.mutedSmall}>{student.admissionNumber}</Text>
          </View>
          <AttendanceToggle
            value={draft[student.entityId] || "absent"}
            onChange={(value) => setDraft((current) => ({ ...current, [student.entityId]: value }))}
            readonly={!(isAdmin || isClerk || isTeacher)}
          />
        </View>
      ))}
      {!roster.length && <Text style={styles.emptyText}>No students found for this class and date.</Text>}
      <DateModal visible={calendarOpen} date={date} onClose={() => setCalendarOpen(false)} onSave={setDate} max={todayKey()} />
    </GlassCard>
  );
}

function AttendanceToggle({ value, onChange, readonly }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[
        ["absent", "A", "#DC2626"],
        ["present", "P", "#16A34A"],
      ].map(([status, label, color]) => {
        const active = value === status;
        return (
          <TouchableOpacity
            key={status}
            disabled={readonly}
            onPress={() => onChange(status)}
            style={[styles.roundToggle, active && { backgroundColor: color, borderColor: color }]}
          >
            <Text style={[styles.roundToggleText, active && { color: "#fff" }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StudentLedger({ metrics, monthDays, logs }) {
  return (
    <>
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Read Only Attendance Ledger</Text>
        <View style={styles.metricRow}>
          <Metric label="Working" value={metrics.working} color="#4F46E5" />
          <Metric label="Present" value={metrics.present} color="#16A34A" />
          <Metric label="Absent" value={metrics.absent} color="#DC2626" />
          <Metric label="Percent" value={`${metrics.percentage}%`} color={metrics.percentage >= 75 ? "#16A34A" : "#DC2626"} />
        </View>
      </GlassCard>
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Current Month Calendar</Text>
        <View style={styles.calendarGrid}>
          {monthDays.map((item) => {
            const color =
              item.status === "present" || item.status === "manual" || item.status === "half-day"
                ? "#16A34A"
                : item.status === "absent"
                  ? "#DC2626"
                  : "#CBD5E1";
            return (
              <View key={item.key} style={[styles.calendarDay, { backgroundColor: color }]}>
                <Text style={{ color: "#fff", fontWeight: "900" }}>{item.day}</Text>
              </View>
            );
          })}
        </View>
      </GlassCard>
      <GlassCard style={styles.card}>
        <Text style={styles.cardTitle}>Historical Log</Text>
        {logs.slice(0, 60).map((log) => (
          <View key={log._id || `${log.entityId}-${log.attendanceDate}`} style={styles.logRow}>
            <Text style={styles.studentName}>{log.attendanceDate}</Text>
            <Text style={{ color: isPresentStatus(log.status) ? "#16A34A" : "#DC2626", fontWeight: "900" }}>
              {log.status}
            </Text>
          </View>
        ))}
        {!logs.length && <Text style={styles.emptyText}>No attendance records found yet.</Text>}
      </GlassCard>
    </>
  );
}

function AccessDenied() {
  return (
    <GlassCard style={styles.card}>
      <Ionicons name="lock-closed-outline" size={36} color="#DC2626" />
      <Text style={styles.cardTitle}>Access denied</Text>
      <Text style={styles.muted}>Only a designated class teacher can mark student attendance.</Text>
    </GlassCard>
  );
}

function DateModal({ visible, date, onClose, onSave, max }) {
  const [value, setValue] = useState(date);
  useEffect(() => setValue(date), [date, visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <GlassCard strong style={styles.modalCard}>
          <Text style={styles.cardTitle}>Select Date</Text>
          <Input label="Date (YYYY-MM-DD)" value={value} onChangeText={setValue} />
          {!!max && (
            <Text style={[styles.mutedSmall, { marginTop: -6, marginBottom: 12 }]}>
              Future dates are not allowed (up to {max}).
            </Text>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              // Block future dates — clamp anything past today back to the max.
              const next = max && value > max ? max : value;
              if (max && value > max) {
                Alert.alert("Future date", "You cannot mark attendance for a future date.");
              }
              onSave(next);
              onClose();
            }}
            style={{ borderRadius: 16, overflow: "hidden" }}
          >
            <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Apply Date</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>
      </View>
    </Modal>
  );
}

function Input({ label, value, onChangeText, keyboardType }) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || "default"}
        style={styles.inputBox}
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

function ToggleRow({ label, active, onPress }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={onPress}>
      <Text style={styles.studentName}>{label}</Text>
      <View style={[styles.switchTrack, active && { backgroundColor: "#16A34A" }]}>
        <View style={[styles.switchThumb, active && { marginLeft: 24 }]} />
      </View>
    </TouchableOpacity>
  );
}

function ActionButton({ label, color, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.barButton, { backgroundColor: color }, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.barButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = {
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 12,
  },
  metricCard: {
    backgroundColor: glassColors.cardBgSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  label: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
  },
  inputBox: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 12,
    justifyContent: "center",
    color: "#0F172A",
    fontWeight: "800",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  pillActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  pillText: {
    color: "#475569",
    fontWeight: "900",
  },
  pillTextActive: {
    color: "#fff",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(99,102,241,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginVertical: 12,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: "900",
  },
  clockButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  clockText: {
    color: "#fff",
    fontWeight: "900",
  },
  statusText: {
    fontWeight: "900",
    marginBottom: 12,
  },
  clockedInHint: {
    color: "#16A34A",
    fontWeight: "800",
    marginBottom: 12,
  },
  doneCard: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 18,
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.30)",
  },
  doneTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
  },
  doneMeta: {
    color: "#16A34A",
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.45,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },
  rollBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(99,102,241,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rollText: {
    color: colors.primaryDark,
    fontWeight: "900",
  },
  studentName: {
    color: "#0F172A",
    fontWeight: "900",
  },
  muted: {
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 10,
  },
  mutedSmall: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  roundToggle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  roundToggleText: {
    color: "#64748B",
    fontWeight: "900",
  },
  emptyText: {
    textAlign: "center",
    color: "#94A3B8",
    fontWeight: "900",
    paddingVertical: 24,
  },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.85)",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.8)",
  },
  barButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  barButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  calendarDay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  switchTrack: {
    width: 52,
    height: 28,
    borderRadius: 14,
    padding: 3,
    backgroundColor: "#CBD5E1",
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 22,
    padding: 18,
  },
};
