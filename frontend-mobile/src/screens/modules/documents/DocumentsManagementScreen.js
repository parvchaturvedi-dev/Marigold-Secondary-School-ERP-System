// Documents Management — configure required-document checklists per role.
// Mirrors web Admin/DocumentsManagement.jsx (namespace `admin-document-requirements`).
// Web shape: an OBJECT mapping role -> array of plain string document labels:
//   { Admin: [], Clerk: [], Teacher: [], Student: [] }
// Documents are plain strings (no `required` flag in the web source), so "edit"
// here renames a label and delete removes it by exact string, matching the web
// dedup/delete logic. We read/write the raw object via apiRequest to stay
// byte-compatible with the web page (formKit.useModuleState is array-oriented).
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import {
  Banner,
  ButtonRow,
  Card,
  Divider,
  Hero,
  IconButton,
  LoadingCard,
  PrimaryButton,
  ScreenShell,
  SectionTitle,
  SmallButton,
  TextField,
  useBanner,
} from "../shared/formKit";
import { useTheme } from "../../../theme/ThemeContext";

const NAMESPACE = "admin-document-requirements";
const ROLES = ["Admin", "Clerk", "Teacher", "Student"];
const EMPTY = { Admin: [], Clerk: [], Teacher: [], Student: [] };

// Normalise whatever the API returns into the canonical role->string[] object.
function normalise(value) {
  const base = { ...EMPTY };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    ROLES.forEach((role) => {
      const list = value[role];
      base[role] = Array.isArray(list) ? list.filter((d) => typeof d === "string") : [];
    });
  }
  return base;
}

export default function DocumentsManagementScreen() {
  const banner = useBanner();
  const { palette } = useTheme();
  const [roleDocuments, setRoleDocuments] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [newDocName, setNewDocName] = useState("");
  const [editing, setEditing] = useState(null); // { role, doc, value }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiRequest(`/module-state/${encodeURIComponent(NAMESPACE)}`);
      setRoleDocuments(normalise(payload?.value));
    } catch (err) {
      banner.showError(err);
    } finally {
      setLoading(false);
    }
  }, [banner]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(async (next) => {
    setSaving(true);
    try {
      await apiRequest(`/module-state/${encodeURIComponent(NAMESPACE)}`, {
        method: "PUT",
        body: JSON.stringify({ value: next }),
      });
      setRoleDocuments(next);
      return true;
    } catch (err) {
      banner.showError(err);
      return false;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentDocs = useMemo(
    () => (selectedRole ? roleDocuments[selectedRole] || [] : []),
    [roleDocuments, selectedRole]
  );

  async function addDocument() {
    const formatted = newDocName.trim();
    if (!formatted) return banner.showError("Document label is required.");
    if (currentDocs.some((d) => d.toLowerCase() === formatted.toLowerCase())) {
      return banner.showError(`"${formatted}" is already registered under ${selectedRole}.`);
    }
    banner.clear();
    const next = { ...roleDocuments, [selectedRole]: [...currentDocs, formatted] };
    const ok = await persist(next);
    if (ok) {
      setNewDocName("");
      banner.showSuccess("Required document added.");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const formatted = (editing.value || "").trim();
    if (!formatted) return banner.showError("Document label is required.");
    const docs = roleDocuments[editing.role] || [];
    if (
      formatted.toLowerCase() !== editing.doc.toLowerCase() &&
      docs.some((d) => d.toLowerCase() === formatted.toLowerCase())
    ) {
      return banner.showError(`"${formatted}" is already registered under ${editing.role}.`);
    }
    banner.clear();
    const next = {
      ...roleDocuments,
      [editing.role]: docs.map((d) => (d === editing.doc ? formatted : d)),
    };
    const ok = await persist(next);
    if (ok) {
      setEditing(null);
      banner.showSuccess("Document label updated.");
    }
  }

  function deleteDocument(role, doc) {
    Alert.alert(
      "Remove requirement",
      `Permanently delete the requirement for "${doc}" from ${role} registrations?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            banner.clear();
            const next = {
              ...roleDocuments,
              [role]: (roleDocuments[role] || []).filter((d) => d !== doc),
            };
            const ok = await persist(next);
            if (ok) banner.showSuccess("Requirement removed.");
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ScreenShell title="Documents Management" refreshing={loading} onRefresh={load}>
        <LoadingCard text="Loading document requirements..." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Documents Management" refreshing={loading} onRefresh={load}>
      <Hero
        icon="folder-open-outline"
        title="Document Configuration Control"
        subtitle="Configure required documentation checklists across system layers."
      />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      {!selectedRole ? (
        <>
          <SectionTitle>Role Checklists</SectionTitle>
          {ROLES.map((role) => {
            const count = (roleDocuments[role] || []).length;
            return (
              <Card key={role}>
                <View style={styles.rowHead}>
                  <View style={[styles.roleBadge, { backgroundColor: palette.tile }]}>
                    <Text style={[styles.roleBadgeText, { color: palette.accentDeep }]}>{role.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: palette.ink }]}>{role} Checklists</Text>
                    <Text style={[styles.sub, { color: palette.inkSoft }]}>{count} required document{count === 1 ? "" : "s"}</Text>
                  </View>
                </View>
                <Divider />
                <ButtonRow>
                  <SmallButton
                    label="Configure"
                    icon="settings-outline"
                    onPress={() => {
                      setSelectedRole(role);
                      setNewDocName("");
                      setEditing(null);
                      banner.clear();
                    }}
                  />
                </ButtonRow>
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <SectionTitle
            right={
              <SmallButton
                label="Back"
                icon="arrow-back-outline"
                onPress={() => {
                  setSelectedRole(null);
                  setEditing(null);
                  setNewDocName("");
                }}
              />
            }
          >
            {selectedRole} Requirements
          </SectionTitle>

          <Card>
            <SectionTitle>Add Required Document</SectionTitle>
            <TextField
              label="Document Label Name"
              value={newDocName}
              onChangeText={setNewDocName}
              placeholder="e.g. Caste Certificate, Passbook"
              hint="Allowed uplinks: .JPG .JPEG .PNG .WEBP .PDF · max 2 MB"
            />
            <PrimaryButton
              icon="add-circle-outline"
              label="Add Required Record Field"
              onPress={addDocument}
              loading={saving}
            />
          </Card>

          <SectionTitle>
            {`${selectedRole} Validation Track (${currentDocs.length})`}
          </SectionTitle>

          {currentDocs.length === 0 ? (
            <Card>
              <Text style={[styles.emptyText, { color: palette.inkSoft }]}>
                No compulsory verification forms initialized. Onboarding users for {selectedRole}{" "}
                currently skip documentation.
              </Text>
            </Card>
          ) : (
            currentDocs.map((doc) => {
              const isEditing = editing && editing.role === selectedRole && editing.doc === doc;
              return (
                <Card key={doc}>
                  {isEditing ? (
                    <View>
                      <TextField
                        label="Document Label Name"
                        value={editing.value}
                        onChangeText={(v) => setEditing((c) => ({ ...c, value: v }))}
                        placeholder="Document label"
                      />
                      <ButtonRow>
                        <SmallButton label="Save" icon="checkmark-outline" onPress={saveEdit} disabled={saving} />
                        <SmallButton label="Cancel" icon="close-outline" onPress={() => setEditing(null)} />
                      </ButtonRow>
                    </View>
                  ) : (
                    <View style={styles.docRow}>
                      <View style={styles.docLeft}>
                        <View style={[styles.docIcon, { backgroundColor: palette.tile }]}>
                          <Text style={[styles.docIconText, { color: palette.inkLabel }]}>DOC</Text>
                        </View>
                        <Text style={[styles.docName, { color: palette.ink }]}>{doc}</Text>
                      </View>
                      <View style={styles.docActions}>
                        <IconButton
                          icon="create-outline"
                          onPress={() => setEditing({ role: selectedRole, doc, value: doc })}
                        />
                        <IconButton icon="trash-outline" tone="danger" onPress={() => deleteDocument(selectedRole, doc)} />
                      </View>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center" },
  roleBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  roleBadgeText: { color: "#4F46E5", fontWeight: "900", fontSize: 16 },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3 },
  emptyText: { color: "#64748B", fontWeight: "700", fontSize: 13, lineHeight: 20, textAlign: "center" },
  docRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  docLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  docIcon: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#EEF2F7",
    marginRight: 10,
  },
  docIconText: { color: "#475569", fontWeight: "900", fontSize: 10 },
  docName: { color: "#0F172A", fontWeight: "800", fontSize: 14, flex: 1 },
  docActions: { flexDirection: "row", alignItems: "center" },
};
