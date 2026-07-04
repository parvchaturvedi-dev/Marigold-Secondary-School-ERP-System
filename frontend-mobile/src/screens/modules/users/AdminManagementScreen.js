// Admin Management — create/delete admin accounts + OTP-gated password reveal.
// Mirrors web Admin/AdminManagement.jsx.
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

import { apiRequest } from "../../../api/apiClient";
import { useTheme } from "../../../theme/ThemeContext";
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
  Toggle,
  useBanner,
} from "../shared/formKit";

const emptyForm = {
  username: "",
  displayName: "",
  email: "",
  mobile: "",
  designation: "Administrator",
  password: "",
  isActive: true,
};

export default function AdminManagementScreen({ user }) {
  const { palette } = useTheme();
  const banner = useBanner();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [otpStage, setOtpStage] = useState({}); // username -> {open, otp, password}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiRequest("/auth/users");
      setUsers(Array.isArray(payload) ? payload : payload?.users || []);
    } catch (err) {
      banner.showError(err);
    } finally {
      setLoading(false);
    }
  }, [banner]);

  useEffect(() => {
    load();
  }, [load]);

  const admins = users.filter((u) => u.role === "admin");
  const updateForm = (field, value) => setForm((c) => ({ ...c, [field]: value }));

  async function createAdmin() {
    if (!form.username.trim() || !form.displayName.trim() || !form.password.trim())
      return banner.showError("Admin ID, display name and password are required.");
    setSaving(true);
    banner.clear();
    try {
      const payload = await apiRequest("/auth/users/admins", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setUsers(payload.users || []);
      setForm(emptyForm);
      banner.showSuccess(payload.message || "Admin created.");
    } catch (err) {
      banner.showError(err);
    } finally {
      setSaving(false);
    }
  }

  function deleteAdmin(target) {
    Alert.alert("Remove admin", `Remove ${target.username} from admin accounts?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const payload = await apiRequest(`/auth/users/${encodeURIComponent(target.username)}`, { method: "DELETE" });
            setUsers(payload.users || []);
            banner.showSuccess(payload.message || "Admin removed.");
          } catch (err) {
            banner.showError(err);
          }
        },
      },
    ]);
  }

  async function requestOtp(target) {
    try {
      const payload = await apiRequest(`/auth/users/${encodeURIComponent(target.username)}/request-password-otp`, {
        method: "POST",
      });
      setOtpStage((c) => ({ ...c, [target.username]: { open: true, otp: "", password: "" } }));
      banner.showSuccess(payload.message || "OTP sent to registered email.");
    } catch (err) {
      banner.showError(err);
    }
  }

  async function revealPassword(target) {
    const stage = otpStage[target.username];
    if (!stage?.otp?.trim()) return;
    try {
      const payload = await apiRequest(`/auth/users/${encodeURIComponent(target.username)}/reveal-password`, {
        method: "POST",
        body: JSON.stringify({ otp: stage.otp }),
      });
      setOtpStage((c) => ({ ...c, [target.username]: { open: true, otp: "", password: payload.password || "Not available" } }));
    } catch (err) {
      banner.showError(err);
    }
  }

  return (
    <ScreenShell title="Admin Management" refreshing={loading} onRefresh={load}>
      <Hero icon="shield-checkmark-outline" title={`${admins.length} admin accounts`} subtitle="Add admin accounts and reveal credentials." />
      <Banner type="error" message={banner.error} />
      <Banner type="success" message={banner.success} />

      <Card>
        <SectionTitle>Add Admin</SectionTitle>
        <TextField label="Admin ID" value={form.username} onChangeText={(v) => updateForm("username", v)} placeholder="ADM-002" autoCapitalize="characters" />
        <TextField label="Display Name" value={form.displayName} onChangeText={(v) => updateForm("displayName", v)} placeholder="Full name" />
        <TextField label="Email" value={form.email} onChangeText={(v) => updateForm("email", v)} placeholder="name@school.com" keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Mobile" value={form.mobile} onChangeText={(v) => updateForm("mobile", v)} placeholder="10-digit mobile" keyboardType="phone-pad" />
        <TextField label="Designation" value={form.designation} onChangeText={(v) => updateForm("designation", v)} placeholder="Administrator" />
        <TextField label="Initial Password" value={form.password} onChangeText={(v) => updateForm("password", v)} placeholder="Minimum 6 characters" />
        <Toggle label="Active account" value={form.isActive} onValueChange={(v) => updateForm("isActive", v)} />
        <PrimaryButton icon="person-add-outline" label="Create Admin" onPress={createAdmin} loading={saving} />
      </Card>

      <SectionTitle>Admin Accounts</SectionTitle>
      {loading ? (
        <LoadingCard text="Loading admins..." />
      ) : (
        admins.map((admin) => {
          const stage = otpStage[admin.username];
          return (
            <Card key={admin.username}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.ink }]}>{admin.displayName || admin.username}</Text>
                  <Text style={[styles.sub, { color: palette.inkSoft }]}>{admin.username} · {admin.email || admin.profile?.email || "No email"}</Text>
                </View>
                <View style={[styles.status, { backgroundColor: admin.isActive === false ? "#FEE2E2" : "#DCFCE7" }]}>
                  <Text style={[styles.statusText, { color: admin.isActive === false ? "#B91C1C" : "#15803D" }]}>
                    {admin.isActive === false ? "Inactive" : "Active"}
                  </Text>
                </View>
              </View>
              <Divider />
              {stage?.password ? (
                <Text style={[styles.password, { color: palette.ink }]}>Initial password: {stage.password}</Text>
              ) : stage?.open ? (
                <View>
                  <TextField
                    label="Enter OTP sent to email"
                    value={stage.otp}
                    onChangeText={(v) => setOtpStage((c) => ({ ...c, [admin.username]: { ...c[admin.username], otp: v } }))}
                    placeholder="6-digit OTP"
                    keyboardType="number-pad"
                  />
                  <SmallButton label="Reveal Password" icon="key-outline" onPress={() => revealPassword(admin)} />
                </View>
              ) : null}
              <ButtonRow>
                <SmallButton label="Reveal Password" icon="eye-outline" onPress={() => requestOtp(admin)} />
                {admin.username !== user?.username && (
                  <View style={{ marginLeft: "auto" }}>
                    <IconButton icon="trash-outline" tone="danger" onPress={() => deleteAdmin(admin)} />
                  </View>
                )}
              </ButtonRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = {
  rowHead: { flexDirection: "row", alignItems: "center" },
  name: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  sub: { color: "#64748B", fontWeight: "700", fontSize: 12, marginTop: 3 },
  status: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontWeight: "900", fontSize: 10, textTransform: "uppercase" },
  password: { color: "#0F172A", fontWeight: "900", fontFamily: "monospace", marginBottom: 6 },
};
