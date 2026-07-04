// Subject Management — global subject registry + classwise subject mapping.
// Mirrors web Admin/SubjectManagement.jsx and stays interoperable with it:
//   global subjects  -> namespace "admin-subjects-global"        record { id, name, code }
//   class mapping     -> namespace "admin-subjects-class-mapping"  record { className, subjects[] }
//   class picker read -> namespace "admin-class-management-classes"
import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

import {
  Banner,
  Card,
  Divider,
  Hero,
  IconButton,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  Select,
  SectionTitle,
  SmallButton,
  TextField,
  useBanner,
  useModuleState,
} from "../shared/formKit";
import { useTheme } from "../../../theme/ThemeContext";

// Web helper: class record name resolution (name || className || class).
const getClassName = (rec = {}) => rec.name || rec.className || rec.class || "";

export default function SubjectManagementScreen() {
  const banner = useBanner();
  const { palette } = useTheme();

  const global = useModuleState("admin-subjects-global");
  const mapping = useModuleState("admin-subjects-class-mapping");
  const classes = useModuleState("admin-class-management-classes");

  const [newSubject, setNewSubject] = useState({ name: "", code: "" });
  const [targetClass, setTargetClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loading = global.loading || mapping.loading || classes.loading;

  // Class name list derived from the class-management namespace (web parity).
  const classNames = useMemo(() => {
    const names = (Array.isArray(classes.items) ? classes.items : [])
      .map((rec) => (typeof rec === "string" ? rec : getClassName(rec)))
      .filter(Boolean);
    return [...new Set(names)];
  }, [classes.items]);

  const globalSubjects = Array.isArray(global.items) ? global.items : [];
  const classMapping = Array.isArray(mapping.items) ? mapping.items : [];

  const onRefresh = () => {
    global.reload();
    mapping.reload();
    classes.reload();
  };

  // ACTION 1: create a new global subject.
  async function handleCreateSubject() {
    const name = newSubject.name.trim();
    const code = newSubject.code.trim();
    if (!name || !code) {
      return banner.showError("Subject name and system code are required.");
    }
    if (globalSubjects.some((s) => (s.code || "").toLowerCase() === code.toLowerCase())) {
      return banner.showError("A subject with this identification code already exists in the registry.");
    }
    const createdItem = {
      id: `SUB-${Math.floor(100 + Math.random() * 900)}`,
      name,
      code: code.toUpperCase(),
    };
    setSaving(true);
    banner.clear();
    try {
      await global.persist([...globalSubjects, createdItem]);
      setNewSubject({ name: "", code: "" });
      banner.showSuccess(`"${createdItem.name}" injected into global subject database successfully!`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  // ACTION 2: assign a subject to a target class.
  async function handleAssignSubjectToClass() {
    if (!targetClass || !selectedSubject) {
      return banner.showError("Select both class and subject before assigning.");
    }
    const existing = classMapping.find((item) => item.className === targetClass);
    if (existing && existing.subjects.includes(selectedSubject)) {
      return banner.showError(`"${selectedSubject}" is already mapped inside ${targetClass} routine parameters.`);
    }

    let next;
    if (!existing) {
      next = [...classMapping, { className: targetClass, subjects: [selectedSubject] }];
    } else {
      next = classMapping.map((item) =>
        item.className === targetClass
          ? { ...item, subjects: [...item.subjects, selectedSubject] }
          : item
      );
    }

    setAssigning(true);
    banner.clear();
    try {
      await mapping.persist(next);
      banner.showSuccess(`Assigned "${selectedSubject}" to ${targetClass} successfully.`);
    } catch (err) {
      banner.showError(err);
    } finally {
      setAssigning(false);
    }
  }

  // ACTION 3: unassign a subject from a specific class.
  function handleUnassignSubject(className, subjectName) {
    Alert.alert("Unlink subject", `Remove "${subjectName}" tracking from ${className}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const next = classMapping.map((item) =>
            item.className === className
              ? { ...item, subjects: item.subjects.filter((s) => s !== subjectName) }
              : item
          );
          try {
            await mapping.persist(next);
            banner.showSuccess(`Removed "${subjectName}" from ${className}.`);
          } catch (err) {
            banner.showError(err);
          }
        },
      },
    ]);
  }

  // ACTION 4: purge a subject from the global registry.
  function handlePurgeGlobalSubject(id, name) {
    Alert.alert(
      "Purge subject",
      `Purging "${name}" will NOT auto-wipe historical class assignments but removes it from onboarding options. Proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Purge",
          style: "destructive",
          onPress: async () => {
            try {
              await global.persist(globalSubjects.filter((s) => s.id !== id));
              banner.showSuccess(`"${name}" removed from global registry.`);
            } catch (err) {
              banner.showError(err);
            }
          },
        },
      ]
    );
  }

  // Every class gets a card, using its mapping row or an empty default (web parity).
  const classCards = classNames.map(
    (className) =>
      classMapping.find((item) => item.className === className) || { className, subjects: [] }
  );

  return (
    <ScreenShell title="Subject Management" refreshing={loading} onRefresh={onRefresh}>
      <Hero
        icon="book-outline"
        title="Curriculum & Subject Routing"
        subtitle="Create master subject blueprints and allocate them to target classes."
      />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      {loading ? (
        <LoadingCard text="Loading subjects..." />
      ) : (
        <>
          {/* CREATE GLOBAL SUBJECT */}
          <Card>
            <SectionTitle>Master Subject Definition</SectionTitle>
            <TextField
              label="Subject Name"
              value={newSubject.name}
              onChangeText={(v) => setNewSubject((c) => ({ ...c, name: v }))}
              placeholder="e.g. Political Science"
            />
            <TextField
              label="System Code Identification"
              value={newSubject.code}
              onChangeText={(v) => setNewSubject((c) => ({ ...c, code: v }))}
              placeholder="e.g. POL-402"
              autoCapitalize="characters"
            />
            <PrimaryButton
              icon="add-outline"
              label="Save Subject Definition"
              onPress={handleCreateSubject}
              loading={saving}
            />
          </Card>

          {/* GLOBAL SUBJECT REGISTRY LIST */}
          <SectionTitle>Available System Channels ({globalSubjects.length})</SectionTitle>
          {globalSubjects.length === 0 ? (
            <Card>
              <Text style={[styles.empty, { color: palette.inkSoft }]}>No subjects defined yet. Create one above.</Text>
            </Card>
          ) : (
            globalSubjects.map((sub) => (
              <Card key={sub.id}>
                <View style={styles.rowHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: palette.ink }]}>{sub.name}</Text>
                    <Text style={[styles.sub, { color: palette.inkSoft }]}>
                      Code: {sub.code} · ID: {sub.id}
                    </Text>
                  </View>
                  <IconButton icon="trash-outline" tone="danger" onPress={() => handlePurgeGlobalSubject(sub.id, sub.name)} />
                </View>
              </Card>
            ))
          )}

          {/* CLASSROOM MAPPING ROUTER */}
          <Card>
            <SectionTitle>Classroom Curriculum Mapping</SectionTitle>
            {classNames.length === 0 ? (
              <Text style={[styles.empty, { color: palette.inkSoft }]}>No classes configured yet.</Text>
            ) : (
              <Select
                label="Target Classroom Node"
                options={classNames}
                value={targetClass}
                onChange={setTargetClass}
                placeholder="Select class"
              />
            )}
            {globalSubjects.length === 0 ? (
              <Text style={[styles.empty, { color: palette.inkSoft }]}>Define a subject before allocating.</Text>
            ) : (
              <Select
                label="Select Subject to Allocate"
                options={globalSubjects.map((s) => ({ value: s.name, label: `${s.name} (${s.code})` }))}
                value={selectedSubject}
                onChange={setSelectedSubject}
                placeholder="Select subject"
              />
            )}
            <PrimaryButton
              icon="bookmark-outline"
              label="Link Node"
              onPress={handleAssignSubjectToClass}
              loading={assigning}
              disabled={globalSubjects.length === 0 || classNames.length === 0}
            />
          </Card>

          {/* CLASS ALLOCATION BLUEPRINT */}
          <SectionTitle>Class Allocation Blueprint</SectionTitle>
          {classCards.length === 0 ? (
            <Card>
              <Text style={[styles.empty, { color: palette.inkSoft }]}>No classes to display.</Text>
            </Card>
          ) : (
            classCards.map((item) => (
              <Card key={item.className}>
                <View style={styles.rowHead}>
                  <Text style={[styles.name, { color: palette.ink }]}>{item.className}</Text>
                  <Text style={[styles.count, { color: palette.inkSoft }]}>{item.subjects.length} Core Channels</Text>
                </View>
                <Divider />
                {item.subjects.length === 0 ? (
                  <Text style={[styles.empty, { color: palette.inkSoft }]}>No active courses linked to this grade node.</Text>
                ) : (
                  <View style={styles.tagWrap}>
                    {item.subjects.map((subj) => (
                      <View key={subj} style={[styles.tag, { backgroundColor: palette.tile }]}>
                        <Text style={[styles.tagText, { color: palette.ink }]}>{subj}</Text>
                        <SmallButton
                          label="Remove"
                          icon="close-outline"
                          tone="danger"
                          onPress={() => handleUnassignSubject(item.className, subj)}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            ))
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900", flex: 1 },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3 },
  count: { color: "#64748B", fontWeight: "900", fontSize: 11 },
  empty: { color: "#64748B", fontWeight: "700", fontSize: 13 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  tagText: { color: "#0F172A", fontWeight: "800", fontSize: 12 },
};
