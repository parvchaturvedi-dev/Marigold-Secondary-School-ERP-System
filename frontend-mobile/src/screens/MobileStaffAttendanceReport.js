// MobileStaffAttendanceReport
// ----------------------------------------------------------------------------
// Mobile admin "Staff Attendance" report — a self-contained port of the web
// `StaffAttendanceReport` (frontend/src/components/common/StaffAttendanceReport.jsx).
//
// Three local-state screens (no navigator needed):
//   1. Staff list  — a searchable list of teacher / clerk cards.
//   2. Report view — per-staff header, From/To CSV export, month-by-month cards.
//   3. Month detail — a datewise Status / Clock-In / Clock-Out list.
//
// Staff lists are read from module-state (`admin-teacher-management-list` and
// `admin-clerk-management-list`) via formKit's `useModuleState`. The month
// report comes from `GET /attendance/staff-report`.
//
// CSV export uses the Expo SDK 54 File API (`new File(Paths.cache, name)` +
// `file.write`) — the legacy `writeAsStringAsync` throws at runtime on SDK 54 —
// and hands the file to `expo-sharing`.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { apiRequest } from "../api/apiClient";
import { useTheme } from "../theme/ThemeContext";
import {
  Banner,
  Card,
  DateField,
  EmptyState,
  LoadingCard,
  PrimaryButton,
  SectionTitle,
  TextField,
  useBanner,
  useModuleState,
} from "./modules/shared/formKit";

/* --------------------------------------------------------------- helpers */

const pad2 = (value) => String(value).padStart(2, "0");

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

// Never let a picked date run into the future.
const clampToToday = (key) => {
  const today = todayKey();
  return key && key > today ? today : key;
};

// Normalise any ISO / date-ish value to a YYYY-MM-DD key (or "" if invalid).
const toDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

// ISO string -> local "hh:mm AM/PM" (or "—" when null / invalid).
const formatClockTime = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
};

// Fixed status chip palette (solid tones, independent of light/dark theme).
const STATUS_META = {
  present: { label: "Present", fg: "#047857", bg: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.35)", icon: "checkmark-circle" },
  manual: { label: "Manual", fg: "#047857", bg: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.35)", icon: "create" },
  "half-day": { label: "Half-day", fg: "#b45309", bg: "rgba(217,119,6,0.14)", border: "rgba(217,119,6,0.35)", icon: "contrast" },
  absent: { label: "Absent", fg: "#be123c", bg: "rgba(244,63,94,0.14)", border: "rgba(244,63,94,0.35)", icon: "close-circle" },
  unmarked: { label: "Unmarked", fg: "#64748b", bg: "rgba(100,116,139,0.14)", border: "rgba(100,116,139,0.30)", icon: "remove-circle" },
};

const statusMeta = (status) => STATUS_META[status] || STATUS_META.unmarked;

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const percentColor = (percent) => (percent >= 75 ? "#047857" : percent >= 50 ? "#b45309" : "#be123c");

// Normalise a raw teacher/clerk record into { entityId, displayName, role }.
const normaliseStaff = (list, fallbackRole) =>
  (Array.isArray(list) ? list : [])
    .map((entry) => {
      if (!entry) return null;
      const id = entry.id || entry.teacherId || entry.empId || entry.clerkId || entry.entityId || "";
      const name = entry.name || entry.displayName || entry.fullName || "Unnamed Staff";
      if (!id && !name) return null;
      return { entityId: String(id), displayName: name, role: entry.role || fallbackRole };
    })
    .filter(Boolean);

// Build the ranged staff-report endpoint (from/to are optional).
const reportEndpoint = ({ entityId, from, to }) => {
  const params = [`entityId=${encodeURIComponent(entityId)}`];
  if (from) params.push(`from=${encodeURIComponent(from)}`);
  if (to) params.push(`to=${encodeURIComponent(to)}`);
  return `/attendance/staff-report?${params.join("&")}`;
};

/* ================================================================ screen 1 */

export default function MobileStaffAttendanceReport({ onBack }) {
  const { palette } = useTheme();
  const teachers = useModuleState("admin-teacher-management-list");
  const clerks = useModuleState("admin-clerk-management-list");

  const [search, setSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState(null);

  const loading = teachers.loading || clerks.loading;
  const loadError = teachers.error || clerks.error;

  const staffList = useMemo(() => {
    const merged = [
      ...normaliseStaff(teachers.items, "Teacher"),
      ...normaliseStaff(clerks.items, "Clerk"),
    ];
    const seen = new Set();
    return merged.filter((person) => {
      const key = person.entityId || person.displayName;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [teachers.items, clerks.items]);

  const filteredStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return staffList;
    return staffList.filter((person) =>
      `${person.displayName} ${person.role} ${person.entityId}`.toLowerCase().includes(term)
    );
  }, [staffList, search]);

  if (selectedStaff) {
    return <StaffReportView staff={selectedStaff} onBack={() => setSelectedStaff(null)} />;
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: palette.tile }]}>
            <Ionicons name="arrow-back" size={18} color={palette.accentDeep} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <SectionTitle>Staff Attendance</SectionTitle>
          <Text style={[styles.subtle, { color: palette.inkSoft }]}>
            Select a teacher or clerk to view their month-by-month report.
          </Text>
        </View>
      </View>

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search staff by name, role or ID"
      />

      {loadError ? <Banner type="error" message={loadError} /> : null}

      {loading && !staffList.length ? (
        <LoadingCard text="Loading staff..." rows={4} hero={false} />
      ) : filteredStaff.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={staffList.length === 0 ? "No staff records yet" : "No matches"}
          text={staffList.length === 0 ? "Teachers and clerks will appear here once added." : "No staff match your search."}
        />
      ) : (
        filteredStaff.map((person) => (
          <StaffCard key={person.entityId || person.displayName} person={person} onOpen={() => setSelectedStaff(person)} />
        ))
      )}
    </ScrollView>
  );
}

function StaffCard({ person, onOpen }) {
  const { palette } = useTheme();
  const isTeacher = String(person.role).toLowerCase().includes("teacher");
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen}>
      <Card>
        <View style={styles.rowCenter}>
          <View style={[styles.avatar, { backgroundColor: palette.tile, borderColor: palette.cardBorder }]}>
            <Text style={[styles.avatarText, { color: palette.accentDeep }]}>
              {String(person.displayName).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.staffName, { color: palette.ink }]} numberOfLines={1}>
              {person.displayName}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name={isTeacher ? "school-outline" : "person-outline"} size={13} color={palette.inkSoft} />
              <Text style={[styles.metaText, { color: palette.inkSoft }]}>{person.role}</Text>
              <Text style={[styles.metaText, { color: palette.inkFaint }]}>· {person.entityId || "—"}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

/* ================================================================ screen 2 */

function StaffReportView({ staff, onBack }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const [state, setState] = useState({ loading: true, error: "", report: null });
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [range, setRange] = useState({ from: "", to: todayKey() });
  const [exporting, setExporting] = useState(false);

  const isTeacher = String(staff.role).toLowerCase().includes("teacher");

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "", report: null });
    setSelectedMonth(null);
    apiRequest(reportEndpoint({ entityId: staff.entityId }))
      .then((report) => {
        if (!active) return;
        setState({ loading: false, error: "", report });
        const joinKey = toDateKey(report?.joinDate);
        setRange({ from: joinKey || todayKey(), to: todayKey() });
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, error: error.message || "Could not load the report.", report: null });
      });
    return () => {
      active = false;
    };
  }, [staff.entityId]);

  const report = state.report;
  const displayName = report?.displayName || staff.displayName;
  const role = report?.role || staff.role;
  const joinKey = toDateKey(report?.joinDate);

  const months = useMemo(() => {
    const list = Array.isArray(report?.months) ? [...report.months] : [];
    return list.sort((a, b) => String(b.month).localeCompare(String(a.month)));
  }, [report]);

  const handleExport = useCallback(async () => {
    banner.clear();
    setExporting(true);
    try {
      const data = await apiRequest(reportEndpoint({ entityId: staff.entityId, from: range.from, to: range.to }));
      const rows = [];
      (data?.months || []).forEach((month) => {
        (month.days || []).forEach((day) => {
          const key = toDateKey(day.date);
          if (range.from && key && key < range.from) return;
          if (range.to && key && key > range.to) return;
          rows.push([
            key || day.date || "",
            day.weekday || "",
            statusMeta(day.status).label,
            formatClockTime(day.clockInAt),
            formatClockTime(day.clockOutAt),
          ]);
        });
      });
      rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

      const header = ["Date", "Weekday", "Status", "Clock In", "Clock Out"];
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

      let canShare = false;
      try {
        canShare = await Sharing.isAvailableAsync();
      } catch {
        canShare = false;
      }
      if (!canShare) {
        banner.showError("Sharing is not available on this device.");
        return;
      }

      const safeName = String(displayName).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
      const fileName = `attendance_${safeName || staff.entityId}_${range.from}_to_${range.to}.csv`;
      const file = new File(Paths.cache, fileName);
      try {
        file.create({ overwrite: true });
      } catch {
        /* already exists — overwrite below */
      }
      // Prepend a BOM so Excel opens the UTF-8 CSV cleanly.
      file.write(`﻿${csv}`);

      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        dialogTitle: "Export attendance CSV",
        UTI: "public.comma-separated-values-text",
      });
    } catch (error) {
      const message = String(error?.message || error || "");
      if (!/cancel/i.test(message)) banner.showError(message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }, [banner, displayName, range.from, range.to, staff.entityId]);

  if (selectedMonth) {
    return <MonthDetailView month={selectedMonth} staffName={displayName} onBack={() => setSelectedMonth(null)} />;
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: palette.tile }]}>
          <Ionicons name="arrow-back" size={18} color={palette.accentDeep} />
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: palette.tile, borderColor: palette.cardBorder }]}>
          <Text style={[styles.avatarText, { color: palette.accentDeep }]}>
            {String(displayName).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.metaRow}>
            <Ionicons name={isTeacher ? "school-outline" : "person-outline"} size={14} color={palette.inkSoft} />
            <Text style={[styles.staffName, { color: palette.ink }]} numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: palette.inkSoft }]} numberOfLines={1}>
            {role} · {staff.entityId}
            {joinKey ? ` · Joined: ${joinKey}` : ""}
          </Text>
        </View>
      </View>

      {/* Export control */}
      <Card>
        <Text style={[styles.blockLabel, { color: palette.inkLabel }]}>Export CSV</Text>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <DateField
              label="From"
              value={range.from}
              onChange={(value) => setRange((current) => ({ ...current, from: clampToToday(value) }))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateField
              label="To"
              value={range.to}
              onChange={(value) => setRange((current) => ({ ...current, to: clampToToday(value) }))}
            />
          </View>
        </View>
        {banner.error ? <Banner type="error" message={banner.error} /> : null}
        {banner.success ? <Banner type="success" message={banner.success} /> : null}
        <PrimaryButton
          icon="download-outline"
          label={exporting ? "Exporting..." : "Export CSV"}
          onPress={handleExport}
          loading={exporting}
          disabled={state.loading}
        />
      </Card>

      {state.loading ? (
        <LoadingCard text="Loading attendance report..." rows={4} hero={false} />
      ) : state.error ? (
        <Banner type="error" message={state.error} />
      ) : months.length === 0 ? (
        <EmptyState icon="calendar-outline" title="No months recorded" text="No attendance months have been recorded yet." />
      ) : (
        months.map((month) => <MonthCard key={month.month} month={month} onOpen={() => setSelectedMonth(month)} />)
      )}
    </ScrollView>
  );
}

function MonthCard({ month, onOpen }) {
  const { palette } = useTheme();
  const percent = clamp(month.percent);
  const absentPercent = clamp(100 - percent);
  const tint = percentColor(percent);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen}>
      <Card>
        <View style={[styles.rowCenter, { marginBottom: 12 }]}>
          <Text style={[styles.monthTitle, { color: palette.ink, flex: 1 }]}>{month.label || month.month}</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.inkFaint} />
        </View>

        <View style={styles.statGrid}>
          <StatTile label="School Days" value={month.schoolDays} tone={palette.ink} />
          <StatTile label="Present" value={month.presentDays} tone="#047857" />
          <StatTile label="Absent" value={month.absentDays} tone="#be123c" />
          <StatTile label="Half-days" value={month.halfDays} tone="#b45309" />
        </View>

        <View style={styles.barHeader}>
          <Text style={[styles.barCaption, { color: palette.inkFaint }]}>ATTENDANCE</Text>
          <Text style={[styles.barPercent, { color: tint }]}>{percent}%</Text>
        </View>
        <View style={[styles.barTrack, { backgroundColor: palette.tile }]}>
          {percent > 0 ? <View style={{ width: `${percent}%`, backgroundColor: "#10b981" }} /> : null}
          {absentPercent > 0 ? <View style={{ width: `${absentPercent}%`, backgroundColor: "#f43f5e" }} /> : null}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function StatTile({ label, value, tone }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: palette.cardSoft, borderColor: palette.cardBorder }]}>
      <Text style={[styles.statLabel, { color: palette.inkFaint }]}>{label}</Text>
      <Text style={[styles.statValue, { color: tone }]}>{value ?? 0}</Text>
    </View>
  );
}

/* ================================================================ screen 3 */

function MonthDetailView({ month, staffName, onBack }) {
  const { palette } = useTheme();
  const days = Array.isArray(month.days) ? month.days : [];
  const percent = clamp(month.percent);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: palette.tile }]}>
          <Ionicons name="arrow-back" size={18} color={palette.accentDeep} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={15} color={palette.accentDeep} />
            <Text style={[styles.monthTitle, { color: palette.ink }]} numberOfLines={1}>
              {month.label || month.month}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: palette.inkSoft }]} numberOfLines={1}>
            {staffName} · {percent}% present · {month.presentDays ?? 0}/{month.schoolDays ?? 0} days
          </Text>
        </View>
      </View>

      {days.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" title="No day records" text="No day records for this month." />
      ) : (
        <Card>
          {days.map((day, index) => {
            const meta = statusMeta(day.status);
            const key = toDateKey(day.date) || day.date || String(index);
            return (
              <View
                key={key}
                style={[styles.dayRow, index < days.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.cardBorder }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.dayDate, { color: palette.ink }]}>{toDateKey(day.date) || day.date || "—"}</Text>
                  <Text style={[styles.dayWeekday, { color: palette.inkFaint }]}>{day.weekday || "—"}</Text>
                  <View style={styles.clockRow}>
                    <Ionicons name="log-in-outline" size={13} color="#047857" />
                    <Text style={[styles.clockText, { color: palette.inkSoft }]}>{formatClockTime(day.clockInAt)}</Text>
                    <Ionicons name="log-out-outline" size={13} color={palette.accentDeep} style={{ marginLeft: 10 }} />
                    <Text style={[styles.clockText, { color: palette.inkSoft }]}>{formatClockTime(day.clockOutAt)}</Text>
                  </View>
                </View>
                <View style={[styles.chip, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                  <Ionicons name={meta.icon} size={13} color={meta.fg} />
                  <Text style={[styles.chipText, { color: meta.fg }]}>{meta.label}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = {
  scroll: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  subtle: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontWeight: "900" },
  staffName: { fontSize: 15, fontWeight: "900" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" },
  metaText: { fontSize: 12, fontWeight: "800" },
  blockLabel: { fontSize: 12, fontWeight: "900", marginBottom: 6, textTransform: "uppercase" },
  dateRow: { flexDirection: "row", gap: 10 },
  monthTitle: { fontSize: 15, fontWeight: "900" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  statTile: { flexBasis: "47%", flexGrow: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  statLabel: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  statValue: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  barHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  barCaption: { fontSize: 10, fontWeight: "900" },
  barPercent: { fontSize: 14, fontWeight: "900" },
  barTrack: { height: 10, borderRadius: 6, overflow: "hidden", flexDirection: "row" },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  dayDate: { fontSize: 14, fontWeight: "900" },
  dayWeekday: { fontSize: 11, fontWeight: "800", marginTop: 1 },
  clockRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  clockText: { fontSize: 12, fontWeight: "800" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 11, fontWeight: "900" },
};
