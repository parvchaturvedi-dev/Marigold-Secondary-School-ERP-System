// Clerk Management — view/create/edit/delete clerical staff + document attach.
// Mirrors web Admin/ClerkManagement.jsx exactly (record shape:
//   { id, name, email, mobile, aadharNumber, documentsAttached: [fileName...] }).
// Namespace: "admin-clerk-management-list" (interoperable with the web page).
import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import {
  Banner,
  ButtonRow,
  Card,
  DetailRows,
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

const NAMESPACE = "admin-clerk-management-list";

const emptyForm = { name: "", email: "", mobile: "", aadharNumber: "" };

// Web id scheme: `CLK-2026-${100..999}`
function makeClerkId() {
  return `CLK-2026-${Math.floor(100 + Math.random() * 900)}`;
}

async function pickDocumentNames() {
  const res = await DocumentPicker.getDocumentAsync({
    type: ["image/*", "application/pdf"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return [];
  return res.assets.map((a) => a.name || "file");
}

export default function ClerkManagementScreen({ user }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const { items: clerksList, loading, reload, persist } = useModuleState(NAMESPACE);

  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const updateForm = (field, value) => setForm((c) => ({ ...c, [field]: value }));
  const updateEdit = (field, value) => setEditForm((c) => ({ ...c, [field]: value }));

  const filteredClerks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return clerksList;
    return clerksList.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.id || "").toLowerCase().includes(q)
    );
  }, [clerksList, searchTerm]);

  // ACTION 1: ADD NEW CLERK (mirror handleRegisterClerk)
  async function handleRegisterClerk() {
    if (!form.name.trim() || !form.email.trim() || !form.mobile.trim()) {
      return banner.showError("Name, email and mobile are required.");
    }
    if (!/^\d{12}$/.test(form.aadharNumber)) {
      return banner.showError("Aadhaar requires exactly 12 digits.");
    }
    setSaving(true);
    banner.clear();
    try {
      const newEntity = {
        id: makeClerkId(),
        ...form,
        documentsAttached: attachedFiles.length > 0 ? attachedFiles : ["default_blank.pdf"],
      };
      await persist([newEntity, ...clerksList]);
      setForm(emptyForm);
      setAttachedFiles([]);
      setCreating(false);
      banner.showSuccess("Clerk registered successfully!");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  // ACTION 2: OPEN EDIT (mirror handleOpenEdit)
  function handleOpenEdit(clerk) {
    setEditingId(clerk.id);
    setEditForm({ ...clerk, documentsAttached: [...(clerk.documentsAttached || [])] });
    setCreating(false);
    banner.clear();
  }

  // ACTION 3: UPDATE CLERK (mirror handleUpdateClerk)
  async function handleUpdateClerk() {
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.mobile.trim()) {
      return banner.showError("Name, email and mobile are required.");
    }
    if (!/^\d{12}$/.test(editForm.aadharNumber)) {
      return banner.showError("Aadhaar requires exactly 12 digits.");
    }
    setSaving(true);
    banner.clear();
    try {
      await persist(clerksList.map((c) => (c.id === editForm.id ? editForm : c)));
      setEditingId(null);
      setEditForm(null);
      banner.showSuccess("Clerk records updated successfully!");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  // ACTION 4: REMOVE CLERK (mirror handleRemoveClerk)
  function handleRemoveClerk(clerk) {
    Alert.alert("Remove clerk", `Are you sure you want to completely remove ${clerk.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await persist(clerksList.filter((c) => c.id !== clerk.id));
            if (editingId === clerk.id) {
              setEditingId(null);
              setEditForm(null);
            }
            banner.showSuccess("Clerk removed.");
          } catch (err) {
            banner.showError(err);
          }
        },
      },
    ]);
  }

  async function attachToNew() {
    try {
      const names = await pickDocumentNames();
      if (names.length) setAttachedFiles((c) => [...c, ...names]);
    } catch (err) {
      banner.showError(err);
    }
  }

  async function attachToEdit() {
    try {
      const names = await pickDocumentNames();
      if (names.length) {
        setEditForm((c) => ({ ...c, documentsAttached: [...(c.documentsAttached || []), ...names] }));
      }
    } catch (err) {
      banner.showError(err);
    }
  }

  return (
    <ScreenShell title="Clerk Management" refreshing={loading} onRefresh={reload}>
      <Hero
        icon="people-outline"
        title={`${clerksList.length} clerical staff`}
        subtitle="Manage admin staff, credentials and directory records."
      />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Card>
        <SectionTitle
          right={
            <SmallButton
              label={creating ? "Close" : "Add Clerk"}
              icon={creating ? "close-outline" : "add-outline"}
              onPress={() => {
                setCreating((v) => !v);
                setEditingId(null);
                setEditForm(null);
                banner.clear();
              }}
            />
          }
        >
          Clerical Staff Directory
        </SectionTitle>
        <TextField
          label="Search"
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search Name or ID..."
          autoCapitalize="none"
        />

        {creating && (
          <View>
            <Divider />
            <SectionTitle>Onboard Clerk Staff</SectionTitle>
            <TextField
              label="Clerk Full Name *"
              value={form.name}
              onChangeText={(v) => updateForm("name", v)}
              placeholder="e.g. Mukesh Kumar"
            />
            <TextField
              label="Official Email Address *"
              value={form.email}
              onChangeText={(v) => updateForm("email", v)}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextField
              label="Mobile Number *"
              value={form.mobile}
              onChangeText={(v) => updateForm("mobile", v)}
              placeholder="10 digit phone"
              keyboardType="phone-pad"
            />
            <TextField
              label="Aadhaar Number *"
              value={form.aadharNumber}
              onChangeText={(v) => updateForm("aadharNumber", v)}
              placeholder="12 digit card indices"
              keyboardType="number-pad"
              maxLength={12}
            />
            <SmallButton label="Upload Credentials Packet" icon="cloud-upload-outline" onPress={attachToNew} />
            {attachedFiles.length > 0 && (
              <DetailRows rows={[["Attached", attachedFiles]]} />
            )}
            <PrimaryButton
              icon="person-add-outline"
              label="Onboard Clerk Staff"
              onPress={handleRegisterClerk}
              loading={saving}
            />
          </View>
        )}
      </Card>

      <SectionTitle>Clerk Accounts</SectionTitle>
      {loading ? (
        <LoadingCard text="Loading clerks..." />
      ) : filteredClerks.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No clerks found"
          text={searchTerm ? "No records match your search." : "Add your first clerk to get started."}
        />
      ) : (
        filteredClerks.map((clerk) => {
          const isEditing = editingId === clerk.id && editForm;
          return (
            <Card key={clerk.id}>
              <View style={styles.rowHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(clerk.name || "C").charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.idTag, { color: palette.inkSoft }]}>{clerk.id}</Text>
                  <Text style={[styles.name, { color: palette.ink }]}>{clerk.name}</Text>
                </View>
              </View>
              <Divider />

              {isEditing ? (
                <View>
                  <SectionTitle>Amend Clerk Records</SectionTitle>
                  <TextField
                    label="Clerk Full Name *"
                    value={editForm.name}
                    onChangeText={(v) => updateEdit("name", v)}
                    placeholder="e.g. Mukesh Kumar"
                  />
                  <TextField
                    label="Official Email Address *"
                    value={editForm.email}
                    onChangeText={(v) => updateEdit("email", v)}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextField
                    label="Mobile Number *"
                    value={editForm.mobile}
                    onChangeText={(v) => updateEdit("mobile", v)}
                    placeholder="10 digit phone"
                    keyboardType="phone-pad"
                  />
                  <TextField
                    label="Aadhaar Number *"
                    value={editForm.aadharNumber}
                    onChangeText={(v) => updateEdit("aadharNumber", v)}
                    placeholder="12 digit card indices"
                    keyboardType="number-pad"
                    maxLength={12}
                  />
                  <SmallButton label="Attach More Documents" icon="cloud-upload-outline" onPress={attachToEdit} />
                  <DetailRows rows={[["Documents", editForm.documentsAttached]]} />
                  <ButtonRow>
                    <PrimaryButton
                      icon="save-outline"
                      label="Update Database"
                      onPress={handleUpdateClerk}
                      loading={saving}
                    />
                    <SmallButton
                      label="Cancel"
                      icon="close-outline"
                      onPress={() => {
                        setEditingId(null);
                        setEditForm(null);
                      }}
                    />
                  </ButtonRow>
                </View>
              ) : (
                <View>
                  <DetailRows
                    rows={[
                      ["Email", clerk.email],
                      ["Mobile", clerk.mobile],
                      ["Aadhaar", clerk.aadharNumber],
                      ["Documents", clerk.documentsAttached],
                    ]}
                  />
                  <ButtonRow>
                    <SmallButton label="Edit Details" icon="create-outline" onPress={() => handleOpenEdit(clerk)} />
                    <View style={{ marginLeft: "auto" }}>
                      <IconButton icon="trash-outline" tone="danger" onPress={() => handleRemoveClerk(clerk)} />
                    </View>
                  </ButtonRow>
                </View>
              )}
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#4F46E5", fontWeight: "900", fontSize: 18 },
  idTag: { color: "#64748B", fontWeight: "900", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900", marginTop: 2 },
};
