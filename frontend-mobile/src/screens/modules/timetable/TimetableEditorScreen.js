// Timetable Editor — full parity with web TimetableHub (manage mode).
// Create / update / delete timetable templates (default + date-range overrides).
// REST module (not module-state): GET /timetable/templates, POST /timetable, DELETE /timetable/:id.
// Payload shape mirrors web/timetableStore EXACTLY so web and backend stay interoperable:
//   { id?, mode:'default'|'override', name, fromDate, toDate,
//     classes:[String], periods:[{id,label,time}], cells:{ '<periodId>__<class>': {subject,teacher,room} } }
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
import {
  Banner,
  ButtonRow,
  Card,
  DateField,
  Divider,
  EmptyState,
  Field,
  GhostButton,
  Hero,
  IconButton,
  LoadingCard,
  MultiSelect,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  Segmented,
  SmallButton,
  TextField,
  todayIso,
  useBanner,
} from "../shared/formKit";

const CLASSES_NAMESPACE = "admin-class-management-classes";

const getCellKey = (periodId, className) => `${periodId}__${className}`;
const className = (record) =>
  (record && (record.name || record.className || record.class)) || String(record || "");

const emptyDraft = (classes) => ({
  id: undefined,
  name: "Default Timetable",
  mode: "default",
  fromDate: "",
  toDate: "",
  classes: (classes && classes.length ? classes : ["Class 1", "Class 2", "Class 3"]).slice(0, 6),
  periods: [
    { id: "period-1", label: "Period 1", time: "08:30 - 09:10" },
    { id: "period-2", label: "Period 2", time: "09:10 - 09:50" },
    { id: "period-3", label: "Period 3", time: "09:50 - 10:30" },
  ],
  cells: {},
});

export default function TimetableEditorScreen({ user }) {
  const banner = useBanner();
  const { palette } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [classNames, setClassNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft([]));
  const [activeClass, setActiveClass] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tplPayload, classPayload] = await Promise.all([
        apiRequest("/timetable/templates"),
        apiRequest(`/module-state/${encodeURIComponent(CLASSES_NAMESPACE)}`).catch(() => ({ value: [] })),
      ]);
      const records = tplPayload?.timetables || [];
      setTemplates(records);
      const rawClasses = classPayload?.value;
      const names = (Array.isArray(rawClasses) ? rawClasses : [])
        .map(className)
        .filter(Boolean);
      setClassNames([...new Set(names)]);
    } catch (err) {
      banner.showError(err);
    } finally {
      setLoading(false);
    }
  }, [banner]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the active class picker pointed at a valid column.
  useEffect(() => {
    const cols = draft.classes || [];
    if (!cols.length) {
      if (activeClass) setActiveClass("");
      return;
    }
    if (!cols.includes(activeClass)) setActiveClass(cols[0]);
  }, [draft.classes, activeClass]);

  const isOverride = draft.mode === "override";

  const columnOptions = useMemo(
    () => [...new Set([...(classNames || []), ...(draft.classes || [])].filter(Boolean))],
    [classNames, draft.classes]
  );

  function resetDraft() {
    setDraft(emptyDraft(classNames));
    banner.clear();
  }

  function editTemplate(record) {
    setDraft({
      id: record.id,
      name: record.name || "",
      mode: record.mode === "override" ? "override" : "default",
      fromDate: record.fromDate || "",
      toDate: record.toDate || "",
      classes: Array.isArray(record.classes) && record.classes.length ? record.classes : classNames.slice(0, 6),
      periods:
        Array.isArray(record.periods) && record.periods.length
          ? record.periods.map((p, i) => ({
              id: String(p.id || `period-${i + 1}`),
              label: String(p.label || `Period ${i + 1}`),
              time: String(p.time || ""),
            }))
          : emptyDraft(classNames).periods,
      cells: record.cells && typeof record.cells === "object" ? record.cells : {},
    });
    banner.clear();
  }

  function setMode(mode) {
    setDraft((c) => ({
      ...c,
      mode,
      fromDate: mode === "default" ? "" : c.fromDate || todayIso(),
      toDate: mode === "default" ? "" : c.toDate || c.fromDate || todayIso(),
      name: mode === "override" && (!c.name || c.name === "Default Timetable") ? "Special Timetable" : c.name,
    }));
  }

  function updateCell(periodId, cls, field, value) {
    const key = getCellKey(periodId, cls);
    setDraft((c) => ({
      ...c,
      cells: { ...(c.cells || {}), [key]: { ...(c.cells?.[key] || {}), [field]: value } },
    }));
  }

  function updatePeriod(periodId, field, value) {
    setDraft((c) => ({
      ...c,
      periods: (c.periods || []).map((p) => (p.id === periodId ? { ...p, [field]: value } : p)),
    }));
  }

  function addPeriod() {
    setDraft((c) => ({
      ...c,
      periods: [
        ...(c.periods || []),
        { id: `period-${Date.now()}`, label: `Period ${(c.periods || []).length + 1}`, time: "" },
      ],
    }));
  }

  function removePeriod(periodId) {
    setDraft((c) => ({
      ...c,
      periods: (c.periods || []).filter((p) => p.id !== periodId),
      cells: Object.fromEntries(
        Object.entries(c.cells || {}).filter(([key]) => !key.startsWith(`${periodId}__`))
      ),
    }));
  }

  // Set the selected class columns (from the MultiSelect). Keeps `classes` an
  // array of names and prunes cells belonging to any removed column so the
  // saved payload stays clean.
  function setColumns(nextNames) {
    const next = [...new Set((nextNames || []).filter(Boolean))];
    setDraft((c) => ({
      ...c,
      classes: next,
      cells: Object.fromEntries(
        Object.entries(c.cells || {}).filter(([key]) => next.some((name) => key.endsWith(`__${name}`)))
      ),
    }));
    if (next.length && !next.includes(activeClass)) setActiveClass(next[0]);
  }

  async function saveDraft() {
    if (!(draft.classes || []).length || !(draft.periods || []).length) {
      banner.showError("At least one class column and one period row are required.");
      return;
    }
    if (isOverride) {
      if (!draft.fromDate || !draft.toDate) {
        banner.showError("From and to dates are required for a date-specific timetable.");
        return;
      }
      if (draft.fromDate > draft.toDate) {
        banner.showError("From date must be on or before the to date.");
        return;
      }
    }
    setSaving(true);
    banner.clear();
    try {
      const body = {
        id: draft.id,
        name: draft.name,
        mode: draft.mode,
        fromDate: isOverride ? draft.fromDate : "",
        toDate: isOverride ? draft.toDate : "",
        classes: draft.classes,
        periods: draft.periods,
        cells: draft.cells,
      };
      const payload = await apiRequest("/timetable", { method: "POST", body: JSON.stringify(body) });
      banner.showSuccess(draft.id ? "Timetable updated." : "Timetable saved.");
      if (payload?.timetable) setDraft({ ...emptyDraft(classNames), ...payload.timetable });
      await load();
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(record) {
    Alert.alert(
      "Delete timetable",
      `Remove "${record.name || record.mode}"${record.mode === "override" ? ` (${record.fromDate} to ${record.toDate})` : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(`/timetable/${encodeURIComponent(record.id)}`, { method: "DELETE" });
              banner.showSuccess("Timetable removed.");
              if (draft.id === record.id) resetDraft();
              await load();
            } catch (err) {
              banner.showError(err);
            }
          },
        },
      ]
    );
  }

  const activeCells = draft.cells || {};

  return (
    <ScreenShell title="Timetable Editor" refreshing={loading} onRefresh={load}>
      <Hero
        icon="calendar-outline"
        title={`${templates.length} timetable${templates.length === 1 ? "" : "s"}`}
        subtitle="Build the default grid or date-range overrides. Fill a subject for each class per period."
      />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      {/* ---- Builder ---- */}
      <Card>
        <SectionTitle right={draft.id ? <SmallButton label="New" icon="add-outline" onPress={resetDraft} /> : null}>
          {draft.id ? "Edit Timetable" : "New Timetable"}
        </SectionTitle>

        <Field label="Type">
          <Segmented
            options={[
              { value: "default", label: "Default" },
              { value: "override", label: "Date Override" },
            ]}
            value={draft.mode}
            onChange={setMode}
          />
        </Field>

        <TextField
          label="Name"
          value={draft.name}
          onChangeText={(v) => setDraft((c) => ({ ...c, name: v }))}
          placeholder="Timetable name"
        />

        {isOverride && (
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <DateField
                label="From date"
                value={draft.fromDate}
                onChange={(v) => setDraft((c) => ({ ...c, fromDate: v }))}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={{ flex: 1 }}>
              <DateField
                label="To date"
                value={draft.toDate}
                onChange={(v) => setDraft((c) => ({ ...c, toDate: v }))}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        )}

        <Divider />

        {/* Class columns */}
        <SectionTitle>Classes</SectionTitle>
        {columnOptions.length ? (
          <MultiSelect
            label="Class columns"
            hint="Check the classes to include as columns in this timetable."
            options={columnOptions}
            values={draft.classes || []}
            onChange={setColumns}
          />
        ) : (
          <Text style={[styles.hint, { color: palette.inkFaint }]}>No classes available from Class Management.</Text>
        )}

        {/* Active-column picker (choose which class's cells to edit) */}
        {(draft.classes || []).length > 0 && (
          <View style={styles.chipWrap}>
            {(draft.classes || []).map((name) => (
              <View
                key={name}
                style={[
                  styles.chip,
                  { backgroundColor: palette.tile, borderColor: palette.cardBorder },
                  name === activeClass && styles.chipActive,
                ]}
              >
                <Text
                  onPress={() => setActiveClass(name)}
                  style={[styles.chipText, { color: palette.accentDeep }, name === activeClass && styles.chipTextActive]}
                >
                  {name}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Divider />

        {/* Periods + per-class cells (one class at a time for phone usability) */}
        <SectionTitle right={<SmallButton label="Add period" icon="add-outline" onPress={addPeriod} />}>
          {activeClass ? `Periods · ${activeClass}` : "Periods"}
        </SectionTitle>

        {!(draft.periods || []).length && <Text style={[styles.hint, { color: palette.inkFaint }]}>No periods yet. Add one to begin.</Text>}

        <ScrollView keyboardShouldPersistTaps="handled">
          {(draft.periods || []).map((period, index) => {
            const key = activeClass ? getCellKey(period.id, activeClass) : "";
            const cell = (activeClass && activeCells[key]) || {};
            return (
              <View key={period.id} style={[styles.periodBox, { borderColor: palette.cardBorder }]}>
                <View style={styles.periodHead}>
                  <Text style={[styles.periodIndex, { color: palette.accentDeep }]}>{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={period.label}
                      onChangeText={(v) => updatePeriod(period.id, "label", v)}
                      placeholder="Period label"
                    />
                  </View>
                  <IconButton icon="trash-outline" tone="danger" onPress={() => removePeriod(period.id)} />
                </View>
                <TextField
                  value={period.time}
                  onChangeText={(v) => updatePeriod(period.id, "time", v)}
                  placeholder="08:30 - 09:10"
                />
                {activeClass ? (
                  <View style={[styles.cellBox, { borderTopColor: palette.cardBorder }]}>
                    <TextField
                      label="Subject"
                      value={cell.subject || ""}
                      onChangeText={(v) => updateCell(period.id, activeClass, "subject", v)}
                      placeholder="Subject"
                    />
                    <View style={styles.dateRow}>
                      <View style={{ flex: 1 }}>
                        <TextField
                          label="Teacher"
                          value={cell.teacher || ""}
                          onChangeText={(v) => updateCell(period.id, activeClass, "teacher", v)}
                          placeholder="Teacher"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TextField
                          label="Room"
                          value={cell.room || ""}
                          onChangeText={(v) => updateCell(period.id, activeClass, "room", v)}
                          placeholder="Room"
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.hint, { color: palette.inkFaint }]}>Add a class column to fill subjects.</Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        <PrimaryButton
          icon="save-outline"
          label={draft.id ? "Update Timetable" : "Save Timetable"}
          onPress={saveDraft}
          loading={saving}
        />
      </Card>

      {/* ---- Existing templates ---- */}
      <SectionTitle>Saved Timetables</SectionTitle>
      {loading ? (
        <LoadingCard text="Loading timetables..." />
      ) : !templates.length ? (
        <EmptyState icon="calendar-outline" title="No timetables yet" text="Create the default grid or an override above." />
      ) : (
        templates.map((record) => (
          <Card key={record.id}>
            <View style={styles.rowHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: palette.ink }]}>{record.name || "Untitled"}</Text>
                <Text style={[styles.sub, { color: palette.inkSoft }]}>
                  {record.mode === "override"
                    ? `Override · ${record.fromDate || "?"} → ${record.toDate || "?"}`
                    : "Default timetable"}
                </Text>
                <Text style={[styles.metaSub, { color: palette.inkFaint }]}>
                  {(record.classes || []).length} classes · {(record.periods || []).length} periods
                  {record.updatedBy ? ` · by ${record.updatedBy}` : ""}
                </Text>
              </View>
              <View
                style={[styles.badge, { backgroundColor: record.mode === "override" ? "#FEF3C7" : "#DCFCE7" }]}
              >
                <Text style={[styles.badgeText, { color: record.mode === "override" ? "#B45309" : "#15803D" }]}>
                  {record.mode === "override" ? "Override" : "Default"}
                </Text>
              </View>
            </View>
            <Divider />
            <ButtonRow>
              <SmallButton label="Edit" icon="create-outline" onPress={() => editTemplate(record)} />
              <GhostButton label="Delete" icon="trash-outline" tone="danger" onPress={() => confirmDelete(record)} />
            </ButtonRow>
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = {
  dateRow: { flexDirection: "row", gap: 10 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipText: { color: "#4F46E5", fontWeight: "900", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  periodBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    backgroundColor: "rgba(255,255,255,0.5)",
    padding: 12,
    marginBottom: 10,
  },
  periodHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  periodIndex: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(99,102,241,0.14)",
    color: "#4F46E5",
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 30,
    fontSize: 13,
  },
  cellBox: { marginTop: 6, borderTopWidth: 1, borderTopColor: "#EEF2F7", paddingTop: 10 },
  rowHead: { flexDirection: "row", alignItems: "flex-start" },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#475569", fontWeight: "800", fontSize: 12, marginTop: 3 },
  metaSub: { color: "#94A3B8", fontWeight: "700", fontSize: 11, marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
  hint: { color: "#94A3B8", fontWeight: "700", fontSize: 12, marginBottom: 6 },
};
