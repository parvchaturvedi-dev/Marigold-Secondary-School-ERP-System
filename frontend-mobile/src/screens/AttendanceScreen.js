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

import PageHeader from "../components/cards/PageHeader";
import { useAuth } from "../auth/AuthContext";
import { getDeviceIdentity } from "../api/deviceIdentity";
import {
  clockAttendance,
  fetchAttendanceDirectory,
  fetchAttendanceLogs,
  fetchAttendanceOverview,
  saveAttendanceSettings,
  saveStudentAttendanceBatch,
} from "../api/attendanceApi";

const todayKey = () => new Date().toISOString().slice(0, 10);
const addDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

function getLocation() {
  return new Promise((resolve, reject) => {
    const nativeAttendance = globalThis.MGPSAttendanceDevice;
    if (nativeAttendance?.getLocation) {
      Promise.resolve(nativeAttendance.getLocation()).then(resolve).catch(reject);
      return;
    }

    if (globalThis.navigator?.geolocation?.getCurrentPosition) {
      globalThis.navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            isMockLocation: Boolean(position.mocked || position.coords.mocked),
          }),
        reject,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
      );
      return;
    }

    reject(new Error("Device GPS bridge is unavailable on this build."));
  });
}

export default function AttendanceScreen({ role, onBack }) {
  const { user } = useAuth();
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
          geofenceRadiusMeters: String(overviewPayload.settings.geofenceRadiusMeters || 100),
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
      const radius = Number(settings.geofenceRadiusMeters || 100);
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
    const point = locationState.point;
    if (!point?.inside) {
      Alert.alert("Location required", "Please verify GPS inside the school boundary first.");
      return;
    }
    if (point.isMockLocation) {
      Alert.alert("Blocked", "Mock location detected.");
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
      Alert.alert("Attendance", payload.message || "Attendance recorded.");
      load();
    } catch (error) {
      Alert.alert("Attendance", error.message);
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
        geofenceRadiusMeters: Number(settingsDraft.geofenceRadiusMeters || 100),
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

  if (loading && !overview && !isStudent) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F8FAFF" }}>
        <AttendanceHeader onBack={onBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#4F46E5" size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFF" }}>
      <AttendanceHeader onBack={onBack} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, paddingBottom: canEditStudents ? 112 : 28 }}
      >
        {isStudent ? (
          <StudentLedger metrics={studentMetrics} monthDays={monthDays} logs={studentLogs} />
        ) : (
          <>
            <RoleSummary roleSummary={overview?.roleSummary} counts={overview?.counts} />
            {isAdmin && (
              <SecurityConfigurator
                settingsDraft={settingsDraft}
                setSettingsDraft={setSettingsDraft}
                onSave={handleSaveSettings}
                saving={saving}
              />
            )}
            {(isClerk || isTeacher) && (
              <ClockCard
                role={role}
                locationState={locationState}
                onCheck={checkLocation}
                onClock={handleClock}
                saving={saving}
              />
            )}
            {isTeacher && !teacherClass ? (
              <AccessDenied />
            ) : (
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
          </>
        )}
      </ScrollView>

      {canEditStudents && roster.length > 0 && (
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
        backgroundColor: "#F8FAFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="arrow-back" size={22} color="#4F46E5" />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: "900", color: "#0F172A" }}>Attendance</Text>
      <TouchableOpacity onPress={onBack} style={styles.headerButton}>
        <Ionicons name="home" size={22} color="#4F46E5" />
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
    <View style={styles.card}>
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
    </View>
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
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Geofencing and Security</Text>
      <Input label="School address" value={settingsDraft.schoolAddress} onChangeText={(value) => setSettingsDraft((draft) => ({ ...draft, schoolAddress: value }))} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Input label="Latitude" value={settingsDraft.geofenceLatitude} keyboardType="numeric" onChangeText={(value) => setSettingsDraft((draft) => ({ ...draft, geofenceLatitude: value }))} />
        <Input label="Longitude" value={settingsDraft.geofenceLongitude} keyboardType="numeric" onChangeText={(value) => setSettingsDraft((draft) => ({ ...draft, geofenceLongitude: value }))} />
      </View>
      <Text style={styles.label}>Radius</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {["50", "100", "200"].map((radius) => (
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
      <TouchableOpacity style={styles.primaryButton} onPress={onSave} disabled={saving}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>Save Security Config</Text>
      </TouchableOpacity>
    </View>
  );
}

function ClockCard({ role, locationState, onCheck, onClock, saving }) {
  const enabled = Boolean(locationState.point?.inside && !locationState.point?.isMockLocation);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>My Attendance</Text>
      <Text style={styles.muted}>{role === "teacher" ? "Teacher" : "Clerk"} self-service clock-in and clock-out requires verified GPS.</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={onCheck} disabled={locationState.checking}>
        <Ionicons name="locate-outline" size={20} color="#4F46E5" />
        <Text style={styles.secondaryButtonText}>{locationState.checking ? "Checking GPS..." : "Check School Boundary"}</Text>
      </TouchableOpacity>
      {!!locationState.message && (
        <Text style={[styles.statusText, enabled ? { color: "#16A34A" } : { color: "#DC2626" }]}>
          {locationState.message}
          {locationState.point?.distance !== undefined ? ` (${locationState.point.distance}m)` : ""}
        </Text>
      )}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity style={[styles.clockButton, !enabled && styles.disabled]} onPress={() => onClock("clock-in")} disabled={!enabled || saving}>
          <Text style={styles.clockText}>Clock In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.clockButton, !enabled && styles.disabled]} onPress={() => onClock("clock-out")} disabled={!enabled || saving}>
          <Text style={styles.clockText}>Clock Out</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{isAdmin ? "Global Override Register" : "Student Attendance Register"}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <TouchableOpacity style={styles.iconButton} onPress={() => setDate(addDays(date, -1))}>
          <Ionicons name="chevron-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.inputBox, { flex: 1 }]} onPress={() => setCalendarOpen(true)}>
          <Text style={{ fontWeight: "900", color: "#0F172A", textAlign: "center" }}>{date}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => setDate(addDays(date, 1))}>
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
      <DateModal visible={calendarOpen} date={date} onClose={() => setCalendarOpen(false)} onSave={setDate} />
    </View>
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Read Only Attendance Ledger</Text>
        <View style={styles.metricRow}>
          <Metric label="Working" value={metrics.working} color="#4F46E5" />
          <Metric label="Present" value={metrics.present} color="#16A34A" />
          <Metric label="Absent" value={metrics.absent} color="#DC2626" />
          <Metric label="Percent" value={`${metrics.percentage}%`} color={metrics.percentage >= 75 ? "#16A34A" : "#DC2626"} />
        </View>
      </View>
      <View style={styles.card}>
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
      </View>
      <View style={styles.card}>
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
      </View>
    </>
  );
}

function AccessDenied() {
  return (
    <View style={styles.card}>
      <Ionicons name="lock-closed-outline" size={36} color="#DC2626" />
      <Text style={styles.cardTitle}>Access denied</Text>
      <Text style={styles.muted}>Only a designated class teacher can mark student attendance.</Text>
    </View>
  );
}

function DateModal({ visible, date, onClose, onSave }) {
  const [value, setValue] = useState(date);
  useEffect(() => setValue(date), [date, visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.cardTitle}>Select Date</Text>
          <Input label="Date (YYYY-MM-DD)" value={value} onChangeText={setValue} />
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              onSave(value);
              onClose();
            }}
          >
            <Text style={styles.primaryButtonText}>Apply Date</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    elevation: 2,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
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
    backgroundColor: "#F8FAFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFF",
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
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  pillActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
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
    backgroundColor: "#4F46E5",
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
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginVertical: 12,
  },
  secondaryButtonText: {
    color: "#4F46E5",
    fontWeight: "900",
  },
  clockButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#16A34A",
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
  disabled: {
    opacity: 0.45,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  rollBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  rollText: {
    color: "#4F46E5",
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
    backgroundColor: "#fff",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
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
    borderBottomColor: "#EEF2F7",
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
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
  },
};
