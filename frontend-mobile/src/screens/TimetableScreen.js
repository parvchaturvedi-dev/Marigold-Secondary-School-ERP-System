import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import PageHeader from "../components/cards/PageHeader";
import { useAuth } from "../auth/AuthContext";
import {
  cellKey,
  createEmptyTimetable,
  fetchEffectiveTimetable,
  fetchTimetableTemplates,
  saveTimetableTemplate,
  todayIsoDate,
} from "../api/timetableApi";
import { colors } from "../shared/theme/colors";
import { gradients, glassColors } from "../shared/theme/glass";
import AuroraBackground from "../shared/components/AuroraBackground";
import GlassCard from "../shared/components/GlassCard";

const classFromUser = (user) =>
  user?.activeStudent?.className || user?.studentProfiles?.[0]?.className || "Class 1";

export default function TimetableScreen() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "clerk";
  const [date, setDate] = useState(todayIsoDate());
  const [selectedClass, setSelectedClass] = useState(classFromUser(user));
  const [effective, setEffective] = useState(null);
  const [draft, setDraft] = useState(createEmptyTimetable());
  const [status, setStatus] = useState("");

  const classes = useMemo(
    () => [...new Set([...(draft.classes || []), selectedClass].filter(Boolean))],
    [draft.classes, selectedClass]
  );

  const load = useCallback(async () => {
    try {
      const effectivePayload = await fetchEffectiveTimetable(date, selectedClass);
      setEffective(effectivePayload.timetable);

      if (canEdit) {
        const templatePayload = await fetchTimetableTemplates();
        const defaultTemplate = templatePayload.timetables?.find((item) => item.mode === "default");
        if (defaultTemplate) setDraft(defaultTemplate);
      }
    } catch (error) {
      setStatus(error.message);
    }
  }, [canEdit, date, selectedClass]);

  useEffect(() => {
    load();
  }, [load]);

  function updateCell(periodId, className, value) {
    const key = cellKey(periodId, className);
    setDraft((current) => ({
      ...current,
      cells: {
        ...(current.cells || {}),
        [key]: {
          ...(current.cells?.[key] || {}),
          subject: value,
        },
      },
    }));
  }

  function addPeriod() {
    setDraft((current) => ({
      ...current,
      periods: [
        ...(current.periods || []),
        { id: `period-${Date.now()}`, label: `Period ${(current.periods || []).length + 1}`, time: "" },
      ],
    }));
  }

  function addClass() {
    const nextClass = `Class ${classes.length + 1}`;
    setDraft((current) => ({ ...current, classes: [...(current.classes || []), nextClass] }));
    setSelectedClass(nextClass);
  }

  async function save() {
    try {
      setStatus("Saving...");
      const payload = await saveTimetableTemplate(draft);
      setDraft(payload.timetable);
      setStatus("Saved");
      load();
    } catch (error) {
      Alert.alert("Timetable save failed", error.message);
      setStatus(error.message);
    }
  }

  const rows = effective?.periods || [];

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      <PageHeader title="Timetable" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <GlassCard style={styles.panel}>
          <Text style={styles.title}>Live Class Timetable</Text>
          <Text style={styles.muted}>{date} • {selectedClass}</Text>
          <TextInput value={date} onChangeText={setDate} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
          <TextInput value={selectedClass} onChangeText={setSelectedClass} style={styles.input} placeholder="Class name" placeholderTextColor="#94A3B8" />
        </GlassCard>

        {rows.map((period) => {
          const cell = effective?.cells?.[cellKey(period.id, selectedClass)] || {};
          return (
            <View key={period.id} style={styles.row}>
              <View style={styles.periodBadge}>
                <Text style={{ color: colors.primaryDark, fontWeight: "900" }}>{period.label?.replace("Period ", "")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{cell.subject || "Free / Not assigned"}</Text>
                <Text style={styles.muted}>{[period.time, cell.teacher, cell.room].filter(Boolean).join(" • ") || "Timing not set"}</Text>
              </View>
            </View>
          );
        })}

        {!rows.length && (
          <GlassCard style={styles.panel}>
            <Ionicons name="calendar-outline" size={42} color="#94A3B8" />
            <Text style={styles.muted}>No timetable published for this class yet.</Text>
          </GlassCard>
        )}

        {canEdit && (
          <GlassCard style={styles.panel}>
            <Text style={styles.title}>Admin / Clerk Editor</Text>
            <Text style={styles.muted}>Edit and publish the default timetable grid.</Text>
            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
              style={styles.input}
              placeholder="Timetable name"
              placeholderTextColor="#94A3B8"
            />

            <ScrollView horizontal>
              <View>
                <View style={{ flexDirection: "row" }}>
                  <View style={styles.headerCell}><Text style={styles.headerText}>Period</Text></View>
                  {(draft.classes || []).map((className, index) => (
                    <TextInput
                      key={`${className}-${index}`}
                      value={className}
                      onChangeText={(value) => {
                        setDraft((current) => ({
                          ...current,
                          classes: current.classes.map((item, itemIndex) => itemIndex === index ? value : item),
                        }));
                      }}
                      style={styles.headerInput}
                    />
                  ))}
                </View>
                {(draft.periods || []).map((period) => (
                  <View key={period.id} style={{ flexDirection: "row" }}>
                    <TextInput
                      value={period.label}
                      onChangeText={(value) => setDraft((current) => ({
                        ...current,
                        periods: current.periods.map((item) => item.id === period.id ? { ...item, label: value } : item),
                      }))}
                      style={styles.periodInput}
                    />
                    {(draft.classes || []).map((className) => (
                      <TextInput
                        key={cellKey(period.id, className)}
                        value={draft.cells?.[cellKey(period.id, className)]?.subject || ""}
                        onChangeText={(value) => updateCell(period.id, className, value)}
                        style={styles.cellInput}
                        placeholder="Subject"
                      />
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <ActionButton label="Row" icon="add-outline" onPress={addPeriod} />
              <ActionButton label="Column" icon="add-circle-outline" onPress={addClass} />
              <ActionButton label="Save" icon="save-outline" onPress={save} primary />
            </View>
            {!!status && <Text style={[styles.muted, { marginTop: 10 }]}>{status}</Text>}
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

function ActionButton({ label, icon, onPress, primary }) {
  if (primary) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flex: 1, borderRadius: 14, overflow: "hidden" }}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          <Ionicons name={icon} size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "900" }}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.primary, fontWeight: "900" }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = {
  panel: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  muted: { color: "#64748B", marginTop: 6, fontWeight: "700" },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    padding: 12,
    fontWeight: "800",
    color: "#0F172A",
  },
  row: {
    backgroundColor: glassColors.cardBgSoft,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  periodBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(99,102,241,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  headerCell: { width: 110, padding: 10, backgroundColor: "rgba(99,102,241,0.12)", borderRadius: 10, margin: 3 },
  headerText: { fontWeight: "900", color: colors.primaryDark },
  headerInput: { width: 130, padding: 10, backgroundColor: "rgba(99,102,241,0.12)", borderRadius: 10, margin: 3, fontWeight: "900" },
  periodInput: { width: 110, padding: 10, backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 10, margin: 3, fontWeight: "800" },
  cellInput: { width: 130, padding: 10, backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 10, margin: 3, fontWeight: "800" },
  button: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(99,102,241,0.12)",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
};
