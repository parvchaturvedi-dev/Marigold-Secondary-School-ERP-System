// Sibling Assigning — link multi-student households under a shared siblingGroupId,
// view live household registry, toggle passout lifecycle, and unlink members.
// Mirrors web Admin/SiblingAssigning.jsx (namespace admin-student-management-students,
// sibling link field `siblingGroupId` = "FAM-XXXX", status "Active" | "Passout (Archived)").
import React, { useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  Banner,
  ButtonRow,
  Card,
  Divider,
  EmptyState,
  Hero,
  IconButton,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  SmallButton,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";
import { useTheme } from "../../../theme/ThemeContext";

const NAMESPACE = "admin-student-management-students";

const admissionOf = (s) => s?.admissionNumber;

function StudentPickRow({ student, selected, onToggle }) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onToggle(student)}
      style={[styles.pickRow, { backgroundColor: palette.tile, borderColor: palette.cardBorder }, selected && styles.pickRowOn]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.pickName, { color: palette.ink }, selected && { color: "#fff" }]}>{student.name || "Unnamed"}</Text>
        <Text style={[styles.pickSub, { color: palette.inkSoft }, selected && { color: "rgba(255,255,255,0.85)" }]}>
          {student.class || "No class"} · Adm {student.admissionNumber || "—"}
          {student.mobile ? ` · ${student.mobile}` : ""}
        </Text>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={22}
        color={selected ? "#fff" : palette.inkFaint}
      />
    </TouchableOpacity>
  );
}

export default function SiblingAssigningScreen({ user }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const { items: studentsPool, loading, error, reload, persist } = useModuleState(NAMESPACE);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]); // array of admissionNumbers
  const [saving, setSaving] = useState(false);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return studentsPool.slice(0, 30);
    return studentsPool.filter((s) => {
      const hay = `${s.name || ""} ${s.admissionNumber || ""} ${s.class || ""} ${s.mobile || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, studentsPool]);

  const selectedStudents = useMemo(
    () => selected.map((adm) => studentsPool.find((s) => admissionOf(s) === adm)).filter(Boolean),
    [selected, studentsPool]
  );

  const siblingGroupsMap = useMemo(() => {
    const groups = {};
    studentsPool.forEach((s) => {
      if (s.siblingGroupId) {
        if (!groups[s.siblingGroupId]) groups[s.siblingGroupId] = [];
        groups[s.siblingGroupId].push(s);
      }
    });
    return groups;
  }, [studentsPool]);

  const groupEntries = Object.entries(siblingGroupsMap);

  const toggleSelect = (student) => {
    const adm = admissionOf(student);
    setSelected((prev) => (prev.includes(adm) ? prev.filter((x) => x !== adm) : [...prev, adm]));
  };

  // ACTION: link the selected students under one unified Family Household Group ID.
  async function handleLinkSiblings() {
    if (selectedStudents.length < 2) {
      return banner.showError("Select two or more students to map a family link.");
    }
    // Reuse an existing group id from any selected member, else generate one (matches web).
    const existingGroupId = selectedStudents.map((s) => s.siblingGroupId).find(Boolean);
    const generatedFamilyId = existingGroupId || `FAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const selectedSet = new Set(selected);

    setSaving(true);
    banner.clear();
    try {
      const next = studentsPool.map((student) =>
        selectedSet.has(admissionOf(student)) ? { ...student, siblingGroupId: generatedFamilyId } : student
      );
      await persist(next);
      setSelected([]);
      banner.showSuccess(`Linked ${selectedStudents.length} students under ${generatedFamilyId}.`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  // ACTION: toggle passout lifecycle status for a single student (matches web).
  async function togglePassout(admissionNumber) {
    banner.clear();
    try {
      const next = studentsPool.map((student) =>
        admissionOf(student) === admissionNumber
          ? { ...student, status: student.status === "Active" ? "Passout (Archived)" : "Active" }
          : student
      );
      await persist(next);
    } catch (err) {
      banner.showError(err);
    }
  }

  // ACTION: unlink a single student from its household group (clears siblingGroupId).
  function unlinkStudent(student) {
    Alert.alert(
      "Unlink from household",
      `Remove ${student.name || student.admissionNumber} from group ${student.siblingGroupId}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            banner.clear();
            try {
              const next = studentsPool.map((s) =>
                admissionOf(s) === admissionOf(student) ? { ...s, siblingGroupId: "" } : s
              );
              await persist(next);
              banner.showSuccess(`${student.name || student.admissionNumber} unlinked.`);
            } catch (err) {
              banner.showError(err);
            }
          },
        },
      ]
    );
  }

  return (
    <ScreenShell title="Sibling Assigning" refreshing={loading} onRefresh={reload}>
      <Hero
        icon="people-outline"
        title="Sibling Cross-Mapping"
        subtitle="Link multi-student households to a shared login and manage passout lifecycle."
      />
      <Banner type="error" message={banner.error || error} />
      <Banner type="success" message={banner.success} />

      <Card>
        <SectionTitle>Assign New Household Connection</SectionTitle>
        <TextField
          label="Search students"
          value={query}
          onChangeText={setQuery}
          placeholder="Name, admission no., class or mobile"
          autoCapitalize="none"
        />
        {loading ? (
          <LoadingCard text="Loading students..." />
        ) : searched.length === 0 ? (
          <Text style={[styles.hintText, { color: palette.inkFaint }]}>No students match your search.</Text>
        ) : (
          <View style={{ marginTop: 4 }}>
            {searched.map((s) => (
              <StudentPickRow
                key={admissionOf(s) || s.name}
                student={s}
                selected={selected.includes(admissionOf(s))}
                onToggle={toggleSelect}
              />
            ))}
          </View>
        )}
        <Text style={[styles.countText, { color: palette.inkLabel }]}>{selected.length} selected</Text>
        <PrimaryButton
          icon="link-outline"
          label="Bind Accounts as Siblings"
          onPress={handleLinkSiblings}
          loading={saving}
          disabled={selectedStudents.length < 2}
        />
        {selected.length > 0 && (
          <SmallButton label="Clear selection" icon="close-outline" onPress={() => setSelected([])} />
        )}
      </Card>

      <SectionTitle>Live Household Registry ({groupEntries.length})</SectionTitle>
      {loading ? (
        <LoadingCard text="Loading households..." />
      ) : groupEntries.length === 0 ? (
        <EmptyState
          icon="home-outline"
          title="No sibling groups yet"
          text="No active compound household clusters detected. Link two or more students above."
        />
      ) : (
        groupEntries.map(([groupId, members]) => (
          <Card key={groupId}>
            <View style={styles.groupHead}>
              <Text style={[styles.groupId, { color: palette.ink }]}>Unified Account ID: {groupId}</Text>
              <View style={[styles.badge, { backgroundColor: palette.tile }]}>
                <Text style={[styles.badgeText, { color: palette.accentDeep }]}>{members.length} members</Text>
              </View>
            </View>
            <Divider />
            {members.map((m, idx) => (
              <View key={admissionOf(m) || m.name}>
                {idx > 0 && <Divider />}
                <View style={styles.memberRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: palette.ink }]}>{m.name || "Unnamed"}</Text>
                    <Text style={[styles.memberSub, { color: palette.inkSoft }]}>
                      {m.class || "No class"} · Adm {m.admissionNumber || "—"}
                      {m.mobile ? ` · ${m.mobile}` : ""}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.status,
                      { backgroundColor: m.status === "Active" ? "#DCFCE7" : "#FEE2E2" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: m.status === "Active" ? "#15803D" : "#B91C1C" },
                      ]}
                    >
                      {m.status || "Active"}
                    </Text>
                  </View>
                </View>
                <ButtonRow>
                  <SmallButton
                    label={m.status === "Active" ? "Mark Passout" : "Restore Active"}
                    icon={m.status === "Active" ? "archive-outline" : "refresh-outline"}
                    tone={m.status === "Active" ? "danger" : "accent"}
                    onPress={() => togglePassout(admissionOf(m))}
                  />
                  <View style={{ marginLeft: "auto" }}>
                    <IconButton icon="unlink-outline" tone="danger" onPress={() => unlinkStudent(m)} />
                  </View>
                </ButtonRow>
              </View>
            ))}
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = {
  hintText: { color: "#94A3B8", fontWeight: "700", fontSize: 12, marginTop: 6, marginLeft: 2 },
  countText: { color: "#475569", fontWeight: "900", fontSize: 12, marginTop: 10, marginBottom: 2, marginLeft: 2 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  pickRowOn: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  pickName: { color: "#0F172A", fontSize: 14, fontWeight: "900" },
  pickSub: { color: "#64748B", fontWeight: "700", fontSize: 11, marginTop: 2 },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupId: { color: "#0F172A", fontSize: 13, fontWeight: "900", flex: 1, marginRight: 8 },
  badge: { backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { color: "#4F46E5", fontWeight: "900", fontSize: 10 },
  memberRow: { flexDirection: "row", alignItems: "center" },
  memberName: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  memberSub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3 },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginLeft: 8 },
  statusText: { fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
};
